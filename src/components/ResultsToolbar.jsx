import { useRef } from 'react';
import Icon from './Icon';
import { SORT_OPTIONS } from '../constants/filterConstants';
import { sortToId } from '../utils/filters';
import { VIEW_TABS } from '../constants/views';


export default function ResultsToolbar({
  totalCount,
  activeTab,
  onTabChange,
  shortlistedCount = 0,
  onExportCsv,
  showExport = true,
  sort,
  onSortChange,
  showSort = true,
}) {
  const tabRefs = useRef({});

  const focusTab = (id) => {
    onTabChange(id);
    // Move focus with the selection (roving tabindex).
    requestAnimationFrame(() => tabRefs.current[id]?.focus());
  };

  const handleKeyDown = (e) => {
    const currentIndex = VIEW_TABS.findIndex(t => t.id === activeTab);
    if (currentIndex === -1) return;
    let next = null;
    if (e.key === 'ArrowRight') next = (currentIndex + 1) % VIEW_TABS.length;
    else if (e.key === 'ArrowLeft') next = (currentIndex - 1 + VIEW_TABS.length) % VIEW_TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = VIEW_TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    focusTab(VIEW_TABS[next].id);
  };

  const currentSortId = sort ? sortToId(sort) : null;
  const sortIsPreset = SORT_OPTIONS.some(o => o.id === currentSortId);

  return (
    <div className="flex flex-col gap-3 mb-4 pb-3 border-b-2 border-ink/20">
      <div
        style={{ overflowX: 'auto' }}
        className="flex no-scrollbar items-center gap-1 border-2 border-ink bg-white p-0.5 shadow-[2px_2px_0_#111111] self-start max-w-full"
        role="tablist"
        aria-label="Result view"
        onKeyDown={handleKeyDown}
      >
        {VIEW_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'shortlist' ? shortlistedCount : null;
          return (
            <button
              key={tab.id}
              ref={el => { tabRefs.current[tab.id] = el; }}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              tabIndex={isActive ? 0 : -1}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`shrink-0 min-h-[36px] px-3 py-1 text-xs font-black uppercase tracking-wide cursor-pointer transition-colors flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ink ${
                isActive ? 'bg-blue text-white' : 'text-ink hover:bg-neutral-100'
              }`}
            >
              <span>{tab.label}</span>
              {badge > 0 && (
                <span className={`px-1 text-[10px] font-mono font-bold leading-tight ${isActive ? 'bg-yellow text-ink' : 'bg-ink text-paper'}`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-black uppercase tracking-wider text-ink/80" aria-live="polite" aria-atomic="true">
          <span className="font-mono text-ink text-sm font-black">{totalCount}</span> {totalCount === 1 ? 'property' : 'properties'}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showSort && sort && onSortChange && (
            <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-ink/80">
              <span>Sort</span>
              <select
                value={sortIsPreset ? currentSortId : 'custom'}
                onChange={(e) => onSortChange(e.target.value)}
                className="min-h-[36px] border-2 border-ink bg-white text-ink px-2 py-1 font-bold text-xs normal-case tracking-normal cursor-pointer focus-visible:outline-2 focus-visible:outline-blue"
              >
                {!sortIsPreset && <option value="custom" disabled>Custom (table column)</option>}
                {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          )}
          {showExport && onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={totalCount === 0}
              className="min-h-[36px] border-2 border-ink bg-white text-ink text-xs font-black uppercase px-3 py-1.5 hover:bg-yellow transition-colors cursor-pointer shadow-[2px_2px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] focus-visible:outline-2 focus-visible:outline-ink inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon name="download" /> Export CSV
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
