import { getConfidenceLevel, getValueVerdict } from './confidence';

/**
 * Valuation evidence derived from the listings currently on screen.
 *
 * value_score is computed at ingest (api/normalise.js) on one of two bases:
 *   - 'ppm'  : suburbMedian(price_per_m2) / listing.price_per_m2
 *   - 'beds' : suburbBedMedian(price) / listing.price   (when size is unknown)
 *
 * So the benchmark that produced a score is always `listing value × score`,
 * never `value ÷ score`.
 */

const bedKey = (beds) => (beds === null || beds === undefined ? null : String(beds));

/**
 * Count comparables per suburb for both scoring bases.
 * @returns {{ [suburb: string]: { ppm: number, beds: { [beds: string]: number } } }}
 */
export function buildComparables(listings = []) {
  const out = {};
  for (const l of listings) {
    if (!l?.suburb) continue;
    const entry = (out[l.suburb] ||= { ppm: 0, beds: {} });
    if (typeof l.price_per_m2 === 'number' && l.price_per_m2 > 0) entry.ppm += 1;
    const key = bedKey(l.bedrooms);
    if (key !== null && typeof l.price === 'number' && l.price > 0) {
      entry.beds[key] = (entry.beds[key] || 0) + 1;
    }
  }
  return out;
}

/**
 * Explain one listing's value score against its comparables.
 */
export function getListingValuation(listing, comparables = {}) {
  const score = typeof listing?.value_score === 'number' && listing.value_score > 0 ? listing.value_score : null;
  const hasPpm = typeof listing?.price_per_m2 === 'number' && listing.price_per_m2 > 0;
  const subComps = comparables[listing?.suburb] || { ppm: 0, beds: {} };

  let basis = null;
  let sampleSize = 0;
  let listingValue = null;
  if (score !== null && hasPpm) {
    basis = 'ppm';
    sampleSize = subComps.ppm;
    listingValue = listing.price_per_m2;
  } else if (score !== null && typeof listing?.price === 'number') {
    basis = 'beds';
    sampleSize = subComps.beds[bedKey(listing.bedrooms)] || 0;
    listingValue = listing.price;
  }

  const benchmark = basis ? Math.round(listingValue * score) : null;
  const diffPercent = benchmark ? Math.round(((benchmark - listingValue) / benchmark) * 100) : null;
  const confidence = basis ? getConfidenceLevel(sampleSize) : 'insufficient';
  const { verdict, label } = score === null
    ? { verdict: 'unrated', label: 'Not rated' }
    : getValueVerdict(score, confidence);

  return { score, basis, listingValue, benchmark, diffPercent, sampleSize, confidence, verdict, label };
}

export const isValueOpportunity = (valuation) =>
  valuation?.verdict === 'good_value' || valuation?.verdict === 'potential_value';
