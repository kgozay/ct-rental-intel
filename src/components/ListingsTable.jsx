import { useState, useMemo } from 'react';
import ValueBadge from './ValueBadge';
import { SUBURBS_LIST } from '../utils/suburbs';
import { DEFAULT_FILTERS } from '../constants/filterConstants';
import { exportCsv } from '../utils/exportCsv';

function daysAgo(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  if (isNaN(diff)) return null;
  return Math.max(0, Math.floor(diff / 86400000));
}

function SortHdr({ field, title, sortField, sortAsc, handleSort, children }) {
  const isSorted = sortField === field;
  return (
    <th
      onClick={() => handleSort(field)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleSort(field); e.preventDefault(); } }}
      className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors whitespace-nowrap focus:outline-none focus:bg-neutral-800"
      aria-sort={isSorted ? (sortAsc ? 'ascending' : 'descending') : 'none'}
      role="columnheader"
      tabIndex={0}
      title={title}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="text-[0.625rem] opacity-80">{isSorted ? (sortAsc ? '▲' : '▼') : '▾'}</span>
      </span>
    </th>
  );
}

export default function ListingsTable({ listings, filteredListings, filters, setFilters, shortlisted, toggleShortlist, lastVisit, onSelectListing, selectedListingUrl }) {
  const [sortField, setSortField] = useState('price');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field !== 'value_score' && field !== 'days');
    }
  };

  const sortedListings = useMemo(() => [...filteredListings].sort((a, b) => {
    // Helper to compare values while keeping nulls at the end regardless of direction
    const compareWithNullsLast = (vA, vB, asc) => {
      const aNull = vA === null || vA === undefined || isNaN(vA);
      const bNull = vB === null || vB === undefined || isNaN(vB);
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      if (vA < vB) return asc ? -1 : 1;
      if (vA > vB) return asc ? 1 : -1;
      return 0;
    };

    switch (sortField) {
      case 'suburb':
        return sortAsc ? a.suburb.localeCompare(b.suburb) : b.suburb.localeCompare(a.suburb);
      case 'property_type':
        return sortAsc ? (a.property_type || '').localeCompare(b.property_type || '') : (b.property_type || '').localeCompare(a.property_type || '');
      case 'bedrooms':
        return compareWithNullsLast(a.bedrooms, b.bedrooms, sortAsc);
      case 'price':
        return compareWithNullsLast(a.price, b.price, sortAsc);
      case 'size_m2':
        return compareWithNullsLast(a.size_m2, b.size_m2, sortAsc);
      case 'price_per_m2':
        return compareWithNullsLast(a.price_per_m2, b.price_per_m2, sortAsc);
      case 'value_score':
        return compareWithNullsLast(a.value_score, b.value_score, sortAsc);
      case 'agency_name':
        return sortAsc ? (a.agency_name || '').localeCompare(b.agency_name || '') : (b.agency_name || '').localeCompare(a.agency_name || '');
      case 'days': {
        const daysA = daysAgo(a.created_at);
        const daysB = daysAgo(b.created_at);
        return compareWithNullsLast(daysA, daysB, sortAsc);
      }
      case 'available': {
        const dateA = a.available_date || null;
        const dateB = b.available_date || null;
        return compareWithNullsLast(dateA, dateB, sortAsc);
      }
      default:
        return compareWithNullsLast(a.price, b.price, sortAsc);
    }
  }), [filteredListings, sortField, sortAsc]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [prevResetKey, setPrevResetKey] = useState({ filters, sortField, sortAsc });

  if (prevResetKey.filters !== filters || prevResetKey.sortField !== sortField || prevResetKey.sortAsc !== sortAsc) {
    setPrevResetKey({ filters, sortField, sortAsc });
    setCurrentPage(1);
  }

  const totalCount = sortedListings.length;
  const numPageSize = pageSize === 'all' ? totalCount : Number(pageSize);
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalCount / (numPageSize || 25)));

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  const paginatedListings = useMemo(() => {
    if (pageSize === 'all') return sortedListings;
    const start = (currentPage - 1) * numPageSize;
    return sortedListings.slice(start, start + numPageSize);
  }, [sortedListings, currentPage, numPageSize, pageSize]);

  return (
    <div className="tableview">
      {/* TABLE TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
        <div className="text-xs font-black uppercase tracking-wider text-ink/60">
          Showing <span className="font-mono text-ink font-black">{totalCount}</span> properties
        </div>
        <button
          onClick={() => exportCsv(sortedListings)}
          className="border-2 border-ink bg-white text-ink text-xs font-black uppercase px-3 py-1 hover:bg-yellow transition-all cursor-pointer shadow-[2px_2px_0_#111111]"
          title="Export current filtered results as CSV"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* DATA TABLE */}
      <div className="overflow-x-auto border-2 border-ink shadow-[3px_3px_0_#111111]">
        <table className="w-full border-collapse bg-white text-ink text-left">
          <thead>
            <tr className="bg-ink text-paper uppercase text-xs tracking-wider border-b-2 border-ink">
              <SortHdr field="suburb" title="Sort by suburb name" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>Suburb</SortHdr>
              <SortHdr field="property_type" title="Sort by property type" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>Type</SortHdr>
              <SortHdr field="bedrooms" title="Sort by number of bedrooms" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>Beds</SortHdr>
              <SortHdr field="price" title="Sort by monthly rental price" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>Price</SortHdr>
              <SortHdr field="size_m2" title="Sort by unit size in square meters" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>Size</SortHdr>
              <SortHdr field="price_per_m2" title="Sort by rental price per square meter" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>R/m²</SortHdr>
              <SortHdr field="value_score" title="Sort by value score (relative to suburb median R/m²)" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>
                Value{' '}
                <span
                  className="font-normal opacity-50 cursor-help text-[0.625rem] ml-0.5"
                  title="Compares this listing's R/m² to the suburb median. Good value (lime) = 15%+ below median. Expensive (red) = 15%+ above."
                  onClick={e => e.stopPropagation()}
                >?</span>
              </SortHdr>
              <SortHdr field="available" title="Sort by occupation date" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>Available</SortHdr>
              <SortHdr field="days" title="Sort by days since listing was first seen" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>Days</SortHdr>
              <SortHdr field="agency_name" title="Sort by real estate agency name" sortField={sortField} sortAsc={sortAsc} handleSort={handleSort}>Agency</SortHdr>
              <th className="px-4 py-3 select-none">Link</th>
            </tr>
          </thead>
          <tbody>
            {sortedListings.length === 0 ? (
              <tr>
                <td colSpan="11" className="px-6 py-10 text-center">
                  {listings.length === 0 ? (
                    <span className="font-bold text-neutral-400">
                      No data yet — click ↻ Refresh Listings to run the first scrape.
                    </span>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="font-black text-sm text-ink">No listings match the active filters.</div>
                      <div className="text-xs text-neutral-500 font-medium max-w-sm text-left space-y-0.5">
                        {filters.search && <div>· Search keyword: &ldquo;{filters.search}&rdquo;</div>}
                        {filters.suburbs.length < SUBURBS_LIST.length && (
                          <div>· Suburbs limited to {filters.suburbs.length} of {SUBURBS_LIST.length}</div>
                        )}
                        {filters.maxPrice < 80000 && (
                          <div>· Max price set to R{filters.maxPrice.toLocaleString('en-ZA')}</div>
                        )}
                        {filters.minBeds !== null && <div>· Minimum {filters.minBeds}+ bedrooms</div>}
                        {filters.furnished === true && <div>· Furnished only</div>}
                        {filters.goodValueOnly && <div>· Good value only is on</div>}
                        {filters.priceDropOnly && <div>· Price drops only is on</div>}
                        {filters.shortlistOnly && shortlisted.size === 0 && <div>· Shortlist is empty — add listings with ♡</div>}
                        {filters.availableBefore && <div>· Available before {filters.availableBefore}</div>}
                      </div>
                      <button
                        onClick={() => setFilters(DEFAULT_FILTERS)}
                        className="border-[3px] border-ink bg-yellow text-ink text-xs font-black uppercase px-5 py-2 cursor-pointer shadow-[3px_3px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                      >
                        Reset all filters
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              paginatedListings.map((item, idx) => {
                const isPriceDrop = item.previous_price && item.price < item.previous_price;
                const days = daysAgo(item.created_at);
                const isNew = lastVisit && item.created_at && item.created_at > lastVisit;
                const animDelay = Math.min(idx, 15) * 30;

                return (
                  <tr
                    key={item.id || item.url}
                    className={`stagger-row ${onSelectListing ? 'cursor-pointer' : ''} ${item.url === selectedListingUrl ? 'bg-yellow border-l-[4px] border-l-blue' : isPriceDrop ? 'hover:bg-neutral-50 border-l-[4px] border-l-lime' : 'hover:bg-neutral-50'}`}
                    style={{ animationDelay: `${animDelay}ms` }}
                    onClick={() => onSelectListing?.(item)}
                  >
                    <td className="px-4 py-3.5 border-t border-neutral-200 font-bold text-xs uppercase">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {item.suburb}
                        {isNew && (
                          <span className="inline-block bg-yellow border border-ink text-ink text-[0.5625rem] font-black uppercase px-1.5 py-0.5 leading-none">
                            NEW
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200 text-xs uppercase font-extrabold text-neutral-500">
                      {item.property_type}
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200 font-bold text-center font-mono tabular-nums">
                      {item.bedrooms !== null ? `${item.bedrooms}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200 font-black font-mono tabular-nums">
                      R{item.price.toLocaleString('en-ZA')}
                      {isPriceDrop && (
                        <span className="block text-[0.6875rem] text-blue font-extrabold mt-0.5">
                          ↓ was R{item.previous_price.toLocaleString('en-ZA')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200 text-xs font-bold font-mono tabular-nums text-neutral-600">
                      {item.size_m2 ? `${item.size_m2}m²` : '—'}
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200 font-bold font-mono tabular-nums">
                      {item.price_per_m2 ? `R${item.price_per_m2}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200">
                      <ValueBadge score={item.value_score} />
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200 text-xs font-bold text-neutral-600">
                      {item.available_date
                        ? item.available_date <= new Date().toISOString().split('T')[0]
                          ? <span className="inline-flex items-center gap-1.5 text-emerald-600 font-black"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Immediate</span>
                          : <span className="font-mono text-neutral-600">{item.available_date}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200 text-xs font-bold font-mono tabular-nums text-neutral-500">
                      {days !== null ? `${days}d` : '—'}
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200 text-xs truncate max-w-xs font-semibold">
                      {item.agency_name || '—'}
                    </td>
                    <td className="px-4 py-3.5 border-t border-neutral-200" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleShortlist(item.url)}
                          className="text-base leading-none cursor-pointer hover:scale-110 transition-transform select-none"
                          title={shortlisted.has(item.url) ? 'Remove from shortlist' : 'Add to shortlist'}
                          aria-label={shortlisted.has(item.url) ? 'Remove from shortlist' : 'Add to shortlist'}
                        >
                          {shortlisted.has(item.url) ? '♥' : '♡'}
                        </button>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block border-2 border-ink bg-yellow font-black px-2.5 py-1 text-xs text-ink transition-transform duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                          title="Open listing on Property24"
                        >
                          ↗
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER ROW & PAGINATION CONTROLS */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-extrabold text-xs text-ink select-none">
            Showing <span className="inline-block bg-blue text-white px-2 py-0.5 text-xs font-black shadow-[2px_2px_0_#111111] mr-1">
              {totalCount === 0 ? 0 : `${(currentPage - 1) * numPageSize + 1}–${Math.min(currentPage * numPageSize, totalCount)}`}
            </span> of {totalCount} matching ({listings.length} total)
          </div>

          <label className="flex items-center gap-1.5 text-xs font-black text-ink select-none">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border-2 border-ink bg-white text-ink px-2 py-1 font-bold text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 select-none">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-2 border-ink bg-white text-ink font-black text-xs px-2.5 py-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 shadow-[1px_1px_0_#111111]"
            >
              ◀ Prev
            </button>
            <span className="text-xs font-extrabold px-2 text-ink">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border-2 border-ink bg-white text-ink font-black text-xs px-2.5 py-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 shadow-[1px_1px_0_#111111]"
            >
              Next ▶
            </button>
          </div>
        )}

        <button
          onClick={() => exportCsv(sortedListings)}
          className="border-2 border-ink bg-paper font-extrabold text-xs uppercase px-4 py-2 cursor-pointer hover:bg-neutral-100 transition-colors shadow-[2px_2px_0_#111111] hover:shadow-[3px_3px_0_#111111] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
        >
          ↓ Export CSV ({sortedListings.length})
        </button>
      </div>
      <div className="mt-2 text-[0.625rem] text-neutral-400 font-bold select-none space-y-0.5">
        <div>* "Days" = how many days since the listing was first detected by the scraper.</div>
        <div>* <span className="inline-block bg-yellow border border-ink text-ink text-[0.5625rem] font-black uppercase px-1 py-0 leading-none mr-0.5">NEW</span> = listing appeared since your last visit.</div>
        <div>* Value score compares this listing's R/m² to the suburb median. Hover the <span className="font-black text-ink">?</span> in the Value column for details.</div>
      </div>
    </div>
  );
}
