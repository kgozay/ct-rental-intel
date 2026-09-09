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

  const todayIso = new Date().toISOString().split('T')[0];
  const isImmediate = !listing.available_date || listing.available_date <= todayIso;
  const availComment = isImmediate
    ? ' Ready for immediate occupation.'
    : ` Available for occupation from ${listing.available_date}.`;

  return `${priceComment}${detailComment}${availComment}`.trim();
}

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

function isRateLimited(req) {
  const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || 'local';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => t > windowStart);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

function sanitizeText(str, maxLen = 80) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLen).replace(/[\r\n`]/g, ' ').trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (isRateLimited(req)) {
    return res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
  }

  try {
    const rawListing = req.body?.listing || {};
    const listing = {
      ...rawListing,
      suburb: sanitizeText(rawListing.suburb, 50),
      address: sanitizeText(rawListing.address, 100),
      agency_name: sanitizeText(rawListing.agency_name, 60)
    };
    const suburbMedianPrice = typeof req.body?.suburbMedianPrice === 'number' ? req.body.suburbMedianPrice : null;
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

    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];
    const currentMonthYear = now.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });

    const isImmediate = !listing.available_date || listing.available_date <= todayIso;
    const availText = isImmediate
      ? `Available immediately (ready for immediate occupation as of ${currentMonthYear})`
      : `Available from ${listing.available_date}`;

    const listingContext = [
      `Suburb: ${listing.suburb}`,
      `Price: R${(listing.price || 0).toLocaleString('en-ZA')}/mo`,
      suburbMedianPrice != null ? `Suburb median: R${suburbMedianPrice.toLocaleString('en-ZA')}/mo` : null,
      priceDiff != null && direction !== 'at' ? `Priced R${priceDiff.toLocaleString('en-ZA')} ${direction} suburb median` : null,
      listing.bedrooms != null ? `Bedrooms: ${listing.bedrooms}` : null,
      listing.size_m2 ? `Size: ${listing.size_m2}m²` : null,
      listing.price_per_m2 ? `R/m²: ${listing.price_per_m2}` : null,
      listing.furnished === true ? 'Furnished' : listing.furnished === false ? 'Unfurnished' : null,
      availText,
      listing.previous_price && listing.price < listing.previous_price
        ? `Price dropped from R${listing.previous_price.toLocaleString('en-ZA')}`
        : null,
    ].filter(Boolean).join(' · ');

    const prompt = `Today's Date: ${todayIso} (${currentMonthYear}).
You are a Cape Town rental analyst evaluating a listing today in ${currentMonthYear}.
Write exactly 1–2 complete sentences providing a tenant with a clear, concise, and honest verdict on this listing relative to today (${currentMonthYear}).
Mention price relative to the suburb median (use percentage if meaningful), size efficiency or value, furnishing, and occupation availability (note: if listed as immediate or with a past date in ${now.getFullYear()}, it is available immediately).
Be specific and direct — no filler phrases like "it's worth noting" or "in conclusion". Do not truncate the sentences.
Listing data: ${listingContext}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 }
      },
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
        const candidate = result.candidates?.[0];
        const verdict = candidate?.content?.parts?.[0]?.text?.trim();
        const finishReason = candidate?.finishReason;

        // Ensure verdict is complete, not cut off by max tokens, and sufficiently informative
        if (verdict && verdict.length >= 25 && finishReason !== 'MAX_TOKENS') {
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
