import { useEffect, useState, useRef } from 'react';
import ValueExplanation from './ValueExplanation';

export default function ListingDrawer({ listing, suburbMedianPrices, shortlisted, toggleShortlist, onClose }) {
  const [verdict, setVerdict] = useState(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const verdictCache = useRef({});
  const closeBtnRef = useRef(null);
  const prevFocusedRef = useRef(null);

  useEffect(() => {
    prevFocusedRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    // Focus close button initially
    if (closeBtnRef.current) {
      closeBtnRef.current.focus();
    }

    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
      if (prevFocusedRef.current && typeof prevFocusedRef.current.focus === 'function') {
        prevFocusedRef.current.focus();
      }
    };
  }, [onClose]);

  useEffect(() => {
    if (!listing?.url) return;

    if (verdictCache.current[listing.url] !== undefined) {
      Promise.resolve().then(() => {
        setVerdict(verdictCache.current[listing.url]);
      });
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
      .catch(() => {
        verdictCache.current[listing.url] = null;
        setVerdict(null);
      })
      .finally(() => setVerdictLoading(false));
  }, [listing, suburbMedianPrices]);

  if (!listing) return null;

  const medianPrice = suburbMedianPrices?.[listing.suburb];
  const isPriceDrop = listing.previous_price && listing.price < listing.previous_price;
  const isShortlisted = shortlisted && shortlisted.has(listing.url);

  const handleCopyLink = () => {
    if (listing.url) {
      navigator.clipboard.writeText(listing.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/50 backdrop-blur-xs z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-full w-[380px] max-w-[95vw] bg-paper border-l-[3px] border-ink z-50 overflow-y-auto flex flex-col shadow-[-6px_0_0_#111111]"
        role="dialog"
        aria-modal="true"
        aria-label="Listing detail drawer"
      >
        {/* Header bar */}
        <div className="bg-ink text-paper px-5 py-4 flex items-start justify-between gap-3 flex-shrink-0 select-none">
          <div className="min-w-0">
            <div className="text-[0.625rem] font-black uppercase tracking-wider text-yellow mb-0.5">
              {listing.suburb}
            </div>
            <div className="font-black text-base leading-snug line-clamp-2">
              {listing.address || listing.suburb}
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="border-2 border-paper text-paper font-black px-2.5 py-1 text-xs uppercase hover:bg-paper/20 focus:ring-2 focus:ring-yellow transition-colors flex-shrink-0 mt-0.5 cursor-pointer"
            aria-label="Close listing detail"
          >
            ✕
          </button>
        </div>

        {/* Listing image or Neo-Brutalist Graphic Placeholder */}
        {listing.main_image_url && !imgFailed ? (
          <div className="border-b-[3px] border-ink flex-shrink-0 bg-neutral-100 relative">
            <img
              src={listing.main_image_url}
              alt={listing.address || listing.suburb}
              className="w-full h-48 object-cover"
              onError={() => setImgFailed(true)}
            />
          </div>
        ) : (
          <div className="border-b-[3px] border-ink flex-shrink-0 bg-white p-6 flex flex-col items-center justify-center text-center select-none">
            <div className="text-3xl mb-1">🏠</div>
            <div className="text-xs font-black uppercase tracking-wider text-ink/70">
              {listing.suburb} · {listing.property_type || 'Residential'}
            </div>
          </div>
        )}

        <div className="p-5 flex flex-col gap-5 flex-1">
          {/* Quick Actions Strip */}
          <div className="flex items-center justify-between gap-2">
            {toggleShortlist && (
              <button
                onClick={() => toggleShortlist(listing.url)}
                className={`flex-1 border-2 border-ink py-1.5 px-3 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-[2px_2px_0_#111111] ${
                  isShortlisted ? 'bg-bred text-white' : 'bg-white text-ink hover:bg-neutral-100'
                }`}
              >
                <span>{isShortlisted ? '♥' : '♡'}</span>
                <span>{isShortlisted ? 'Shortlisted' : 'Add to Shortlist'}</span>
              </button>
            )}
            <button
              onClick={handleCopyLink}
              className="border-2 border-ink bg-white text-ink py-1.5 px-3 text-xs font-black uppercase cursor-pointer hover:bg-yellow transition-colors shadow-[2px_2px_0_#111111]"
              title="Copy direct listing link"
            >
              {copied ? '✓ Copied' : '🔗 Link'}
            </button>
          </div>

          {/* Property meta chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="border-2 border-ink bg-white px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
              {listing.property_type}
            </span>
            {listing.bedrooms != null && (
              <span className="border-2 border-ink bg-white px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
                {listing.bedrooms} {listing.bedrooms === 1 ? 'BED' : 'BEDS'}
              </span>
            )}
            {listing.bathrooms != null && (
              <span className="border-2 border-ink bg-white px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
                {listing.bathrooms} {listing.bathrooms === 1 ? 'BATH' : 'BATHS'}
              </span>
            )}
            {listing.size_m2 && (
              <span className="border-2 border-ink bg-white px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
                {listing.size_m2}m²
              </span>
            )}
            {listing.furnished === true && (
              <span className="border-2 border-ink bg-yellow px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
                Furnished
              </span>
            )}
            {listing.furnished === false && (
              <span className="border-2 border-ink bg-bgrey px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">
                Unfurnished
              </span>
            )}
          </div>

          {/* Price block */}
          <div className="border-[3px] border-ink bg-white p-4 shadow-[3px_3px_0_#111111]">
            <div className="text-3xl font-black text-ink leading-none">
              R{listing.price.toLocaleString('en-ZA')}
              <span className="text-sm font-bold text-ink/40 ml-1">/mo</span>
            </div>
            {listing.price_per_m2 && (
              <div className="text-xs font-bold text-ink/60 mt-1">
                R{listing.price_per_m2}/m² rate
              </div>
            )}
            {isPriceDrop && (
              <div className="text-xs font-extrabold text-blue mt-1.5">
                ↓ Was R{listing.previous_price.toLocaleString('en-ZA')}
              </div>
            )}
          </div>

          {/* Value Assessment & Decision Evidence */}
          <div className="border-t-2 border-ink/10 pt-4">
            <ValueExplanation
              listing={listing}
              suburbMedianPrice={medianPrice}
              suburbMedianPpm2={listing.price_per_m2 && listing.value_score ? Math.round(listing.price_per_m2 / listing.value_score) : null}
              sampleSize={20}
              confidence={listing.value_score ? (listing.value_score > 1.2 ? 'high' : 'medium') : 'insufficient'}
            />
          </div>

          {/* AI Verdict */}
          <div className="border-t-2 border-ink/10 pt-4">
            <div className="text-[0.625rem] font-black uppercase tracking-wider text-ink/50 mb-2 flex items-center gap-1">
              <span className="text-blue font-black">✦</span> AI Market Read
            </div>
            {verdictLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-neutral-200 rounded w-full" />
                <div className="h-3 bg-neutral-200 rounded w-4/5" />
              </div>
            ) : verdict ? (
              <p className="text-xs md:text-sm font-semibold text-ink leading-relaxed bg-white border-2 border-ink p-3 shadow-[2px_2px_0_#111111] break-words whitespace-normal">
                {verdict}
              </p>
            ) : (
              <p className="text-xs font-medium text-ink/60 italic">
                Priced at market standard for {listing.suburb}.
              </p>
            )}
          </div>

          {/* Details section */}
          <div className="border-t-2 border-ink/10 pt-4">
            <div className="text-[0.625rem] font-black uppercase tracking-wider text-ink/50 mb-2">
              Listing Details
            </div>
            <div className="space-y-2 text-xs font-bold text-ink">
              {listing.available_date && (
                <div className="flex justify-between border-b border-ink/10 pb-1">
                  <span className="text-ink/50 uppercase">Occupation</span>
                  <span className="font-black">
                    {listing.available_date <= new Date().toISOString().split('T')[0]
                      ? `Immediate (${listing.available_date})`
                      : listing.available_date}
                  </span>
                </div>
              )}
              {listing.agency_name && (
                <div className="flex justify-between border-b border-ink/10 pb-1">
                  <span className="text-ink/50 uppercase">Agency</span>
                  <span className="font-black truncate ml-2 max-w-[180px] text-right">{listing.agency_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink/50 uppercase">Listing ID</span>
                <span className="font-mono text-[0.6875rem] text-ink/70">{listing.listing_id || 'P24-DIRECT'}</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-auto pt-3">
            <a
              href={listing.url}
              target="_blank"
              rel="noreferrer"
              className="block w-full border-[3px] border-ink bg-yellow text-ink font-black uppercase text-sm text-center px-5 py-3 shadow-[4px_4px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all no-underline"
            >
              View on Property24 ↗
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
