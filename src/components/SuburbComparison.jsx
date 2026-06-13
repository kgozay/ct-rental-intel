import { useMemo } from 'react';
import { SUBURBS_LIST } from '../utils/suburbs';

const TREND_COLORS = {
  up:   'text-red-600',
  down: 'text-emerald-600',
  flat: 'text-neutral-400',
};

export default function SuburbComparison({ listings, history, medians }) {
  const cards = useMemo(() => {
    return SUBURBS_LIST.map(suburb => {
      const suburbListings = listings.filter(l => l.suburb === suburb);
      const count = suburbListings.length;
      const goodValue = suburbListings.filter(l => l.value_score > 1.15).length;
      const medianPrice = medians[suburb] ?? null;

      // Median rent (overall median price, not per-m²)
      const prices = suburbListings.map(l => l.price).filter(Boolean).sort((a, b) => a - b);
      const mid = Math.floor(prices.length / 2);
      const medianRent = prices.length === 0 ? null
        : prices.length % 2 !== 0 ? prices[mid]
        : Math.round((prices[mid - 1] + prices[mid]) / 2);

      // Trend: compare last two history points for this suburb (overall medians)
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
  }, [listings, history, medians]);

  return (
    <div>
      <div className="border-[3px] border-ink bg-paper shadow-[6px_6px_0_#111111] p-5 mb-7 rounded-none">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1 mb-1">
          Suburb Comparison
        </h2>
        <p className="text-xs text-neutral-500 font-bold mt-2 mb-0">
          Side-by-side snapshot of all 7 suburbs based on the latest scrape.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {cards.map(({ suburb, count, goodValue, medianRent, medianPrice, trend, trendDiff }) => (
          <div
            key={suburb}
            className="border-[3px] border-ink bg-white shadow-[4px_4px_0_#111111] p-5 rounded-none flex flex-col gap-3"
          >
            {/* Suburb header */}
            <div className="border-b-[3px] border-ink pb-3">
              <div className="font-black text-sm uppercase tracking-wide text-ink leading-tight">
                {suburb}
              </div>
              <div className="text-[0.6875rem] font-bold text-neutral-500 mt-0.5">
                {count} listing{count !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col gap-2 text-xs">
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
                <span className={`font-black ${goodValue > 0 ? 'text-emerald-600' : 'text-neutral-400'}`}>
                  {goodValue > 0 ? `${goodValue} listing${goodValue !== 1 ? 's' : ''}` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold uppercase text-neutral-500 text-[0.6875rem]">Trend</span>
                <span className={`font-black ${TREND_COLORS[trend]}`}>
                  {trend === 'up' && trendDiff !== null
                    ? `↑ R${Math.abs(trendDiff).toLocaleString('en-ZA')}`
                    : trend === 'down' && trendDiff !== null
                    ? `↓ R${Math.abs(trendDiff).toLocaleString('en-ZA')}`
                    : '→ Stable'}
                </span>
              </div>
            </div>

            {/* Good value badge strip */}
            {count > 0 && (
              <div className="mt-auto pt-2 border-t-2 border-ink/10">
                <div
                  className="h-1.5 rounded-none"
                  style={{
                    background: `linear-gradient(to right, #A3E635 ${Math.round((goodValue / count) * 100)}%, #e5e5e5 0%)`
                  }}
                  title={`${Math.round((goodValue / count) * 100)}% good value`}
                />
                <div className="text-[0.625rem] font-bold text-neutral-400 mt-1">
                  {Math.round((goodValue / count) * 100)}% good value
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
