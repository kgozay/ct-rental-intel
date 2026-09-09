// api/launcher.js (CommonJS)
// Shared launcher helper to start an Apify run for a single suburb with webhook callback.

function resolveBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const proto = req?.headers?.['x-forwarded-proto'] || 'https';
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  return host ? `${proto}://${host}` : '';
}

async function launchSuburbRun(suburb, scrapeId, baseUrl, ingestSecret, apifyToken, enrich = true) {
  const hook = [{
    eventTypes: ['ACTOR.RUN.SUCCEEDED'],
    requestUrl: `${baseUrl}/api/ingest?suburb=${encodeURIComponent(suburb.name)}&scrapeId=${scrapeId}&secret=${encodeURIComponent(ingestSecret)}`
  }];
  const webhooksEncoded = encodeURIComponent(Buffer.from(JSON.stringify(hook)).toString('base64'));
  const url = `https://api.apify.com/v2/acts/fatihtahta~property24-scraper-za/runs?token=${apifyToken}&webhooks=${webhooksEncoded}`;
  const body = {
    deal_type: "Properties For Rent",
    location: suburb.location,
    limit: 50,
    property_type: ["house", "apartment_flat", "townhouse"],
    max_price: 150000,
    enrich_data: enrich,
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
  return { suburb: suburb.name, runId: data?.data?.id };
}

module.exports = {
  resolveBaseUrl,
  launchSuburbRun
};
