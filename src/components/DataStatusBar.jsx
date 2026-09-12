import { formatDataStatus } from '../utils/dataStatus';

export default function DataStatusBar({
  dataStatus,
  onRefresh,
  isRefreshing,
  feedbackMessage,
  onClearFeedback
}) {
  const statusInfo = formatDataStatus(dataStatus);
  const isFirstRun = dataStatus?.state === 'empty';

  return (
    <aside aria-label="Market Data Status" className="mb-4">
      <div className="border-2 border-ink bg-paper p-3 shadow-[3px_3px_0_#111111] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left: Status Indicator & Details */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className={`inline-block px-2.5 py-1 text-xs font-black uppercase tracking-wider ${statusInfo.badgeClass}`}>
            {statusInfo.title}
          </span>
          <p className="text-xs font-medium text-ink/80 leading-snug m-0">
            {statusInfo.description}
          </p>
        </div>

        {/* Right: Coverage + Refresh Button */}
        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
          {dataStatus && (
            <div className="text-xs font-mono font-bold text-ink/70 hidden sm:block">
              <span>{dataStatus.listingCount || 0} listings</span>
              <span className="mx-1.5">•</span>
              <span>{(dataStatus.completedSuburbs || []).length}/7 suburbs</span>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="border-2 border-ink bg-yellow px-3 py-1.5 text-xs font-black uppercase tracking-wider text-ink hover:bg-yellow/80 active:translate-x-[1px] active:translate-y-[1px] shadow-[2px_2px_0_#111111] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isRefreshing
              ? 'Updating...'
              : isFirstRun
              ? 'Create Market Snapshot'
              : 'Update Market Snapshot'}
          </button>
        </div>
      </div>

      {/* Actionable Feedback message banner */}
      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-2 p-2.5 text-xs font-bold border-2 border-ink flex items-center justify-between shadow-[2px_2px_0_#111111] ${
            feedbackMessage.type === 'error'
              ? 'bg-red text-white'
              : feedbackMessage.type === 'success'
              ? 'bg-lime text-ink'
              : 'bg-paper text-ink'
          }`}
        >
          <span>{feedbackMessage.message}</span>
          {onClearFeedback && (
            <button
              onClick={onClearFeedback}
              className="ml-2 px-1.5 py-0.5 text-[10px] font-black uppercase border border-current hover:opacity-75 cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
