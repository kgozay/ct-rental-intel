import { SUBURBS_LIST } from '../utils/suburbs';

const DEFAULT_FILTERS = {
  search: '',
  suburbs: [...SUBURBS_LIST],
  maxPrice: 80000,
  minBeds: null,
  furnished: null,
  goodValueOnly: false,
  priceDropOnly: false,
  availableBefore: '',
  shortlistOnly: false,
};

export default function FilterSummary({ filters, setFilters }) {
  const chips = [];

  if (filters.search && filters.search.trim() !== '') {
    chips.push({
      key: 'search',
      label: `SEARCH: "${filters.search}"`,
      onClear: () => setFilters({ ...filters, search: '' })
    });
  }

  if (filters.suburbs.length < SUBURBS_LIST.length) {
    if (filters.suburbs.length === 0) {
      chips.push({
        key: 'suburbs',
        label: 'NO SUBURBS',
        onClear: () => setFilters({ ...filters, suburbs: [...SUBURBS_LIST] })
      });
    } else if (filters.suburbs.length === 1) {
      chips.push({
        key: 'suburbs',
        label: filters.suburbs[0],
        onClear: () => setFilters({ ...filters, suburbs: [...SUBURBS_LIST] })
      });
    } else {
      chips.push({
        key: 'suburbs',
        label: `${filters.suburbs.length} SUBURBS`,
        onClear: () => setFilters({ ...filters, suburbs: [...SUBURBS_LIST] })
      });
    }
  }

  if (filters.maxPrice < 80000) {
    chips.push({
      key: 'price',
      label: `≤R${filters.maxPrice.toLocaleString('en-ZA')}`,
      onClear: () => setFilters({ ...filters, maxPrice: 80000 })
    });
  }

  if (filters.minBeds !== null) {
    chips.push({
      key: 'beds',
      label: `${filters.minBeds}+ BEDS`,
      onClear: () => setFilters({ ...filters, minBeds: null })
    });
  }

  if (filters.furnished === true) {
    chips.push({
      key: 'furnished',
      label: 'FURNISHED',
      onClear: () => setFilters({ ...filters, furnished: null })
    });
  }

  if (filters.goodValueOnly) {
    chips.push({
      key: 'value',
      label: 'GOOD VALUE',
      onClear: () => setFilters({ ...filters, goodValueOnly: false })
    });
  }

  if (filters.priceDropOnly) {
    chips.push({
      key: 'drops',
      label: 'PRICE DROPS',
      onClear: () => setFilters({ ...filters, priceDropOnly: false })
    });
  }

  if (filters.availableBefore) {
    chips.push({
      key: 'date',
      label: `AVAIL. BEFORE ${filters.availableBefore}`,
      onClear: () => setFilters({ ...filters, availableBefore: '' })
    });
  }

  if (filters.shortlistOnly) {
    chips.push({
      key: 'shortlist',
      label: 'SHORTLISTED',
      onClear: () => setFilters({ ...filters, shortlistOnly: false })
    });
  }

  const hasFilters = chips.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 pb-4 mb-2 border-b-2 border-ink/10 select-none min-h-[2.25rem]">
      {hasFilters ? (
        <>
          <span className="text-[0.625rem] font-black uppercase tracking-wider text-ink/40 mr-1">
            Filters:
          </span>
          {chips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 border-2 border-ink bg-ink text-paper text-[0.625rem] font-black uppercase px-2.5 py-0.5 leading-snug"
            >
              <span>{chip.label}</span>
              {chip.onClear && (
                <button
                  onClick={chip.onClear}
                  className="hover:text-yellow text-[0.7rem] leading-none cursor-pointer"
                  title="Remove this filter"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="border-2 border-ink bg-white text-ink text-[0.625rem] font-black uppercase px-2.5 py-0.5 cursor-pointer hover:bg-yellow transition-colors shadow-[1px_1px_0_#111111] ml-1"
          >
            Reset All
          </button>
        </>
      ) : (
        <span className="text-[0.625rem] font-black uppercase tracking-wider text-ink/30">
          All listings · No active filters
        </span>
      )}
    </div>
  );
}
