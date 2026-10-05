import { SUBURBS_LIST } from './suburbs';
import { PRICE_CAP } from '../constants/filterConstants';
import { normaliseFilters } from './filters';

/** Human-readable one-line summary of a filter set, e.g. "Sea Point · ≤ R25k · 2+ beds". */
export function describeFilters(rawFilters) {
  const filters = normaliseFilters(rawFilters);
  const parts = [];
  if (filters.suburbs.length && filters.suburbs.length < SUBURBS_LIST.length) {
    parts.push(filters.suburbs.length <= 2 ? filters.suburbs.join(' & ') : `${filters.suburbs.length} suburbs`);
  } else {
    parts.push('All suburbs');
  }
  if (filters.minPrice > 0 && filters.maxPrice < PRICE_CAP) {
    parts.push(`R${Math.round(filters.minPrice / 1000)}k–R${Math.round(filters.maxPrice / 1000)}k`);
  } else if (filters.maxPrice < PRICE_CAP) {
    parts.push(`≤ R${Math.round(filters.maxPrice / 1000)}k`);
  } else if (filters.minPrice > 0) {
    parts.push(`≥ R${Math.round(filters.minPrice / 1000)}k`);
  }
  if (filters.minBeds === 'studio') parts.push('Studio');
  else if (filters.minBeds !== null) parts.push(`${filters.minBeds}+ beds`);
  if (filters.minSize > 0) parts.push(`≥ ${filters.minSize}m²`);
  if (filters.furnished === true) parts.push('Furnished');
  if (filters.furnished === false) parts.push('Unfurnished');
  if (filters.goodValueOnly) parts.push('Good value');
  if (filters.priceDropOnly) parts.push('Price drops');
  if (filters.search?.trim()) parts.push(`“${filters.search.trim()}”`);
  return parts.join(' · ');
}
