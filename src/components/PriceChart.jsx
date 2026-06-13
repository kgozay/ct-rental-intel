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

// 1. Custom Brutalist Tooltip
const CustomTooltip = ({ active, payload, label }) => {
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

export default function PriceChart({ listings, history, historyBeds, setHistoryBeds }) {
  // --- CHART 1: MEDIAN BY SUBURB & BED COUNT ---
  const bedCounts = [1, 2, 3];
  const chart1Data = bedCounts.map(beds => {
    const row = { beds: `${beds} Bed` };
    SUBURBS_LIST.forEach(sub => {
      const match = listings.filter(l => l.suburb === sub && l.bedrooms === beds);
      if (match.length > 0) {
        const prices = match.map(l => l.price).sort((a, b) => a - b);
        const mid = Math.floor(prices.length / 2);
        row[sub] = prices.length % 2 !== 0 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
      }
    });
    return row;
  });

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
  SUBURBS_LIST.forEach(sub => {
    scatterData[sub] = listings
      .filter(l => l.suburb === sub && l.size_m2 !== null && l.price !== null)
      .map(l => ({
        x: l.size_m2,
        y: l.price,
        name: l.address || sub,
        suburb: sub,
        price_per_m2: l.price_per_m2
      }));
  });

  return (
    <div className="flex flex-col gap-10">
      {/* Chart 1: Grouped Bar Chart */}
      <div className="border-[3px] border-ink bg-white p-5 shadow-[6px_6px_0_#111111] rounded-none">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1 mb-6">
          Median Price by Suburb & Beds
        </h2>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart1Data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="beds" tick={{ fill: '#111111', fontWeight: 'bold' }} stroke="#111111" />
              <YAxis tickFormatter={(val) => `R ${val/1000}k`} tick={{ fill: '#111111', fontWeight: 'bold' }} stroke="#111111" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', paddingTop: '10px' }} />
              {SUBURBS_LIST.map(sub => (
                <Bar key={sub} dataKey={sub} fill={SUBURB_COLORS[sub]} stroke="#111111" strokeWidth={1.5} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Historical Timeline (only show if data points > 0) */}
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
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {chart2Data.length <= 1 ? (
          <div className="flex flex-col items-center justify-center h-80 bg-neutral-50 border-2 border-dashed border-ink/30 text-neutral-400 font-bold p-4 text-center">
            <span className="mb-2">Timeline requires at least 2 historical scrapes.</span>
            <span className="text-xs text-neutral-400 font-medium">Scrapes are currently scheduled daily. Check back tomorrow!</span>
          </div>
        ) : (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart2Data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="date" tick={{ fill: '#111111', fontWeight: 'bold' }} stroke="#111111" />
                <YAxis tickFormatter={(val) => `R ${val/1000}k`} tick={{ fill: '#111111', fontWeight: 'bold' }} stroke="#111111" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', paddingTop: '10px' }} />
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
      </div>

      {/* Chart 3: Scatter Plot (Price vs Size) */}
      <div className="border-[3px] border-ink bg-white p-5 shadow-[6px_6px_0_#111111] rounded-none">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-wider px-2.5 py-1 mb-6">
          Unit size vs Pricing Spread
        </h2>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" dataKey="x" name="Size" unit="m²" tick={{ fill: '#111111', fontWeight: 'bold' }} stroke="#111111" />
              <YAxis type="number" dataKey="y" name="Price" tickFormatter={(val) => `R ${val/1000}k`} tick={{ fill: '#111111', fontWeight: 'bold' }} stroke="#111111" />
              <ZAxis type="category" dataKey="name" name="Name" />
              <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#111' }} />
              <Legend wrapperStyle={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px', paddingTop: '10px' }} />
              {SUBURBS_LIST.map(sub => (
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
      </div>
    </div>
  );
}
