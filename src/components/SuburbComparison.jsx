import { useMemo } from 'react';
import { SUBURBS_LIST } from '../utils/suburbs';

export default function SuburbComparison({ listings, history, onDrillDown }) {
  const cards = useMemo(() => {
    const built = SUBURBS_LIST.map(suburb => {
      const suburbListings = listings.filter(l => l.suburb === suburb);
      const count = suburbListings.length;
      const goodValue = suburbListings.filter(l => l.value_score > 1.15).length;

      // Median rent (overall median price)
      const prices = suburbListings.map(l => l.price).filter(Boolean).sort((a, b) => a - b);
      const mid = Math.floor(prices.length / 2);
      const medianRent = prices.length === 0 ? null
        : prices.length % 2 !== 0 ? prices[mid]
        : Math.round((prices[mid - 1] + prices[mid]) / 2);

      // Median R/m² — computed locally from the listings prop
      const pm2 = suburbListings.map(l => l.price_per_m2).filter(Boolean).sort((a, b) => a - b);
      const midPm2 = Math.floor(pm2.length / 2);
      const medianPrice = pm2.length === 0 ? null
        : pm2.length % 2 !== 0 ? pm2[midPm2]
        : Math.round((pm2[midPm2 - 1] + pm2[midPm2]) / 2);

      // Trend: compare last two history points for this suburb
      const subHistory = history
        .filter(h => h.suburb === suburb)
        .sort((a, b) => a.date.localeCompare(b.date));
      let trend = 'flat';
      let trendDiff = null;
      if (subHistory.length >= 2) {
        const prev = subHistory[subHistory.length - 2].median;
        const curr = subHistory[subHistory.length - 1].median;
        trendDiff = curr - prev;
        if (trendDiff > 0) trend = 'up';
        else if (trendDiff < 0) trend = 'down';
      }

      return { suburb, count, goodValue, medianRent, medianPrice, trend, trendDiff };
    });

    // Sort cheapest median rent first; suburbs with no data go to the end
    return built.sort((a, b) => {
      if (a.medianRent === null && b.medianRent === null) return 0;
      if (a.medianRent === null) return 1;
      if (b.medianRent === null) return -1;
      return a.medianRent - b.medianRent;
    });
  }, [listings, history]);

  return (
    <div>
      <div className="border-[3px] border-ink bg-paper shadow-[6px_6px_0_#111111] p-5 mb-7 rounded-none">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1 mb-1">
          Suburbs
        </h2>
        <p className="text-xs text-neutral-500 font-bold mt-2 mb-0">
          Side-by-side snapshot based on active filters. Sorted cheapest first.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {cards.map(({ suburb, count, goodValue, medianRent, medianPrice, trend, trendDiff }) => (
          <div
            key={suburb}
            className="border-[3px] border-ink bg-white shadow-[4px_4px_0_#111111] p-5 rounded-none flex flex-col gap-3"
          >
            {/* Suburb header */}
            <div className="bg-ink text-paper px-3 py-2 -mx-5 -mt-5 mb-0 flex items-center justify-between">
              <div>
                <div className="font-black text-sm uppercase tracking-wide leading-tight">
                  {suburb}
                </div>
                <div className="text-[0.6875rem] font-bold text-paper/50 mt-0.5">
                  {count} listing{count !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col gap-2 text-xs mt-1">
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase text-neutral-500 text-[0.6875rem]">Median Rent</span>
                <span className="font-black text-ink">
                  {medianRent ? `R ${medianRent.toLocaleString('en-ZA')}` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold uppercase text-neutral-500 text-[0.6875rem]">Median R/m²</span>
                <span className="font-black text-ink">
                  {medianPrice ? `R ${medianPrice.toLocaleString('en-ZA')}` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold uppercase text-neutral-500 text-[0.6875rem]">Good Value</span>
                {goodValue > 0 ? (
                  <span className="inline-block bg-lime border border-ink text-ink text-[0.6rem] font-black uppercase px-1.5 py-0.5 leading-none">
                    {goodValue} listing{goodValue !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="font-black text-neutral-400">—</span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold uppercase text-neutral-500 text-[0.6875rem]">Trend</span>
                <span className={`font-black ${trend === 'up' ? 'text-bred' : trend === 'down' ? 'text-blue' : 'text-neutral-400'}`}>
                  {trend === 'up' && trendDiff !== null
                    ? `↑ R${Math.abs(trendDiff).toLocaleString('en-ZA')}`
                    : trend === 'down' && trendDiff !== null
                    ? `↓ R${Math.abs(trendDiff).toLocaleString('en-ZA')}`
                    : '→ Stable'}
                </span>
              </div>
            </div>

            {/* Good value fill bar */}
            {count > 0 && (
              <div className="mt-auto pt-2 border-t-2 border-ink/10">
                <div className="border-2 border-ink bg-white h-2">
                  <div
                    className="bg-lime h-full"
                    style={{ width: `${Math.round((goodValue / count) * 100)}%` }}
                    title={`${Math.round((goodValue / count) * 100)}% good value`}
                  />
                </div>
                <div className="text-[0.625rem] font-bold text-neutral-400 mt-1">
                  {Math.round((goodValue / count) * 100)}% good value
                </div>
              </div>
            )}

            {/* Explore button */}
            {onDrillDown && count > 0 && (
              <button
                onClick={() => onDrillDown(suburb, null)}
                className="w-full border-2 border-ink bg-yellow text-ink font-black text-[0.6875rem] uppercase px-3 py-1.5 cursor-pointer shadow-[2px_2px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all text-center"
              >
                Explore listings →
              </button>
            )}

            {/* Empty state for filtered-out suburbs */}
            {count === 0 && (
              <div className="text-[0.625rem] font-bold text-neutral-400 mt-auto pt-2 border-t-2 border-ink/10">
                No listings match active filters
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
