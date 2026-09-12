import { describe, it, expect } from 'vitest';
import { isValid, parseAvailableDate } from './normalise';

describe('normalise utilities', () => {
  describe('isValid', () => {
    it('accepts valid apartment listing', () => {
      const listing = {
        pricing: { price: 18500, price_text: 'R 18 500' },
        property: { property_type: 'Apartment' }
      };
      expect(isValid(listing)).toBe(true);
    });

    it('rejects POA listings', () => {
      const listing = {
        pricing: { price: 20000, price_text: 'POA' },
        property: { property_type: 'Apartment' }
      };
      expect(isValid(listing)).toBe(false);
    });

    it('rejects commercial properties', () => {
      const listing = {
        pricing: { price: 25000, price_text: 'R 25 000' },
        property: { property_type: 'Commercial Office' }
      };
      expect(isValid(listing)).toBe(false);
    });

    it('rejects out-of-bound prices', () => {
      expect(isValid({ pricing: { price: -500 }, property: { property_type: 'Flat' } })).toBe(false);
      expect(isValid({ pricing: { price: 250000 }, property: { property_type: 'Flat' } })).toBe(false);
    });
  });

  describe('parseAvailableDate', () => {
    it('handles NOW and IMMEDIATELY', () => {
      const todayIso = new Date().toISOString().split('T')[0];
      expect(parseAvailableDate('AVAILABLE NOW')).toBe(todayIso);
      expect(parseAvailableDate('AVAILABLE IMMEDIATELY')).toBe(todayIso);
    });

    it('handles standard dates', () => {
      const result = parseAvailableDate('Available 01 Dec 2026');
      expect(result).toBe('2026-12-01');
    });

    it('returns null for unparseable status', () => {
      expect(parseAvailableDate('Contact Agent')).toBeNull();
      expect(parseAvailableDate('')).toBeNull();
    });
  });
});
