const { neon } = require('@neondatabase/serverless');

if (!process.env.NEON_DATABASE_URL) {
  throw new Error("NEON_DATABASE_URL is not set");
}

const sql = neon(process.env.NEON_DATABASE_URL);

/**
 * Scrape lifecycle housekeeping shared by api/listings.js and api/scrape.js.
 * (Lives here rather than in its own file because every .js file in api/ is a
 * separate Vercel function and the Hobby plan allows at most 12.)
 *
 * Apify only calls our webhook when a suburb run SUCCEEDS, so a run that fails,
 * times out or loses its webhook never reports back and its scrape row would
 * stay 'running' forever (the UI would show "Updating…" indefinitely). Rows
 * older than SCRAPE_TIMEOUT_HOURS are finalised as 'partial' (some suburbs
 * landed) or 'failed' (none did), with the missing suburbs recorded.
 */
const SCRAPE_TIMEOUT_HOURS = 2;

async function expireStaleScrapes() {
  return sql.query(
    `UPDATE scrapes
        SET status = CASE WHEN COALESCE(array_length(completed_suburbs, 1), 0) > 0 THEN 'partial' ELSE 'failed' END,
            completed_at = NOW(),
            pending_suburbs = '{}',
            failed_suburbs = ARRAY(
              SELECT unnest(COALESCE(suburbs, '{}'))
              EXCEPT
              SELECT unnest(COALESCE(completed_suburbs, '{}'))
            ),
            error_summary = COALESCE(error_summary, 'Timed out waiting for scraper results')
      WHERE status = 'running'
        AND scraped_at < NOW() - make_interval(hours => $1)
      RETURNING id, status`,
    [SCRAPE_TIMEOUT_HOURS]
  );
}

module.exports = { sql, SCRAPE_TIMEOUT_HOURS, expireStaleScrapes };
