import { useState, useMemo } from 'react';
import ValueBadge from './ValueBadge';
import Icon from './Icon';
import InfoTip from './InfoTip';
import NoResults from './NoResults';
import { daysAgo } from '../utils/filters';
import { describePriceDrop } from '../utils/priceDrop';
import { VALUE_THRESHOLDS } from '../utils/confidence';

function SortHdr({ field, label, sort, onSort, children, className = '' }) {
  const isSorted = sort.field === field;
  return (
    <th
      scope="col"
      aria-sort={isSorted ? (sort.asc ? 'ascending' : 'descending') : 'none'}
      className={`px-0 py-0 whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center">
        <button
          type="button"
          onClick={() => onSort(field)}
          className="px-3 py-3 inline-flex items-center gap-1 uppercase font-black tracking-wider cursor-pointer hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-yellow"
          aria-label={`Sort by ${label}`}
        >
          {label}
          <Icon name={isSorted && sort.asc ? 'chevronUp' : 'chevronDown'} size={10} className={isSorted ? 'opacity-100' : 'opacity-50'} />
        </button>
        {children}
      </span>
    </th>
  );
}

export default function ListingsTable({
  listings,
  totalListings,
  filters,
  onResetFilters,
  sort,
  onSort,
  shortlisted,
  toggleShortlist,
  lastVisit,
  onSelectListing,
  selectedListingUrl,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [prevResetKey, setPrevResetKey] = useState({ filters, sort });

  if (prevResetKey.filters !== filters || prevResetKey.sort !== sort) {
    setPrevResetKey({ filters, sort });
    setCurrentPage(1);
  }

  const totalCount = listings.length;
  const numPageSize = pageSize === 'all' ? totalCount : Number(pageSize);
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalCount / (numPageSize || 25)));

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  const paginatedListings = useMemo(() => {
    if (pageSize === 'all') return listings;
    const start = (currentPage - 1) * numPageSize;
    return listings.slice(start, start + numPageSize);
  }, [listings, currentPage, numPageSize, pageSize]);

  if (totalCount === 0) {
    return <NoResults filters={filters} onReset={onResetFilters} shortlistedCount={shortlisted.size} />;
  }

  const today = new Date().toISOString().split('T')[0];
  const td = 'px-3 py-3 border-t border-neutral-200';
  const hdr = { sort, onSort };

  return (
    <div className="tableview">
      <div className="overflow-x-auto border-2 border-ink shadow-[3px_3px_0_#111111]">
        <table className="w-full border-collapse bg-white text-ink text-left">
          <caption className="sr-only">Rental listings, sorted by {sort.field.replace(/_/g, ' ')} {sort.asc ? 'ascending' : 'descending'}</caption>
          <thead>
            <tr className="bg-ink text-paper text-xs border-b-2 border-ink">
              <SortHdr field="suburb" label="Suburb" {...hdr} className="sticky left-0 z-[1] bg-ink" />
              <SortHdr field="price" label="Price" {...hdr} />
              <SortHdr field="value_score" label="Value" {...hdr}>
                <InfoTip label="How the value score works">
                  The score compares this listing&rsquo;s rent per m² with the median for its suburb
                  (or, with no size listed, its rent with same-bedroom listings). A score of {VALUE_THRESHOLDS.GOOD.toFixed(2)}+
                  is <b>Good value</b>; {VALUE_THRESHOLDS.PREMIUM.toFixed(2)} or less is <b>Premium</b>. With fewer than 8
                  comparables a good score shows as <b>Potential value</b>; under 3 it is <b>Unrated</b>. Open a listing to see its evidence.
                </InfoTip>
              </SortHdr>
              <SortHdr field="bedrooms" label="Beds" {...hdr} />
              <SortHdr field="size_m2" label="Size" {...hdr} />
              <SortHdr field="price_per_m2" label="R/m²" {...hdr} />
              <SortHdr field="property_type" label="Type" {...hdr} />
              <SortHdr field="available" label="Available" {...hdr} />
              <SortHdr field="days" label="Listed" {...hdr} />
              <SortHdr field="agency_name" label="Agency" {...hdr} />
              <th scope="col" className="px-3 py-3 uppercase font-black tracking-wider"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {paginatedListings.map((item, idx) => {
              const drop = describePriceDrop(item);
              const days = daysAgo(item.created_at);
              const isNew = lastVisit && item.created_at && item.created_at > lastVisit;
              const isSelected = item.url === selectedListingUrl;
              const isShortlisted = shortlisted.has(item.url);
              const rowBg = isSelected ? 'bg-yellow' : 'bg-white group-hover:bg-neutral-50';

              return (
                <tr
                  key={item.id || item.url}
                  className={`stagger-row cursor-pointer group ${isSelected ? 'bg-yellow' : 'hover:bg-neutral-50'}`}
                  style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}
                  onClick={() => onSelectListing?.(item)}
                >
                  <td className={`${td} sticky left-0 z-[1] ${rowBg} ${drop ? 'border-l-[4px] border-l-blue' : ''}`}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelectListing?.(item); }}
                      className="text-left font-bold text-xs uppercase hover:underline focus-visible:outline-2 focus-visible:outline-ink inline-flex items-center gap-1.5 flex-wrap cursor-pointer max-w-[9rem]"
                      aria-label={`View details: ${item.bedrooms === 0 ? 'studio' : item.bedrooms != null ? `${item.bedrooms} bed` : ''} ${item.property_type || ''} in ${item.suburb} for R${item.price.toLocaleString('en-ZA')}`}
                    >
                      <span className="font-bold text-ink">{item.suburb}</span>
                      {isNew && (
                        <span className="inline-block bg-yellow border border-ink text-ink text-[0.625rem] font-black uppercase px-1.5 py-0.5 leading-none">New</span>
                      )}
                    </button>
                  </td>
                  <td className={`${td} font-black font-mono tabular-nums whitespace-nowrap`}>
                    R{item.price.toLocaleString('en-ZA')}
                    {drop && (
                      <span className="block text-[0.6875rem] text-blue font-extrabold mt-0.5" title={drop.long}>
                        {drop.short}
                      </span>
                    )}
                  </td>
                  <td className={td}><ValueBadge valuation={item.valuation} /></td>
                  <td className={`${td} font-bold text-center font-mono tabular-nums`}>
                    {item.bedrooms === 0 ? <span className="text-xs">Studio</span> : item.bedrooms ?? '—'}
                  </td>
                  <td className={`${td} text-xs font-bold font-mono tabular-nums text-ink/80`}>{item.size_m2 ? `${item.size_m2}m²` : '—'}</td>
                  <td className={`${td} font-bold font-mono tabular-nums`}>{item.price_per_m2 ? `R${item.price_per_m2}` : '—'}</td>
                  <td className={`${td} text-xs uppercase font-extrabold text-ink/75`}>{item.property_type}</td>
                  <td className={`${td} text-xs font-bold text-ink/80 whitespace-nowrap`}>
                    {item.available_date
                      ? item.available_date <= today
                        ? <span className="inline-flex items-center gap-1.5 text-emerald-800 font-black"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />Now</span>
                        : <span className="font-mono">{item.available_date}</span>
                      : '—'}
                  </td>
                  <td className={`${td} text-xs font-bold font-mono tabular-nums text-ink/75`}>{days !== null ? `${days}d` : '—'}</td>
                  <td className={`${td} text-xs truncate max-w-[10rem] font-semibold`}>{item.agency_name || '—'}</td>
                  <td className={td} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleShortlist(item.url, item)}
                        aria-pressed={isShortlisted}
                        className={`w-9 h-9 inline-flex items-center justify-center cursor-pointer border-2 transition-colors focus-visible:outline-2 focus-visible:outline-ink ${isShortlisted ? 'border-ink bg-bred text-white' : 'border-transparent text-ink hover:border-ink'}`}
                        aria-label={isShortlisted ? `Remove ${item.suburb} listing from shortlist` : `Add ${item.suburb} listing to shortlist`}
                      >
                        <Icon name="heart" filled={isShortlisted} size={16} />
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-9 h-9 inline-flex items-center justify-center border-2 border-ink bg-yellow text-ink transition-transform duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0_#111111] focus-visible:outline-2 focus-visible:outline-ink"
                        aria-label={`Open ${item.suburb} listing on Property24`}
                      >
                        <Icon name="external" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-extrabold text-xs text-ink">
            <span className="font-mono">{(currentPage - 1) * numPageSize + 1}–{Math.min(currentPage * numPageSize, totalCount)}</span>
            {' '}of {totalCount} matching ({totalListings} total)
          </div>
          <label className="flex items-center gap-1.5 text-xs font-black text-ink">
            <span>Per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="min-h-[36px] border-2 border-ink bg-white text-ink px-2 py-1 font-bold text-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-blue"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {totalPages > 1 && (
          <nav aria-label="Table pages" className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="min-h-[36px] border-2 border-ink bg-white text-ink font-black text-xs px-2.5 py-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 inline-flex items-center gap-1"
            >
              <Icon name="chevronLeft" size={12} /> Prev
            </button>
            <span className="text-xs font-extrabold px-2 text-ink" aria-current="page">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="min-h-[36px] border-2 border-ink bg-white text-ink font-black text-xs px-2.5 py-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 inline-flex items-center gap-1"
            >
              Next <Icon name="chevronRight" size={12} />
            </button>
          </nav>
        )}
      </div>

      <ul className="mt-3 text-[11px] text-ink/75 font-semibold space-y-0.5 list-none p-0 m-0">
        <li><b>Listed</b> = days since the listing was first seen by the scraper.</li>
        <li><span className="inline-block bg-yellow border border-ink text-ink text-[0.625rem] font-black uppercase px-1 leading-none mr-1">New</span>= appeared since your last visit.</li>
        <li><span className="inline-block w-2 h-2.5 bg-blue align-middle mr-1" />Blue edge = price dropped.</li>
      </ul>
    </div>
  );
}
