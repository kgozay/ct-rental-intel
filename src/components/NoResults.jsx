import { SUBURBS_LIST } from '../utils/suburbs';
import { PRICE_CAP } from '../constants/filterConstants';
import { normaliseFilters } from '../utils/filters';

/** Explains which active filters are excluding everything, with one recovery action. */
export default function NoResults({ filters: rawFilters, onReset, shortlistedCount = 0, compact = false }) {
  const f = normaliseFilters(rawFilters);
  const reasons = [];
  if (f.search?.trim()) reasons.push(`Keyword “${f.search}”`);
  if (f.suburbs.length < SUBURBS_LIST.length) reasons.push(`Suburbs limited to ${f.suburbs.length} of ${SUBURBS_LIST.length}`);
  if (f.minPrice > 0) reasons.push(`Min rent R${f.minPrice.toLocaleString('en-ZA')}`);
  if (f.maxPrice < PRICE_CAP) reasons.push(`Max rent R${f.maxPrice.toLocaleString('en-ZA')}`);
  if (f.minBeds === 'studio') reasons.push('Studios only');
  else if (f.minBeds !== null) reasons.push(`${f.minBeds}+ bedrooms`);
  if (f.minBaths !== null) reasons.push(`${f.minBaths}+ bathrooms`);
  if (f.minSize > 0) reasons.push(`At least ${f.minSize}m²`);
  if (f.propertyTypes.length) reasons.push(`Type: ${f.propertyTypes.join(', ')}`);
  if (f.furnished === true) reasons.push('Furnished only');
  if (f.furnished === false) reasons.push('Unfurnished only');
  if (f.goodValueOnly) reasons.push('Good value only');
  if (f.priceDropOnly) reasons.push('Price drops only');
  if (f.availableBefore) reasons.push(`Available before ${f.availableBefore}${f.includeUnknownAvail ? '' : ' (unknown dates hidden)'}`);
  if (f.shortlistOnly) reasons.push(shortlistedCount === 0 ? 'Shortlisted only — your shortlist is empty' : 'Shortlisted only');

  return (
    <div className={`border-2 border-ink bg-white text-center flex flex-col items-center gap-3 ${compact ? 'p-6' : 'p-8 shadow-[4px_4px_0_#111111]'}`}>
      <div className="text-base font-black uppercase tracking-tight text-ink">No listings match these filters</div>
      {reasons.length > 0 && (
        <ul className="text-xs text-ink/80 font-medium text-left space-y-0.5 list-disc pl-5 m-0">
          {reasons.map(r => <li key={r}>{r}</li>)}
        </ul>
      )}
      {onReset && reasons.length > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="border-[3px] border-ink bg-yellow text-ink text-xs font-black uppercase px-5 py-2 cursor-pointer shadow-[3px_3px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          Reset all filters
        </button>
      )}
    </div>
  );
}
