const RESIDENTIAL_ALLOWLIST = [
  'apartment / flat', 'flat', 'apartment', 'house', 'townhouse',
  'cluster', 'duplex', 'penthouse', 'studio', 'maisonette',
  'garden cottage', 'cottage', 'estate', 'residential estate'
];

function isValid(raw) {
  if (!raw) return false;
  
  const price = raw.pricing?.price;
  const priceText = raw.pricing?.price_text;
  const propType = raw.property?.property_type;
  
  // 1. Check if price is present and clean, or check POA
  if (!price || priceText === 'POA') return false;
  
  // 2. Sanity check: Price must be positive and below ceiling
  if (price <= 0 || price > 150000) return false;
  
  // 3. Enforce residential types
  if (!propType) return false;
  const typeLower = propType.toLowerCase().trim();
  if (!RESIDENTIAL_ALLOWLIST.includes(typeLower)) return false;
  
  return true;
}

function parseAvailableDate(status) {
  if (!status) return null;
  const s = status.toUpperCase().trim();
  
  if (
    s === 'AVAILABLE NOW' ||
    s === 'AVAILABLE IMMEDIATELY' ||
    s === 'AVAILABLE IMMEDIATE' ||
    s === 'IMMEDIATE' ||
    s === 'IMMEDIATELY' ||
    s === 'NOW'
  ) {
    return new Date().toISOString().split('T')[0];
  }
  
  const match = s.match(/AVAILABLE:\s*(\d{1,2})\s*([A-Z]{3})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2];
    
    const months = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };
    
    const month = months[monthStr];
    if (month !== undefined) {
      const now = new Date();
      let year = now.getFullYear();
      
      // If the target month has already passed in the current year, it must be for next year
      if (month < now.getMonth()) {
        year += 1;
      }
      
      const d = new Date(year, month, day);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  
  return null;
}

function extractBedrooms(title, description, rawBedrooms) {
  if (rawBedrooms !== undefined && rawBedrooms !== null) {
    const val = parseFloat(rawBedrooms);
    if (!isNaN(val)) return val;
  }
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  
  // Look for decimals like "0.5 bedroom" or "1.5 beds"
  const bedMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:bedroom|bed|bd)/i);
  if (bedMatch) {
    return parseFloat(bedMatch[1]);
  }
  
  if (text.includes('studio') || text.includes('bachelor')) {
    return 0.5;
  }
  
  return null;
}

function extractBathrooms(title, description, rawBathrooms) {
  if (rawBathrooms !== undefined && rawBathrooms !== null) {
    const val = parseFloat(rawBathrooms);
    if (!isNaN(val)) return val;
  }
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  
  const bathMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:bathroom|bath|ba)/i);
  if (bathMatch) {
    return parseFloat(bathMatch[1]);
  }
  
  return null;
}

function extractSize(title, description, rawSize) {
  if (rawSize !== undefined && rawSize !== null) {
    const val = parseInt(String(rawSize).replace(/[\s,]/g, ''), 10);
    if (!isNaN(val)) return val;
  }
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  
  // Match size like "148m2", "148 m²", "148 sqm", "148 sq m", "148 sq.m", "148 square meters", etc.
  const sizeMatch = text.match(/(?:floor)?\s*(\d+(?:[\s,]\d+)?)\s*(?:m2|m²|sq\.?\s*m|sq\.?\s*meter|sq\.?\s*metre|square\s*meter|square\s*metre)s?/i);
  if (sizeMatch) {
    const cleaned = sizeMatch[1].replace(/[\s,]/g, '');
    const val = parseInt(cleaned, 10);
    if (!isNaN(val)) return val;
  }
  
  return null;
}

function extractFurnished(title, description, rawFurnished) {
  if (rawFurnished !== undefined && rawFurnished !== null) {
    return !!rawFurnished;
  }
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  
  if (text.includes('unfurnished') || text.includes('not furnished')) {
    return false;
  }
  if (text.includes('furnished')) {
    return true;
  }
  return null;
}

function normaliseListing(raw) {
  const price = raw.pricing?.price;
  const title = raw.entity?.title || '';
  const desc = raw.entity?.description || '';
  
  const bedrooms = extractBedrooms(title, desc, raw.property?.bedrooms);
  const bathrooms = extractBathrooms(title, desc, raw.property?.bathrooms);
  const size = extractSize(title, desc, raw.property?.floor_area?.value);
  const pricePerM2 = size ? Math.round(price / size) : null;
  
  const rawType = raw.property?.property_type || '';
  let propType = 'other';
  
  const typeLower = rawType.toLowerCase().trim();
  if (['apartment / flat', 'apartment', 'flat', 'studio'].includes(typeLower)) {
    propType = 'apartment';
  } else if (typeLower === 'house') {
    propType = 'house';
  } else if (['townhouse', 'cluster', 'duplex', 'maisonette'].includes(typeLower)) {
    propType = 'townhouse';
  }
  
  // Clean suburb name: strip ", Cape Town" suffix
  let suburb = raw.location?.locality || '';
  suburb = suburb.replace(/,\s*Cape\s*Town.*$/i, '').trim();
  
  return {
    listing_id: raw.record_id ? String(raw.record_id) : '',
    url: raw.source_context?.listing_url || '',
    suburb: suburb,
    property_type: propType,
    bedrooms: bedrooms,
    bathrooms: bathrooms,
    price: price,
    size_m2: size,
    price_per_m2: pricePerM2,
    furnished: extractFurnished(title, desc, raw.property?.furnished),
    available_date: parseAvailableDate(raw.availability?.availability_status),
    address: raw.property?.features?.street_address || raw.location?.address || null,
    main_image_url: raw.media?.main_image_url ?? null,
    agency_name: raw.relationships?.agency?.name ?? null,
    scraped_at: raw.source_context?.scraped_at || new Date().toISOString()
  };
}

function medianOf(nums) {
  const arr = nums.filter(n => n !== null && n !== undefined && !isNaN(n)).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

/**
 * value_score = how a listing compares to its suburb's market. >1 = cheaper than the
 * benchmark (good value), <1 = pricier. Thresholds: >1.15 good, 0.85–1.15 fair, <0.85 expensive.
 *
 * Primary basis is price/m² (size-aware, matches the R/m² legend in the UI):
 *   value_score = suburbMedian(price_per_m2) / listing.price_per_m2
 * Listings without a size fall back to a suburb+bedrooms median-price ratio so they
 * still get a score:
 *   value_score = suburbBedMedian(price) / listing.price
 */
function computeValueScores(normalisedListings) {
  // 1a. Per-suburb median price_per_m2 (size-based, primary basis).
  const suburbPpm2 = {};
  // 1b. Per-suburb+bedrooms median price (fallback for sizeless listings).
  const suburbBedPrices = {};

  normalisedListings.forEach(item => {
    if (item.price_per_m2 !== null && item.price_per_m2 !== undefined) {
      (suburbPpm2[item.suburb] ||= []).push(item.price_per_m2);
    }
    if (item.price !== null && item.price !== undefined && item.bedrooms !== null && item.bedrooms !== undefined) {
      (suburbBedPrices[`${item.suburb}_beds_${item.bedrooms}`] ||= []).push(item.price);
    }
  });

  const suburbPpm2Median = {};
  for (const sub in suburbPpm2) suburbPpm2Median[sub] = medianOf(suburbPpm2[sub]);

  const suburbBedMedian = {};
  for (const key in suburbBedPrices) suburbBedMedian[key] = medianOf(suburbBedPrices[key]);

  // 2. Score each listing — prefer the price/m² basis, fall back to suburb+beds price.
  return normalisedListings.map(item => {
    if (item.price_per_m2 !== null && item.price_per_m2 !== undefined) {
      const med = suburbPpm2Median[item.suburb];
      if (med) {
        return { ...item, value_score: parseFloat((med / item.price_per_m2).toFixed(2)) };
      }
    }

    if (item.price !== null && item.price !== undefined && item.bedrooms !== null && item.bedrooms !== undefined) {
      const med = suburbBedMedian[`${item.suburb}_beds_${item.bedrooms}`];
      if (med) {
        return { ...item, value_score: parseFloat((med / item.price).toFixed(2)) };
      }
    }

    return { ...item, value_score: null };
  });
}

module.exports = {
  isValid,
  parseAvailableDate,
  normaliseListing,
  computeValueScores
};
