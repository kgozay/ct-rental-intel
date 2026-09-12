import { useState, useMemo } from 'react';
import ValueBadge from './ValueBadge';
import { exportCsv } from '../utils/exportCsv';

export default function ShortlistWorkspace({
  shortlistedUrls,
  userData,
  allListings = [],
  onToggleShortlist,
  onUpdateNote,
  onSelectListing,
}) {
  // Find full listing objects for shortlisted URLs
  // Fall back to snapshot in userData.items if listing was filtered out or from an earlier scrape
  const shortlistedItems = useMemo(() => {
    const listingMap = new Map();
    allListings.forEach(l => {
      if (l.url) listingMap.set(l.url, l);
    });

    return Array.from(shortlistedUrls).map(url => {
      const liveListing = listingMap.get(url);
      const storedItem = userData?.items?.[url] || {};
      if (liveListing) {
        return {
          ...liveListing,
          userNote: storedItem.note || '',
          addedAt: storedItem.addedAt || null,
        };
      }
      // Fallback from snapshot
      if (storedItem.snapshot) {
        return {
          ...storedItem.snapshot,
          url,
          userNote: storedItem.note || '',
          addedAt: storedItem.addedAt || null,
          isSnapshotOnly: true,
        };
      }
      return {
        url,
        suburb: 'Unknown',
        price: null,
        userNote: storedItem.note || '',
        addedAt: storedItem.addedAt || null,
        isSnapshotOnly: true,
      };
    });
  }, [shortlistedUrls, allListings, userData]);

  // Selected URLs for side-by-side comparison (max 4)
  const [selectedForCompare, setSelectedForCompare] = useState(() => {
    return shortlistedItems.slice(0, 3).map(i => i.url);
  });

  const [copyFeedback, setCopyFeedback] = useState(false);

  // Sync selected comparison items if items were removed
  const activeCompareItems = useMemo(() => {
    return shortlistedItems.filter(item => selectedForCompare.includes(item.url));
  }, [shortlistedItems, selectedForCompare]);

  const toggleCompareSelection = (url) => {
    setSelectedForCompare(prev => {
      if (prev.includes(url)) {
        return prev.filter(u => u !== url);
      }
      if (prev.length >= 4) {
        // Replace oldest
        return [...prev.slice(1), url];
      }
      return [...prev, url];
    });
  };

  const handleCopySummary = () => {
    const itemsToCopy = activeCompareItems.length > 0 ? activeCompareItems : shortlistedItems;
    if (itemsToCopy.length === 0) return;

    let text = `Cape Town Rental Comparison (${itemsToCopy.length} properties)\n\n`;
    itemsToCopy.forEach((item, idx) => {
      text += `${idx + 1}. ${item.suburb} - R${item.price?.toLocaleString('en-ZA') || '—'}/month\n`;
      text += `   • ${item.bedrooms ?? '—'} bed | ${item.bathrooms ?? '—'} bath | ${item.size_m2 ? item.size_m2 + 'm²' : 'Size unlisted'}\n`;
      text += `   • Rate: ${item.price_per_m2 ? 'R' + item.price_per_m2 + '/m²' : '—'}\n`;
      text += `   • Furnished: ${item.furnished === true ? 'Yes' : item.furnished === false ? 'No' : 'Unspecified'}\n`;
      text += `   • Available: ${item.available_date || 'Immediately'}\n`;
      if (item.agency_name) text += `   • Agency: ${item.agency_name}\n`;
      if (item.userNote) text += `   • Private Note: ${item.userNote}\n`;
      text += `   • Link: ${item.url}\n\n`;
    });

    navigator.clipboard?.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    }).catch(err => {
      console.warn('Clipboard write error:', err);
    });
  };

  if (shortlistedItems.length === 0) {
    return (
      <div className="border-[3px] border-ink bg-white p-8 md:p-12 text-center shadow-[4px_4px_0_#111111]">
        <div className="text-3xl mb-2 select-none">♡</div>
        <h3 className="text-base md:text-lg font-black uppercase text-ink mb-2">
          Your Shortlist is Empty
        </h3>
        <p className="text-xs md:text-sm text-neutral-600 max-w-md mx-auto mb-6 leading-relaxed">
          Click the heart icon on any rental in the table, card view, or map to save candidates here. You can add private inspection notes and compare up to 4 listings side by side.
        </p>
      </div>
    );
  }

  // Find lowest price among compared items for highlighting
  const validPrices = activeCompareItems.map(i => i.price).filter(p => typeof p === 'number' && p > 0);
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

  return (
    <div className="space-y-6">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-white p-3 shadow-[2px_2px_0_#111111]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-ink">
            Shortlist ({shortlistedItems.length})
          </span>
          <span className="text-xs text-neutral-500 font-medium">
            Comparing {activeCompareItems.length} of {shortlistedItems.length} (max 4)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="border-2 border-ink bg-yellow text-ink text-xs font-black uppercase px-3 py-1.5 cursor-pointer transition-all shadow-[1px_1px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] focus-visible:outline-2 focus-visible:outline-ink"
            title="Copy formatted text comparison to clipboard"
          >
            {copyFeedback ? '✓ Summary Copied!' : '📋 Copy Comparison'}
          </button>
          <button
            onClick={() => exportCsv(shortlistedItems)}
            className="border-2 border-ink bg-white text-ink text-xs font-black uppercase px-3 py-1.5 cursor-pointer transition-all shadow-[1px_1px_0_#111111] hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-ink"
            title="Export shortlist as CSV"
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* SIDE-BY-SIDE COMPARISON MATRIX */}
      {activeCompareItems.length >= 2 && (
        <section aria-label="Side by side property comparison" className="border-2 border-ink bg-paper shadow-[3px_3px_0_#111111] overflow-x-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-ink flex items-center gap-1.5">
              <span>⚖ Side-by-Side Comparison</span>
              <span className="text-[10px] font-normal text-neutral-500 normal-case">(Differences emphasized in bold)</span>
            </h4>
            {activeCompareItems.length < shortlistedItems.length && (
              <span className="text-[11px] font-bold text-blue">
                Select other items below to swap comparison
              </span>
            )}
          </div>

          <table className="w-full border-collapse bg-white text-ink text-xs text-left border-2 border-ink">
            <thead>
              <tr className="bg-ink text-paper uppercase text-[11px] tracking-wider border-b-2 border-ink">
                <th className="p-3 w-32 shrink-0 border-r border-ink/20">Feature</th>
                {activeCompareItems.map(item => (
                  <th key={item.url} className="p-3 border-r border-ink/20 last:border-r-0 min-w-[200px]">
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-black truncate">{item.suburb}</span>
                      <button
                        onClick={() => toggleCompareSelection(item.url)}
                        className="text-[10px] font-bold text-paper/70 hover:text-yellow cursor-pointer"
                        title="Remove from comparison view"
                        aria-label={`Remove ${item.suburb} from comparison table`}
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {/* Monthly Rent */}
              <tr>
                <td className="p-3 font-black text-ink/70 bg-neutral-50 border-r border-neutral-200 uppercase text-[10px]">Monthly Rent</td>
                {activeCompareItems.map(item => {
                  const isLowest = item.price === minPrice && activeCompareItems.length > 1;
                  return (
                    <td key={item.url} className="p-3 font-mono border-r border-neutral-200 last:border-r-0">
                      <div className="text-sm font-black text-ink">
                        R{item.price?.toLocaleString('en-ZA') || '—'}
                      </div>
                      {isLowest && (
                        <span className="inline-block mt-0.5 border border-emerald-600 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-1 py-0.2">
                          Lowest Rent
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Bedrooms & Bathrooms */}
              <tr>
                <td className="p-3 font-black text-ink/70 bg-neutral-50 border-r border-neutral-200 uppercase text-[10px]">Beds & Baths</td>
                {activeCompareItems.map(item => (
                  <td key={item.url} className="p-3 font-bold border-r border-neutral-200 last:border-r-0">
                    {item.bedrooms !== null && item.bedrooms !== undefined ? `${item.bedrooms} Bed` : 'Bed unlisted'}
                    {' · '}
                    {item.bathrooms !== null && item.bathrooms !== undefined ? `${item.bathrooms} Bath` : 'Bath unlisted'}
                  </td>
                ))}
              </tr>

              {/* Size & R/m² */}
              <tr>
                <td className="p-3 font-black text-ink/70 bg-neutral-50 border-r border-neutral-200 uppercase text-[10px]">Size & Rate</td>
                {activeCompareItems.map(item => (
                  <td key={item.url} className="p-3 font-mono border-r border-neutral-200 last:border-r-0">
                    <span className="font-bold">{item.size_m2 ? `${item.size_m2}m²` : '—'}</span>
                    {' · '}
                    <span className="text-neutral-600">{item.price_per_m2 ? `R${item.price_per_m2}/m²` : '—'}</span>
                  </td>
                ))}
              </tr>

              {/* Value Verdict */}
              <tr>
                <td className="p-3 font-black text-ink/70 bg-neutral-50 border-r border-neutral-200 uppercase text-[10px]">Value Benchmark</td>
                {activeCompareItems.map(item => (
                  <td key={item.url} className="p-3 border-r border-neutral-200 last:border-r-0">
                    <ValueBadge score={item.value_score} showTypical />
                  </td>
                ))}
              </tr>

              {/* Furnishing */}
              <tr>
                <td className="p-3 font-black text-ink/70 bg-neutral-50 border-r border-neutral-200 uppercase text-[10px]">Furnishing</td>
                {activeCompareItems.map(item => (
                  <td key={item.url} className="p-3 font-bold border-r border-neutral-200 last:border-r-0">
                    {item.furnished === true ? 'Furnished' : item.furnished === false ? 'Unfurnished' : 'Unspecified'}
                  </td>
                ))}
              </tr>

              {/* Occupation Date */}
              <tr>
                <td className="p-3 font-black text-ink/70 bg-neutral-50 border-r border-neutral-200 uppercase text-[10px]">Available</td>
                {activeCompareItems.map(item => (
                  <td key={item.url} className="p-3 font-mono border-r border-neutral-200 last:border-r-0">
                    {item.available_date || 'Immediately'}
                  </td>
                ))}
              </tr>

              {/* Agency */}
              <tr>
                <td className="p-3 font-black text-ink/70 bg-neutral-50 border-r border-neutral-200 uppercase text-[10px]">Agency</td>
                {activeCompareItems.map(item => (
                  <td key={item.url} className="p-3 truncate max-w-[200px] border-r border-neutral-200 last:border-r-0 font-medium">
                    {item.agency_name || '—'}
                  </td>
                ))}
              </tr>

              {/* Private Notes */}
              <tr>
                <td className="p-3 font-black text-ink/70 bg-neutral-50 border-r border-neutral-200 uppercase text-[10px]">Private Notes</td>
                {activeCompareItems.map(item => (
                  <td key={item.url} className="p-3 border-r border-neutral-200 last:border-r-0">
                    <textarea
                      rows={2}
                      defaultValue={item.userNote || ''}
                      onBlur={(e) => onUpdateNote?.(item.url, e.target.value)}
                      placeholder="Add note (parking, views, fiber)..."
                      className="w-full border border-neutral-300 p-1.5 text-xs text-ink bg-neutral-50 focus:bg-white focus:outline-none focus:border-ink resize-y font-normal"
                      aria-label={`Private note for ${item.suburb}`}
                    />
                  </td>
                ))}
              </tr>

              {/* Actions */}
              <tr>
                <td className="p-3 font-black text-ink/70 bg-neutral-50 border-r border-neutral-200 uppercase text-[10px]">Actions</td>
                {activeCompareItems.map(item => (
                  <td key={item.url} className="p-3 border-r border-neutral-200 last:border-r-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectListing?.(item)}
                        className="border border-ink bg-white px-2 py-1 text-[11px] font-bold uppercase hover:bg-neutral-100 cursor-pointer"
                      >
                        Detail
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-ink bg-yellow px-2 py-1 text-[11px] font-bold text-ink hover:underline"
                        title="View on Property24"
                      >
                        P24 ↗
                      </a>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* SHORTLIST ITEMS GRID */}
      <div>
        <h4 className="text-xs font-black uppercase tracking-wider text-ink/70 mb-3">
          All Shortlisted Properties ({shortlistedItems.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shortlistedItems.map(item => {
            const isCompared = selectedForCompare.includes(item.url);
            return (
              <div
                key={item.url}
                className={`border-2 border-ink bg-white p-4 transition-all shadow-[2px_2px_0_#111111] flex flex-col justify-between ${
                  isCompared ? 'ring-2 ring-blue' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue">
                        {item.property_type || 'Residential'}
                      </span>
                      <h5 className="font-black text-sm uppercase text-ink leading-tight">
                        {item.suburb}
                      </h5>
                    </div>
                    <button
                      onClick={() => onToggleShortlist(item.url, item)}
                      className="text-base text-ink cursor-pointer hover:scale-110 transition-transform select-none focus-visible:outline-2 focus-visible:outline-ink"
                      title="Remove from shortlist"
                      aria-label={`Remove ${item.suburb} from shortlist`}
                    >
                      ♥
                    </button>
                  </div>

                  <div className="text-base font-black font-mono text-ink mb-2">
                    R{item.price?.toLocaleString('en-ZA') || '—'}
                    <span className="text-[11px] font-normal text-neutral-500 font-sans ml-1">/month</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-neutral-600 mb-3">
                    <span>{item.bedrooms !== null && item.bedrooms !== undefined ? `${item.bedrooms} Bed` : '—'}</span>
                    <span>·</span>
                    <span>{item.size_m2 ? `${item.size_m2}m²` : '—'}</span>
                    <span>·</span>
                    <span>{item.price_per_m2 ? `R${item.price_per_m2}/m²` : '—'}</span>
                  </div>

                  <div className="mb-3">
                    <ValueBadge score={item.value_score} showTypical />
                  </div>

                  {/* Private note */}
                  <div className="mb-3">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-ink/60 mb-1">
                      Private Inspection Note:
                    </label>
                    <textarea
                      rows={2}
                      defaultValue={item.userNote || ''}
                      onBlur={(e) => onUpdateNote?.(item.url, e.target.value)}
                      placeholder="Click to add note..."
                      className="w-full border border-neutral-300 p-1.5 text-xs text-ink bg-neutral-50 focus:bg-white focus:outline-none focus:border-ink resize-none font-normal"
                      aria-label={`Private note for ${item.suburb}`}
                    />
                  </div>
                </div>

                {/* Card actions */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-ink cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isCompared}
                      onChange={() => toggleCompareSelection(item.url)}
                      className="accent-blue cursor-pointer"
                    />
                    <span>Compare</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSelectListing?.(item)}
                      className="border border-ink bg-white px-2.5 py-1 text-xs font-black uppercase hover:bg-neutral-100 cursor-pointer shadow-[1px_1px_0_#111111]"
                    >
                      Detail
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-ink bg-yellow px-2.5 py-1 text-xs font-black text-ink hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform shadow-[1px_1px_0_#111111]"
                      title="Open on Property24"
                    >
                      ↗
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
