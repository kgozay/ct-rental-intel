const { sql } = require('./db');

module.exports = async function handler(req, res) {
  // Enforce GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Aggregation query: median price per suburb per scrape date (grouped by day)
    const query = `
      SELECT date_trunc('day', s.scraped_at) as date, l.suburb, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.price) as median
      FROM listings l
      JOIN scrapes s ON l.scrape_id = s.id
      GROUP BY 1, 2
      ORDER BY 1 ASC;
    `;

    const rows = await sql(query);
    
    // Structure results nicely for Recharts
    // Format date as YYYY-MM-DD
    const formatted = rows.map(r => ({
      date: new Date(r.date).toISOString().split('T')[0],
      suburb: r.suburb,
      median: Math.round(parseFloat(r.median))
    }));

    return res.status(200).json({
      history: formatted
    });

  } catch (err) {
    console.error("Fetch history failed:", err);
    return res.status(500).json({ error: err.message });
  }
};
