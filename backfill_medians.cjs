/**
 * One-off backfill: compute suburb medians from existing listings and
 * insert them into suburb_medians so the Charts tab has data to display.
 * Safe to run multiple times (uses a synthetic scrape_id = 0 for the seed row).
 */
const { sql } = require('./api/db');

function median(nums) {
  const arr = nums.filter(n => n !== null && n !== undefined && !isNaN(n)).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

async function backfill() {
  console.log('Fetching existing listings from DB...');

  // Get the latest scrape_id to associate with the backfilled rows
  const scrapeRows = await sql.query('SELECT id FROM scrapes ORDER BY id DESC LIMIT 1');
  const scrapeId = scrapeRows.length > 0 ? scrapeRows[0].id : 0;
  console.log(`Using scrape_id = ${scrapeId}`);

  // Delete any existing backfill rows to keep it idempotent
  await sql.query('DELETE FROM suburb_medians WHERE scrape_id = $1', [scrapeId]);
  console.log(`Cleared previous suburb_medians rows for scrape_id=${scrapeId}`);

  // Fetch all listings
  const listings = await sql.query(`
    SELECT suburb, bedrooms, price, price_per_m2, scraped_at
    FROM listings
    WHERE price IS NOT NULL
  `);
  console.log(`Found ${listings.length} listings to process`);

  // Group by suburb
  const bySuburb = {};
  for (const l of listings) {
    if (!bySuburb[l.suburb]) bySuburb[l.suburb] = [];
    bySuburb[l.suburb].push(l);
  }

  for (const [suburb, rows] of Object.entries(bySuburb)) {
    console.log(`\nProcessing ${suburb} (${rows.length} listings)...`);

    // Overall median row (bedrooms IS NULL)
    const prices = rows.map(l => parseInt(l.price, 10));
    const ppms = rows.map(l => l.price_per_m2 ? parseInt(l.price_per_m2, 10) : null);
    const medianPrice = median(prices);
    const medianPpm2 = median(ppms);

    await sql.query(
      `INSERT INTO suburb_medians (scrape_id, suburb, median_price, median_ppm2, listing_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [scrapeId, suburb, medianPrice, medianPpm2, rows.length]
    );
    console.log(`  Overall: R${medianPrice} median, ${rows.length} listings`);

    // Per-bedroom rows
    for (const beds of [1, 2, 3]) {
      const bedRows = rows.filter(l => parseFloat(l.bedrooms) === beds);
      if (bedRows.length >= 2) {
        const bPrices = bedRows.map(l => parseInt(l.price, 10));
        const bPpms = bedRows.map(l => l.price_per_m2 ? parseInt(l.price_per_m2, 10) : null);
        await sql.query(
          `INSERT INTO suburb_medians (scrape_id, suburb, median_price, median_ppm2, listing_count, bedrooms)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [scrapeId, suburb, median(bPrices), median(bPpms), bedRows.length, beds]
        );
        console.log(`  ${beds}-bed: R${median(bPrices)} median, ${bedRows.length} listings`);
      }
    }
  }

  const total = await sql.query('SELECT COUNT(*) as count FROM suburb_medians');
  console.log(`\nDone! suburb_medians now has ${total[0].count} rows`);
}

backfill().catch(err => { console.error(err); process.exit(1); });
