/**
 * CommonJS confidence utility for Vercel serverless functions.
 */

const CONFIDENCE_THRESHOLDS = {
  HIGH: 20,
  MEDIUM: 8,
  LOW: 3,
};

function getConfidenceLevel(sampleSize) {
  const count = typeof sampleSize === 'number' && !isNaN(sampleSize) ? sampleSize : 0;
  if (count >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (count >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  if (count >= CONFIDENCE_THRESHOLDS.LOW) return 'low';
  return 'insufficient';
}

function getValueVerdict(valueScore, confidenceLevel) {
  if (confidenceLevel === 'insufficient') {
    return { verdict: 'unrated', label: 'Insufficient data' };
  }
  const score = typeof valueScore === 'number' ? valueScore : 0;
  if (score >= 1.2) {
    return confidenceLevel === 'low'
      ? { verdict: 'potential_value', label: 'Potential value' }
      : { verdict: 'good_value', label: 'Good value' };
  }
  if (score <= 0.8) {
    return { verdict: 'premium_price', label: 'Premium price' };
  }
  return { verdict: 'typical_price', label: 'Typical price' };
}

module.exports = {
  CONFIDENCE_THRESHOLDS,
  getConfidenceLevel,
  getValueVerdict,
};
