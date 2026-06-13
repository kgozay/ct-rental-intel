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

function computeValueScores(normalisedListings) {
  // 1. Group listings by [suburb][bedrooms] and extract prices
  const suburbBedPrices = {};
  
  normalisedListings.forEach(item => {
    if (item.price !== null && item.price !== undefined && item.bedrooms !== null && item.bedrooms !== undefined) {
      const key = `${item.suburb}_beds_${item.bedrooms}`;
      if (!suburbBedPrices[key]) {
        suburbBedPrices[key] = [];
      }
      suburbBedPrices[key].push(item.price);
    }
  });
  
  // 2. Compute median price for each [suburb][bedrooms] group
  const suburbBedMedians = {};
  for (const key in suburbBedPrices) {
    const prices = suburbBedPrices[key].sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const median = prices.length % 2 !== 0 
      ? prices[mid] 
      : Math.round((prices[mid - 1] + prices[mid]) / 2);
    suburbBedMedians[key] = median;
  }
  
  // 3. Compute value score for each listing based on its suburb-bed median price
  return normalisedListings.map(item => {
    if (item.price === null || item.price === undefined || item.bedrooms === null || item.bedrooms === undefined) {
      return { ...item, value_score: null };
    }
    
    const key = `${item.suburb}_beds_${item.bedrooms}`;
    const median = suburbBedMedians[key];
    if (!median) {
      return { ...item, value_score: null };
    }
    
    // value_score = medianPriceForBedsInSuburb / listing.price
    const score = parseFloat((median / item.price).toFixed(2));
    return { ...item, value_score: score };
  });
}

module.exports = {
  isValid,
  parseAvailableDate,
  normaliseListing,
  computeValueScores
};
