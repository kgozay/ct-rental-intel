import React, { useState, useMemo } from 'react';
import ValueBadge from './ValueBadge';
import { SUBURBS_LIST } from '../utils/suburbs';

export default function ListingsTable({ listings, filteredListings, filters, setFilters }) {
  const [sortField, setSortField] = useState('price');
  const [sortAsc, setSortAsc] = useState(true);

  // 1. Toggle suburb in filters
  const toggleSuburb = (sub) => {
    let updated;
    if (filters.suburbs.includes(sub)) {
      // Don't allow empty list (or allow all if none selected, but standard is keeping active selections)
      updated = filters.suburbs.filter(s => s !== sub);
    } else {
      updated = [...filters.suburbs, sub];
    }
    setFilters({ ...filters, suburbs: updated });
  };

  // 2. Sorting handlers
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      // Higher value_score = better, so default that column to descending.
      setSortAsc(field !== 'value_score');
    }
  };

  // 3. Apply sorting on filtered listings (memoized)
  const sortedListings = useMemo(() => [...filteredListings].sort((a, b) => {
    let valA, valB;

    switch (sortField) {
      case 'suburb':
        valA = a.suburb;
        valB = b.suburb;
        break;
      case 'property_type':
        valA = a.property_type;
        valB = b.property_type;
        break;
      case 'bedrooms':
        valA = a.bedrooms ?? 0;
        valB = b.bedrooms ?? 0;
        break;
      case 'price':
        valA = a.price;
        valB = b.price;
        break;
      case 'size_m2':
        valA = a.size_m2 ?? 0;
        valB = b.size_m2 ?? 0;
        break;
      case 'price_per_m2':
        valA = a.price_per_m2 ?? 999999;
        valB = b.price_per_m2 ?? 999999;
        break;
      case 'value_score':
        valA = a.value_score ?? 0;
        valB = b.value_score ?? 0;
        // High value score is better, so default sorting by value score desc
        break;
      case 'agency_name':
        valA = a.agency_name || '';
        valB = b.agency_name || '';
        break;
      default:
        valA = a.price;
        valB = b.price;
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  }), [filteredListings, sortField, sortAsc]);

  return (
    <div className="tableview">
      {/* FILTER PANEL */}
      <div className="border-[3px] border-ink bg-paper shadow-[6px_6px_0_#111111] p-5 mb-7 rounded-none">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1 mb-4">
          Filters
        </h2>
        
        <div className="flex flex-wrap gap-6 items-start">
          {/* Suburb checkboxes */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">Suburb</div>
            <div className="flex flex-wrap gap-2 max-w-xl">
              {SUBURBS_LIST.map(sub => {
                const isActive = filters.suburbs.includes(sub);
                return (
                  <span
                    key={sub}
                    onClick={() => toggleSuburb(sub)}
                    className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                      isActive ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
                    }`}
                  >
                    {sub}
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
              type="range"
              min="8000"
              max="80000"
              step="500"
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: parseInt(e.target.value, 10) })}
              className="w-44 accent-blue cursor-pointer h-1.5 bg-neutral-200"
            />
          </div>

          {/* Bedrooms Pills */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">Beds</div>
            <div className="flex gap-1">
              {[
                { label: 'Any', value: null },
                { label: '1+', value: 1 },
                { label: '2+', value: 2 },
                { label: '3+', value: 3 }
              ].map(opt => {
                const isActive = filters.minBeds === opt.value;
                return (
                  <span
                    key={opt.label}
                    onClick={() => setFilters({ ...filters, minBeds: opt.value })}
                    className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                      isActive ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
                    }`}
                  >
                    {opt.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Furnished Pill */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">Furnished</div>
            <div className="flex gap-1">
              {[
                { label: 'All', value: null },
                { label: 'Furnished only', value: true }
              ].map(opt => {
                const isActive = filters.furnished === opt.value;
                return (
                  <span
                    key={opt.label}
                    onClick={() => setFilters({ ...filters, furnished: opt.value })}
                    className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                      isActive ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
                    }`}
                  >
                    {opt.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Value score checkbox */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-ink/70">Value</div>
            <span
              onClick={() => setFilters({ ...filters, goodValueOnly: !filters.goodValueOnly })}
              className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer select-none transition-colors duration-100 ${
                filters.goodValueOnly ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
              }`}
            >
              Good only
            </span>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="overflow-x-auto border-[3px] border-ink shadow-[6px_6px_0_#111111]">
        <table className="w-full border-collapse bg-white text-ink text-left">
          <thead>
            <tr className="bg-ink text-paper uppercase text-xs tracking-wider border-b-[3px] border-ink">
              <th onClick={() => handleSort('suburb')} className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors">
                Suburb {sortField === 'suburb' ? (sortAsc ? '▲' : '▼') : '▾'}
              </th>
              <th onClick={() => handleSort('property_type')} className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors">
                Type
              </th>
              <th onClick={() => handleSort('bedrooms')} className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors">
                Beds
              </th>
              <th onClick={() => handleSort('price')} className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors">
                Price {sortField === 'price' ? (sortAsc ? '▲' : '▼') : '▾'}
              </th>
              <th onClick={() => handleSort('size_m2')} className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors">
                Size
              </th>
              <th onClick={() => handleSort('price_per_m2')} className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors">
                R/m²
              </th>
              <th onClick={() => handleSort('value_score')} className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors">
                Value {sortField === 'value_score' ? (sortAsc ? '▲' : '▼') : '▾'}
              </th>
              <th onClick={() => handleSort('agency_name')} className="px-4 py-3 cursor-pointer select-none hover:bg-neutral-800 transition-colors">
                Agency
              </th>
              <th className="px-4 py-3 select-none">
                Link
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedListings.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-4 py-8 text-center text-neutral-400 font-bold">
                  No listings match the current filters.
                </td>
              </tr>
            ) : (
              sortedListings.map((item, idx) => {
                const isPriceDrop = item.previous_price && item.price < item.previous_price;
                return (
                  <tr
                    key={item.id || item.url}
                    className="stagger-row hover:bg-neutral-50"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <td className="px-4 py-3 border-t-2 border-ink font-bold text-xs uppercase">
                      {item.suburb}
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
                    <td className="px-4 py-3 border-t-2 border-ink text-xs truncate max-w-xs font-semibold">
                      {item.agency_name || '—'}
                    </td>
                    <td className="px-4 py-3 border-t-2 border-ink">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block border-2 border-ink bg-yellow font-black px-2.5 py-1 text-xs text-ink transition-transform duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                      >
                        ↗
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 font-extrabold text-sm text-ink select-none">
        Showing <span className="inline-block bg-blue text-white px-2 py-0.5 text-xs font-black shadow-[2px_2px_0_#111111] mr-1">{sortedListings.length}</span> of {listings.length} listings
      </div>
    </div>
  );
}
