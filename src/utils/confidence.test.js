import { describe, it, expect } from 'vitest';
import { getConfidenceLevel, getValueVerdict, CONFIDENCE_THRESHOLDS } from './confidence';

describe('confidence utility', () => {
  it('correctly maps sample size to confidence level', () => {
    expect(getConfidenceLevel(CONFIDENCE_THRESHOLDS.HIGH)).toBe('high');
    expect(getConfidenceLevel(25)).toBe('high');
    expect(getConfidenceLevel(19)).toBe('medium');
    expect(getConfidenceLevel(CONFIDENCE_THRESHOLDS.MEDIUM)).toBe('medium');
    expect(getConfidenceLevel(7)).toBe('low');
    expect(getConfidenceLevel(CONFIDENCE_THRESHOLDS.LOW)).toBe('low');
    expect(getConfidenceLevel(2)).toBe('insufficient');
    expect(getConfidenceLevel(0)).toBe('insufficient');
    expect(getConfidenceLevel(null)).toBe('insufficient');
  });

  it('correctly evaluates value verdict based on score and confidence', () => {
    // Insufficient confidence yields unrated
    expect(getValueVerdict(1.4, 'insufficient')).toEqual({ verdict: 'unrated', label: 'Insufficient data' });
    // High / medium confidence with score >= 1.2 yields Good value
    expect(getValueVerdict(1.25, 'high')).toEqual({ verdict: 'good_value', label: 'Good value' });
    expect(getValueVerdict(1.3, 'medium')).toEqual({ verdict: 'good_value', label: 'Good value' });
    // Low confidence with score >= 1.2 yields Potential value
    expect(getValueVerdict(1.3, 'low')).toEqual({ verdict: 'potential_value', label: 'Potential value' });
    // Score <= 0.8 yields Premium price
    expect(getValueVerdict(0.75, 'high')).toEqual({ verdict: 'premium_price', label: 'Premium price' });
    // Middle score yields Typical price
    expect(getValueVerdict(1.0, 'high')).toEqual({ verdict: 'typical_price', label: 'Typical price' });
  });
});
