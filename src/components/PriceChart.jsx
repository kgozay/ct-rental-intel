import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { SUBURBS_LIST } from '../utils/suburbs';

const SUBURB_COLORS = {
  "De Waterkant": '#2563EB',   // blue
  "Green Point": '#FFD23F',    // yellow
  "Gardens": '#A3E635',        // lime
  "Sea Point": '#FF5436',      // red
  "Woodstock": '#9333EA',      // purple
  "Claremont": '#06B6D4',      // cyan
  "Cape Town CBD": '#111111'   // ink
};

// Custom Brutalist Tooltip
const CustomTooltip = ({ active, payload, label, hint }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-paper border-2 border-ink p-2.5 font-bold shadow-[3px_3px_0_#111111] text-xs text-ink rounded-none">
        <p className="border-b-2 border-ink pb-1 mb-1.5 uppercase text-[0.625rem] text-ink/60">{label}</p>
        {payload.map((p, idx) => {
          const name = p.name || p.dataKey;
          const value = typeof p.value === 'number' ? `R ${p.value.toLocaleString('en-ZA')}` : p.value;
          return (
            <p key={idx} className="my-0.5" style={{ color: p.color || p.stroke || '#111' }}>
              <span className="uppercase">{name}</span>: <span className="font-black">{value}</span>
            </p>
          );
        })}
        {hint && (
          <p className="mt-1.5 pt-1 border-t border-ink/20 text-[0.625rem] font-black text-ink/50 uppercase tracking-wide">
            {hint}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Custom Scatter Tooltip
const ScatterTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-paper border-2 border-ink p-2.5 font-bold shadow-[3px_3px_0_#111111] text-xs text-ink rounded-none">
        <p className="border-b-2 border-ink pb-1 mb-1.5 uppercase text-[0.625rem] text-ink/60 truncate max-w-[180px]">{data.name}</p>
        <p className="my-0.5 text-neutral-600">SUBURB: <span className="font-extrabold text-ink">{data.suburb}</span></p>
        <p className="my-0.5 text-neutral-600">SIZE: <span className="font-extrabold text-ink">{data.x} m²</span></p>
        <p className="my-0.5 text-blue">PRICE: <span className="font-black">R {data.y.toLocaleString('en-ZA')}</span></p>
        {data.price_per_m2 && (
          <p className="my-0.5 text-neutral-600">RATE: <span className="font-extrabold text-ink">{data.price_per_m2} R/m²</span></p>
        )}
      </div>
    );
  }
  return null;
};

export default function PriceChart({ listings, history, historyBeds, setHistoryBeds, onDrillDown, theme }) {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#FAF6E9' : '#111111';
  const gridColor = isDark ? '#333333' : '#e5e5e5';

  // --- CHART 1: MEDIAN BY SUBURB & BED COUNT ---
  const bedCounts = [1, 2, 3];
  const chart1Data = bedCounts.map(beds => {
    const row = { beds: `${beds} Bed` };
    SUBURBS_LIST.forEach(sub => {
      const match = listings.filter(l => l.suburb === sub && l.bedrooms === beds && typeof l.price === 'number');
      if (match.length > 0) {
        const prices = match.map(l => l.price).sort((a, b) => a - b);
        const mid = Math.floor(prices.length / 2);
        row[sub] = prices.length % 2 !== 0 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
      }
    });
    return row;
  });

  const hasChart1Data = chart1Data.some(row => SUBURBS_LIST.some(sub => row[sub] !== undefined));

  // --- CHART 2: MEDIAN OVER TIME (HISTORY) ---
  const historyByDate = {};
  history.forEach(item => {
    if (!historyByDate[item.date]) {
      historyByDate[item.date] = { date: item.date };
    }
    historyByDate[item.date][item.suburb] = item.median;
  });
  const chart2Data = Object.values(historyByDate).sort((a, b) => a.date.localeCompare(b.date));

  // --- CHART 3: PRICE VS SIZE SCATTER ---
  const scatterData = {};
  let totalScatterPoints = 0;
  SUBURBS_LIST.forEach(sub => {
    scatterData[sub] = listings
      .filter(l => l.suburb === sub && l.size_m2 !== null && l.size_m2 > 0 && l.price !== null && l.price > 0)
      .map(l => ({
        x: l.size_m2,
        y: l.price,
        name: l.address || sub,
        suburb: sub,
        price_per_m2: l.price_per_m2
      }));
    totalScatterPoints += scatterData[sub].length;
  });

  if (!listings || listings.length === 0) {
    return (
      <div className="border-[3px] border-ink bg-white p-10 text-center shadow-[4px_4px_0_#111111]">
        <h3 className="text-sm font-black uppercase text-ink mb-1.5">
          No Data for Price Analytics
        </h3>
        <p className="text-xs text-neutral-500 font-medium max-w-sm mx-auto mb-0 leading-relaxed">
          No listings match your active filters. Broaden your search or reset filters to view median charts and scatter distributions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Chart 1: Grouped Bar Chart */}
      <div className="border-[3px] border-ink bg-white p-5 shadow-[6px_6px_0_#111111] rounded-none">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1">
            Median Price by Suburb &amp; Beds
          </h2>
          <span className="text-[11px] font-bold text-neutral-500 font-mono">
            {listings.length} matching listings
          </span>
        </div>
        {!hasChart1Data ? (
          <div className="flex flex-col items-center justify-center h-80 bg-neutral-50 dark:bg-neutral-900 border-2 border-dashed border-ink/30 text-neutral-400 font-bold p-4 text-center">
            <span className="font-black text-ink text-sm mb-1">No listings available for bar chart</span>
            <span className="text-xs text-neutral-400 font-medium">Try broadening your suburb or bedroom filters.</span>
          </div>
        ) : (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart1Data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="beds" tick={{ fill: textColor, fontWeight: 'bold' }} stroke={textColor} />
                <YAxis tickFormatter={(val) => `R ${val/1000}k`} tick={{ fill: textColor, fontWeight: 'bold' }} stroke={textColor} />
                <Tooltip content={(props) => (
                  <CustomTooltip
                    {...props}
                    hint={onDrillDown ? '↗ Click bar to filter table' : undefined}
                  />
                )} />
                <Legend wrapperStyle={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', paddingTop: '10px', color: textColor }} />
                {SUBURBS_LIST.map(sub => (
                  <Bar
                    key={sub}
                    dataKey={sub}
                    fill={SUBURB_COLORS[sub]}
                    stroke="#111111"
                    strokeWidth={1.5}
                    cursor={onDrillDown ? 'pointer' : 'default'}
                    onClick={(data) => {
                      if (onDrillDown && data && data[sub] !== undefined) {
                        const bedNum = parseInt(data.beds, 10);
                        onDrillDown(sub, isNaN(bedNum) ? null : bedNum);
                      }
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-[11px] font-medium text-neutral-500 mt-3 pt-2 border-t border-neutral-200">
          Summary: Median monthly rents grouped by 1, 2, and 3 bedrooms across active suburbs. Click any bar to drill down.
        </p>
      </div>

      {/* Chart 2: Historical Timeline */}
      <div className="border-[3px] border-ink bg-white p-5 shadow-[6px_6px_0_#111111] rounded-none">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1">
            Price Trends over Time
          </h2>
          <div className="flex gap-1 select-none">
            {[{ label: 'All', value: null }, { label: '1 Bed', value: 1 }, { label: '2 Bed', value: 2 }, { label: '3 Bed', value: 3 }].map(opt => (
              <button
                key={opt.label}
                onClick={() => setHistoryBeds(opt.value)}
                className={`border-2 border-ink px-3 py-1 text-xs font-bold cursor-pointer transition-colors duration-100 ${
                  historyBeds === opt.value ? 'bg-ink text-paper' : 'bg-white text-ink hover:bg-neutral-100'
                }`}
                aria-pressed={historyBeds === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {chart2Data.length <= 1 ? (
          <div className="flex flex-col items-center justify-center h-80 bg-neutral-50 dark:bg-neutral-900 border-2 border-dashed border-ink/30 text-neutral-400 font-bold p-4 text-center">
            <span className="mb-2 font-black text-ink text-sm">Not enough data for trends yet</span>
            <span className="text-xs text-neutral-400 font-medium max-w-xs">
              {chart2Data.length === 1
                ? 'One scrape recorded — scrape again in 24h+ to unlock the trend line.'
                : 'Run the first scrape with ↻ Refresh Listings to start collecting data.'}
            </span>
          </div>
        ) : (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart2Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fill: textColor, fontWeight: 'bold' }} stroke={textColor} />
                <YAxis tickFormatter={(val) => `R ${val/1000}k`} tick={{ fill: textColor, fontWeight: 'bold' }} stroke={textColor} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', paddingTop: '10px', color: textColor }} />
                {SUBURBS_LIST.map(sub => (
                  <Line
                    key={sub}
                    type="monotone"
                    dataKey={sub}
                    stroke={SUBURB_COLORS[sub]}
                    strokeWidth={3}
                    dot={{ stroke: '#111111', strokeWidth: 1.5, r: 4 }}
                    activeDot={{ stroke: '#111111', strokeWidth: 2, r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-[11px] font-medium text-neutral-500 mt-3 pt-2 border-t border-neutral-200">
          Summary: Historical suburb median rent trends over 48h crawl cycles. Filter by bedroom count to track specific inventory categories.
        </p>
      </div>

      {/* Chart 3: Scatter Plot (Price vs Size) */}
      <div className="border-[3px] border-ink bg-white p-5 shadow-[6px_6px_0_#111111] rounded-none">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1 mb-6">
          Unit size vs Pricing Spread
        </h2>
        {totalScatterPoints === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 bg-neutral-50 dark:bg-neutral-900 border-2 border-dashed border-ink/30 text-neutral-400 font-bold p-4 text-center">
            <span className="font-black text-ink text-sm mb-1">No size (m²) data available for scatter plot</span>
            <span className="text-xs text-neutral-400 font-medium">None of the filtered listings reported a floor area in m².</span>
          </div>
        ) : (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" dataKey="x" name="Size" unit="m²" tick={{ fill: textColor, fontWeight: 'bold' }} stroke={textColor} />
                <YAxis type="number" dataKey="y" name="Price" tickFormatter={(val) => `R ${val/1000}k`} tick={{ fill: textColor, fontWeight: 'bold' }} stroke={textColor} />
                <ZAxis type="category" dataKey="name" name="Name" />
                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: textColor }} />
                <Legend wrapperStyle={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', paddingTop: '10px', color: textColor }} />
                {SUBURBS_LIST.filter(sub => scatterData[sub].length > 0).map(sub => (
                  <Scatter
                    key={sub}
                    name={sub}
                    data={scatterData[sub]}
                    fill={SUBURB_COLORS[sub]}
                    stroke="#111111"
                    strokeWidth={1.5}
                    line={false}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-[11px] font-medium text-neutral-500 mt-3 pt-2 border-t border-neutral-200">
          Summary: Floor area (m²) plotted against monthly rent. Properties towards the lower right deliver maximum living area per Rand.
        </p>
      </div>
    </div>
  );
}
