const { sql } = require('./db');

module.exports = async function handler(req, res) {
  // Enforce GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { suburb, maxPrice, minBeds, furnished, latestOnly } = req.query;

    let queryConditions = [];
    let queryParams = [];
    let paramIdx = 1;

    // Fetch the latest scrape once — its id is reused for the latestOnly filter,
    // and its timestamp is returned as lastScraped (avoids a second round-trip).
    const latestScrapeResult = await sql.query(
      `SELECT id, scraped_at FROM scrapes ORDER BY id DESC LIMIT 1`
    );
    const lastScraped = latestScrapeResult.length > 0 ? latestScrapeResult[0].scraped_at : null;

    // 1. Filter by latest scrape if requested
    if (latestOnly === 'true') {
      if (latestScrapeResult.length > 0) {
        queryConditions.push(`scrape_id = $${paramIdx++}`);
        queryParams.push(latestScrapeResult[0].id);
      } else {
        // No scrapes exist yet
        return res.status(200).json({
          listings: [],
          medians: {},
          lastScraped: null,
          totalCount: 0
        });
      }
    }

    // 2. Filter by suburbs (CSV)
    if (suburb) {
      const suburbsList = suburb.split(',').map(s => s.trim());
      queryConditions.push(`suburb = ANY($${paramIdx++})`);
      queryParams.push(suburbsList);
    }

    // 3. Filter by max price
    if (maxPrice) {
      const maxPriceVal = parseInt(maxPrice, 10);
      if (!isNaN(maxPriceVal)) {
        queryConditions.push(`price <= $${paramIdx++}`);
        queryParams.push(maxPriceVal);
      }
    }

    // 4. Filter by min bedrooms
    if (minBeds) {
      const minBedsVal = parseInt(minBeds, 10);
      if (!isNaN(minBedsVal)) {
        queryConditions.push(`bedrooms >= $${paramIdx++}`);
        queryParams.push(minBedsVal);
      }
    }

    // 5. Filter by furnishing status
    if (furnished === 'true') {
      queryConditions.push(`furnished = true`);
    } else if (furnished === 'false') {
      queryConditions.push(`(furnished = false OR furnished IS NULL)`);
    }

    const whereClause = queryConditions.length > 0 
      ? `WHERE ${queryConditions.join(' AND ')}` 
      : '';

    const listingsQuery = `
      SELECT id, scrape_id, listing_id, url, suburb, property_type, bedrooms, bathrooms,
             price, size_m2, price_per_m2, value_score, furnished, available_date,
             address, lat, lng, geocode_precise, main_image_url, agency_name,
             price_changed, previous_price, scraped_at, created_at
      FROM listings
      ${whereClause}
      ORDER BY price_per_m2 ASC, price ASC;
    `;

    const listings = await sql.query(listingsQuery, queryParams);

    // 6. Compute median price_per_m2 per suburb from the resulting array
    const suburbPrices = {};
    listings.forEach(item => {
      if (item.price_per_m2 !== null && item.price_per_m2 !== undefined) {
        if (!suburbPrices[item.suburb]) {
          suburbPrices[item.suburb] = [];
        }
        suburbPrices[item.suburb].push(item.price_per_m2);
      }
    });

    const medians = {};
    for (const sub in suburbPrices) {
      const prices = suburbPrices[sub].sort((a, b) => a - b);
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 !== 0 
        ? prices[mid] 
        : Math.round((prices[mid - 1] + prices[mid]) / 2);
      medians[sub] = median;
    }

    return res.status(200).json({
      listings: listings.map(l => ({
        ...l,
        bedrooms: l.bedrooms ? parseFloat(l.bedrooms) : null,
        bathrooms: l.bathrooms ? parseFloat(l.bathrooms) : null,
        price: parseInt(l.price, 10),
        size_m2: l.size_m2 ? parseInt(l.size_m2, 10) : null,
        price_per_m2: l.price_per_m2 ? parseInt(l.price_per_m2, 10) : null,
        value_score: l.value_score ? parseFloat(l.value_score) : null,
        lat: l.lat ? parseFloat(l.lat) : null,
        lng: l.lng ? parseFloat(l.lng) : null,
        previous_price: l.previous_price ? parseInt(l.previous_price, 10) : null,
        created_at: l.created_at ? new Date(l.created_at).toISOString() : null
      })),
      medians,
      lastScraped,
      totalCount: listings.length
    });

  } catch (err) {
    console.error("Fetch listings failed:", err);
    return res.status(500).json({ error: err.message });
  }
};
