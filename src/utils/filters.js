import { SUBURBS_LIST } from './suburbs';
import { DEFAULT_FILTERS, PRICE_CAP, DEFAULT_SORT } from '../constants/filterConstants';
import { isValueOpportunity } from './valuation';

export function daysAgo(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  if (isNaN(diff)) return null;
  return Math.max(0, Math.floor(diff / 86400000));
}

export const isPriceDrop = (item) =>
  Boolean(item?.previous_price && item.price < item.previous_price);

/** Fill in any keys missing from older saved searches / URLs. */
export function normaliseFilters(filters = {}) {
  return { ...DEFAULT_FILTERS, ...filters };
}

/**
 * Pure predicate shared by the results list, saved-search match counts and
 * empty-state explanations. `item.valuation` is attached in App.
 */
export function matchesFilters(item, rawFilters, { shortlisted } = {}) {
  const filters = normaliseFilters(rawFilters);
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    const fields = [item.address, item.suburb, item.property_type, item.agency_name];
    if (!fields.some(f => f && f.toLowerCase().includes(q))) return false;
  }
  if (filters.suburbs.length > 0 && !filters.suburbs.includes(item.suburb)) return false;
  if (filters.minPrice > 0 && item.price < filters.minPrice) return false;
  if (filters.maxPrice < PRICE_CAP && item.price > filters.maxPrice) return false;
  if (filters.minBeds === 'studio') {
    if (item.bedrooms !== 0) return false;
  } else if (filters.minBeds !== null && (item.bedrooms === null || item.bedrooms === undefined || item.bedrooms < filters.minBeds)) {
    return false;
  }
  if (filters.minBaths !== null && (item.bathrooms === null || item.bathrooms === undefined || item.bathrooms < filters.minBaths)) return false;
  if (filters.minSize > 0 && (!item.size_m2 || item.size_m2 < filters.minSize)) return false;
  if (filters.propertyTypes.length > 0 && !filters.propertyTypes.includes(item.property_type)) return false;
  if (filters.furnished !== null && item.furnished !== filters.furnished) return false;
  if (filters.goodValueOnly && !isValueOpportunity(item.valuation)) return false;
  if (filters.priceDropOnly && !isPriceDrop(item)) return false;
  if (filters.availableBefore) {
    if (!item.available_date) {
      if (!filters.includeUnknownAvail) return false;
    } else if (item.available_date > filters.availableBefore) {
      return false;
    }
  }
  if (filters.shortlistOnly && !shortlisted?.has(item.url)) return false;
  return true;
}

export function countActiveFilters(rawFilters) {
  const f = normaliseFilters(rawFilters);
  let n = 0;
  if (f.search?.trim()) n++;
  if (f.suburbs.length < SUBURBS_LIST.length) n++;
  if (f.minPrice > 0 || f.maxPrice < PRICE_CAP) n++;
  if (f.minBeds !== null) n++;
  if (f.minBaths !== null) n++;
  if (f.minSize > 0) n++;
  if (f.propertyTypes.length) n++;
  if (f.furnished !== null) n++;
  if (f.goodValueOnly) n++;
  if (f.priceDropOnly) n++;
  if (f.availableBefore) n++;
  if (f.shortlistOnly) n++;
  return n;
}

const compareNullsLast = (a, b, asc) => {
  const aNull = a === null || a === undefined || (typeof a === 'number' && isNaN(a));
  const bNull = b === null || b === undefined || (typeof b === 'number' && isNaN(b));
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (a < b) return asc ? -1 : 1;
  if (a > b) return asc ? 1 : -1;
  return 0;
};

const SORT_ACCESSORS = {
  suburb: l => l.suburb || null,
  property_type: l => l.property_type || null,
  bedrooms: l => l.bedrooms,
  bathrooms: l => l.bathrooms,
  price: l => l.price,
  size_m2: l => l.size_m2,
  price_per_m2: l => l.price_per_m2,
  value_score: l => l.value_score,
  agency_name: l => l.agency_name || null,
  days: l => daysAgo(l.created_at),
  available: l => l.available_date || null,
};

export function sortListings(listings, sort = DEFAULT_SORT) {
  const get = SORT_ACCESSORS[sort.field] || SORT_ACCESSORS.price;
  return [...listings].sort((a, b) =>
    compareNullsLast(get(a), get(b), sort.asc) || compareNullsLast(a.price, b.price, true)
  );
}

export const sortToId = (sort) => `${sort.field}:${sort.asc ? 'asc' : 'desc'}`;

export function sortFromId(id) {
  if (!id || typeof id !== 'string') return { ...DEFAULT_SORT };
  const [field, dir] = id.split(':');
  if (!SORT_ACCESSORS[field]) return { ...DEFAULT_SORT };
  return { field, asc: dir !== 'desc' };
}

const parseIntOr = (v, fallback) => {
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
};

/** Read filters from a URL query string (deep links, landing barometer). */
export function filtersFromSearch(search) {
  const params = new URLSearchParams(search);
  const subParam = params.get('suburbs');
  const beds = params.get('minBeds');
  const baths = params.get('minBaths');
  const furn = params.get('furnished');
  const types = params.get('types');
  return normaliseFilters({
    search: params.get('search') || '',
    suburbs: subParam ? subParam.split(',').filter(s => SUBURBS_LIST.includes(s)) : [...SUBURBS_LIST],
    minPrice: parseIntOr(params.get('minPrice'), 0),
    maxPrice: parseIntOr(params.get('maxPrice'), PRICE_CAP),
    minBeds: beds === 'studio' ? 'studio' : beds ? parseIntOr(beds, null) : null,
    minBaths: baths ? parseIntOr(baths, null) : null,
    minSize: parseIntOr(params.get('minSize'), 0),
    propertyTypes: types ? types.split(',').filter(Boolean) : [],
    furnished: furn === 'true' ? true : furn === 'false' ? false : null,
    goodValueOnly: params.get('goodValue') === 'true',
    priceDropOnly: params.get('priceDrop') === 'true',
    availableBefore: params.get('avail') || '',
    includeUnknownAvail: params.get('unknownAvail') !== 'false',
    shortlistOnly: params.get('shortlist') === 'true',
  });
}

/** Write non-default filters into URLSearchParams. */
export function filtersToParams(rawFilters, params = new URLSearchParams()) {
  const f = normaliseFilters(rawFilters);
  if (f.search) params.set('search', f.search);
  if (f.suburbs.length < SUBURBS_LIST.length) params.set('suburbs', f.suburbs.join(','));
  if (f.minPrice > 0) params.set('minPrice', String(f.minPrice));
  if (f.maxPrice < PRICE_CAP) params.set('maxPrice', String(f.maxPrice));
  if (f.minBeds !== null) params.set('minBeds', String(f.minBeds));
  if (f.minBaths !== null) params.set('minBaths', String(f.minBaths));
  if (f.minSize > 0) params.set('minSize', String(f.minSize));
  if (f.propertyTypes.length) params.set('types', f.propertyTypes.join(','));
  if (f.furnished !== null) params.set('furnished', String(f.furnished));
  if (f.goodValueOnly) params.set('goodValue', 'true');
  if (f.priceDropOnly) params.set('priceDrop', 'true');
  if (f.availableBefore) params.set('avail', f.availableBefore);
  if (!f.includeUnknownAvail) params.set('unknownAvail', 'false');
  if (f.shortlistOnly) params.set('shortlist', 'true');
  return params;
}
