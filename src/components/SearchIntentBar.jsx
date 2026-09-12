import { useMemo } from 'react';
import { SUBURBS_LIST } from '../utils/suburbs';
import { PRICE_PRESETS, DEFAULT_FILTERS } from '../constants/filterConstants';

export default function SearchIntentBar({
  filters,
  setFilters,
  listings = [],
  onToggleMoreFilters,
  showMoreFilters,
  activeSecondaryFilterCount = 0,
  onOpenSavedSearches,
  savedSearchesCount = 0,
}) {
  const isAllSuburbs = filters.suburbs.length === SUBURBS_LIST.length;

  // Live listing counts per suburb
  const suburbCounts = useMemo(() => {
    const counts = {};
    listings.forEach(l => {
      if (l.suburb) counts[l.suburb] = (counts[l.suburb] || 0) + 1;
    });
    return counts;
  }, [listings]);

  const handleSelectAllSuburbs = () => {
    setFilters(prev => ({ ...prev, suburbs: [...SUBURBS_LIST] }));
  };

  const handleToggleSuburb = (suburb) => {
    setFilters(prev => {
      if (prev.suburbs.length === SUBURBS_LIST.length) {
        return { ...prev, suburbs: [suburb] };
      }
      if (prev.suburbs.length === 1 && prev.suburbs[0] === suburb) {
        return { ...prev, suburbs: [...SUBURBS_LIST] };
      }
      const exists = prev.suburbs.includes(suburb);
      const updated = exists
        ? prev.suburbs.filter(s => s !== suburb)
        : [...prev.suburbs, suburb];
      return { ...prev, suburbs: updated.length === 0 ? [...SUBURBS_LIST] : updated };
    });
  };

  const isFiltered = useMemo(() => {
    return (
      (filters.search && filters.search.trim() !== '') ||
      filters.suburbs.length < SUBURBS_LIST.length ||
      filters.maxPrice < 80000 ||
      filters.minBeds !== null ||
      filters.furnished !== null ||
      filters.goodValueOnly ||
      filters.priceDropOnly ||
      filters.availableBefore ||
      filters.shortlistOnly
    );
  }, [filters]);

  const activeChips = useMemo(() => {
    const chips = [];
    if (filters.search?.trim()) {
      chips.push({
        id: 'search',
        label: `"${filters.search}"`,
        onClear: () => setFilters(prev => ({ ...prev, search: '' }))
      });
    }
    if (!isAllSuburbs) {
      chips.push({
        id: 'suburbs',
        label: filters.suburbs.length === 1 ? filters.suburbs[0] : `${filters.suburbs.length} Suburbs`,
        onClear: () => setFilters(prev => ({ ...prev, suburbs: [...SUBURBS_LIST] }))
      });
    }
    if (filters.maxPrice < 80000) {
      chips.push({
        id: 'price',
        label: `≤ R${filters.maxPrice.toLocaleString('en-ZA')}`,
        onClear: () => setFilters(prev => ({ ...prev, maxPrice: 80000 }))
      });
    }
    if (filters.minBeds !== null) {
      chips.push({
        id: 'beds',
        label: `${filters.minBeds}+ Beds`,
        onClear: () => setFilters(prev => ({ ...prev, minBeds: null }))
      });
    }
    if (filters.furnished === true) {
      chips.push({
        id: 'furnished',
        label: 'Furnished',
        onClear: () => setFilters(prev => ({ ...prev, furnished: null }))
      });
    }
    if (filters.furnished === false) {
      chips.push({
        id: 'unfurnished',
        label: 'Unfurnished',
        onClear: () => setFilters(prev => ({ ...prev, furnished: null }))
      });
    }
    if (filters.goodValueOnly) {
      chips.push({
        id: 'value',
        label: 'Good Value',
        onClear: () => setFilters(prev => ({ ...prev, goodValueOnly: false }))
      });
    }
    if (filters.priceDropOnly) {
      chips.push({
        id: 'drops',
        label: 'Price Drops',
        onClear: () => setFilters(prev => ({ ...prev, priceDropOnly: false }))
      });
    }
    if (filters.availableBefore) {
      chips.push({
        id: 'avail',
        label: `Before ${filters.availableBefore}`,
        onClear: () => setFilters(prev => ({ ...prev, availableBefore: '' }))
      });
    }
    if (filters.shortlistOnly) {
      chips.push({
        id: 'shortlist',
        label: 'Shortlisted Only',
        onClear: () => setFilters(prev => ({ ...prev, shortlistOnly: false }))
      });
    }
    return chips;
  }, [filters, isAllSuburbs, setFilters]);

  return (
    <section aria-label="Search and Filter Rentals" className="bg-paper border-2 border-ink shadow-[3px_3px_0_#111111] mb-6 p-4 md:p-5">
      {/* PRIMARY ROW: KEYWORD SEARCH + BEDROOMS + SECONDARY TOGGLE */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 pb-3 border-b border-ink/10">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            placeholder="Search address, building, agency..."
            className="w-full border-2 border-ink bg-white text-ink px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue shadow-[1px_1px_0_#111111]"
            aria-label="Keyword search"
          />
          {filters.search && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink/50 hover:text-ink cursor-pointer"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Bedroom Segmented Selector */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-black uppercase tracking-wider text-ink/60 mr-0.5">
            Beds:
          </span>
          <div className="inline-flex border-2 border-ink bg-white shadow-[1px_1px_0_#111111]" role="radiogroup" aria-label="Minimum Bedrooms">
            {[
              { label: 'Any', value: null },
              { label: '1+', value: 1 },
              { label: '2+', value: 2 },
              { label: '3+', value: 3 },
            ].map(opt => {
              const active = filters.minBeds === opt.value;
              return (
                <button
                  key={opt.label}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFilters(prev => ({ ...prev, minBeds: opt.value }))}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ink ${
                    active ? 'bg-ink text-paper' : 'text-ink hover:bg-neutral-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* More Filters Toggle, Saved Searches, & Reset */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={onToggleMoreFilters}
            aria-expanded={showMoreFilters}
            aria-controls="more-filters-panel"
            className={`border-2 border-ink text-xs font-black uppercase px-3 py-1.5 cursor-pointer transition-all shadow-[1px_1px_0_#111111] flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-ink ${
              showMoreFilters || activeSecondaryFilterCount > 0
                ? 'bg-blue text-white border-blue'
                : 'bg-white text-ink hover:bg-neutral-100'
            }`}
          >
            <span>Filters</span>
            {activeSecondaryFilterCount > 0 && (
              <span className="bg-yellow text-ink px-1.5 py-0.2 text-[10px] font-black leading-tight rounded-none">
                {activeSecondaryFilterCount}
              </span>
            )}
            <span className="text-[10px]">{showMoreFilters ? '▲' : '▼'}</span>
          </button>

          {onOpenSavedSearches && (
            <button
              type="button"
              onClick={onOpenSavedSearches}
              className="border-2 border-ink bg-white text-ink text-xs font-black uppercase px-3 py-1.5 hover:bg-neutral-100 transition-colors cursor-pointer shadow-[1px_1px_0_#111111] focus-visible:outline-2 focus-visible:outline-ink flex items-center gap-1.5"
              title="View and manage saved searches"
            >
              <span>Saved</span>
              {savedSearchesCount > 0 && (
                <span className="bg-yellow text-ink px-1.5 py-0.2 text-[10px] font-black leading-tight">
                  {savedSearchesCount}
                </span>
              )}
            </button>
          )}

          {isFiltered && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="border-2 border-ink bg-white text-ink text-xs font-black uppercase px-3 py-1.5 hover:bg-yellow transition-colors cursor-pointer shadow-[1px_1px_0_#111111] focus-visible:outline-2 focus-visible:outline-ink"
              title="Reset all filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* SUBURB ROW */}
      <div className="pt-3 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-ink/60 mr-1">
            Suburb:
          </span>
          <button
            onClick={handleSelectAllSuburbs}
            className={`border-2 border-ink px-2.5 py-1 text-xs font-black uppercase cursor-pointer transition-all shadow-[1px_1px_0_#111111] ${
              isAllSuburbs
                ? 'bg-ink text-paper'
                : 'bg-white text-ink hover:bg-neutral-100'
            }`}
          >
            All Suburbs
          </button>
          {SUBURBS_LIST.map(sub => {
            const isSelected = filters.suburbs.includes(sub);
            const count = suburbCounts[sub] || 0;
            return (
              <button
                key={sub}
                onClick={() => handleToggleSuburb(sub)}
                className={`border-2 border-ink px-2.5 py-1 text-xs font-bold cursor-pointer transition-all shadow-[1px_1px_0_#111111] flex items-center gap-1.5 ${
                  isSelected && !isAllSuburbs
                    ? 'bg-blue text-white border-blue'
                    : isAllSuburbs
                    ? 'bg-white text-ink hover:bg-neutral-100'
                    : 'bg-white text-ink/60 hover:text-ink hover:bg-neutral-100 opacity-70'
                }`}
                title={isAllSuburbs ? `Filter to ${sub}` : `Toggle ${sub}`}
              >
                <span>{sub}</span>
                <span className={`text-[10px] font-mono font-bold ${isSelected && !isAllSuburbs ? 'text-white/80' : 'text-ink/40'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PRICE RANGE ROW */}
      <div className="pt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-ink/60 mr-1">
          Max Rent:
        </span>
        {PRICE_PRESETS.map(preset => {
          const isPresetActive = filters.maxPrice === preset.value;
          return (
            <button
              key={preset.label}
              onClick={() => setFilters(prev => ({ ...prev, maxPrice: preset.value }))}
              className={`border-2 border-ink px-2.5 py-1 text-xs font-bold cursor-pointer transition-all shadow-[1px_1px_0_#111111] ${
                isPresetActive
                  ? 'bg-ink text-paper'
                  : 'bg-white text-ink hover:bg-neutral-100'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        <div className="flex items-center gap-2 ml-auto sm:ml-2">
          <input
            type="range"
            min="10000"
            max="80000"
            step="1000"
            value={filters.maxPrice}
            onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: parseInt(e.target.value, 10) }))}
            className="w-24 md:w-32 accent-blue cursor-pointer h-1.5 bg-neutral-200"
            aria-label="Adjust max price slider"
          />
          <span className="text-xs font-mono font-black text-blue tabular-nums min-w-[4rem]">
            {filters.maxPrice < 80000 ? `R${filters.maxPrice.toLocaleString('en-ZA')}` : 'No cap'}
          </span>
        </div>
      </div>

      {/* SECONDARY DISCLOSURE (COLLAPSIBLE) */}
      {showMoreFilters && (
        <div id="more-filters-panel" className="mt-4 pt-3.5 border-t border-ink/10 flex flex-wrap items-center gap-4 bg-paper/50">
          {/* Furnishing */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-ink/60">
              Furnishing:
            </span>
            <div className="inline-flex border-2 border-ink bg-white shadow-[1px_1px_0_#111111]" role="radiogroup" aria-label="Furnishing">
              {[
                { label: 'All', value: null },
                { label: 'Furnished', value: true },
                { label: 'Unfurnished', value: false },
              ].map(opt => (
                <button
                  key={opt.label}
                  role="radio"
                  aria-checked={filters.furnished === opt.value}
                  onClick={() => setFilters(prev => ({ ...prev, furnished: opt.value }))}
                  className={`px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ink ${
                    filters.furnished === opt.value ? 'bg-ink text-paper' : 'text-ink hover:bg-neutral-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Move-in Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-ink/60">
              Available Before:
            </span>
            <input
              type="date"
              value={filters.availableBefore || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, availableBefore: e.target.value }))}
              aria-label="Filter listings available before date"
              className="border-2 border-ink bg-white text-ink px-2 py-1 text-xs font-bold shadow-[1px_1px_0_#111111] focus-visible:outline-2 focus-visible:outline-ink"
            />
            {filters.availableBefore && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, availableBefore: '' }))}
                className="text-xs font-bold text-blue hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-ink"
                aria-label="Clear available before filter"
              >
                Clear
              </button>
            )}
          </div>

          {/* Value and Price Drop Toggles */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={filters.goodValueOnly}
              onClick={() => setFilters(prev => ({ ...prev, goodValueOnly: !prev.goodValueOnly }))}
              className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer transition-all shadow-[1px_1px_0_#111111] focus-visible:outline-2 focus-visible:outline-ink ${
                filters.goodValueOnly ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-ink hover:bg-neutral-100'
              }`}
            >
              💎 Good Value Only
            </button>
            <button
              type="button"
              aria-pressed={filters.priceDropOnly}
              onClick={() => setFilters(prev => ({ ...prev, priceDropOnly: !prev.priceDropOnly }))}
              className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer transition-all shadow-[1px_1px_0_#111111] focus-visible:outline-2 focus-visible:outline-ink ${
                filters.priceDropOnly ? 'bg-blue text-white border-blue' : 'bg-white text-ink hover:bg-neutral-100'
              }`}
            >
              ↓ Price Drops
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE FILTER CHIPS ROW */}
      {activeChips.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-ink/10 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-ink/50 mr-1">
            Active:
          </span>
          {activeChips.map(chip => (
            <span
              key={chip.id}
              className="filter-chip inline-flex items-center gap-1.5 border-2 border-ink bg-ink text-paper text-xs font-bold uppercase px-2.5 py-0.5 shadow-[1px_1px_0_#111111]"
            >
              <span>{chip.label}</span>
              <button
                onClick={chip.onClear}
                className="hover:text-yellow text-xs font-black ml-1 cursor-pointer leading-none"
                aria-label={`Remove filter ${chip.label}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
