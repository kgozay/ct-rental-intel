const { sql } = require('./db');

module.exports = async function handler(req, res) {
  // Enforce GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Read from the append-only suburb_medians snapshots. The listings table is
    // upsert-on-url (current state only), so it cannot preserve history — these
    // snapshots are written once per suburb per scrape by api/ingest.js.
    // Average the medians per day in case of multiple scrapes on the same day.
    const query = `
      SELECT date_trunc('day', scraped_at) as date, suburb, ROUND(AVG(median_price)) as median
      FROM suburb_medians
      WHERE median_price IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1 ASC;
    `;

    const rows = await sql.query(query);

    // Structure results for Recharts. Format date as YYYY-MM-DD.
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
