import { useState, useMemo } from 'react';
import ValueBadge from './ValueBadge';
import Icon from './Icon';
import { exportCsv } from '../utils/exportCsv';
import { sortListings } from '../utils/filters';
import { getListingValuation } from '../utils/valuation';

const MAX_COMPARE = 4;
const fmtR = (n) => (typeof n === 'number' ? `R${n.toLocaleString('en-ZA')}` : '—');

function useCopyFeedback() {
  const [state, setState] = useState(null);
  const run = async (text, okKey) => {
    try {
      await navigator.clipboard.writeText(text);
      setState(okKey);
    } catch {
      setState('failed');
    }
    setTimeout(() => setState(null), 2500);
  };
  return [state, run];
}

function PriceChange({ item }) {
  const saved = item.savedPrice;
  if (item.isSnapshotOnly || typeof saved !== 'number' || typeof item.price !== 'number' || saved === item.price) return null;
  const diff = item.price - saved;
  const down = diff < 0;
  return (
    <div className={`inline-flex items-center gap-1 text-xs font-black mb-2 px-1.5 py-0.5 border-2 border-ink ${down ? 'bg-lime text-ink' : 'bg-white text-ink'}`}>
      {down ? '↓' : '↑'} {fmtR(Math.abs(diff))} since you saved it
    </div>
  );
}

export default function ShortlistWorkspace({
  shortlistedUrls,
  userData,
  allListings = [],
  comparables = {},
  sort,
  onToggleShortlist,
  onUpdateNote,
  onSelectListing,
}) {
  const shortlistedItems = useMemo(() => {
    const listingMap = new Map(allListings.map(l => [l.url, l]));
    const items = Array.from(shortlistedUrls).map(url => {
      const stored = userData?.items?.[url] || {};
      const savedPrice = stored.snapshot?.price ?? null;
      const live = listingMap.get(url);
      const base = { userNote: stored.note || '', addedAt: stored.addedAt || null, savedPrice };
      if (live) return { ...live, ...base };
      const snap = stored.snapshot || { suburb: 'Unknown', price: null };
      const item = { ...snap, url, ...base, isSnapshotOnly: true };
      return { ...item, valuation: getListingValuation(item, comparables) };
    });
    return sort ? sortListings(items, sort) : items;
  }, [shortlistedUrls, allListings, userData, comparables, sort]);

  const urlsKey = shortlistedItems.map(i => i.url).join('\n');
  const [compareUrls, setCompareUrls] = useState(() => shortlistedItems.slice(0, MAX_COMPARE).map(i => i.url));
  const [knownKey, setKnownKey] = useState(urlsKey);
  // Keep the comparison in step with the shortlist: drop removed items and
  // pull newly added ones in while there is room.
  if (knownKey !== urlsKey) {
    const prevKnown = new Set(knownKey.split('\n'));
    const current = shortlistedItems.map(i => i.url);
    const added = current.filter(u => !prevKnown.has(u));
    setKnownKey(urlsKey);
    setCompareUrls(prev => [...prev.filter(u => current.includes(u)), ...added].slice(0, MAX_COMPARE));
  }

  const [copyState, copy] = useCopyFeedback();

  const activeCompareItems = shortlistedItems.filter(item => compareUrls.includes(item.url));

  const toggleCompareSelection = (url) => {
    setCompareUrls(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= MAX_COMPARE) return [...prev.slice(1), url];
      return [...prev, url];
    });
  };

  const handleCopySummary = () => {
    const itemsToCopy = activeCompareItems.length > 0 ? activeCompareItems : shortlistedItems;
    if (itemsToCopy.length === 0) return;
    let text = `Cape Town rental comparison (${itemsToCopy.length} properties)\n\n`;
    itemsToCopy.forEach((item, idx) => {
      text += `${idx + 1}. ${item.suburb} - ${fmtR(item.price)}/month\n`;
      text += `   • ${item.bedrooms === 0 ? 'Studio' : `${item.bedrooms ?? '—'} bed`} | ${item.bathrooms ?? '—'} bath | ${item.size_m2 ? `${item.size_m2}m²` : 'Size unlisted'}\n`;
      text += `   • Rate: ${item.price_per_m2 ? `R${item.price_per_m2}/m²` : '—'} | Value: ${item.valuation?.label || '—'}\n`;
      text += `   • Furnished: ${item.furnished === true ? 'Yes' : item.furnished === false ? 'No' : 'Unspecified'}\n`;
      text += `   • Available: ${item.available_date || 'Not stated'}\n`;
      if (item.agency_name) text += `   • Agency: ${item.agency_name}\n`;
      if (item.userNote) text += `   • Note: ${item.userNote}\n`;
      text += `   • Link: ${item.url}\n\n`;
    });
    copy(text, 'summary');
  };

  const shareableIds = shortlistedItems.map(i => i.listing_id).filter(Boolean);
  const handleShare = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('view', 'shortlist');
    url.searchParams.set('shared', shareableIds.join(','));
    copy(url.toString(), 'share');
  };

  if (shortlistedItems.length === 0) {
    return (
      <div className="border-[3px] border-ink bg-white p-8 md:p-12 text-center shadow-[4px_4px_0_#111111]">
        <Icon name="heart" size={32} className="mx-auto mb-3 text-ink/70" />
        <h3 className="text-base md:text-lg font-black uppercase text-ink mb-2">Your shortlist is empty</h3>
        <p className="text-sm text-ink/80 max-w-md mx-auto leading-relaxed m-0">
          Tap the heart on any listing in the table, cards or detail panel to save it here. You can add private
          notes, compare up to {MAX_COMPARE} side by side, and share the list.
        </p>
      </div>
    );
  }

  const validPrices = activeCompareItems.map(i => i.price).filter(p => typeof p === 'number' && p > 0);
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const sizes = activeCompareItems.map(i => i.size_m2).filter(Boolean);
  const maxSize = sizes.length ? Math.max(...sizes) : null;

  const rowLabel = 'p-3 font-black text-ink/80 bg-neutral-50 border-r border-neutral-200 uppercase text-[11px] sticky left-0';
  const cell = 'p-3 border-r border-neutral-200 last:border-r-0';
  const btn = 'min-h-[36px] border-2 border-ink text-xs font-black uppercase px-3 py-1.5 cursor-pointer transition-colors shadow-[1px_1px_0_#111111] focus-visible:outline-2 focus-visible:outline-ink inline-flex items-center gap-1.5';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-white p-3 shadow-[2px_2px_0_#111111]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs font-black uppercase tracking-wider text-ink">Shortlist ({shortlistedItems.length})</span>
          <span className="text-xs text-ink/80 font-medium">Comparing {activeCompareItems.length} of {shortlistedItems.length} (max {MAX_COMPARE})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          <button type="button" onClick={handleCopySummary} className={`${btn} bg-yellow text-ink`}>
            <Icon name={copyState === 'summary' ? 'check' : 'clipboard'} />
            {copyState === 'summary' ? 'Copied' : 'Copy comparison'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={shareableIds.length === 0}
            className={`${btn} bg-white text-ink hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Copy a link that opens this shortlist on another device"
          >
            <Icon name={copyState === 'share' ? 'check' : 'share'} />
            {copyState === 'share' ? 'Link copied' : 'Share link'}
          </button>
          <button type="button" onClick={() => exportCsv(shortlistedItems, 'ct-shortlist')} className={`${btn} bg-white text-ink hover:bg-neutral-100`}>
            <Icon name="download" /> Export CSV
          </button>
          {copyState === 'failed' && <span className="text-xs font-bold text-bred">Couldn&rsquo;t access the clipboard.</span>}
        </div>
      </div>

      {activeCompareItems.length >= 2 && (
        <section aria-labelledby="compare-title" className="border-2 border-ink bg-paper shadow-[3px_3px_0_#111111] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 id="compare-title" className="text-xs font-black uppercase tracking-wider text-ink flex items-center gap-1.5 m-0">
              <Icon name="scale" /> Side-by-side
            </h3>
            <span className="text-[11px] font-bold text-ink/80">Best rent and largest size are highlighted.</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white text-ink text-xs text-left border-2 border-ink">
              <thead>
                <tr className="bg-ink text-paper uppercase text-[11px] tracking-wider">
                  <th scope="col" className="p-3 w-28 border-r border-ink/20 sticky left-0 bg-ink">Feature</th>
                  {activeCompareItems.map(item => (
                    <th scope="col" key={item.url} className="p-3 border-r border-ink/20 last:border-r-0 min-w-[170px]">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-black truncate">{item.suburb}</span>
                        <button
                          type="button"
                          onClick={() => toggleCompareSelection(item.url)}
                          className="w-6 h-6 inline-flex items-center justify-center text-paper/80 hover:text-yellow cursor-pointer"
                          aria-label={`Remove ${item.suburb} from comparison`}
                        >
                          <Icon name="close" size={10} />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                <tr>
                  <th scope="row" className={rowLabel}>Rent</th>
                  {activeCompareItems.map(item => (
                    <td key={item.url} className={`${cell} font-mono`}>
                      <div className="text-sm font-black text-ink">{fmtR(item.price)}</div>
                      {item.price === minPrice && (
                        <span className="inline-block mt-0.5 border border-ink bg-lime text-ink text-[10px] font-black uppercase px-1">Lowest rent</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={rowLabel}>Beds &amp; baths</th>
                  {activeCompareItems.map(item => (
                    <td key={item.url} className={`${cell} font-bold`}>
                      {item.bedrooms === 0 ? 'Studio' : item.bedrooms != null ? `${item.bedrooms} bed` : 'Beds n/a'}
                      {' · '}
                      {item.bathrooms != null ? `${item.bathrooms} bath` : 'Baths n/a'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={rowLabel}>Size &amp; rate</th>
                  {activeCompareItems.map(item => (
                    <td key={item.url} className={`${cell} font-mono`}>
                      <span className={item.size_m2 && item.size_m2 === maxSize ? 'font-black underline' : 'font-bold'}>
                        {item.size_m2 ? `${item.size_m2}m²` : '—'}
                      </span>
                      {' · '}
                      <span className="text-ink/80">{item.price_per_m2 ? `R${item.price_per_m2}/m²` : '—'}</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={rowLabel}>Value</th>
                  {activeCompareItems.map(item => (
                    <td key={item.url} className={cell}><ValueBadge valuation={item.valuation} showTypical /></td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={rowLabel}>Furnishing</th>
                  {activeCompareItems.map(item => (
                    <td key={item.url} className={`${cell} font-bold`}>
                      {item.furnished === true ? 'Furnished' : item.furnished === false ? 'Unfurnished' : 'Unspecified'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={rowLabel}>Available</th>
                  {activeCompareItems.map(item => (
                    <td key={item.url} className={`${cell} font-mono`}>{item.available_date || 'Not stated'}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={rowLabel}>Notes</th>
                  {activeCompareItems.map(item => (
                    <td key={item.url} className={`${cell} text-ink/90 whitespace-pre-wrap`}>{item.userNote || <span className="text-ink/60">—</span>}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="shortlist-all-title">
        <h3 id="shortlist-all-title" className="text-xs font-black uppercase tracking-wider text-ink/80 mb-3 m-0">
          All shortlisted ({shortlistedItems.length})
        </h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
          {shortlistedItems.map(item => {
            const isCompared = compareUrls.includes(item.url);
            return (
              <li
                key={item.url}
                className={`border-2 border-ink bg-white p-4 shadow-[2px_2px_0_#111111] flex flex-col justify-between ${isCompared ? 'outline outline-2 outline-blue outline-offset-2' : ''}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <span className="text-[11px] font-black uppercase tracking-wider text-blue">{item.property_type || 'Residential'}</span>
                      <h4 className="font-black text-sm uppercase text-ink leading-tight m-0">{item.suburb}</h4>
                      {item.address && <p className="text-xs text-ink/80 truncate m-0">{item.address}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleShortlist(item.url, item)}
                      className="w-9 h-9 shrink-0 inline-flex items-center justify-center border-2 border-ink bg-bred text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-ink"
                      aria-label={`Remove ${item.suburb} listing from shortlist`}
                      title="Remove from shortlist"
                    >
                      <Icon name="heart" filled size={16} />
                    </button>
                  </div>

                  {item.isSnapshotOnly && (
                    <div className="text-[11px] font-bold border border-dashed border-ink/60 text-ink/80 px-2 py-1 mb-2">
                      Not in the latest snapshot — it may have been let. Showing details from when you saved it.
                    </div>
                  )}

                  <div className="text-base font-black font-mono text-ink mb-1">
                    {fmtR(item.price)}
                    <span className="text-[11px] font-normal text-ink/75 font-sans ml-1">/month</span>
                  </div>
                  <PriceChange item={item} />

                  <p className="text-xs font-bold text-ink/80 mb-3 m-0">
                    {[
                      item.bedrooms === 0 ? 'Studio' : item.bedrooms != null ? `${item.bedrooms} bed` : null,
                      item.size_m2 ? `${item.size_m2}m²` : null,
                      item.price_per_m2 ? `R${item.price_per_m2}/m²` : null,
                    ].filter(Boolean).join(' · ') || '—'}
                  </p>

                  <div className="mb-3"><ValueBadge valuation={item.valuation} showTypical /></div>

                  <label className="block mb-3">
                    <span className="block text-[11px] font-black uppercase tracking-wider text-ink/80 mb-1">Private note</span>
                    <textarea
                      rows={2}
                      defaultValue={item.userNote || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (item.userNote || '')) onUpdateNote?.(item.url, e.target.value);
                      }}
                      placeholder="Parking, views, fibre, viewing time…"
                      className="w-full border-2 border-ink/40 p-1.5 text-xs text-ink bg-neutral-50 focus:bg-white focus:outline-none focus:border-ink resize-y font-normal"
                    />
                  </label>
                </div>

                <div className="pt-2 border-t border-neutral-200 flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-ink cursor-pointer min-h-[36px]">
                    <input
                      type="checkbox"
                      checked={isCompared}
                      onChange={() => toggleCompareSelection(item.url)}
                      className="accent-blue cursor-pointer w-4 h-4"
                    />
                    Compare
                  </label>
                  <div className="flex items-center gap-1.5">
                    {!item.isSnapshotOnly && (
                      <button type="button" onClick={() => onSelectListing?.(item)} className={`${btn} bg-white text-ink hover:bg-neutral-100`}>
                        Details
                      </button>
                    )}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`${btn} bg-yellow text-ink no-underline`}
                      aria-label={`Open ${item.suburb} listing on Property24`}
                    >
                      <Icon name="external" />
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
