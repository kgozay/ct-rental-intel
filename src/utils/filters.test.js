import { describe, it, expect } from 'vitest';
import { matchesFilters, sortListings, filtersFromSearch, filtersToParams, countActiveFilters } from './filters';
import { DEFAULT_FILTERS } from '../constants/filterConstants';

const base = { suburb: 'Sea Point', price: 20000, bedrooms: 1, bathrooms: 1, size_m2: 50, property_type: 'Apartment', url: 'u' };
const f = (over) => ({ ...DEFAULT_FILTERS, ...over });

describe('matchesFilters', () => {
  it('matches everything with default filters', () => {
    expect(matchesFilters(base, DEFAULT_FILTERS)).toBe(true);
  });

  it('supports studio-only and min-bedroom filters', () => {
    expect(matchesFilters({ ...base, bedrooms: 0 }, f({ minBeds: 'studio' }))).toBe(true);
    expect(matchesFilters(base, f({ minBeds: 'studio' }))).toBe(false);
    expect(matchesFilters({ ...base, bedrooms: 0 }, f({ minBeds: 1 }))).toBe(false);
  });

  it('applies min rent, min size, baths and property type', () => {
    expect(matchesFilters(base, f({ minPrice: 25000 }))).toBe(false);
    expect(matchesFilters(base, f({ minSize: 60 }))).toBe(false);
    expect(matchesFilters({ ...base, size_m2: null }, f({ minSize: 10 }))).toBe(false);
    expect(matchesFilters(base, f({ minBaths: 2 }))).toBe(false);
    expect(matchesFilters(base, f({ propertyTypes: ['House'] }))).toBe(false);
    expect(matchesFilters(base, f({ propertyTypes: ['Apartment'] }))).toBe(true);
  });

  it('lets users exclude listings with no availability date', () => {
    const noDate = { ...base, available_date: null };
    expect(matchesFilters(noDate, f({ availableBefore: '2026-12-01' }))).toBe(true);
    expect(matchesFilters(noDate, f({ availableBefore: '2026-12-01', includeUnknownAvail: false }))).toBe(false);
    expect(matchesFilters({ ...base, available_date: '2027-01-01' }, f({ availableBefore: '2026-12-01' }))).toBe(false);
  });

  it('uses the valuation verdict for good-value-only', () => {
    expect(matchesFilters({ ...base, valuation: { verdict: 'good_value' } }, f({ goodValueOnly: true }))).toBe(true);
    expect(matchesFilters({ ...base, valuation: { verdict: 'potential_value' } }, f({ goodValueOnly: true }))).toBe(true);
    expect(matchesFilters({ ...base, value_score: 1.18, valuation: { verdict: 'typical_price' } }, f({ goodValueOnly: true }))).toBe(false);
  });

  it('fills in keys missing from older saved searches', () => {
    expect(matchesFilters(base, { suburbs: ['Sea Point'], maxPrice: 80000 })).toBe(true);
  });
});

describe('sortListings', () => {
  it('sorts nulls last in both directions', () => {
    const rows = [{ url: 'a', price: 1, value_score: null }, { url: 'b', price: 2, value_score: 1.4 }, { url: 'c', price: 3, value_score: 0.9 }];
    expect(sortListings(rows, { field: 'value_score', asc: false }).map(r => r.url)).toEqual(['b', 'c', 'a']);
    expect(sortListings(rows, { field: 'value_score', asc: true }).map(r => r.url)).toEqual(['c', 'b', 'a']);
  });
});

describe('URL round trip', () => {
  it('serialises and parses every filter', () => {
    const filters = f({
      search: 'loft', suburbs: ['Gardens', 'Sea Point'], minPrice: 12000, maxPrice: 30000, minBeds: 'studio',
      minBaths: 2, minSize: 40, propertyTypes: ['Apartment'], furnished: false, goodValueOnly: true,
      priceDropOnly: true, availableBefore: '2026-12-01', includeUnknownAvail: false, shortlistOnly: true,
    });
    const parsed = filtersFromSearch(`?${filtersToParams(filters).toString()}`);
    expect(parsed).toEqual(filters);
    // min + max rent count as a single price filter
    expect(countActiveFilters(parsed)).toBe(12);
  });

  it('produces an empty query for defaults', () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('');
  });
});
