import React, { useState, useMemo } from 'react';
import ValueBadge from './ValueBadge';
import { SUBURBS_LIST } from '../utils/suburbs';

function daysAgo(isoString) {
  if (!isoString) return null;
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000);
}

function exportCsv(rows) {
  const headers = ['Suburb', 'Type', 'Beds', 'Price (ZAR)', 'Size (m²)', 'R/m²', 'Value', 'Available', 'Days Listed', 'Agency', 'URL'];
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map(l => [
      l.suburb, l.property_type, l.bedrooms ?? '', l.price,
      l.size_m2 ?? '', l.price_per_m2 ?? '',
      l.value_score > 1.15 ? 'Good value' : l.value_score < 0.85 ? 'Expensive' : 'Fair',
      l.available_date ?? '', daysAgo(l.created_at) ?? '',
      l.agency_name ?? '', l.url
    ].map(escape).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ct-rentals-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ListingsTable({ listings, filteredListings, filters, setFilters, shortlisted, toggleShortlist, lastVisit }) {
  const [sortField, setSortField] = useState('price');
  const [sortAsc, setSortAsc] = useState(true);

  const toggleSuburb = (sub) => {
    const updated = filters.suburbs.includes(sub)
      ? filters.suburbs.filter(s => s !== sub)
      : [...filters.suburbs, sub];
    setFilters({ ...filters, suburbs: updated });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field !== 'value_score' && field !== 'days');
    }
  };

  // Inventory counts per suburb (from unfiltered listings)
  const suburbCounts = useMemo(() =>
    Object.fromEntries(SUBURBS_LIST.map(s => [s, listings.filter(l => l.suburb === s).length])),
    [listings]
  );

  const sortedListings = useMemo(() => [...filteredListings].sort((a, b) => {
    let valA, valB;
    switch (sortField) {
      case 'suburb':        valA = a.suburb; valB = b.suburb; break;
      case 'property_type': valA = a.property_type; valB = b.property_type; break;
      case 'bedrooms':      valA = a.bedrooms ?? 0; valB = b.bedrooms ?? 0; break;
      case 'price':         valA = a.price; valB = b.price; break;
      case 'size_m2':       valA = a.size_m2 ?? 0; valB = b.size_m2 ?? 0; break;
      case 'price_per_m2':  valA = a.price_per_m2 ?? 999999; valB = b.price_per_m2 ?? 999999; break;
      case 'value_score':   valA = a.value_score ?? 0; valB = b.value_score ?? 0; break;
      case 'agency_name':   valA = a.agency_name || ''; valB = b.agency_name || ''; break;
      case 'days':          valA = a.created_at || ''; valB = b.created_at || ''; break;
      case 'available':     valA = a.available_date || 'zzz'; valB = b.available_date || 'zzz'; break;
      default:              valA = a.price; valB = b.price;
    }
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  }), [filteredListings, sortField, sortAsc]);

  const SortHdr = ({ field, children }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors whitespace-nowrap"
    >
      {children} {sortField === field ? (sortAsc ? '▲' : '▼') : '▾'}
    </th>
  );

  return (
    <div className="tableview">
      {/* FILTER PANEL */}
      <div className="border-[3px] border-ink bg-paper shadow-[6px_6px_0_#111111] p-5 mb-7 rounded-none">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1 mb-4">
          Filters
        </h2>

        <div className="flex flex-wrap gap-6 items-start">
          {/* Suburb chips with inventory count */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">Suburb</div>
            <div className="flex flex-wrap gap-2 max-w-xl">
              {SUBURBS_LIST.map(sub => {
                const isActive = filters.suburbs.includes(sub);
                const count = suburbCounts[sub] || 0;
                return (
                  <span
                    key={sub}
                    onClick={() => toggleSuburb(sub)}
                    className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                      isActive ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
                    }`}
                  >
                    {sub}
                    <span className={`ml-1.5 text-[10px] font-black ${isActive ? 'text-paper/60' : 'text-neutral-400'}`}>
                      {count}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Max Price Slider */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">
              Max Price — <span className="font-extrabold text-sm text-blue">R{filters.maxPrice.toLocaleString('en-ZA')}</span>
            </div>
            <input
              type="range" min="8000" max="80000" step="500"
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: parseInt(e.target.value, 10) })}
              className="w-44 accent-blue cursor-pointer h-1.5 bg-neutral-200"
            />
          </div>

          {/* Bedrooms */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">Beds</div>
            <div className="flex gap-1">
              {[{ label: 'Any', value: null }, { label: '1+', value: 1 }, { label: '2+', value: 2 }, { label: '3+', value: 3 }].map(opt => (
                <span
                  key={opt.label}
                  onClick={() => setFilters({ ...filters, minBeds: opt.value })}
                  className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                    filters.minBeds === opt.value ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
                  }`}
                >
                  {opt.label}
                </span>
              ))}
            </div>
          </div>

          {/* Furnished */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">Furnished</div>
            <div className="flex gap-1">
              {[{ label: 'All', value: null }, { label: 'Furnished only', value: true }].map(opt => (
                <span
                  key={opt.label}
                  onClick={() => setFilters({ ...filters, furnished: opt.value })}
                  className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                    filters.furnished === opt.value ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
                  }`}
                >
                  {opt.label}
                </span>
              ))}
            </div>
          </div>

          {/* Available before date */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">Available Before</div>
            <input
              type="date"
              value={filters.availableBefore}
              onChange={(e) => setFilters({ ...filters, availableBefore: e.target.value })}
              className="border-2 border-ink bg-white px-2 py-1 text-xs font-bold text-ink cursor-pointer accent-blue focus:outline-none"
            />
            {filters.availableBefore && (
              <span
                onClick={() => setFilters({ ...filters, availableBefore: '' })}
                className="text-[10px] font-bold text-blue cursor-pointer hover:underline"
              >
                Clear
              </span>
            )}
          </div>

          {/* Toggle chips row */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">Quick Filters</div>
            <div className="flex flex-wrap gap-1">
              <span
                onClick={() => setFilters({ ...filters, goodValueOnly: !filters.goodValueOnly })}
                className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                  filters.goodValueOnly ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
                }`}
              >
                Good value only
              </span>
              <span
                onClick={() => setFilters({ ...filters, priceDropOnly: !filters.priceDropOnly })}
                className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                  filters.priceDropOnly ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-ink hover:bg-neutral-100'
                }`}
              >
                ↓ Price drops
              </span>
              <span
                onClick={() => setFilters({ ...filters, shortlistOnly: !filters.shortlistOnly })}
                className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                  filters.shortlistOnly ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
                }`}
              >
                ♥ Shortlist only
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="overflow-x-auto border-[3px] border-ink shadow-[6px_6px_0_#111111]">
        <table className="w-full border-collapse bg-white text-ink text-left">
          <thead>
            <tr className="bg-ink text-paper uppercase text-xs tracking-wider border-b-[3px] border-ink">
              <SortHdr field="suburb">Suburb</SortHdr>
              <SortHdr field="property_type">Type</SortHdr>
              <SortHdr field="bedrooms">Beds</SortHdr>
              <SortHdr field="price">Price</SortHdr>
              <SortHdr field="size_m2">Size</SortHdr>
              <SortHdr field="price_per_m2">R/m²</SortHdr>
              <SortHdr field="value_score">Value</SortHdr>
              <SortHdr field="available">Available</SortHdr>
              <SortHdr field="days">Days</SortHdr>
              <SortHdr field="agency_name">Agency</SortHdr>
              <th className="px-4 py-3 select-none">Link</th>
            </tr>
          </thead>
          <tbody>
            {sortedListings.length === 0 ? (
              <tr>
                <td colSpan="11" className="px-4 py-8 text-center text-neutral-400 font-bold">
                  No listings match the current filters.
                </td>
              </tr>
            ) : (
              sortedListings.map((item, idx) => {
                const isPriceDrop = item.previous_price && item.price < item.previous_price;
                const days = daysAgo(item.created_at);
                const isNew = lastVisit && item.created_at && item.created_at > lastVisit;

                return (
                  <tr
                    key={item.id || item.url}
                    className={`stagger-row hover:bg-neutral-50 ${isPriceDrop ? 'border-l-4 border-l-emerald-500' : ''}`}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <td className="px-4 py-3 border-t-2 border-ink font-bold text-xs uppercase">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {item.suburb}
                        {isNew && (
                          <span className="inline-block bg-yellow border border-ink text-ink text-[9px] font-black uppercase px-1.5 py-0.5 leading-none">
                            NEW
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink text-xs uppercase font-extrabold text-neutral-500">
                      {item.property_type}
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink font-bold text-center">
                      {item.bedrooms !== null ? `${item.bedrooms}` : '—'}
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink font-black">
                      R{item.price.toLocaleString('en-ZA')}
                      {isPriceDrop && (
                        <span className="block text-[11px] text-emerald-600 font-extrabold mt-0.5">
                          ↓ was R{item.previous_price.toLocaleString('en-ZA')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink text-xs font-extrabold text-neutral-600">
                      {item.size_m2 ? `${item.size_m2}m²` : '—'}
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink font-bold">
                      {item.price_per_m2 ? `${item.price_per_m2}` : '—'}
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink">
                      <ValueBadge score={item.value_score} />
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink text-xs font-bold text-neutral-600">
                      {item.available_date ?? '—'}
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink text-xs font-bold text-neutral-500">
                      {days !== null ? `${days}d` : '—'}
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink text-xs truncate max-w-xs font-semibold">
                      {item.agency_name || '—'}
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleShortlist(item.url)}
                          className="text-base leading-none cursor-pointer hover:scale-110 transition-transform select-none"
                          title={shortlisted.has(item.url) ? 'Remove from shortlist' : 'Add to shortlist'}
                        >
                          {shortlisted.has(item.url) ? '♥' : '♡'}
                        </button>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block border-2 border-ink bg-yellow font-black px-2.5 py-1 text-xs text-ink transition-transform duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
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

      {/* FOOTER ROW */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="font-extrabold text-sm text-ink select-none">
          Showing <span className="inline-block bg-blue text-white px-2 py-0.5 text-xs font-black shadow-[2px_2px_0_#111111] mr-1">{sortedListings.length}</span> of {listings.length} listings
        </div>
        <button
          onClick={() => exportCsv(sortedListings)}
          className="border-2 border-ink bg-paper font-extrabold text-xs uppercase px-4 py-2 cursor-pointer hover:bg-neutral-100 transition-colors shadow-[2px_2px_0_#111111] hover:shadow-[3px_3px_0_#111111] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
        >
          ↓ Export CSV
        </button>
      </div>
    </div>
  );
}
