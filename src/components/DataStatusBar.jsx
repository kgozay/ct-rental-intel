import { formatDataStatus, COOLDOWN_HOURS } from '../utils/dataStatus';
import Icon from './Icon';

export default function DataStatusBar({
  dataStatus,
  onRefresh,
  onRetry,
  isRefreshing,
  feedbackMessage,
  onClearFeedback,
}) {
  const statusInfo = formatDataStatus(dataStatus);
  const state = dataStatus?.state;
  const isUnavailable = !dataStatus || state === 'unavailable';
  const isFirstRun = state === 'empty';
  const failed = dataStatus?.failedSuburbs || [];

  // Server-computed snapshot age keeps render pure (no clock reads here).
  const cooldown = dataStatus?.cooldownHours || COOLDOWN_HOURS;
  const age = typeof dataStatus?.ageHours === 'number' ? dataStatus.ageHours : null;
  const coolingDown = !isUnavailable && !isFirstRun && !isRefreshing && age !== null && age < cooldown;
  const hoursLeft = coolingDown ? Math.max(1, Math.ceil(cooldown - age)) : 0;

  const btn = 'min-h-[38px] border-2 border-ink px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-[2px_2px_0_#111111] transition-all inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-blue';

  return (
    <aside aria-label="Market data status" className="mb-4">
      <div className="border-2 border-ink bg-paper p-3 shadow-[3px_3px_0_#111111] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className={`inline-block px-2.5 py-1 text-xs font-black uppercase tracking-wider ${statusInfo.badgeClass}`}>
            {statusInfo.title}
          </span>
          <p className="text-xs font-medium text-ink/90 leading-snug m-0">
            {statusInfo.description}
            {failed.length > 0 && !isRefreshing && <> Missing: {failed.join(', ')}.</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:justify-end shrink-0">
          {dataStatus && !isUnavailable && (
            <div className="text-xs font-mono font-bold text-ink/80">
              {dataStatus.listingCount || 0} listings · {(dataStatus.completedSuburbs || []).length}/{dataStatus.expectedSuburbs || 7} suburbs
            </div>
          )}

          {isUnavailable ? (onRetry && (
            <button type="button" onClick={onRetry} className={`${btn} bg-white text-ink hover:bg-yellow cursor-pointer`}>
              <Icon name="refresh" /> Retry
            </button>
          )) : coolingDown ? (
            <button
              type="button"
              onClick={onRefresh}
              className={`${btn} bg-white text-ink/80 cursor-pointer hover:bg-neutral-100`}
              title={`Snapshots are limited to one every ${cooldown} hours.`}
            >
              Next update in {hoursLeft}h
            </button>
          ) : (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`${btn} bg-yellow text-ink hover:bg-yellow/80 cursor-pointer disabled:opacity-70 disabled:cursor-wait`}
            >
              {isRefreshing ? <><Icon name="spinner" /> Updating…</> : <><Icon name="refresh" /> {isFirstRun ? 'Create market snapshot' : 'Update market snapshot'}</>}
            </button>
          )}
        </div>
      </div>

      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-2 p-2.5 text-xs font-bold border-2 border-ink flex items-center justify-between gap-2 ${
            feedbackMessage.type === 'error' ? 'bg-bred text-white' : feedbackMessage.type === 'success' ? 'bg-lime text-ink' : 'bg-white text-ink'
          }`}
        >
          <span>{feedbackMessage.message}</span>
          {onClearFeedback && (
            <button
              type="button"
              onClick={onClearFeedback}
              className="w-8 h-8 shrink-0 inline-flex items-center justify-center border border-current hover:opacity-75 cursor-pointer"
              aria-label="Dismiss message"
            >
              <Icon name="close" size={10} />
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
