// Frontend normalisation and value scoring utilities
export const COMMERCIAL_KEYWORDS = [
  'commercial', 'office', 'retail', 'industrial', 'warehouse',
  'storage', 'parking', 'farm', 'land', 'business', 'showroom', 'factory'
];

export const RESIDENTIAL_ALLOWLIST = [
  'apartment / flat', 'flat', 'apartment', 'house', 'townhouse',
  'cluster', 'duplex', 'penthouse', 'studio', 'maisonette',
  'garden cottage', 'cottage', 'estate', 'residential estate',
  'loft', 'simplex', 'bachelor', 'room'
];

export function isValid(raw) {
  if (!raw) return false;
  const price = raw.pricing?.price;
  const priceText = raw.pricing?.price_text;
  const propType = raw.property?.property_type;
  
  if (!price || priceText === 'POA') return false;
  if (typeof price !== 'number' || price <= 0 || price > 150000) return false;
  if (!propType || typeof propType !== 'string') return false;
  
  const typeLower = propType.toLowerCase().trim();
  if (COMMERCIAL_KEYWORDS.some(kw => typeLower.includes(kw))) return false;
  
  return RESIDENTIAL_ALLOWLIST.includes(typeLower) ||
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
}

export function computeValueScores(normalisedListings) {
  const suburbPpm2 = {};
  const suburbBedPrices = {};

  const medianOf = (nums) => {
    const arr = nums.filter(n => n !== null && n !== undefined && !isNaN(n) && typeof n === 'number').sort((a, b) => a - b);
    if (arr.length === 0) return null;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
  };

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
