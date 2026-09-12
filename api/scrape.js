const { sql } = require('./db');
const { SUBURBS } = require('./suburbs');
const { resolveBaseUrl, launchSuburbRun } = require('./launcher');

// Manual-only cooldown — prevents re-scraping more than once every 2 days.
const COOLDOWN_HOURS = 48;

// Enrichment roughly doubles the per-listing Apify cost (listing + enrichment events).
// Toggle off via APIFY_ENRICH=false once we confirm floor_area survives without it.
const ENRICH = process.env.APIFY_ENRICH !== 'false';

/**
 * Launch-only scrape. Free-tier (Vercel Hobby, 60s cap) safe: this function only
 * STARTS the 7 Apify runs and attaches a webhook to each so completion notifies
 * /api/ingest. It does not poll, geocode, or write listings — that happens per-suburb
 * in api/ingest.js, which keeps every function call well under 60s.
 */
module.exports = async function handler(req, res) {
  // Only allow POST (user-initiated refresh) or authorized forced trigger with valid secret.
  const force = req?.query?.force === 'true';
  if (req.method !== 'POST' && !(force && req.method === 'GET')) {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed. Scrapes are on-demand only via POST.` });
  }

  const INGEST_SECRET = process.env.INGEST_SECRET;

  // Security guard — forced scrapes bypass cooldown and trigger paid Apify runs.
  // Must be authorized via secret query parameter or Bearer token.
  if (force) {
    const authHeader = req?.headers?.['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!INGEST_SECRET || (req?.query?.secret !== INGEST_SECRET && token !== INGEST_SECRET)) {
      return res.status(401).json({ error: "Unauthorized: forced scrape requires valid secret" });
    }
  }

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "APIFY_API_TOKEN environment variable is not set" });
  }
  if (!INGEST_SECRET) {
    return res.status(500).json({ error: "INGEST_SECRET environment variable is not set" });
  }

  const baseUrl = resolveBaseUrl(req);
  if (!baseUrl) {
    return res.status(500).json({ error: "Could not resolve a public base URL for webhooks (set PUBLIC_BASE_URL)" });
  }

  try {
    // 0. Cooldown guard — skip the billable scrape if data is still fresh.

    if (!force) {
      try {
        const lastRows = await sql.query(
          `SELECT scraped_at FROM scrapes WHERE status IN ('succeeded', 'partial', 'running') OR status IS NULL ORDER BY id DESC LIMIT 1`
        );
        if (lastRows.length > 0) {
          const lastScraped = new Date(lastRows[0].scraped_at);
          const ageMs = Date.now() - lastScraped.getTime();
          const cooldownMs = COOLDOWN_HOURS * 3600 * 1000;
          if (ageMs < cooldownMs) {
            const nextAllowed = new Date(lastScraped.getTime() + cooldownMs).toISOString();
            console.log(`Scrape skipped — within ${COOLDOWN_HOURS}h cooldown. Last: ${lastScraped.toISOString()}`);
            return res.status(200).json({
              skipped: true,
              reason: 'cooldown',
              cooldownHours: COOLDOWN_HOURS,
              lastScraped: lastScraped.toISOString(),
              nextAllowed
            });
          }
        }
      } catch (err) {
        console.warn("Could not check scrape cooldown, proceeding:", err.message);
      }
    }

    // Ensure pending_suburbs and lifecycle columns exist
    await sql.query(`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS pending_suburbs TEXT[];`);
    await sql.query(`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';`);
    await sql.query(`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS completed_suburbs TEXT[] DEFAULT '{}';`);
    await sql.query(`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS failed_suburbs TEXT[] DEFAULT '{}';`);
    await sql.query(`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;`);
    await sql.query(`ALTER TABLE scrapes ADD COLUMN IF NOT EXISTS error_summary TEXT;`);

    // Split suburbs into an initial batch of 4 (under Apify free tier 5-concurrency cap)
    // and queue the remaining 3 to be launched by /api/ingest as slots free up.
    const initialSuburbs = SUBURBS.slice(0, 4);
    const pendingSuburbs = SUBURBS.slice(4).map(s => s.name);

    // 1. Create the scrape session up front with pending suburbs and status running.
    const scrapeRow = await sql.query(
      `INSERT INTO scrapes (suburbs, pending_suburbs, completed_suburbs, failed_suburbs, status, listing_count, dropped_count) 
       VALUES ($1, $2, '{}', '{}', 'running', 0, 0) RETURNING id`,
      [SUBURBS.map(s => s.name), pendingSuburbs]
    );
    const scrapeId = scrapeRow[0].id;

    console.log(`Launching initial batch of ${initialSuburbs.length} Apify runs for scrape #${scrapeId} (${pendingSuburbs.length} queued; enrich=${ENRICH}, force=${force})`);

    // 2. Launch the initial batch concurrently (safe under 5-run cap).
    const launchPromises = initialSuburbs.map(suburb =>
      launchSuburbRun(suburb, scrapeId, baseUrl, INGEST_SECRET, APIFY_TOKEN, ENRICH)
    );

    const settled = await Promise.allSettled(launchPromises);
    const launched = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
    const failed = settled.filter(s => s.status === 'rejected').map(s => s.reason.message);

    if (launched.length === 0) {
      throw new Error(`All initial suburb runs failed to launch. ${failed.join('; ')}`);
    }
    if (failed.length > 0) {
      console.warn(`${failed.length} initial suburb run(s) failed to launch:`, failed.join('; '));
    }

    console.log(`Launched ${launched.length}/${initialSuburbs.length} initial runs for scrape #${scrapeId} (${pendingSuburbs.length} pending in queue):`,
      launched.map(r => `${r.suburb}:${r.runId}`).join(', '));

    // 3. Return immediately. Ingestion & queued launches happen asynchronously via webhooks.
    return res.status(202).json({
      started: true,
      scrapeId,
      launched: launched.length,
      queued: pendingSuburbs.length,
      totalSuburbs: SUBURBS.length
    });

  } catch (err) {
    console.error("Scrape launch crashed:", err);
    return res.status(500).json({ error: err.message });
  }
};
