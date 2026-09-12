/**
 * Pure functions for data status calculation and presentation.
 */

export const DATA_STATES = {
  LIVE: 'live',
  CACHED: 'cached',
  PARTIAL: 'partial',
  EMPTY: 'empty',
  UNAVAILABLE: 'unavailable',
  BASELINE: 'baseline',
};

export const COOLDOWN_HOURS = 48; // 2 days limit

/**
 * Calculates human-readable age and formatted status message.
 */
export function formatDataStatus(dataStatus) {
  if (!dataStatus) {
    return {
      state: DATA_STATES.UNAVAILABLE,
      title: 'Data Unavailable',
      description: 'Unable to connect to market intelligence service. Please check your connection.',
      badgeClass: 'bg-red text-white'
    };
  }

  const { state, ageHours, lastSuccessfulScrapeAt, completedSuburbs = [], isRefreshing } = dataStatus;

  if (isRefreshing) {
    const completedCount = completedSuburbs.length;
    return {
      state: 'refreshing',
      title: 'Updating Market Data',
      description: `Updating ${completedCount} of 7 suburbs. You can continue using the existing snapshot while it runs.`,
      badgeClass: 'bg-yellow text-ink animate-pulse'
    };
  }

  switch (state) {
    case DATA_STATES.LIVE:
      return {
        state: DATA_STATES.LIVE,
        title: 'Live Market Data',
        description: `Verified within the last 48 hours across all 7 suburbs (${formatAge(ageHours)}).`,
        badgeClass: 'bg-lime text-ink'
      };

    case DATA_STATES.CACHED:
      return {
        state: DATA_STATES.CACHED,
        title: 'Cached Snapshot',
        description: `Last complete snapshot from ${formatTimestamp(lastSuccessfulScrapeAt)}. Updates available every 2 days.`,
        badgeClass: 'bg-white text-ink border border-ink/40'
      };

    case DATA_STATES.PARTIAL:
      return {
        state: DATA_STATES.PARTIAL,
        title: 'Partial Coverage',
        description: `${completedSuburbs.length} of 7 suburbs active. Some areas temporarily unavailable.`,
        badgeClass: 'bg-yellow text-ink'
      };

    case DATA_STATES.BASELINE:
      return {
        state: DATA_STATES.BASELINE,
        title: 'Baseline Estimate',
        description: 'Illustrative benchmark figures shown for demonstration.',
        badgeClass: 'bg-paper text-ink border border-ink/30'
      };

    case DATA_STATES.EMPTY:
      return {
        state: DATA_STATES.EMPTY,
        title: 'No Market Snapshot Yet',
        description: 'No listings currently recorded. Trigger a user scrape to populate data.',
        badgeClass: 'bg-paper text-ink border border-ink/30'
      };

    case DATA_STATES.UNAVAILABLE:
    default:
      return {
        state: DATA_STATES.UNAVAILABLE,
        title: 'Data Unavailable',
        description: 'Could not retrieve listing evidence. Try again in a moment.',
        badgeClass: 'bg-red text-white'
      };
  }
}

export function formatAge(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) return 'unknown age';
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`;
}

export function formatTimestamp(isoString) {
  if (!isoString) return 'Never';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (isNaN(diffMs)) return 'Never';
  const hours = diffMs / (1000 * 60 * 60);
  return formatAge(hours);
}

