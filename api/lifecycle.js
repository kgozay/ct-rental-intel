/**
 * Scrape lifecycle housekeeping shared by api/listings.js and api/scrape.js.
 *
 * Apify only calls our webhook when a suburb run SUCCEEDS, so a run that fails,
 * times out or loses its webhook never reports back and its scrape row would
 * stay 'running' forever (the UI would show "Updating…" indefinitely). Rows
 * older than SCRAPE_TIMEOUT_HOURS are finalised as 'partial' (some suburbs
 * landed) or 'failed' (none did), with the missing suburbs recorded.
 */
const SCRAPE_TIMEOUT_HOURS = 2;

async function expireStaleScrapes(sql) {
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

module.exports = { SCRAPE_TIMEOUT_HOURS, expireStaleScrapes };
