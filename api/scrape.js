const { sql } = require('./db');
const { SUBURBS } = require('./suburbs');

// Cooldown between billable scrapes. Manual refreshes inside this window return
// cached data instead of spending Apify credits. The Vercel cron (every 3 days)
// bypasses it with ?force=true. See CLAUDE.md "Apify cost controls".
const COOLDOWN_HOURS = 72;

// Enrichment roughly doubles the per-listing Apify cost (listing + enrichment events).
// Toggle off via APIFY_ENRICH=false once we confirm floor_area survives without it.
const ENRICH = process.env.APIFY_ENRICH !== 'false';

// Resolve the public base URL Apify webhooks should call back. On Vercel,
// VERCEL_URL is the (per-deployment) host; PUBLIC_BASE_URL pins a stable prod domain.
function resolveBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Local/dev fallback from request headers (webhooks won't reach localhost — see CLAUDE.md).
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${proto}://${host}` : '';
}

/**
 * Launch-only scrape. Free-tier (Vercel Hobby, 60s cap) safe: this function only
 * STARTS the 7 Apify runs and attaches a webhook to each so completion notifies
 * /api/ingest. It does not poll, geocode, or write listings — that happens per-suburb
 * in api/ingest.js, which keeps every function call well under 60s.
 */
module.exports = async function handler(req, res) {
  // Allow POST (manual refresh) and GET (Vercel cron with ?force=true).
  const isCron = req.method === 'GET' && req.query.force === 'true';
  if (req.method !== 'POST' && !isCron) {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
  const INGEST_SECRET = process.env.INGEST_SECRET;

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
    const force = req.query.force === 'true';
    if (!force) {
      try {
        const lastRows = await sql.query(`SELECT scraped_at FROM scrapes ORDER BY id DESC LIMIT 1`);
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

    // 1. Create the scrape session up front. Its timestamp drives the cooldown,
    //    and ingests attribute their listings to this scrapeId.
    const scrapeRow = await sql.query(
      `INSERT INTO scrapes (suburbs, listing_count, dropped_count) VALUES ($1, 0, 0) RETURNING id`,
      [SUBURBS.map(s => s.name)]
    );
    const scrapeId = scrapeRow[0].id;

    console.log(`Launching ${SUBURBS.length} Apify runs for scrape #${scrapeId} (enrich=${ENRICH}, force=${force})`);

    // 2. Launch all runs in parallel, each with a completion webhook to /api/ingest.
    const launchPromises = SUBURBS.map(async (suburb) => {
      const hook = [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: `${baseUrl}/api/ingest?suburb=${encodeURIComponent(suburb.name)}&scrapeId=${scrapeId}&secret=${encodeURIComponent(INGEST_SECRET)}`
      }];
      const webhooks = Buffer.from(JSON.stringify(hook)).toString('base64');

      const url = `https://api.apify.com/v2/acts/fatihtahta~property24-scraper-za/runs?token=${APIFY_TOKEN}&webhooks=${webhooks}`;
      const body = {
        deal_type: "Properties For Rent",
        location: suburb.location,
        limit: 50,
        // Push residential filtering upstream so we don't pay for listings isValid() would drop.
        property_type: ["house", "apartment_flat", "townhouse"],
        max_price: 150000,            // mirror the isValid() sanity ceiling
        enrich_data: ENRICH,
        sort_by: "most_recent",
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ["RESIDENTIAL"]
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to launch scraper for ${suburb.name}: ${response.statusText} (${errText})`);
      }

      const data = await response.json();
      return { suburb: suburb.name, runId: data.data.id };
    });

    const settled = await Promise.allSettled(launchPromises);
    const launched = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
    const failed = settled.filter(s => s.status === 'rejected').map(s => s.reason.message);

    if (launched.length === 0) {
      throw new Error(`All suburb runs failed to launch. ${failed.join('; ')}`);
    }
    if (failed.length > 0) {
      console.warn(`${failed.length} suburb run(s) failed to launch:`, failed.join('; '));
    }

    console.log(`Launched ${launched.length}/${SUBURBS.length} runs for scrape #${scrapeId}:`,
      launched.map(r => `${r.suburb}:${r.runId}`).join(', '));

    // 3. Return immediately. Ingestion happens asynchronously via webhooks.
    return res.status(202).json({
      started: true,
      scrapeId,
      launched: launched.length,
      failedToLaunch: failed.length,
      suburbs: SUBURBS.length
    });

  } catch (err) {
    console.error("Scrape launch crashed:", err);
    return res.status(500).json({ error: err.message });
  }
};
