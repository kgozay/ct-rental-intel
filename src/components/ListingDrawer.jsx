import { useEffect, useState, useRef } from 'react';
import ValueExplanation from './ValueExplanation';
import Icon from './Icon';
import { describePriceDrop } from '../utils/priceDrop';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Verdicts are cached for the session so flicking between listings doesn't re-query.
const verdictCache = new Map();

export default function ListingDrawer({
  listing,
  medianPrice = null,
  medianLabel = 'median',
  shortlisted,
  toggleShortlist,
  onClose,
  onPrev,
  onNext,
  position = null,
}) {
  const [verdictState, setVerdictState] = useState({ url: null, text: null });
  const [copyState, setCopyState] = useState(null); // 'copied' | 'failed' | null
  const [failedImageUrl, setFailedImageUrl] = useState(null);
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);

  // Keep the latest callbacks in refs so the mount effect below runs exactly
  // once — re-running it on every parent render used to steal focus.
  const handlersRef = useRef({ onClose, onPrev, onNext });
  useEffect(() => {
    handlersRef.current = { onClose, onPrev, onNext };
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();

    const onKeyDown = (e) => {
      const { onClose: close, onPrev: prev, onNext: next } = handlersRef.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName);
      if (!typing && (e.key === 'ArrowLeft' || e.key === 'k') && prev) {
        e.preventDefault();
        prev();
        return;
      }
      if (!typing && (e.key === 'ArrowRight' || e.key === 'j') && next) {
        e.preventDefault();
        next();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  // Scroll the panel back to the top when navigating to another listing.
  useEffect(() => {
    panelRef.current?.scrollTo?.({ top: 0 });
  }, [listing?.url]);

  useEffect(() => {
    if (!listing?.url) return undefined;
    const url = listing.url;
    if (verdictCache.has(url)) {
      Promise.resolve().then(() => setVerdictState({ url, text: verdictCache.get(url) }));
      return undefined;
    }
    const controller = new AbortController();
    fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing, suburbMedianPrice: medianPrice, medianLabel }),
      signal: controller.signal,
    })
      .then(r => (r.ok ? r.json() : { verdict: null }))
      .then(data => {
        verdictCache.set(url, data.verdict || null);
        setVerdictState({ url, text: data.verdict || null });
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setVerdictState({ url, text: null });
      });
    return () => controller.abort();
  }, [listing, medianPrice, medianLabel]);

  if (!listing) return null;

  const verdictLoading = verdictState.url !== listing.url;
  const verdict = verdictLoading ? null : verdictState.text;
  const drop = describePriceDrop(listing);
  const isShortlisted = shortlisted && shortlisted.has(listing.url);
  const imgFailed = failedImageUrl === listing.main_image_url;
  const today = new Date().toISOString().split('T')[0];

  const handleCopyLink = async () => {
    if (!listing.url) return;
    try {
      await navigator.clipboard.writeText(listing.url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState(null), 2000);
  };

  const navBtn = 'border-2 border-paper text-paper w-9 h-9 inline-flex items-center justify-center hover:bg-paper/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-yellow';

  return (
    <>
      <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs z-40" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-paper sm:border-l-[3px] border-ink z-50 overflow-y-auto flex flex-col sm:shadow-[-6px_0_0_#111111]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-drawer-title"
      >
        <div className="bg-ink text-paper px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3 flex-shrink-0 sticky top-0 z-10">
          <div className="min-w-0">
            <div className="text-[0.6875rem] font-black uppercase tracking-wider text-yellow mb-0.5">
              {listing.suburb}
              {position && <span className="text-paper/80 ml-2 font-mono">{position.index + 1} / {position.total}</span>}
            </div>
            <h2 id="listing-drawer-title" className="font-black text-base leading-snug line-clamp-2 m-0">
              {listing.address || listing.suburb}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(onPrev || onNext) && (
              <>
                <button type="button" onClick={onPrev} disabled={!onPrev} className={navBtn} aria-label="Previous listing" title="Previous listing (←)">
                  <Icon name="chevronLeft" />
                </button>
                <button type="button" onClick={onNext} disabled={!onNext} className={navBtn} aria-label="Next listing" title="Next listing (→)">
                  <Icon name="chevronRight" />
                </button>
              </>
            )}
            <button ref={closeBtnRef} type="button" onClick={onClose} className={navBtn} aria-label="Close listing detail">
              <Icon name="close" />
            </button>
          </div>
        </div>

        {listing.main_image_url && !imgFailed ? (
          <div className="border-b-[3px] border-ink flex-shrink-0 bg-neutral-100">
            <img
              src={listing.main_image_url}
              alt={listing.address || listing.suburb}
              className="w-full h-52 object-cover"
              onError={() => setFailedImageUrl(listing.main_image_url)}
            />
          </div>
        ) : (
          <div className="border-b-[3px] border-ink flex-shrink-0 bg-white p-6 flex flex-col items-center justify-center text-center gap-1.5">
            <Icon name="building" size={32} className="text-ink/70" />
            <div className="text-xs font-black uppercase tracking-wider text-ink/80">
              {listing.suburb} · {listing.property_type || 'Residential'}
            </div>
          </div>
        )}

        <div className="p-4 sm:p-5 flex flex-col gap-5 flex-1">
          <div className="flex items-stretch gap-2">
            {toggleShortlist && (
              <button
                type="button"
                onClick={() => toggleShortlist(listing.url, listing)}
                aria-pressed={Boolean(isShortlisted)}
                className={`flex-1 min-h-[40px] border-2 border-ink py-1.5 px-3 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-[2px_2px_0_#111111] ${
                  isShortlisted ? 'bg-bred text-white' : 'bg-white text-ink hover:bg-neutral-100'
                }`}
              >
                <Icon name="heart" filled={isShortlisted} />
                <span>{isShortlisted ? 'Shortlisted' : 'Add to Shortlist'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[40px] border-2 border-ink bg-white text-ink py-1.5 px-3 text-xs font-black uppercase cursor-pointer hover:bg-yellow transition-colors shadow-[2px_2px_0_#111111] inline-flex items-center gap-1.5"
            >
              <Icon name={copyState === 'copied' ? 'check' : 'link'} />
              <span aria-live="polite">{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy link'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              listing.property_type,
              listing.bedrooms === 0 ? 'Studio' : listing.bedrooms != null ? `${listing.bedrooms} ${listing.bedrooms === 1 ? 'bed' : 'beds'}` : null,
              listing.bathrooms != null ? `${listing.bathrooms} ${listing.bathrooms === 1 ? 'bath' : 'baths'}` : null,
              listing.size_m2 ? `${listing.size_m2}m²` : null,
            ].filter(Boolean).map(chip => (
              <span key={chip} className="border-2 border-ink bg-white px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">{chip}</span>
            ))}
            {listing.furnished === true && (
              <span className="border-2 border-ink bg-yellow px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">Furnished</span>
            )}
            {listing.furnished === false && (
              <span className="border-2 border-ink bg-bgrey px-2.5 py-0.5 text-[0.6875rem] font-black uppercase">Unfurnished</span>
            )}
          </div>

          <div className="border-[3px] border-ink bg-white p-4 shadow-[3px_3px_0_#111111]">
            <div className="text-3xl font-black text-ink leading-none">
              R{listing.price.toLocaleString('en-ZA')}
              <span className="text-sm font-bold text-ink/70 ml-1">/mo</span>
            </div>
            {listing.price_per_m2 && (
              <div className="text-xs font-bold text-ink/80 mt-1">R{listing.price_per_m2}/m²</div>
            )}
            {medianPrice != null && (
              <div className="text-xs font-bold text-ink/80 mt-1">
                {listing.suburb} {medianLabel}: R{medianPrice.toLocaleString('en-ZA')}/mo
              </div>
            )}
            {drop && (
              <div className="text-xs font-extrabold text-blue mt-1.5 inline-flex items-center gap-1">
                <Icon name="arrowDown" size={12} /> {drop.long}
              </div>
            )}
          </div>

          <ValueExplanation listing={listing} valuation={listing.valuation} />

          <section aria-labelledby="ai-read-title" className="border-t-2 border-ink/15 pt-4">
            <h3 id="ai-read-title" className="text-[0.6875rem] font-black uppercase tracking-wider text-ink/80 mb-2 flex items-center gap-1.5 m-0">
              <Icon name="sparkle" size={12} className="text-blue" /> AI Market Read
            </h3>
            {verdictLoading ? (
              <div className="space-y-2 animate-pulse" aria-label="Loading AI read">
                <div className="h-3 bg-neutral-200 w-full" />
                <div className="h-3 bg-neutral-200 w-4/5" />
              </div>
            ) : verdict ? (
              <p className="text-sm font-semibold text-ink leading-relaxed bg-white border-2 border-ink p-3 shadow-[2px_2px_0_#111111] break-words m-0">
                {verdict}
              </p>
            ) : (
              <p className="text-xs font-medium text-ink/80 m-0">AI read unavailable for this listing right now.</p>
            )}
          </section>

          <section aria-labelledby="details-title" className="border-t-2 border-ink/15 pt-4">
            <h3 id="details-title" className="text-[0.6875rem] font-black uppercase tracking-wider text-ink/80 mb-2 m-0">Listing Details</h3>
            <dl className="space-y-2 text-xs font-bold text-ink m-0">
              <div className="flex justify-between border-b border-ink/15 pb-1">
                <dt className="text-ink/75 uppercase">Occupation</dt>
                <dd className="font-black m-0">
                  {!listing.available_date
                    ? 'Not stated'
                    : listing.available_date <= today
                      ? `Immediate (${listing.available_date})`
                      : listing.available_date}
                </dd>
              </div>
              {listing.agency_name && (
                <div className="flex justify-between border-b border-ink/15 pb-1">
                  <dt className="text-ink/75 uppercase">Agency</dt>
                  <dd className="font-black truncate ml-2 max-w-[200px] text-right m-0">{listing.agency_name}</dd>
                </div>
              )}
              {listing.created_at && (
                <div className="flex justify-between border-b border-ink/15 pb-1">
                  <dt className="text-ink/75 uppercase">First seen</dt>
                  <dd className="font-black m-0">{new Date(listing.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink/75 uppercase">Listing ID</dt>
                <dd className="font-mono text-[0.6875rem] text-ink/80 m-0">{listing.listing_id || '—'}</dd>
              </div>
            </dl>
          </section>

          <div className="mt-auto pt-3">
            <a
              href={listing.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full border-[3px] border-ink bg-yellow text-ink font-black uppercase text-sm px-5 py-3 shadow-[4px_4px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all no-underline"
            >
              View on Property24 <Icon name="external" />
            </a>
            {(onPrev || onNext) && (
              <p className="hidden sm:block text-[11px] text-ink/70 font-bold text-center mt-3 m-0">
                Tip: use ← / → to move between listings, Esc to close.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
