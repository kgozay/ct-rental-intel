const COMMERCIAL_KEYWORDS = [
  'commercial', 'office', 'retail', 'industrial', 'warehouse',
  'storage', 'parking', 'farm', 'land', 'business', 'showroom', 'factory'
];

const RESIDENTIAL_ALLOWLIST = [
  'apartment / flat', 'flat', 'apartment', 'house', 'townhouse',
  'cluster', 'duplex', 'penthouse', 'studio', 'maisonette',
  'garden cottage', 'cottage', 'estate', 'residential estate',
  'loft', 'simplex', 'bachelor', 'room'
];

function isValid(raw) {
  if (!raw) return false;
  
  const price = raw.pricing?.price;
  const priceText = raw.pricing?.price_text;
  const propType = raw.property?.property_type;
  
  // 1. Check if price is present, positive, and not POA
  if (!price || priceText === 'POA') return false;
  
  // 2. Sanity check: Price must be positive and below ceiling
  if (typeof price !== 'number' || price <= 0 || price > 150000) return false;
  
  // 3. Enforce residential types
  if (!propType || typeof propType !== 'string') return false;
  const typeLower = propType.toLowerCase().trim();
  
  // Explicitly drop commercial listings
  if (COMMERCIAL_KEYWORDS.some(kw => typeLower.includes(kw))) {
    return false;
  }
  
  // Allow if exact match in allowlist OR contains common residential keywords
  const isAllowed = RESIDENTIAL_ALLOWLIST.includes(typeLower) ||
    typeLower.includes('apartment') ||
    typeLower.includes('flat') ||
    typeLower.includes('house') ||
    typeLower.includes('townhouse') ||
    typeLower.includes('studio') ||
    typeLower.includes('cottage') ||
    typeLower.includes('duplex') ||
    typeLower.includes('simplex') ||
    typeLower.includes('loft') ||
    typeLower.includes('penthouse') ||
    typeLower.includes('cluster') ||
    typeLower.includes('maisonette');
  
  return isAllowed;
}

const MONTH_MAP = {
  JAN: 0, JANUARY: 0,
  FEB: 1, FEBRUARY: 1,
  MAR: 2, MARCH: 2,
  APR: 3, APRIL: 3,
  MAY: 4,
  JUN: 5, JUNE: 5,
  JUL: 6, JULY: 6,
  AUG: 7, AUGUST: 7,
  SEP: 8, SEPTEMBER: 8,
  OCT: 9, OCTOBER: 9,
  NOV: 10, NOVEMBER: 10,
  DEC: 11, DECEMBER: 11
};

function parseAvailableDate(status) {
  if (!status || typeof status !== 'string') return null;
  const s = status.toUpperCase().trim();
  
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];

  if (
    s === 'AVAILABLE NOW' ||
    s === 'AVAILABLE IMMEDIATELY' ||
    s === 'AVAILABLE IMMEDIATE' ||
    s === 'IMMEDIATE' ||
    s === 'IMMEDIATELY' ||
    s === 'NOW'
  ) {
    return todayIso;
  }
  
  // Matches "AVAILABLE: 01 JUL", "AVAILABLE 1 JULY", "AVAILABLE FROM 15 AUG 2026", "01 JUL 2026", etc.
  const match = s.match(/(?:AVAILABLE(?::|\s+FROM|\s+AS\s+OF)?\s*)?(\d{1,2})\s+([A-Z]{3,9})(?:\s+(\d{4}))?/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthKey = match[2].toUpperCase();
    const explicitYear = match[3] ? parseInt(match[3], 10) : null;
    
    const month = MONTH_MAP[monthKey];
    if (month !== undefined && day >= 1 && day <= 31) {
      let year = explicitYear || today.getFullYear();
      
      // If no explicit year is present:
      // Recent past months (e.g. June/July when currently in August) belong to the current year.
      // Only rollover to next year if month is far in the past (e.g. > 7 months earlier, like Jan when in Dec).
      if (!explicitYear) {
        const currentMonth = today.getMonth();
        if (month < currentMonth && (currentMonth - month) > 7) {
          year += 1;
        }
      }
      
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }
  
  return null;
}

function extractBedrooms(title, description, rawBedrooms) {
  if (rawBedrooms !== undefined && rawBedrooms !== null) {
    const val = parseFloat(rawBedrooms);
    if (!isNaN(val) && val >= 0 && val <= 20) return val;
  }
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  
  // Look for decimals like "0.5 bedroom" or "1.5 beds"
  const bedMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:bedroom|bed|bd)/i);
  if (bedMatch) {
    const parsed = parseFloat(bedMatch[1]);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 20) return parsed;
  }
  
  if (text.includes('studio') || text.includes('bachelor')) {
    return 0.5;
  }
  
  return null;
}

function extractBathrooms(title, description, rawBathrooms) {
  if (rawBathrooms !== undefined && rawBathrooms !== null) {
    const val = parseFloat(rawBathrooms);
    if (!isNaN(val) && val >= 0 && val <= 20) return val;
  }
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  
  const bathMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:bathroom|bath|ba)/i);
  if (bathMatch) {
    const parsed = parseFloat(bathMatch[1]);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 20) return parsed;
  }
  
  return null;
}

function extractSize(title, description, rawSize) {
  if (rawSize !== undefined && rawSize !== null) {
    const val = parseInt(String(rawSize).replace(/[\s,]/g, ''), 10);
    if (!isNaN(val) && val >= 10 && val <= 3000) return val;
  }
  const text = ((title || '') + ' ' + (description || '')).toLowerCase();
  
  // Match size like "148m2", "148 m²", "148 sqm", "148 sq m", "148 sq.m", "148 square meters", etc.
  const sizeMatch = text.match(/(?:floor)?\s*(\d+(?:[\s,]\d+)?)\s*(?:m2|m²|sq\.?\s*m|sq\.?\s*meter|sq\.?\s*metre|square\s*meter|square\s*metre)s?/i);
  if (sizeMatch) {
    const cleaned = sizeMatch[1].replace(/[\s,]/g, '');
    const val = parseInt(cleaned, 10);
    if (!isNaN(val) && val >= 10 && val <= 3000) return val;
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
  const price = typeof raw.pricing?.price === 'number' ? raw.pricing.price : parseInt(raw.pricing?.price, 10) || 0;
  const title = raw.entity?.title || '';
  const desc = raw.entity?.description || '';
  
  const bedrooms = extractBedrooms(title, desc, raw.property?.bedrooms);
  const bathrooms = extractBathrooms(title, desc, raw.property?.bathrooms);
  const size = extractSize(title, desc, raw.property?.floor_area?.value);
  const pricePerM2 = (size && size > 0 && price > 0) ? Math.round(price / size) : null;
  
  const rawType = raw.property?.property_type || '';
  let propType = 'other';
  
  const typeLower = rawType.toLowerCase().trim();
  if (typeLower.includes('apartment') || typeLower.includes('flat') || typeLower.includes('studio') || typeLower.includes('loft')) {
    propType = 'apartment';
  } else if (typeLower.includes('house') || typeLower.includes('cottage')) {
    propType = 'house';
  } else if (typeLower.includes('townhouse') || typeLower.includes('cluster') || typeLower.includes('duplex') || typeLower.includes('maisonette') || typeLower.includes('simplex')) {
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
  const arr = nums.filter(n => n !== null && n !== undefined && !isNaN(n) && typeof n === 'number').sort((a, b) => a - b);
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
    if (item.price_per_m2 !== null && item.price_per_m2 !== undefined && item.price_per_m2 > 0) {
      (suburbPpm2[item.suburb] ||= []).push(item.price_per_m2);
    }
    if (item.price !== null && item.price !== undefined && item.price > 0 && item.bedrooms !== null && item.bedrooms !== undefined) {
      (suburbBedPrices[`${item.suburb}_beds_${item.bedrooms}`] ||= []).push(item.price);
    }
  });

  const suburbPpm2Median = {};
  for (const sub in suburbPpm2) suburbPpm2Median[sub] = medianOf(suburbPpm2[sub]);

  const suburbBedMedian = {};
  for (const key in suburbBedPrices) suburbBedMedian[key] = medianOf(suburbBedPrices[key]);

  // 2. Score each listing — prefer the price/m² basis, fall back to suburb+beds price.
  return normalisedListings.map(item => {
    if (item.price_per_m2 !== null && item.price_per_m2 !== undefined && item.price_per_m2 > 0) {
      const med = suburbPpm2Median[item.suburb];
      if (med && med > 0) {
        const score = parseFloat((med / item.price_per_m2).toFixed(2));
        if (isFinite(score) && score > 0) {
          return { ...item, value_score: score };
        }
      }
    }

    if (item.price !== null && item.price !== undefined && item.price > 0 && item.bedrooms !== null && item.bedrooms !== undefined) {
      const med = suburbBedMedian[`${item.suburb}_beds_${item.bedrooms}`];
      if (med && med > 0) {
        const score = parseFloat((med / item.price).toFixed(2));
        if (isFinite(score) && score > 0) {
          return { ...item, value_score: score };
        }
      }
    }

    return { ...item, value_score: null };
  });
}

module.exports = {
  isValid,
  parseAvailableDate,
  extractBedrooms,
  extractBathrooms,
  extractSize,
  extractFurnished,
  normaliseListing,
  computeValueScores
};
