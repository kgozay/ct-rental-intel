const { sql } = require('./db');
const { SUBURBS } = require('./suburbs');
const { isValid, normaliseListing, computeValueScores } = require('../src/utils/normalise');

const sleep = ms => new Promise(res => setTimeout(res, ms));

module.exports = async function handler(req, res) {
  // Enforce POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
  const MAPBOX_SECRET = process.env.MAPBOX_SECRET_TOKEN;

  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "APIFY_API_TOKEN environment variable is not set" });
  }

  try {
    console.log("Starting parallel scraping of 7 suburbs...");
    
    // 1. Launch Apify runs in parallel for each suburb
    const launchPromises = SUBURBS.map(async (suburb) => {
      const url = `https://api.apify.com/v2/acts/fatihtahta~property24-scraper-za/runs?token=${APIFY_TOKEN}`;
      const body = {
        deal_type: "Properties For Rent",
        location: suburb.location,
        limit: 50
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
      return {
        suburb: suburb.name,
        runId: data.data.id,
        centroid: suburb.centroid
      };
    });

    const activeRuns = await Promise.all(launchPromises);
    console.log(`Launched 7 scraper runs:`, activeRuns.map(r => `${r.suburb}: ${r.runId}`).join(', '));

    // 2. Poll concurrently for all run completions (Up to 150s timeout for queue safety)
    const pollPromises = activeRuns.map(async (run) => {
      const startTime = Date.now();
      const timeoutMs = 150 * 1000;
      
      while (true) {
        if (Date.now() - startTime > timeoutMs) {
          console.warn(`Polling timeout exceeded for ${run.suburb} (run ID: ${run.runId})`);
          return { ...run, success: false, error: 'TIMEOUT' };
        }
        
        await sleep(5000);
        
        try {
          const checkUrl = `https://api.apify.com/v2/actor-runs/${run.runId}?token=${APIFY_TOKEN}`;
          const response = await fetch(checkUrl);
          
          if (!response.ok) {
            console.error(`Error polling run status for ${run.suburb}: ${response.statusText}`);
            continue;
          }
          
          const data = await response.json();
          const status = data.data.status;
          
          if (status === 'SUCCEEDED') {
            return {
              ...run,
              success: true,
              datasetId: data.data.defaultDatasetId
            };
          } else if (status === 'FAILED' || status === 'TIMED-OUT' || status === 'ABORTED') {
            console.warn(`Scraper run for ${run.suburb} ended with status: ${status}`);
            return { ...run, success: false, error: status };
          }
        } catch (err) {
          console.error(`Error polling run ${run.runId}:`, err);
        }
      }
    });

    const pollResults = await Promise.all(pollPromises);
    const succeededRuns = pollResults.filter(r => r.success);
    console.log(`Successfully completed runs: ${succeededRuns.length} of 7`);

    if (succeededRuns.length === 0) {
      throw new Error("All suburb scraper runs failed or timed out.");
    }

    // 3. Fetch dataset items for successful runs and merge
    let allRawItems = [];
    for (const run of succeededRuns) {
      try {
        console.log(`Fetching dataset for ${run.suburb}...`);
        const datasetUrl = `https://api.apify.com/v2/datasets/${run.datasetId}/items?token=${APIFY_TOKEN}&clean=true`;
        const response = await fetch(datasetUrl);
        if (!response.ok) {
          console.error(`Failed to fetch dataset for ${run.suburb}: ${response.statusText}`);
          continue;
        }
        
        const items = await response.json();
        console.log(`Fetched ${items.length} items for ${run.suburb}`);
        
        // Tag with target suburb to bypass messy crawler locality strings
        const taggedItems = items.map(item => ({
          ...item,
          requestingSuburb: run.suburb,
          suburbCentroid: run.centroid
        }));
        
        allRawItems = allRawItems.concat(taggedItems);
      } catch (err) {
        console.error(`Error fetching dataset items for ${run.suburb}:`, err);
      }
    }

    console.log(`Total raw items collected: ${allRawItems.length}`);

    // 4. Run through data normalisation pipeline
    const validRawItems = allRawItems.filter(isValid);
    const droppedCount = allRawItems.length - validRawItems.length;
    
    let normalisedListings = validRawItems.map(item => {
      const listing = normaliseListing(item);
      // Enforce the canonical suburb display name from our launch parameters
      listing.suburb = item.requestingSuburb;
      return {
        ...listing,
        suburbCentroid: item.suburbCentroid
      };
    });

    // Compute value scores (relative to the suburb medians in this scrape)
    normalisedListings = computeValueScores(normalisedListings);
    console.log(`Clean listings to process: ${normalisedListings.length} (dropped ${droppedCount})`);

    if (normalisedListings.length === 0) {
      return res.status(200).json({
        success: true,
        inserted: 0,
        updated: 0,
        dropped: droppedCount,
        message: "No valid residential listings were scraped."
      });
    }

    // 5. Geocoding cache check and geocode resolving
    console.log("Checking geocoding cache in database...");
    const urls = normalisedListings.map(l => l.url);
    let cachedCoordsMap = {};
    
    try {
      const cacheRows = await sql(
        `SELECT url, lat, lng, geocode_precise FROM listings WHERE url = ANY($1)`,
        [urls]
      );
      cacheRows.forEach(row => {
        if (row.lat && row.lng) {
          cachedCoordsMap[row.url] = {
            lat: parseFloat(row.lat),
            lng: parseFloat(row.lng),
            geocode_precise: row.geocode_precise
          };
        }
      });
      console.log(`Cache hits: found ${Object.keys(cachedCoordsMap).length} coordinates in DB`);
    } catch (err) {
      console.warn("Could not query geocoding cache from database, falling back to geocoding everything:", err.message);
    }

    // Geocode listings
    const processedListings = [];
    let nominatimQueryCount = 0;
    const MAX_NOMINATIM_QUERIES = 20;

    for (const listing of normalisedListings) {
      const cached = cachedCoordsMap[listing.url];
      
      if (cached) {
        // Cache hit: reuse coordinates
        listing.lat = cached.lat;
        listing.lng = cached.lng;
        listing.geocode_precise = cached.geocode_precise;
      } else {
        // Cache miss: geocode using OpenStreetMap Nominatim API
        let lat = listing.suburbCentroid.lat;
        let lng = listing.suburbCentroid.lng;
        let geocode_precise = false;
        
        const hasNumberAddress = listing.address && /^\d+/.test(listing.address);
        
        if (hasNumberAddress && nominatimQueryCount < MAX_NOMINATIM_QUERIES) {
          try {
            nominatimQueryCount++;
            console.log(`[OSM Geocode ${nominatimQueryCount}/${MAX_NOMINATIM_QUERIES}] Resolving: ${listing.address}`);
            
            // Respect Nominatim's strict usage policy: sleep 1 second (1000ms) between calls
            await sleep(1000);
            
            const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(listing.address + ', Cape Town, South Africa')}&format=json&limit=1`;
            const response = await fetch(geocodeUrl, {
              headers: { 'User-Agent': 'CapeTownRentalIntel/1.0 (contact@example.com)' }
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data && data.length > 0) {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
                geocode_precise = true;
              } else {
                console.warn(`Nominatim geocode returned no results for: ${listing.address}`);
              }
            } else {
              console.warn(`Nominatim API returned error: ${response.statusText}`);
            }
          } catch (err) {
            console.error(`Error querying Nominatim for "${listing.address}":`, err.message);
          }
        }
        
        listing.lat = lat;
        listing.lng = lng;
        listing.geocode_precise = geocode_precise;
      }
      
      // Remove temporary centroid before DB write
      delete listing.suburbCentroid;
      processedListings.push(listing);
    }

    // 6. DB transaction: insert scrape record & bulk upsert listings
    console.log("Writing scrape results to database...");
    
    // Create a scrape session
    const scrapeResult = await sql(
      `INSERT INTO scrapes (suburbs, listing_count, dropped_count) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      [SUBURBS.map(s => s.name), processedListings.length, droppedCount]
    );
    const scrapeId = scrapeResult[0].id;

    // Build bulk upsert query
    const valuesClauses = [];
    const valuesParams = [];
    let paramIdx = 1;
    
    processedListings.forEach(item => {
      const params = [
        scrapeId,
        item.listing_id,
        item.url,
        item.suburb,
        item.property_type,
        item.bedrooms,
        item.bathrooms,
        item.price,
        item.size_m2,
        item.price_per_m2,
        item.value_score,
        item.furnished,
        item.available_date,
        item.address,
        item.lat,
        item.lng,
        item.geocode_precise,
        item.main_image_url,
        item.agency_name,
        item.scraped_at
      ];
      
      const placeholders = params.map(() => `$${paramIdx++}`).join(', ');
      valuesClauses.push(`(${placeholders})`);
      valuesParams.push(...params);
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
        scraped_at = EXCLUDED.scraped_at
      RETURNING id, (price_changed AND price < previous_price) AS is_price_drop;
    `;

    const upsertResults = await sql(bulkQuery, valuesParams);
    
    let inserted = 0;
    let updated = 0;
    
    // We can infer inserts vs updates by cross-checking listings updated or checking scrape_id
    // But since it's an upsert returning all IDs, we just know all processedListings were handled.
    // For counting simplicity, return totals.
    console.log(`Bulk upserted ${upsertResults.length} listings in DB successfully.`);

    return res.status(200).json({
      success: true,
      scrapeId: scrapeId,
      totalScraped: allRawItems.length,
      processed: processedListings.length,
      dropped: droppedCount,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Scrape operation crashed:", err);
    return res.status(500).json({ error: err.message });
  }
};
