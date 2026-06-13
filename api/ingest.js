const { sql } = require('./db');
const { SUBURBS } = require('./suburbs');
const { isValid, normaliseListing, computeValueScores } = require('./normalise');

function median(nums) {
  const arr = nums.filter(n => n !== null && n !== undefined && !isNaN(n)).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

/**
 * Apify webhook target. Called once per suburb run when it SUCCEEDS. Fetches just
 * that run's dataset (~50 items), normalises, scores, and upserts — small and fast,
 * so it stays well within the Vercel Hobby 60s function cap. No live geocoding:
 * coordinates use the suburb centroid (MapView jitters approximate pins).
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // 1. Auth — shared secret in the webhook callback URL.
  if (!process.env.INGEST_SECRET || req.query.secret !== process.env.INGEST_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: 'APIFY_API_TOKEN environment variable is not set' });
  }

  const suburbName = req.query.suburb;
  const scrapeId = parseInt(req.query.scrapeId, 10);
  const suburbDef = SUBURBS.find(s => s.name === suburbName);

  if (!suburbName || isNaN(scrapeId) || !suburbDef) {
    return res.status(400).json({ error: 'Missing or invalid suburb/scrapeId' });
  }

  try {
    // 2. Resolve the dataset id from the webhook payload.
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    let datasetId = body?.resource?.defaultDatasetId;

    // Fallback: derive from the run id if the payload shape differs.
    if (!datasetId && body?.eventData?.actorRunId) {
      const runRes = await fetch(`https://api.apify.com/v2/actor-runs/${body.eventData.actorRunId}?token=${APIFY_TOKEN}`);
      if (runRes.ok) {
        const runData = await runRes.json();
        datasetId = runData?.data?.defaultDatasetId;
      }
    }

    if (!datasetId) {
      console.error(`Ingest for ${suburbName} (scrape #${scrapeId}): no datasetId in webhook payload`);
      return res.status(400).json({ error: 'No dataset id in webhook payload' });
    }

    // 3. Fetch the dataset items for this single run.
    const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`;
    const dsRes = await fetch(datasetUrl);
    if (!dsRes.ok) {
      throw new Error(`Failed to fetch dataset ${datasetId}: ${dsRes.statusText}`);
    }
    const rawItems = await dsRes.json();
    console.log(`Ingest ${suburbName} (scrape #${scrapeId}): ${rawItems.length} raw items from dataset ${datasetId}`);

    // 4. Normalise pipeline (reused from api/normalise.js).
    const validItems = rawItems.filter(isValid);
    const droppedCount = rawItems.length - validItems.length;

    let listings = validItems.map(item => {
      const listing = normaliseListing(item);
      listing.suburb = suburbName; // canonical display name from our launch params
      // Centroid coordinates — no live geocoding on free tier.
      listing.lat = suburbDef.centroid.lat;
      listing.lng = suburbDef.centroid.lng;
      listing.geocode_precise = false;
      return listing;
    });

    // Value scores are computed within this suburb batch (grouping is per-suburb).
    listings = computeValueScores(listings);

    // Dedupe by url to avoid "ON CONFLICT cannot affect row a second time".
    const uniq = new Map();
    listings.forEach(l => uniq.set(l.url, l));
    listings = Array.from(uniq.values());

    if (listings.length === 0) {
      // Still record an (empty) snapshot so history has a consistent point.
      await sql.query(
        `INSERT INTO suburb_medians (scrape_id, suburb, median_price, median_ppm2, listing_count)
         VALUES ($1, $2, NULL, NULL, 0)`,
        [scrapeId, suburbName]
      );
      await sql.query(
        `UPDATE scrapes SET dropped_count = COALESCE(dropped_count,0) + $1 WHERE id = $2`,
        [droppedCount, scrapeId]
      );
      return res.status(200).json({ ingested: 0, dropped: droppedCount, suburb: suburbName });
    }

    // 5. Bulk upsert into listings, attributed to this scrapeId.
    const valuesClauses = [];
    const params = [];
    let p = 1;
    listings.forEach(item => {
      const row = [
        scrapeId, item.listing_id, item.url, item.suburb, item.property_type,
        item.bedrooms, item.bathrooms, item.price, item.size_m2, item.price_per_m2,
        item.value_score, item.furnished, item.available_date, item.address,
        item.lat, item.lng, item.geocode_precise, item.main_image_url,
        item.agency_name, item.scraped_at
      ];
      valuesClauses.push(`(${row.map(() => `$${p++}`).join(', ')})`);
      params.push(...row);
    });

    const bulkQuery = `
      INSERT INTO listings (
        scrape_id, listing_id, url, suburb, property_type, bedrooms, bathrooms, price,
        size_m2, price_per_m2, value_score, furnished, available_date, address,
        lat, lng, geocode_precise, main_image_url, agency_name, scraped_at
      )
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (url) DO UPDATE SET
        price = EXCLUDED.price,
        price_changed = (listings.price != EXCLUDED.price),
        previous_price = CASE WHEN listings.price != EXCLUDED.price
                              THEN listings.price ELSE listings.previous_price END,
        scrape_id = EXCLUDED.scrape_id,
        value_score = EXCLUDED.value_score,
        scraped_at = EXCLUDED.scraped_at,
        bedrooms = EXCLUDED.bedrooms,
        bathrooms = EXCLUDED.bathrooms,
        size_m2 = EXCLUDED.size_m2,
        price_per_m2 = EXCLUDED.price_per_m2,
        furnished = EXCLUDED.furnished,
        address = EXCLUDED.address
      RETURNING id;
    `;
    const upserted = await sql.query(bulkQuery, params);

    // 6. Atomically bump the scrape totals.
    await sql.query(
      `UPDATE scrapes
         SET listing_count = COALESCE(listing_count,0) + $1,
             dropped_count = COALESCE(dropped_count,0) + $2
       WHERE id = $3`,
      [upserted.length, droppedCount, scrapeId]
    );

    // 7. Append an immutable median snapshot for the history time-series.
    const medianPrice = median(listings.map(l => l.price));
    const medianPpm2 = median(listings.map(l => l.price_per_m2));
    await sql.query(
      `INSERT INTO suburb_medians (scrape_id, suburb, median_price, median_ppm2, listing_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [scrapeId, suburbName, medianPrice, medianPpm2, upserted.length]
    );

    console.log(`Ingest ${suburbName} (scrape #${scrapeId}): upserted ${upserted.length}, dropped ${droppedCount}`);
    return res.status(200).json({
      ingested: upserted.length,
      dropped: droppedCount,
      suburb: suburbName,
      scrapeId
    });

  } catch (err) {
    console.error(`Ingest failed for ${suburbName} (scrape #${scrapeId}):`, err);
    return res.status(500).json({ error: err.message });
  }
};
