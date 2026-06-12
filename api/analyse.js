module.exports = async function handler(req, res) {
  // Enforce POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { listings = [], context = {} } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    // 1. Calculate aggregates to send a small, concise prompt to Gemini
    const suburbStats = {};
    let totalListings = listings.length;
    let priceChangesCount = listings.filter(l => l.previous_price && l.price < l.previous_price).length;
    let goodValueCount = listings.filter(l => l.value_score > 1.15).length;
    
    listings.forEach(l => {
      if (!suburbStats[l.suburb]) {
        suburbStats[l.suburb] = {
          count: 0,
          prices: [],
          goodValue: 0
        };
      }
      suburbStats[l.suburb].count++;
      suburbStats[l.suburb].prices.push(l.price);
      if (l.value_score > 1.15) {
        suburbStats[l.suburb].goodValue++;
      }
    });

    const parsedStats = {};
    for (const sub in suburbStats) {
      const prices = suburbStats[sub].prices.sort((a,b) => a-b);
      if (prices.length === 0) continue;
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 !== 0 ? prices[mid] : Math.round((prices[mid-1] + prices[mid])/2);
      
      parsedStats[sub] = {
        count: suburbStats[sub].count,
        medianPrice: median,
        minPrice: prices[0],
        maxPrice: prices[prices.length - 1],
        goodValueCount: suburbStats[sub].goodValue
      };
    }

    const maxPriceText = context.maxPrice ? `R${parseInt(context.maxPrice, 10).toLocaleString('en-ZA')}` : 'Any';

    const systemPrompt = `You are a Cape Town residential property analyst. Respond in plain English, in exactly 3 short paragraphs. 
Paragraph 1: which suburb gives best value at the stated budget and why. 
Paragraph 2: any notable supply or pricing patterns across the suburbs. 
Paragraph 3: a specific recommendation. 
Be concrete — use actual numbers from the data. The covered suburbs are De Waterkant, Green Point, Gardens, Sea Point, Woodstock, Claremont, and Cape Town CBD.`;

    const prompt = `Here is the current aggregated listing data:
- Total active listings: ${totalListings}
- Price drops: ${priceChangesCount}
- Good value listings (score > 1.15): ${goodValueCount}
- User Search Context:
  - Max Price: ${maxPriceText}
  - Suburbs active: ${context.suburb || 'All'}
  - Min Bedrooms: ${context.minBeds || 'Any'}

Detailed Suburb Aggregates:
${JSON.stringify(parsedStats, null, 2)}

Please write the analysis based on this data. Use bold text for numbers and suburb names to make it scannable. Do not use headings or bullet lists.`;

    // 2. If no API key is set, return a mock response for UI testing
    if (!GEMINI_KEY) {
      console.warn("GEMINI_API_KEY not found. Returning mockup analysis.");
      const mockAnalysis = `**Gardens** and **Woodstock** deliver the strongest value at a **${maxPriceText}** budget. **Gardens** shows a healthy median pricing undercutting **Green Point** and **De Waterkant** substantially, with multiple good-value flats. Meanwhile, **Woodstock** remains the cheapest entry point, though listings tend to be smaller.

Supply is highly concentrated in **Sea Point** and **Green Point** for premium 2-bedroom apartments, whereas smaller studio units dominate **De Waterkant** and the **Cape Town CBD**. Price changes reflect a downward adjustment on only **${priceChangesCount}** listings, suggesting a stabilizing rental market.

Recommendation: prioritize **Gardens** for space-to-cost optimization, or look at **Claremont** and **Woodstock** if entry-level budget bounds are strict. Spot check the **${goodValueCount}** good-value items on the listings map.`;
      
      return res.status(200).json({
        analysis: mockAnalysis,
        generatedAt: new Date().toISOString(),
        mocked: true
      });
    }

    // 3. Make REST call to Google Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800
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
