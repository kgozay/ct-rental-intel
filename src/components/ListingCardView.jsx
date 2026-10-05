import { useState } from 'react';
import ValueBadge from './ValueBadge';
import Icon from './Icon';
import NoResults from './NoResults';
import { describePriceDrop } from '../utils/priceDrop';

const PAGE = 24;

export default function ListingCardView({
  listings = [],
  filters,
  onResetFilters,
  onSelectListing,
  shortlisted = new Set(),
  onToggleShortlist,
  lastVisit,
}) {
  const [visible, setVisible] = useState(PAGE);
  const [prevListings, setPrevListings] = useState(listings);
  if (prevListings !== listings) {
    setPrevListings(listings);
    setVisible(PAGE);
  }

  if (listings.length === 0) {
    return <NoResults filters={filters} onReset={onResetFilters} shortlistedCount={shortlisted.size} />;
  }

  return (
    <>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
        {listings.slice(0, visible).map(listing => {
          const isShortlisted = shortlisted.has(listing.url);
          const drop = describePriceDrop(listing);
          const isNew = lastVisit && listing.created_at && listing.created_at > lastVisit;
          const features = [
            listing.bedrooms === 0 ? 'Studio' : listing.bedrooms != null ? `${listing.bedrooms} bed` : null,
            listing.bathrooms != null ? `${listing.bathrooms} bath` : null,
            listing.size_m2 ? `${listing.size_m2} m²` : null,
            listing.furnished === true ? 'Furnished' : listing.furnished === false ? 'Unfurnished' : null,
          ].filter(Boolean);

          return (
            <li key={listing.url || listing.id}>
              <article className="h-full border-2 border-ink bg-white shadow-[3px_3px_0_#111111] hover:shadow-[5px_5px_0_#111111] transition-shadow flex flex-col">
                <div className="relative h-44 bg-neutral-100 border-b-2 border-ink overflow-hidden">
                  {listing.main_image_url ? (
                    <img
                      src={listing.main_image_url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-paper text-ink/60">
                      <Icon name="building" size={36} />
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="bg-ink text-paper text-[11px] font-black uppercase px-2 py-0.5">{listing.suburb}</span>
                    {isNew && <span className="bg-yellow text-ink border border-ink text-[11px] font-black uppercase px-1.5 py-0.5">New</span>}
                  </div>

                  <div className="absolute top-2 right-2">
                    <ValueBadge valuation={listing.valuation} />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleShortlist(listing.url, listing);
                    }}
                    aria-pressed={isShortlisted}
                    className={`absolute bottom-2 right-2 w-10 h-10 inline-flex items-center justify-center border-2 border-ink shadow-[2px_2px_0_#111111] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                      isShortlisted ? 'bg-bred text-white' : 'bg-white text-ink hover:bg-neutral-100'
                    }`}
                    aria-label={isShortlisted ? `Remove ${listing.suburb} listing from shortlist` : `Add ${listing.suburb} listing to shortlist`}
                  >
                    <Icon name="heart" filled={isShortlisted} size={18} />
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-xl font-black font-mono text-ink tracking-tight">
                      R{Number(listing.price).toLocaleString('en-ZA')}
                      <span className="text-xs font-normal text-ink/75">/mo</span>
                    </span>
                    {listing.price_per_m2 && (
                      <span className="text-xs font-mono font-bold text-ink/80">R{listing.price_per_m2}/m²</span>
                    )}
                  </div>
                  {drop && (
                    <div className="text-xs font-extrabold text-blue mb-1" title={drop.long}>{drop.long}</div>
                  )}

                  <h3 className="text-xs font-bold text-ink truncate mb-2 m-0" title={listing.address}>
                    {listing.address || `${listing.suburb} ${listing.property_type || 'rental'}`}
                  </h3>

                  {features.length > 0 && (
                    <p className="text-xs font-medium text-ink/80 mt-auto pt-2 border-t border-ink/10 m-0">
                      {features.join(' · ')}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-paper border-t-2 border-ink flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectListing(listing)}
                    className="flex-1 min-h-[40px] border-2 border-ink bg-white hover:bg-yellow text-ink text-xs font-black uppercase py-1.5 px-3 transition-colors cursor-pointer text-center focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    Details
                  </button>
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] border-2 border-ink bg-ink text-paper hover:bg-blue hover:border-blue text-xs font-black uppercase py-1.5 px-3 transition-colors inline-flex items-center gap-1.5 no-underline focus-visible:outline-2 focus-visible:outline-ink"
                    aria-label={`Open ${listing.suburb} listing on Property24`}
                  >
                    P24 <Icon name="external" size={12} />
                  </a>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      {visible < listings.length && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setVisible(v => v + PAGE)}
            className="min-h-[44px] border-2 border-ink bg-white text-ink text-xs font-black uppercase px-6 py-2 cursor-pointer shadow-[2px_2px_0_#111111] hover:bg-yellow"
          >
            Show more ({listings.length - visible} remaining)
          </button>
        </div>
      )}
    </>
  );
}
