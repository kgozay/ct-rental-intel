import { describe, it, expect } from 'vitest';
import { buildComparables, getListingValuation, isValueOpportunity } from './valuation';

const mk = (over) => ({ suburb: 'Sea Point', price: 20000, bedrooms: 1, price_per_m2: 300, value_score: 1, ...over });

describe('valuation', () => {
  it('derives the benchmark as value × score (not value ÷ score)', () => {
    // value_score = median / listing  =>  median = listing × score
    const listings = Array.from({ length: 10 }, (_, i) => mk({ url: String(i) }));
    const comps = buildComparables(listings);
    const v = getListingValuation(mk({ price_per_m2: 300, value_score: 0.73 }), comps);
    expect(v.basis).toBe('ppm');
    expect(v.benchmark).toBe(219);
    expect(v.diffPercent).toBeLessThan(0); // pricier than the median
    expect(v.verdict).toBe('premium_price');
  });

  it('uses the real comparable count for confidence', () => {
    const few = buildComparables(Array.from({ length: 5 }, () => mk()));
    const many = buildComparables(Array.from({ length: 25 }, () => mk()));
    expect(getListingValuation(mk({ value_score: 1.3 }), few)).toMatchObject({ sampleSize: 5, confidence: 'low', verdict: 'potential_value' });
    expect(getListingValuation(mk({ value_score: 1.3 }), many)).toMatchObject({ sampleSize: 25, confidence: 'high', verdict: 'good_value' });
    expect(getListingValuation(mk({ value_score: 1.3 }), buildComparables([mk()])).verdict).toBe('unrated');
  });

  it('falls back to same-bedroom rent when there is no floor area', () => {
    const listings = [
      mk({ price_per_m2: null, bedrooms: 2, price: 25000 }),
      mk({ price_per_m2: null, bedrooms: 2, price: 26000 }),
      mk({ price_per_m2: null, bedrooms: 2, price: 27000 }),
      mk({ price_per_m2: null, bedrooms: 1, price: 15000 }),
    ];
    const v = getListingValuation(mk({ price_per_m2: null, bedrooms: 2, price: 20000, value_score: 1.3 }), buildComparables(listings));
    expect(v.basis).toBe('beds');
    expect(v.sampleSize).toBe(3);
    expect(v.benchmark).toBe(26000);
  });

  it('counts studios (0 bedrooms) as their own group', () => {
    const comps = buildComparables([mk({ bedrooms: 0, price_per_m2: null }), mk({ bedrooms: 0, price_per_m2: null })]);
    expect(comps['Sea Point'].beds['0']).toBe(2);
  });

  it('treats missing scores as unrated, not premium', () => {
    const v = getListingValuation(mk({ value_score: null }), {});
    expect(v.verdict).toBe('unrated');
    expect(isValueOpportunity(v)).toBe(false);
  });
});
