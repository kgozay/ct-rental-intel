const { sql } = require('./db');
const { SUBURBS } = require('./suburbs');
const VALID_SUBURB_NAMES = new Set(SUBURBS.map(s => s.name));

module.exports = async function handler(req, res) {
  // Enforce GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Edge CDN cache: fresh for 30s, serves stale up to 60s while revalidating
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  try {
    const { suburb, maxPrice, minBeds, furnished } = req.query;

    let queryConditions = [];
    let queryParams = [];
    let paramIdx = 1;

    // Fetch the latest scrape timestamp to surface in the UI header.
    const latestScrapeResult = await sql.query(
      `SELECT id, scraped_at FROM scrapes ORDER BY id DESC LIMIT 1`
    );
    const lastScraped = latestScrapeResult.length > 0 ? latestScrapeResult[0].scraped_at : null;

    if (latestScrapeResult.length === 0) {
      return res.status(200).json({
        listings: [],
        medians: {},
        lastScraped: null,
        totalCount: 0
      });
    }

    // 2. Filter by suburbs (CSV) — only accept known suburb names to prevent schema probing
    if (suburb) {
      const suburbsList = suburb.split(',').map(s => s.trim()).filter(s => VALID_SUBURB_NAMES.has(s));
      if (suburbsList.length > 0) {
        queryConditions.push(`l.suburb = ANY($${paramIdx++})`);
        queryParams.push(suburbsList);
      }
    }

    // 3. Filter by max price
    if (maxPrice) {
      const maxPriceVal = parseInt(maxPrice, 10);
      if (!isNaN(maxPriceVal)) {
        queryConditions.push(`l.price <= $${paramIdx++}`);
        queryParams.push(maxPriceVal);
      }
    }

    // 4. Filter by min bedrooms
    if (minBeds) {
      const minBedsVal = parseInt(minBeds, 10);
      if (!isNaN(minBedsVal)) {
        queryConditions.push(`l.bedrooms >= $${paramIdx++}`);
        queryParams.push(minBedsVal);
      }
    }

    // 5. Filter by furnishing status
    if (furnished === 'true') {
      queryConditions.push(`l.furnished = true`);
    } else if (furnished === 'false') {
      queryConditions.push(`(l.furnished = false OR l.furnished IS NULL)`);
    }

    const whereClause = queryConditions.length > 0 
      ? `AND ${queryConditions.join(' AND ')}` 
      : '';

    // Only return listings from the latest scrape for each suburb.
    // Historical listings remain in the database for trends and history.
    const listingsQuery = `
      WITH latest_suburb_scrapes AS (
        SELECT suburb, MAX(scrape_id) AS max_scrape_id
        FROM listings
        GROUP BY suburb
      )
      SELECT l.id, l.scrape_id, l.listing_id, l.url, l.suburb, l.property_type, l.bedrooms, l.bathrooms,
             l.price, l.size_m2, l.price_per_m2, l.value_score, l.furnished, l.available_date,
             l.address, l.lat, l.lng, l.geocode_precise, l.main_image_url, l.agency_name,
             l.price_changed, l.previous_price, l.scraped_at, l.created_at
      FROM listings l
      INNER JOIN latest_suburb_scrapes lss
         ON l.suburb = lss.suburb AND l.scrape_id = lss.max_scrape_id
      WHERE 1=1 ${whereClause}
      ORDER BY l.price_per_m2 ASC, l.price ASC;
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
