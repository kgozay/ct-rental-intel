export default function ResultsToolbar({
  totalCount,
  activeTab,
  onTabChange,
  shortlistedCount = 0,
  onExportCsv,
  showExport = true,
}) {
  const tabs = [
    { id: 'table', label: 'Table' },
    { id: 'cards', label: 'Cards' },
    { id: 'map', label: 'Map' },
    { id: 'charts', label: 'Charts' },
    { id: 'compare', label: 'Suburbs' },
    { id: 'ai', label: 'AI Intel' },
    { id: 'shortlist', label: 'Shortlist', badge: shortlistedCount },
  ];

  const handleKeyDown = (e) => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % tabs.length;
      onTabChange(tabs[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      onTabChange(tabs[prevIndex].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onTabChange(tabs[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      onTabChange(tabs[tabs.length - 1].id);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b-2 border-ink/20">
      {/* Result Count */}
      <div className="text-xs font-black uppercase tracking-wider text-ink/70" aria-live="polite" aria-atomic="true">
        Showing <span className="font-mono text-ink text-sm font-black">{totalCount}</span> properties
      </div>

      {/* View Switcher Tabs + Export */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex flex-wrap items-center gap-1 border-2 border-ink bg-white p-0.5 shadow-[2px_2px_0_#111111]"
          role="tablist"
          aria-label="Result View Mode"
          onKeyDown={handleKeyDown}
        >
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1 text-xs font-black uppercase tracking-wide cursor-pointer transition-all flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-ink ${
                  isActive
                    ? 'bg-blue text-white shadow-[1px_1px_0_#111111]'
                    : 'text-ink hover:bg-neutral-100'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className={`px-1 py-0.2 text-[10px] font-mono font-bold leading-none ${
                    isActive ? 'bg-yellow text-ink' : 'bg-ink text-paper'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {showExport && onExportCsv && (
          <button
            onClick={onExportCsv}
            className="border-2 border-ink bg-white text-ink text-xs font-black uppercase px-3 py-1.5 hover:bg-yellow transition-all cursor-pointer shadow-[2px_2px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] focus-visible:outline-2 focus-visible:outline-ink"
            title="Download matching listings as CSV"
          >
            Export CSV
          </button>
        )}
      </div>
    </div>
  );
}

