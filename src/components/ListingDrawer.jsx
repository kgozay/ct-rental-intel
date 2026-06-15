import { useEffect, useState, useRef } from 'react';
import ValueBadge from './ValueBadge';

export default function ListingDrawer({ listing, suburbMedianPrices, onClose }) {
  const [verdict, setVerdict] = useState(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const verdictCache = useRef({});

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!listing?.url) return;
    setVerdict(null);

    if (verdictCache.current[listing.url] !== undefined) {
      setVerdict(verdictCache.current[listing.url]);
      return;
    }

    setVerdictLoading(true);
    const suburbMedianPrice = suburbMedianPrices?.[listing.suburb] ?? null;
    fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing, suburbMedianPrice }),
    })
      .then(r => r.ok ? r.json() : { verdict: null })
      .then(data => {
        verdictCache.current[listing.url] = data.verdict || null;
        setVerdict(data.verdict || null);
      })
      .catch(() => { verdictCache.current[listing.url] = null; })
      .finally(() => setVerdictLoading(false));
  }, [listing?.url]);

  if (!listing) return null;

  const medianPrice = suburbMedianPrices?.[listing.suburb];
  const delta = medianPrice != null ? medianPrice - listing.price : null;
  const deltaAbs = delta != null ? Math.abs(delta) : null;
  const deltaLabel = delta > 0
    ? `R${deltaAbs.toLocaleString('en-ZA')} below suburb median`
    : delta < 0
      ? `R${Math.abs(delta).toLocaleString('en-ZA')} above suburb median`
      : delta === 0
        ? 'At suburb median'
        : null;
  const deltaColor = delta > 0 ? 'text-lime' : delta < 0 ? 'text-bred' : 'text-ink/50';

  // Map value_score (0.5–1.5) → fill width (0–100%)
  const scorePercent = listing.value_score != null
    ? Math.max(0, Math.min(100, ((listing.value_score - 0.5) / 1.0) * 100))
    : null;
  const scoreFill = listing.value_score > 1.15 ? 'bg-lime' : listing.value_score < 0.85 ? 'bg-bred' : 'bg-bgrey';

  const isPriceDrop = listing.previous_price && listing.price < listing.previous_price;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-full w-[360px] max-w-[95vw] bg-paper border-l-[3px] border-ink z-50 overflow-y-auto flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Listing detail"
      >
        {/* Header bar */}
        <div className="bg-ink text-paper px-5 py-4 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[0.625rem] font-black uppercase tracking-wider text-paper/50 mb-0.5">
              {listing.suburb}
            </div>
            <div className="font-black text-base leading-snug line-clamp-2">
              {listing.address || listing.suburb}
            </div>
          </div>
          <button
            onClick={onClose}
            className="border-2 border-paper text-paper font-black px-2 py-1 text-xs uppercase hover:bg-paper/20 transition-colors flex-shrink-0 mt-0.5 cursor-pointer"
            aria-label="Close listing detail"
          >
            ✕
          </button>
        </div>

        {/* Listing image */}
        {listing.main_image_url && (
          <div className="border-b-[3px] border-ink flex-shrink-0">
            <img
              src={listing.main_image_url}
              alt={listing.address || listing.suburb}
              className="w-full h-44 object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        <div className="p-5 flex flex-col gap-5 flex-1">
          {/* Property meta chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="border-2 border-ink px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
              {listing.property_type}
            </span>
            {listing.bedrooms != null && (
              <span className="border-2 border-ink px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
                {listing.bedrooms} BED
              </span>
            )}
            {listing.size_m2 && (
              <span className="border-2 border-ink px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
                {listing.size_m2}m²
              </span>
            )}
            {listing.furnished === true && (
              <span className="border-2 border-ink bg-yellow px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
                Furnished
              </span>
            )}
          </div>

          {/* Price block */}
          <div className="border-[3px] border-ink bg-white p-4">
            <div className="text-3xl font-black text-ink leading-none">
              R{listing.price.toLocaleString('en-ZA')}
              <span className="text-sm font-bold text-ink/40 ml-1">/mo</span>
            </div>
            {listing.price_per_m2 && (
              <div className="text-xs font-bold text-ink/50 mt-1">
                R{listing.price_per_m2}/m²
              </div>
            )}
            {isPriceDrop && (
              <div className="text-xs font-extrabold text-blue mt-1.5">
                ↓ Was R{listing.previous_price.toLocaleString('en-ZA')}
              </div>
            )}
          </div>

          {/* Market position */}
          <div>
            <div className="text-[0.625rem] font-black uppercase tracking-wider text-ink/50 mb-2">
              vs Suburb Median
            </div>
            {deltaLabel ? (
              <>
                <div className={`text-sm font-black ${deltaColor}`}>{deltaLabel}</div>
                {scorePercent !== null && (
                  <div className="mt-2.5 border-2 border-ink h-3 bg-white">
                    <div
                      className={`h-full ${scoreFill} transition-none`}
                      style={{ width: `${scorePercent}%` }}
                    />
                  </div>
                )}
                <div className="mt-2.5">
                  <ValueBadge score={listing.value_score} />
                </div>
              </>
            ) : (
              <div className="text-xs font-bold text-ink/40">No comparison data available</div>
            )}
          </div>

          {/* AI Verdict */}
          {(verdictLoading || verdict) && (
            <div className="border-t-[3px] border-ink pt-4">
              <div className="text-[0.625rem] font-black uppercase tracking-wider text-ink/50 mb-2">
                AI Verdict
              </div>
              {verdictLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-neutral-200 rounded w-full" />
                  <div className="h-3 bg-neutral-200 rounded w-4/5" />
                </div>
              ) : (
                <p className="text-sm font-semibold text-ink leading-snug">
                  <span className="text-blue mr-1 select-none">✦</span>{verdict}
                </p>
              )}
            </div>
          )}

          {/* Details section */}
          <div className="border-t-[3px] border-ink pt-4">
            <div className="text-[0.625rem] font-black uppercase tracking-wider text-ink/50 mb-2">
              Details
            </div>
            <div className="space-y-1.5 text-xs font-bold text-ink">
              {listing.available_date && (
                <div className="flex justify-between">
                  <span className="text-ink/50 uppercase">Available</span>
                  <span className="font-black">{listing.available_date}</span>
                </div>
              )}
              {listing.agency_name && (
                <div className="flex justify-between">
                  <span className="text-ink/50 uppercase">Agency</span>
                  <span className="font-black truncate ml-2 max-w-[180px] text-right">{listing.agency_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-auto pt-2">
            <a
              href={listing.url}
              target="_blank"
              rel="noreferrer"
              className="block w-full border-[3px] border-ink bg-yellow text-ink font-black uppercase text-sm text-center px-5 py-3 shadow-[4px_4px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              View on Property24 ↗
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
