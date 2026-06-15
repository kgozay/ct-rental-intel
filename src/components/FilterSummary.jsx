import { SUBURBS_LIST } from '../utils/suburbs';

const DEFAULT_FILTERS = {
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

  if (filters.suburbs.length < SUBURBS_LIST.length) {
    if (filters.suburbs.length === 0) {
      chips.push({ key: 'suburbs', label: 'NO SUBURBS' });
    } else if (filters.suburbs.length === 1) {
      chips.push({ key: 'suburbs', label: filters.suburbs[0] });
    } else {
      chips.push({ key: 'suburbs', label: `${filters.suburbs.length} SUBURBS` });
    }
  }

  if (filters.maxPrice < 80000) {
    chips.push({ key: 'price', label: `≤R${filters.maxPrice.toLocaleString('en-ZA')}` });
  }

  if (filters.minBeds !== null) {
    chips.push({ key: 'beds', label: `${filters.minBeds}+ BEDS` });
  }

  if (filters.furnished === true) {
    chips.push({ key: 'furnished', label: 'FURNISHED' });
  }

  if (filters.goodValueOnly) {
    chips.push({ key: 'value', label: 'GOOD VALUE' });
  }

  if (filters.priceDropOnly) {
    chips.push({ key: 'drops', label: 'PRICE DROPS' });
  }

  if (filters.availableBefore) {
    chips.push({ key: 'date', label: `AVAIL. BEFORE ${filters.availableBefore}` });
  }

  if (filters.shortlistOnly) {
    chips.push({ key: 'shortlist', label: 'SHORTLISTED' });
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
              className="inline-block border-2 border-ink bg-ink text-paper text-[0.625rem] font-black uppercase px-2.5 py-0.5 leading-snug"
            >
              {chip.label}
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
