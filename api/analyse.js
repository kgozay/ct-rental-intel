const { SUBURBS } = require('./suburbs');
const VALID_SUBURBS = new Set(SUBURBS.map(s => s.name));

module.exports = async function handler(req, res) {
  // Enforce POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { listings = [], context = {} } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    // 1. Calculate detailed aggregates (bedroom medians, furnishing ratio) for Gemini
    const suburbStats = {};
    let totalListings = listings.length;
    let priceChangesCount = listings.filter(l => l.previous_price && l.price < l.previous_price).length;
    let goodValueCount = listings.filter(l => l.value_score > 1.15).length;
    
    listings.forEach(l => {
      if (!suburbStats[l.suburb]) {
        suburbStats[l.suburb] = {
          count: 0,
          prices: [],
          goodValue: 0,
          furnished: 0,
          unfurnished: 0,
          beds: { 0.5: [], 1: [], 2: [], 3: [] }
        };
      }
      suburbStats[l.suburb].count++;
      suburbStats[l.suburb].prices.push(l.price);
      if (l.value_score > 1.15) {
        suburbStats[l.suburb].goodValue++;
      }
      if (l.furnished === true) suburbStats[l.suburb].furnished++;
      if (l.furnished === false) suburbStats[l.suburb].unfurnished++;
      
      const roundedBeds = l.bedrooms !== null ? l.bedrooms : null;
      if (roundedBeds !== null && suburbStats[l.suburb].beds[roundedBeds] !== undefined) {
        suburbStats[l.suburb].beds[roundedBeds].push(l.price);
      }
    });

    const parsedStats = {};
    for (const sub in suburbStats) {
      const prices = suburbStats[sub].prices.sort((a,b) => a-b);
      if (prices.length === 0) continue;
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 !== 0 ? prices[mid] : Math.round((prices[mid-1] + prices[mid])/2);
      
      const bedMedians = {};
      for (const b in suburbStats[sub].beds) {
        const bPrices = suburbStats[sub].beds[b].sort((a,b) => a-b);
        if (bPrices.length > 0) {
          const bMid = Math.floor(bPrices.length / 2);
          bedMedians[b] = bPrices.length % 2 !== 0 ? bPrices[bMid] : Math.round((bPrices[bMid-1] + bPrices[bMid])/2);
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

    // Sanitize context fields — validate suburbs against whitelist, coerce numerics.
    // This prevents prompt injection via crafted context values.
    const rawMaxPrice = parseInt(context.maxPrice, 10);
    const maxPriceText = (!isNaN(rawMaxPrice) && rawMaxPrice > 0) ? `R${rawMaxPrice.toLocaleString('en-ZA')}` : 'Any';

    let safeSuburb = 'All';
    if (context.suburb) {
      const allowed = String(context.suburb).split(',').map(s => s.trim()).filter(s => VALID_SUBURBS.has(s));
      safeSuburb = allowed.length > 0 ? allowed.join(', ') : 'All';
    }
    const rawMinBeds = parseInt(context.minBeds, 10);
    const safeMinBeds = (!isNaN(rawMinBeds) && rawMinBeds >= 0) ? rawMinBeds : null;

    const systemPrompt = `You are a senior residential property analyst specializing in Cape Town's Atlantic Seaboard, City Bowl, and Southern Suburbs. 
Write a highly insightful, professional, and data-driven market report based on the provided listing stats. 

Your report must be structured in exactly three paragraphs:
1. **Value & Budget Optimization**: Analyze which suburbs or specific bedroom configurations offer the best value relative to the user's budget. Identify specific pricing anomalies (e.g. where a larger configuration or a premium suburb is priced surprisingly close to a cheaper one).
2. **Supply, Furnishing & Market Dynamics**: Analyze the supply distributions, furnishing ratios, and configuration patterns across suburbs. Explain what these numbers suggest about landlord pricing power and tenant profiles (e.g., student density in Claremont, short-term let focus in De Waterkant, or long-term family rentals in Sea Point).
3. **Strategic Recommendations**: Provide concrete, actionable tactics for a prospective tenant searching in these markets, mentioning specific numbers, price points, and suburbs to target.

Use bold text for suburb names, prices, and statistics to make the analysis immediately scannable. Do not use headings, markdown bullet lists, or generic advice. Be concrete, analytical, and highly structured.`;

    const prompt = `Here is the current aggregated listing data:
- Total active listings: ${totalListings}
- Price drops: ${priceChangesCount}
- Good value listings (score > 1.15): ${goodValueCount}
- User Search Context:
  - Max Price: ${maxPriceText}
  - Suburbs active: ${safeSuburb}
  - Min Bedrooms: ${safeMinBeds !== null ? safeMinBeds : 'Any'}

Detailed Suburb Aggregates:
${JSON.stringify(parsedStats, null, 2)}

Please write the analysis based on this data. Use bold text for numbers and suburb names to make it scannable. Do not use headings or bullet lists.`;

    // 2. If no API key is set, return a mock response for UI testing
    if (!GEMINI_KEY) {
      console.warn("GEMINI_API_KEY not found. Returning mockup analysis.");
      const mockAnalysis = `**Gardens** and **Woodstock** deliver the strongest value at a **${maxPriceText}** budget. In **Gardens**, the 1-bedroom median sits at **R14 500**, undercutting **Green Point** (median **R21 000**) and **De Waterkant** (median **R23 000**) substantially. Furthermore, a pricing anomaly exists in **Woodstock** where 2-bedroom units (median **R12 000**) are priced exceptionally close to 1-bedroom apartments, signaling an opportunity for budget hunters to upgrade sizes at minor premium.
      
      Supply is highly concentrated in **Sea Point** (overall median **R19 200**) and **Green Point** with a high concentration of furnished listings (**58%** and **62%** respectively), reflecting corporate-relocation and digital nomad demand. In contrast, **Claremont** displays an **88%** unfurnished profile with lower median prices, tailored to the local student and medical professional demographic where tenancy is stable and long-term.
      
      Recommendation: prioritize **Gardens** for space-to-cost optimization, targeting 1-bedroom units below **R15 000**. If searching in **Sea Point**, focus on unfurnished options to bypass the transient premium, and cross-reference the **${goodValueCount}** high value-score listings on the map dashboard to find deals beating local averages by **15%** or more.`;
      
      return res.status(200).json({
        analysis: mockAnalysis,
        generatedAt: new Date().toISOString(),
        mocked: true
      });
    }

    // 3. Make REST call to Google Gemini API
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
        maxOutputTokens: 4096
      }
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.statusText} (${errText})`);
    }

    const result = await response.json();
    let analysis = '';
    
    if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
      analysis = result.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Invalid response structure from Gemini API");
    }

    return res.status(200).json({
      analysis: analysis,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error("AI Analysis failed:", err);
    return res.status(500).json({ error: err.message });
  }
};
