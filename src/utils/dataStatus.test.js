import { describe, it, expect } from 'vitest';
import { formatDataStatus, formatAge, DATA_STATES } from './dataStatus';

describe('dataStatus utility', () => {
  it('formats live data state accurately', () => {
    const status = formatDataStatus({
      state: DATA_STATES.LIVE,
      ageHours: 2.5,
      completedSuburbs: ['Gardens', 'Sea Point'],
      isRefreshing: false
    });
    expect(status.state).toBe('live');
    expect(status.title).toBe('Live Market Data');
    expect(status.badgeClass).toContain('bg-lime');
  });

  it('formats refreshing state during active run', () => {
    const status = formatDataStatus({
      state: DATA_STATES.LIVE,
      ageHours: 1,
      completedSuburbs: ['Gardens', 'Sea Point', 'Green Point'],
      isRefreshing: true
    });
    expect(status.state).toBe('refreshing');
    expect(status.title).toBe('Updating Market Data');
    expect(status.description).toContain('3 of 7 suburbs');
  });

  it('formats empty and unavailable states safely', () => {
    expect(formatDataStatus(null).state).toBe(DATA_STATES.UNAVAILABLE);
    expect(formatDataStatus({ state: DATA_STATES.EMPTY }).state).toBe(DATA_STATES.EMPTY);
  });

  it('formats age correctly into hours and days', () => {
    expect(formatAge(0.5)).toBe('less than an hour ago');
    expect(formatAge(5)).toBe('5h ago');
    expect(formatAge(48)).toBe('2d ago');
    expect(formatAge(52)).toBe('2d 4h ago');
  });
});
