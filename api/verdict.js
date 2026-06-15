module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(200).json({ verdict: null });
  }

  try {
    const { listing = {}, suburbMedianPrice } = req.body;

    const priceDiff = suburbMedianPrice != null
      ? Math.abs(listing.price - suburbMedianPrice)
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

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return res.status(200).json({ verdict: null });
    }

    const result = await response.json();
    const verdict = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    return res.status(200).json({ verdict });
  } catch (err) {
    console.error('Verdict API error:', err);
    return res.status(200).json({ verdict: null });
  }
};
