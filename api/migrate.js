const { sql } = require('./db');

async function migrate() {
  console.log("Running migrations...");
  const statements = [
    `CREATE TABLE IF NOT EXISTS scrapes (
      id SERIAL PRIMARY KEY,
      scraped_at TIMESTAMPTZ DEFAULT NOW(),
      suburbs TEXT[],
      listing_count INTEGER,
      dropped_count INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      scrape_id INTEGER REFERENCES scrapes(id),
      listing_id TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      suburb TEXT NOT NULL,
      property_type TEXT,
      bedrooms NUMERIC(3,1),
      bathrooms NUMERIC(3,1),
      price INTEGER NOT NULL,
      size_m2 INTEGER,
      price_per_m2 INTEGER,
      value_score NUMERIC(5,2),
      furnished BOOLEAN,
      available_date TEXT,
      address TEXT,
      lat NUMERIC(10,7),
      lng NUMERIC(10,7),
      geocode_precise BOOLEAN DEFAULT false,
      main_image_url TEXT,
      agency_name TEXT,
      price_changed BOOLEAN DEFAULT false,
      previous_price INTEGER,
      scraped_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_listings_suburb ON listings(suburb)`,
    `CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price)`,
    `CREATE INDEX IF NOT EXISTS idx_listings_scrape_id ON listings(scrape_id)`,
    // Append-only snapshot of per-suburb medians, written once per suburb per scrape.
    // The listings table is upsert-on-url (current state only), so it can't preserve
    // history — this table is the source for the "Price Trends over Time" chart.
    `CREATE TABLE IF NOT EXISTS suburb_medians (
      id SERIAL PRIMARY KEY,
      scrape_id INTEGER REFERENCES scrapes(id),
      scraped_at TIMESTAMPTZ DEFAULT NOW(),
      suburb TEXT NOT NULL,
      median_price INTEGER,
      median_ppm2 INTEGER,
      listing_count INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_suburb_medians_scrape ON suburb_medians(scrape_id)`
  ];

  for (const statement of statements) {
    try {
      await sql.query(statement);
      console.log(`Executed: ${statement.split('\n')[0].trim()}...`);
    } catch (err) {
      console.error("Migration error on statement:", statement);
      console.error(err);
      throw err;
    }
  }
  console.log("Migrations completed successfully!");
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error("Migration script failed:", err);
    process.exit(1);
  });
}

module.exports = { migrate };
