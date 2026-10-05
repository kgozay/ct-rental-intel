import { useMemo } from 'react';
import { SUBURBS_LIST } from '../utils/suburbs';
import { PRICE_PRESETS, PRICE_CAP, DEFAULT_FILTERS, BED_OPTIONS, BATH_OPTIONS } from '../constants/filterConstants';
import { countActiveFilters } from '../utils/filters';
import Icon from './Icon';

const LABEL = 'text-[11px] font-black uppercase tracking-wider text-ink/80';
const CHIP = 'min-h-[36px] border-2 border-ink px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue';
const SEGMENT = 'min-h-[34px] px-3 py-1 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue';

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="inline-flex border-2 border-ink bg-white" role="radiogroup" aria-label={label}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`${SEGMENT} ${active ? 'bg-ink text-paper' : 'text-ink hover:bg-neutral-100'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SearchIntentBar({
  filters,
  setFilters,
  listings = [],
  onToggleMoreFilters,
  showMoreFilters,
  activeSecondaryFilterCount = 0,
  onOpenSavedSearches,
  savedSearchesCount = 0,
  savedSearchNewCount = 0,
}) {
  const isAllSuburbs = filters.suburbs.length === SUBURBS_LIST.length;
  const set = (patch) => setFilters(prev => ({ ...prev, ...patch }));

  const suburbCounts = useMemo(() => {
    const counts = {};
    listings.forEach(l => {
      if (l.suburb) counts[l.suburb] = (counts[l.suburb] || 0) + 1;
    });
    return counts;
  }, [listings]);

  const propertyTypes = useMemo(() => {
    const types = new Set(listings.map(l => l.property_type).filter(Boolean));
    filters.propertyTypes.forEach(t => types.add(t));
    return [...types].sort();
  }, [listings, filters.propertyTypes]);

  const handleToggleSuburb = (suburb) => {
    setFilters(prev => {
      if (prev.suburbs.length === SUBURBS_LIST.length) return { ...prev, suburbs: [suburb] };
      const exists = prev.suburbs.includes(suburb);
      const updated = exists ? prev.suburbs.filter(s => s !== suburb) : [...prev.suburbs, suburb];
      return { ...prev, suburbs: updated.length === 0 ? [...SUBURBS_LIST] : updated };
    });
  };

  const toggleType = (type) => {
    setFilters(prev => ({
      ...prev,
      propertyTypes: prev.propertyTypes.includes(type)
        ? prev.propertyTypes.filter(t => t !== type)
        : [...prev.propertyTypes, type],
    }));
  };

  const isFiltered = countActiveFilters(filters) > 0;

  const activeChips = [];
  if (filters.search?.trim()) activeChips.push({ id: 'search', label: `“${filters.search}”`, clear: { search: '' } });
  if (!isAllSuburbs) {
    activeChips.push({
      id: 'suburbs',
      label: filters.suburbs.length <= 2 ? filters.suburbs.join(' + ') : `${filters.suburbs.length} suburbs`,
      clear: { suburbs: [...SUBURBS_LIST] },
    });
  }
  if (filters.minPrice > 0) activeChips.push({ id: 'minPrice', label: `≥ R${filters.minPrice.toLocaleString('en-ZA')}`, clear: { minPrice: 0 } });
  if (filters.maxPrice < PRICE_CAP) activeChips.push({ id: 'price', label: `≤ R${filters.maxPrice.toLocaleString('en-ZA')}`, clear: { maxPrice: PRICE_CAP } });
  if (filters.minBeds !== null) activeChips.push({ id: 'beds', label: filters.minBeds === 'studio' ? 'Studio' : `${filters.minBeds}+ beds`, clear: { minBeds: null } });
  if (filters.minBaths !== null) activeChips.push({ id: 'baths', label: `${filters.minBaths}+ baths`, clear: { minBaths: null } });
  if (filters.minSize > 0) activeChips.push({ id: 'size', label: `≥ ${filters.minSize}m²`, clear: { minSize: 0 } });
  if (filters.propertyTypes.length) activeChips.push({ id: 'types', label: filters.propertyTypes.join(', '), clear: { propertyTypes: [] } });
  if (filters.furnished !== null) activeChips.push({ id: 'furnished', label: filters.furnished ? 'Furnished' : 'Unfurnished', clear: { furnished: null } });
  if (filters.goodValueOnly) activeChips.push({ id: 'value', label: 'Good value', clear: { goodValueOnly: false } });
  if (filters.priceDropOnly) activeChips.push({ id: 'drops', label: 'Price drops', clear: { priceDropOnly: false } });
  if (filters.availableBefore) activeChips.push({ id: 'avail', label: `Available by ${filters.availableBefore}`, clear: { availableBefore: '', includeUnknownAvail: true } });
  if (filters.shortlistOnly) activeChips.push({ id: 'shortlist', label: 'Shortlisted only', clear: { shortlistOnly: false } });

  return (
    <section aria-label="Search and filter rentals" className="bg-paper border-2 border-ink shadow-[3px_3px_0_#111111] mb-6 p-3 sm:p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-3 pb-3 border-b border-ink/15">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/70" />
          <input
            type="search"
            value={filters.search || ''}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search address, building, agency…"
            className="w-full min-h-[40px] border-2 border-ink bg-white text-ink pl-9 pr-9 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue"
            aria-label="Keyword search"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set({ search: '' })}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center text-ink/70 hover:text-ink cursor-pointer"
              aria-label="Clear search"
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className={LABEL}>Beds</span>
          <Segmented label="Bedrooms" options={BED_OPTIONS} value={filters.minBeds} onChange={(v) => set({ minBeds: v })} />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMoreFilters}
            aria-expanded={showMoreFilters}
            aria-controls="more-filters-panel"
            className={`${CHIP} font-black uppercase flex items-center gap-1.5 ${
              showMoreFilters || activeSecondaryFilterCount > 0 ? 'bg-blue text-white border-blue' : 'bg-white text-ink hover:bg-neutral-100'
            }`}
          >
            <span>More filters</span>
            {activeSecondaryFilterCount > 0 && (
              <span className="bg-yellow text-ink px-1.5 text-[10px] font-black leading-tight">{activeSecondaryFilterCount}</span>
            )}
            <Icon name={showMoreFilters ? 'chevronUp' : 'chevronDown'} size={10} />
          </button>

          {onOpenSavedSearches && (
            <button
              type="button"
              onClick={onOpenSavedSearches}
              className={`${CHIP} font-black uppercase bg-white text-ink hover:bg-neutral-100 flex items-center gap-1.5`}
              aria-label={`Saved searches${savedSearchesCount ? ` (${savedSearchesCount})` : ''}${savedSearchNewCount ? `, ${savedSearchNewCount} new matches` : ''}`}
            >
              <span>Saved</span>
              {savedSearchesCount > 0 && (
                <span className="bg-ink text-paper px-1.5 text-[10px] font-black leading-tight">{savedSearchesCount}</span>
              )}
              {savedSearchNewCount > 0 && (
                <span className="bg-lime text-ink border border-ink px-1.5 text-[10px] font-black leading-tight">{savedSearchNewCount} new</span>
              )}
            </button>
          )}

          {isFiltered && (
            <button
              type="button"
              onClick={() => setFilters({ ...DEFAULT_FILTERS })}
              className={`${CHIP} font-black uppercase bg-white text-ink hover:bg-yellow`}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="pt-3 pb-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Suburbs">
          <span className={`${LABEL} mr-1`}>Suburb</span>
          <button
            type="button"
            aria-pressed={isAllSuburbs}
            onClick={() => set({ suburbs: [...SUBURBS_LIST] })}
            className={`${CHIP} font-black uppercase ${isAllSuburbs ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'}`}
          >
            All
          </button>
          {SUBURBS_LIST.map(sub => {
            const isSelected = !isAllSuburbs && filters.suburbs.includes(sub);
            return (
              <button
                key={sub}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleToggleSuburb(sub)}
                className={`${CHIP} flex items-center gap-1.5 ${
                  isSelected ? 'bg-blue text-white border-blue' : 'bg-white text-ink hover:bg-neutral-100'
                }`}
              >
                <span>{sub}</span>
                <span className={`text-[11px] font-mono font-bold ${isSelected ? 'text-white/90' : 'text-ink/70'}`}>
                  {suburbCounts[sub] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Maximum rent">
        <span className={`${LABEL} mr-1`}>Max rent</span>
        {PRICE_PRESETS.map(preset => {
          const isPresetActive = filters.maxPrice === preset.value;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={isPresetActive}
              onClick={() => set({ maxPrice: preset.value })}
              className={`${CHIP} ${isPresetActive ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'}`}
            >
              {preset.label}
            </button>
          );
        })}
        <div className="flex items-center gap-2 sm:ml-2">
          <input
            type="range"
            min="10000"
            max={PRICE_CAP}
            step="1000"
            value={filters.maxPrice}
            onChange={(e) => set({ maxPrice: parseInt(e.target.value, 10) })}
            className="w-28 md:w-32 accent-blue cursor-pointer"
            aria-label="Maximum rent"
            aria-valuetext={filters.maxPrice < PRICE_CAP ? `R${filters.maxPrice.toLocaleString('en-ZA')}` : 'No cap'}
          />
          <span className="text-xs font-mono font-black text-blue tabular-nums min-w-[4rem]">
            {filters.maxPrice < PRICE_CAP ? `R${filters.maxPrice.toLocaleString('en-ZA')}` : 'No cap'}
          </span>
        </div>
      </div>

      {showMoreFilters && (
        <div id="more-filters-panel" className="mt-4 pt-4 border-t border-ink/15 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Min rent (R)</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1000"
              value={filters.minPrice || ''}
              placeholder="No minimum"
              onChange={(e) => set({ minPrice: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="min-h-[38px] border-2 border-ink bg-white text-ink px-2 py-1 text-sm font-bold focus-visible:outline-2 focus-visible:outline-blue"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Min floor area (m²)</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="5"
              value={filters.minSize || ''}
              placeholder="Any size"
              onChange={(e) => set({ minSize: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="min-h-[38px] border-2 border-ink bg-white text-ink px-2 py-1 text-sm font-bold focus-visible:outline-2 focus-visible:outline-blue"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Bathrooms</span>
            <Segmented label="Bathrooms" options={BATH_OPTIONS} value={filters.minBaths} onChange={(v) => set({ minBaths: v })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Furnishing</span>
            <Segmented
              label="Furnishing"
              options={[{ label: 'All', value: null }, { label: 'Furnished', value: true }, { label: 'Unfurnished', value: false }]}
              value={filters.furnished}
              onChange={(v) => set({ furnished: v })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="avail-before" className={LABEL}>Available by</label>
            <div className="flex items-center gap-2">
              <input
                id="avail-before"
                type="date"
                value={filters.availableBefore || ''}
                onChange={(e) => set({ availableBefore: e.target.value })}
                className="min-h-[38px] border-2 border-ink bg-white text-ink px-2 py-1 text-xs font-bold focus-visible:outline-2 focus-visible:outline-blue"
              />
              {filters.availableBefore && (
                <button type="button" onClick={() => set({ availableBefore: '', includeUnknownAvail: true })} className="text-xs font-bold text-blue underline cursor-pointer">
                  Clear
                </button>
              )}
            </div>
            {filters.availableBefore && (
              <label className="inline-flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.includeUnknownAvail}
                  onChange={(e) => set({ includeUnknownAvail: e.target.checked })}
                  className="accent-blue w-4 h-4"
                />
                Include listings with no date
              </label>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Highlights</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={filters.goodValueOnly}
                onClick={() => set({ goodValueOnly: !filters.goodValueOnly })}
                className={`${CHIP} ${filters.goodValueOnly ? 'bg-lime text-ink' : 'bg-white text-ink hover:bg-neutral-100'}`}
              >
                Good value only
              </button>
              <button
                type="button"
                aria-pressed={filters.priceDropOnly}
                onClick={() => set({ priceDropOnly: !filters.priceDropOnly })}
                className={`${CHIP} inline-flex items-center gap-1 ${filters.priceDropOnly ? 'bg-blue text-white border-blue' : 'bg-white text-ink hover:bg-neutral-100'}`}
              >
                <Icon name="arrowDown" size={12} /> Price drops
              </button>
            </div>
          </div>

          {propertyTypes.length > 1 && (
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
              <span className={LABEL}>Property type</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Property type">
                {propertyTypes.map(type => {
                  const on = filters.propertyTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleType(type)}
                      className={`${CHIP} ${on ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'}`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-ink/15 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-ink/80 mr-1">Active</span>
          {activeChips.map(chip => (
            <span
              key={chip.id}
              className="filter-chip inline-flex items-center gap-1 border-2 border-ink bg-ink text-paper text-xs font-bold uppercase pl-2.5 pr-0.5"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={() => set(chip.clear)}
                className="w-7 h-7 inline-flex items-center justify-center cursor-pointer"
                aria-label={`Remove filter ${chip.label}`}
              >
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
