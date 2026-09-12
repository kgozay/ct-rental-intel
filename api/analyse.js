const { SUBURBS } = require('./suburbs');
const VALID_SUBURBS = new Set(SUBURBS.map(s => s.name));

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;

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

function generateFallbackAnalysis(parsedStats, context, totalListings, priceChangesCount, goodValueCount, maxPriceText, safeSuburb) {
  // Identify cheapest and most expensive suburbs from parsedStats
  const suburbsList = Object.keys(parsedStats);
  if (suburbsList.length === 0) {
    const emptyText = `Currently, there are no active listings matching your search filter (${maxPriceText}, suburbs: ${safeSuburb}). To see market intelligence, try broadening your suburb selection or increasing the maximum price cap.`;
    return {
      report: emptyText,
      structured: {
        sentiment: 'balanced',
        sentimentLabel: 'Neutral Market',
        headline: `No active listings matching ${maxPriceText} in ${safeSuburb}`,
        bargainSuburbs: [],
        actionableAdvice: ['Broaden your price range or select additional suburbs.']
      }
    };
  }

  // Sort by overallMedianPrice
  const sortedByPrice = [...suburbsList].sort((a, b) => (parsedStats[a].overallMedianPrice || 0) - (parsedStats[b].overallMedianPrice || 0));
  const cheapestSuburb = sortedByPrice[0];
  const premiumSuburb = sortedByPrice[sortedByPrice.length - 1];

  const cheapStats = parsedStats[cheapestSuburb] || {};
  const premStats = parsedStats[premiumSuburb] || {};

  // Best value suburb by goodValueCount
  const sortedByValue = [...suburbsList].sort((a, b) => (parsedStats[b].goodValueCount || 0) - (parsedStats[a].goodValueCount || 0));
  const bestValueSub = sortedByValue[0] || cheapestSuburb;

  // Find 1-bed medians
  const c1Bed = cheapStats.medianPriceByBedrooms?.['1'] || cheapStats.overallMedianPrice;
  const p1Bed = premStats.medianPriceByBedrooms?.['1'] || premStats.overallMedianPrice;

  let comparisonText = '';
  if (typeof c1Bed === 'number' && typeof p1Bed === 'number' && p1Bed > 0) {
    const oneBedDiff = Math.round(((p1Bed - c1Bed) / p1Bed) * 100);
    comparisonText = ` Specifically, 1-bedroom units in **${cheapestSuburb}** (median **R ${c1Bed.toLocaleString('en-ZA')}**) reflect a **${oneBedDiff}%** lower monthly cost compared to **${premiumSuburb}** (median **R ${p1Bed.toLocaleString('en-ZA')}**).`;
  }

  const discountPercent = cheapStats.overallMedianPrice && premStats.overallMedianPrice && premStats.overallMedianPrice > 0
    ? Math.round((1 - cheapStats.overallMedianPrice / premStats.overallMedianPrice) * 100)
    : 0;

  const furnishingText = (typeof premStats.furnishedPercent === 'number' && typeof cheapStats.furnishedPercent === 'number')
    ? `Furnishing breakdown shows **${premStats.furnishedPercent}%** furnished listings in **${premiumSuburb}** versus **${cheapStats.furnishedPercent}%** in **${cheapestSuburb}**.`
    : `Furnishing data is recorded where specified by agencies.`;

  const report = `**${cheapestSuburb}** and **${bestValueSub}** deliver the lowest rental medians within the active **${maxPriceText}** parameter. In **${cheapestSuburb}**, the overall median rent is **R ${cheapStats.overallMedianPrice ? cheapStats.overallMedianPrice.toLocaleString('en-ZA') : '—'}**, comparing favorably with **${premiumSuburb}** (median **R ${premStats.overallMedianPrice ? premStats.overallMedianPrice.toLocaleString('en-ZA') : '—'}**).${comparisonText}

Market supply in this selection is distributed across **${totalListings} active listings**, with **${goodValueCount} listings** qualifying as Good Value or Potential Value based on local median R/m² benchmarks. ${furnishingText} A total of **${priceChangesCount} listings with price reductions** were identified, highlighting opportunities for active tenant negotiation.

Strategic Recommendation: Prioritize listings in **${bestValueSub}** displaying positive value scores to optimize living space per Rand. In higher-demand suburbs such as **${premiumSuburb}**, review availability dates and recent price adjustments closely to maximize bargaining power.`;

  const sentiment = goodValueCount >= Math.max(1, Math.floor(totalListings * 0.2)) ? 'tenant_favored' : 'balanced';

  return {
    report,
    structured: {
      sentiment,
      sentimentLabel: sentiment === 'tenant_favored' ? 'Tenant-Favored Selection' : 'Balanced Market Selection',
      headline: `${bestValueSub} & ${cheapestSuburb} lead value within ${maxPriceText}`,
      bargainSuburbs: [
        {
          suburb: cheapestSuburb,
          discount: discountPercent > 0 ? `${discountPercent}% lower` : 'Lowest median',
          detail: `Median R${cheapStats.overallMedianPrice?.toLocaleString('en-ZA') || '—'}/mo vs R${premStats.overallMedianPrice?.toLocaleString('en-ZA') || '—'} in ${premiumSuburb}`
        },
        {
          suburb: bestValueSub,
          discount: `${parsedStats[bestValueSub]?.goodValueCount || goodValueCount} value picks`,
          detail: `Substantial density of listings priced below suburb median R/m²`
        }
      ],
      actionableAdvice: [
        `Prioritize listings in ${bestValueSub} with positive value scores to maximize space per Rand.`,
        `Examine unfurnished versus furnished options in ${premiumSuburb} depending on lease duration.`,
        priceChangesCount > 0
          ? `Review ${priceChangesCount} discounted listings for increased negotiation leverage.`
          : `Monitor new listings regularly to catch competitive rentals early.`
      ]
    }
  };
}

module.exports = async function handler(req, res) {
  // Enforce POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (isRateLimited(req)) {
    return res.status(429).json({ error: "Rate limit exceeded. Please wait a minute before generating new analysis." });
  }

  try {
    const rawListings = Array.isArray(req.body?.listings) ? req.body.listings : [];
    const listings = rawListings.slice(0, 150); // Cap payload size
    const context = req.body?.context || {};
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    // 1. Calculate detailed aggregates (bedroom medians, furnishing ratio) for Gemini
    const suburbStats = {};
    const totalListings = listings.length;
    const priceChangesCount = listings.filter(l => l.previous_price && l.price < l.previous_price).length;
    const goodValueCount = listings.filter(l => l.value_score > 1.15).length;
    
    listings.forEach(l => {
      if (!suburbStats[l.suburb]) {
        suburbStats[l.suburb] = {
          count: 0,
          prices: [],
          goodValue: 0,
          furnished: 0,
          unfurnished: 0,
          beds: {}
        };
      }
      suburbStats[l.suburb].count++;
      if (typeof l.price === 'number') {
        suburbStats[l.suburb].prices.push(l.price);
      }
      if (l.value_score > 1.15) {
        suburbStats[l.suburb].goodValue++;
      }
      if (l.furnished === true) suburbStats[l.suburb].furnished++;
      if (l.furnished === false) suburbStats[l.suburb].unfurnished++;
      
      const roundedBeds = l.bedrooms !== null && l.bedrooms !== undefined ? String(l.bedrooms) : 'other';
      if (!suburbStats[l.suburb].beds[roundedBeds]) {
        suburbStats[l.suburb].beds[roundedBeds] = [];
      }
      if (typeof l.price === 'number') {
        suburbStats[l.suburb].beds[roundedBeds].push(l.price);
      }
    });

    const parsedStats = {};
    for (const sub in suburbStats) {
      const prices = suburbStats[sub].prices.sort((a, b) => a - b);
      if (prices.length === 0) continue;
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 !== 0 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
      
      const bedMedians = {};
      for (const b in suburbStats[sub].beds) {
        const bPrices = suburbStats[sub].beds[b].sort((a, b) => a - b);
        if (bPrices.length > 0) {
          const bMid = Math.floor(bPrices.length / 2);
          bedMedians[b] = bPrices.length % 2 !== 0 ? bPrices[bMid] : Math.round((bPrices[bMid - 1] + bPrices[bMid]) / 2);
        } else {
          bedMedians[b] = 'N/A';
        }
      }
      
      parsedStats[sub] = {
        totalListingsCount: suburbStats[sub].count,
        overallMedianPrice: median,
        priceMin: prices[0],
        priceMax: prices[prices.length - 1],
        goodValueCount: suburbStats[sub].goodValue,
        furnishedPercent: suburbStats[sub].count > 0 ? Math.round((suburbStats[sub].furnished / suburbStats[sub].count) * 100) : 0,
        medianPriceByBedrooms: bedMedians
      };
    }

    // Sanitize context fields
    const rawMaxPrice = parseInt(context.maxPrice, 10);
    const maxPriceText = (!isNaN(rawMaxPrice) && rawMaxPrice > 0) ? `R${rawMaxPrice.toLocaleString('en-ZA')}` : 'Any';

    let safeSuburb = 'All';
    if (context.suburb) {
      const allowed = String(context.suburb).split(',').map(s => s.trim()).filter(s => VALID_SUBURBS.has(s));
      safeSuburb = allowed.length > 0 ? allowed.join(', ') : 'All';
    }
    const rawMinBeds = parseInt(context.minBeds, 10);
    const safeMinBeds = (!isNaN(rawMinBeds) && rawMinBeds >= 0) ? rawMinBeds : null;

    const fallbackData = generateFallbackAnalysis(parsedStats, context, totalListings, priceChangesCount, goodValueCount, maxPriceText, safeSuburb);

    // Fallback if no API key is provided
    if (!GEMINI_KEY) {
      return res.status(200).json({
        analysis: fallbackData.report,
        structured: fallbackData.structured,
        generatedAt: new Date().toISOString(),
        fallback: true
      });
    }

    const now = new Date();
    const currentDateFormatted = now.toLocaleDateString('en-ZA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const currentMonthYear = now.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });

    const systemPrompt = `You are a senior residential property analyst specializing in Cape Town's Atlantic Seaboard, City Bowl, and Southern Suburbs.
Current Real-World Date: ${currentDateFormatted} (Current Month & Year: ${currentMonthYear}).
CRITICAL TEMPORAL AWARENESS: Today is in ${currentMonthYear}. All market insights, seasonal trends, and rental availability timelines MUST be evaluated strictly from the perspective of ${currentMonthYear}. Never refer to 2024 or 2025 as the present year. Listings available in past months of ${now.getFullYear()} are available immediately.

Write a highly insightful, professional, and data-driven market report based on the provided listing stats.
Respond STRICTLY with a valid JSON object matching this schema:
{
  "sentiment": "tenant_favored" | "balanced" | "landlord_favored",
  "sentimentLabel": "Tenant-Favored" | "Balanced Market" | "Landlord-Favored",
  "headline": "Short 1-sentence analytical headline summarizing value opportunities",
  "bargainSuburbs": [
    { "suburb": "Suburb Name", "discount": "Estimated percentage or value edge", "detail": "Specific pricing anomaly reason" }
  ],
  "actionableAdvice": [
    "Tactical tip 1 with specific numbers/suburbs",
    "Tactical tip 2 with specific numbers/suburbs",
    "Tactical tip 3 with specific numbers/suburbs"
  ],
  "report": "Three paragraphs of detailed markdown analysis. Paragraph 1 on value & budget optimization; Paragraph 2 on supply, furnishing & market dynamics; Paragraph 3 on strategic recommendations. Use bold text for numbers and suburb names to make it scannable. Do not use headings or bullet lists inside the report field."
}`;

    const prompt = `Report Date: ${currentDateFormatted} (${currentMonthYear})
Here is the current aggregated listing data:
- Total active listings: ${totalListings}
- Price drops: ${priceChangesCount}
- Good value listings (score > 1.15): ${goodValueCount}
- User Search Context:
  - Max Price: ${maxPriceText}
  - Suburbs active: ${safeSuburb}
  - Min Bedrooms: ${safeMinBeds !== null ? safeMinBeds : 'Any'}

Detailed Suburb Aggregates:
${JSON.stringify(parsedStats, null, 2)}

Return pure JSON conforming to the requested schema.`;

    // REST call to Google Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    try {
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
      });

      if (response.ok) {
        const result = await response.json();
        let rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText && rawText.trim()) {
          try {
            const clean = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
            const parsed = JSON.parse(clean);
            return res.status(200).json({
              analysis: parsed.report || rawText.trim(),
              structured: {
                sentiment: parsed.sentiment || fallbackData.structured.sentiment,
                sentimentLabel: parsed.sentimentLabel || fallbackData.structured.sentimentLabel,
                headline: parsed.headline || fallbackData.structured.headline,
                bargainSuburbs: Array.isArray(parsed.bargainSuburbs) ? parsed.bargainSuburbs : fallbackData.structured.bargainSuburbs,
                actionableAdvice: Array.isArray(parsed.actionableAdvice) ? parsed.actionableAdvice : fallbackData.structured.actionableAdvice
              },
              generatedAt: new Date().toISOString()
            });
          } catch {
            return res.status(200).json({
              analysis: rawText.trim(),
              structured: fallbackData.structured,
              generatedAt: new Date().toISOString()
            });
          }
        }
      }
    } catch (apiErr) {
      console.warn("Gemini API call failed, using heuristic analysis fallback:", apiErr.message);
    }

    // Fallback if Gemini call failed
    return res.status(200).json({
      analysis: fallbackData.report,
      structured: fallbackData.structured,
      generatedAt: new Date().toISOString(),
      fallback: true
    });

  } catch (err) {
    console.error("AI Analysis endpoint error:", err);
    return res.status(500).json({ error: err.message });
  }
};
