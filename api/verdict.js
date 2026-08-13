function generateHeuristicVerdict(listing, suburbMedianPrice) {
  const price = listing.price || 0;
  const suburb = listing.suburb || 'this area';
  const delta = suburbMedianPrice != null ? suburbMedianPrice - price : null;
  const absDelta = delta != null ? Math.abs(delta) : null;
  
  let priceComment;
  if (delta != null && absDelta > 0) {
    const pct = Math.round((absDelta / suburbMedianPrice) * 100);
    if (delta > 0) {
      priceComment = `Priced R${absDelta.toLocaleString('en-ZA')} (${pct}%) below the ${suburb} median (R${suburbMedianPrice.toLocaleString('en-ZA')}/mo), offering exceptional value for renters.`;
    } else {
      priceComment = `Priced R${absDelta.toLocaleString('en-ZA')} (${pct}%) above the ${suburb} median (R${suburbMedianPrice.toLocaleString('en-ZA')}/mo), placing it in the premium tier.`;
    }
  } else if (suburbMedianPrice != null) {
    priceComment = `Priced right at the ${suburb} median of R${suburbMedianPrice.toLocaleString('en-ZA')}/mo.`;
  } else {
    priceComment = `Listed at R${price.toLocaleString('en-ZA')}/mo in ${suburb}.`;
  }

  let detailComment = '';
  if (listing.price_per_m2 && listing.size_m2) {
    detailComment = ` Features ${listing.size_m2}m² of floor space at R${listing.price_per_m2}/m² with ${listing.furnished ? 'furnished' : 'unfurnished'} finishes.`;
  } else if (listing.bedrooms != null) {
    detailComment = ` Offers a ${listing.bedrooms}-bedroom layout with ${listing.furnished ? 'furnished' : 'unfurnished'} interior.`;
  }

  const availComment = listing.available_date
    ? ` Available for occupation from ${listing.available_date}.`
    : ' Ready for immediate occupation.';

  return `${priceComment}${detailComment}${availComment}`.trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { listing = {}, suburbMedianPrice } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_KEY) {
      const verdict = generateHeuristicVerdict(listing, suburbMedianPrice);
      return res.status(200).json({ verdict, fallback: true });
    }

    const priceDiff = suburbMedianPrice != null
      ? Math.abs((listing.price || 0) - suburbMedianPrice)
      : null;
    const direction = suburbMedianPrice != null
      ? (listing.price < suburbMedianPrice ? 'below' : listing.price > suburbMedianPrice ? 'above' : 'at')
      : null;

    const listingContext = [
      `Suburb: ${listing.suburb}`,
      `Price: R${(listing.price || 0).toLocaleString('en-ZA')}/mo`,
      suburbMedianPrice != null ? `Suburb median: R${suburbMedianPrice.toLocaleString('en-ZA')}/mo` : null,
      priceDiff != null && direction !== 'at' ? `Priced R${priceDiff.toLocaleString('en-ZA')} ${direction} suburb median` : null,
      listing.bedrooms != null ? `Bedrooms: ${listing.bedrooms}` : null,
      listing.size_m2 ? `Size: ${listing.size_m2}m²` : null,
      listing.price_per_m2 ? `R/m²: ${listing.price_per_m2}` : null,
      listing.furnished === true ? 'Furnished' : listing.furnished === false ? 'Unfurnished' : null,
      listing.available_date ? `Available: ${listing.available_date}` : 'Available: now',
      listing.previous_price && listing.price < listing.previous_price
        ? `Price dropped from R${listing.previous_price.toLocaleString('en-ZA')}`
        : null,
    ].filter(Boolean).join(' · ');

    const prompt = `You are a Cape Town rental analyst. Write exactly 1–2 sentences that give a prospective tenant a clear, honest verdict on this listing. Mention price relative to the suburb median (use percentage if meaningful), size efficiency or value, furnishing, and availability timing. Be specific and direct — no filler phrases like "it's worth noting" or "in conclusion". Listing data: ${listingContext}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 120 },
    };

    try {
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const result = await response.json();
        const verdict = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (verdict) {
          return res.status(200).json({ verdict });
        }
      }
    } catch (apiErr) {
      console.warn("Verdict Gemini API call timed out or failed:", apiErr.message);
    }

    const fallbackVerdict = generateHeuristicVerdict(listing, suburbMedianPrice);
    return res.status(200).json({ verdict: fallbackVerdict, fallback: true });

  } catch (err) {
    console.error('Verdict API error:', err);
    return res.status(200).json({ verdict: null });
  }
};
