import ValueBadge from './ValueBadge';

export default function ListingCardView({
  listings = [],
  onSelectListing,
  shortlisted = new Set(),
  onToggleShortlist
}) {
  if (listings.length === 0) {
    return (
      <div className="border-2 border-ink bg-white p-8 text-center shadow-[4px_4px_0_#111111]">
        <div className="text-xl font-black uppercase tracking-tight text-ink mb-2">
          No matching properties
        </div>
        <p className="text-xs text-ink/70">
          Try broadening your suburb selections, increasing your maximum budget, or resetting filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {listings.map(listing => {
        const isShortlisted = shortlisted.has(listing.url);
        const formattedPrice = `R ${Number(listing.price).toLocaleString('en-ZA')}`;
        const ppm2 = listing.price_per_m2 ? `R ${Number(listing.price_per_m2).toLocaleString('en-ZA')}/m²` : null;

        return (
          <article
            key={listing.url || listing.id}
            className="border-2 border-ink bg-white shadow-[3px_3px_0_#111111] hover:shadow-[5px_5px_0_#111111] transition-all flex flex-col justify-between"
          >
            {/* Top: Image + Badges */}
            <div className="relative h-44 bg-neutral-100 border-b-2 border-ink overflow-hidden">
              {listing.main_image_url ? (
                <img
                  src={listing.main_image_url}
                  alt={listing.address || listing.suburb}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-paper text-ink/40 font-mono text-xs font-bold uppercase">
                  No image available
                </div>
              )}

              {/* Suburb Badge */}
              <div className="absolute top-2 left-2 bg-ink text-paper text-[10px] font-black uppercase px-2 py-0.5 border border-ink shadow-[1px_1px_0_#ffffff]">
                {listing.suburb}
              </div>

              {/* Value Badge */}
              {listing.value_score && (
                <div className="absolute top-2 right-2">
                  <ValueBadge score={listing.value_score} />
                </div>
              )}

              {/* Shortlist Heart Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleShortlist(listing.url);
                }}
                className={`absolute bottom-2 right-2 p-1.5 border-2 border-ink shadow-[2px_2px_0_#111111] cursor-pointer transition-all ${
                  isShortlisted ? 'bg-red text-white' : 'bg-white text-ink hover:bg-neutral-100'
                }`}
                aria-label={isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
              >
                {isShortlisted ? '♥' : '♡'}
              </button>
            </div>

            {/* Middle: Key details */}
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xl font-black font-mono text-ink tracking-tight">
                  {formattedPrice}
                  <span className="text-xs font-normal text-ink/60">/mo</span>
                </span>
                {ppm2 && (
                  <span className="text-xs font-mono font-bold text-ink/70">
                    {ppm2}
                  </span>
                )}
              </div>

              <h3 className="text-xs font-bold text-ink truncate mb-2" title={listing.address}>
                {listing.address || `${listing.suburb} Apartment`}
              </h3>

              {/* Key Features */}
              <div className="flex flex-wrap gap-2 text-xs font-medium text-ink/80 mt-auto pt-2 border-t border-ink/10">
                <span>{listing.bedrooms ? `${listing.bedrooms} bed` : 'Studio'}</span>
                <span>•</span>
                <span>{listing.bathrooms ? `${listing.bathrooms} bath` : '1 bath'}</span>
                {listing.size_m2 && (
                  <>
                    <span>•</span>
                    <span>{listing.size_m2} m²</span>
                  </>
                )}
                {listing.furnished !== null && (
                  <>
                    <span>•</span>
                    <span>{listing.furnished ? 'Furnished' : 'Unfurnished'}</span>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-3 bg-paper border-t-2 border-ink flex items-center justify-between gap-2">
              <button
                onClick={() => onSelectListing(listing)}
                className="flex-1 border-2 border-ink bg-white hover:bg-yellow text-ink text-xs font-black uppercase py-1.5 px-3 transition-colors cursor-pointer shadow-[1px_1px_0_#111111] text-center"
              >
                Inspect
              </button>
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-ink bg-ink text-paper hover:bg-blue hover:border-blue text-xs font-black uppercase py-1.5 px-3 transition-colors cursor-pointer shadow-[1px_1px_0_#111111] text-center no-underline"
              >
                P24 ↗
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
