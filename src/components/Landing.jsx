import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SUBURBS_LIST } from '../utils/suburbs';
import { useRentalData } from '../hooks/useRentalData';
import { formatRelativeTime } from '../utils/dataStatus';

// Suburb metadata & fallback baselines (used while live data is loading or offline)
const SUBURB_METADATA = {
  'De Waterkant': { region: 'Atlantic Seaboard', baseMedian: 22000, baseRate: 320, bedMedians: { 1: 18500, 2: 26000, 3: 38000 } },
  'Green Point': { region: 'Atlantic Seaboard', baseMedian: 21000, baseRate: 285, bedMedians: { 1: 16500, 2: 24500, 3: 35000 } },
  'Sea Point': { region: 'Atlantic Seaboard', baseMedian: 20000, baseRate: 300, bedMedians: { 1: 16000, 2: 24000, 3: 36000 } },
  'Gardens': { region: 'City Bowl', baseMedian: 16000, baseRate: 240, bedMedians: { 1: 13500, 2: 19500, 3: 28000 } },
  'Woodstock': { region: 'City Bowl / East', baseMedian: 12500, baseRate: 190, bedMedians: { 1: 10500, 2: 14500, 3: 19000 } },
  'Claremont': { region: 'Southern Suburbs', baseMedian: 14000, baseRate: 180, bedMedians: { 1: 11500, 2: 16000, 3: 22500 } },
  'Cape Town CBD': { region: 'City Bowl', baseMedian: 15000, baseRate: 250, bedMedians: { 1: 12500, 2: 18000, 3: 26000 } },
};

export default function Landing() {
  const { listings: liveListings, dataStatus } = useRentalData();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  // Deal Barometer State
  const [selectedSuburb, setSelectedSuburb] = useState('Sea Point');
  const [selectedBeds, setSelectedBeds] = useState(1);
  const [targetBudget, setTargetBudget] = useState(16000);

  // Feature Showcase Active Tab
  const [activeShowcaseTab, setActiveShowcaseTab] = useState('table');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.title = "Cape Town Rental Intelligence — Rental Data for 7 Suburbs";
  }, []);

  const hasLiveData = liveListings && liveListings.length > 0;

  const stats = useMemo(() => {
    if (!hasLiveData) return null;
    const suburbs = new Set(liveListings.map(l => l.suburb)).size;
    const rates = liveListings.map(l => l.price_per_m2).filter(r => r != null).sort((a, b) => a - b);
    let medianRate = null;
    if (rates.length) {
      const mid = Math.floor(rates.length / 2);
      medianRate = rates.length % 2 ? rates[mid] : Math.round((rates[mid - 1] + rates[mid]) / 2);
    }
    const goodValue = liveListings.filter(l => l.value_score > 1.15).length;
    return { total: liveListings.length, suburbs, medianRate, goodValue };
  }, [liveListings, hasLiveData]);

  // Compute live per-suburb medians with baseline fallbacks
  const suburbStats = useMemo(() => {
    const result = {};
    for (const sub of SUBURBS_LIST) {
      const subListings = liveListings.filter(l => l.suburb === sub);
      const meta = SUBURB_METADATA[sub] || { region: 'Cape Town', baseMedian: 18000, baseRate: 250, bedMedians: { 1: 15000, 2: 22000, 3: 30000 } };

      if (!subListings.length) {
        result[sub] = {
          count: '—',
          medianPrice: meta.baseMedian,
          medianRate: meta.baseRate,
          bedMedians: meta.bedMedians,
          region: meta.region
        };
        continue;
      }

      const prices = subListings.map(l => l.price).filter(Boolean).sort((a, b) => a - b);
      const midP = Math.floor(prices.length / 2);
      const medianPrice = prices.length ? (prices.length % 2 ? prices[midP] : Math.round((prices[midP - 1] + prices[midP]) / 2)) : meta.baseMedian;

      const rates = subListings.map(l => l.price_per_m2).filter(Boolean).sort((a, b) => a - b);
      const midR = Math.floor(rates.length / 2);
      const medianRate = rates.length ? (rates.length % 2 ? rates[midR] : Math.round((rates[midR - 1] + rates[midR]) / 2)) : meta.baseRate;

      const bedMedians = { ...meta.bedMedians };
      [1, 2, 3].forEach(b => {
        const bPrices = subListings.filter(l => l.bedrooms === b).map(l => l.price).filter(Boolean).sort((a, b) => a - b);
        if (bPrices.length) {
          const midB = Math.floor(bPrices.length / 2);
          bedMedians[b] = bPrices.length % 2 ? bPrices[midB] : Math.round((bPrices[midB - 1] + bPrices[midB]) / 2);
        }
      });

      result[sub] = {
        count: subListings.length,
        medianPrice,
        medianRate,
        bedMedians,
        region: meta.region
      };
    }
    return result;
  }, [liveListings]);

  // Deal Barometer Calculation
  const activeSuburbInfo = suburbStats[selectedSuburb] || SUBURB_METADATA[selectedSuburb];
  const activeBedMedian = activeSuburbInfo?.bedMedians?.[selectedBeds] || 16000;
  const budgetDiff = activeBedMedian - targetBudget;
  const isGoodValue = targetBudget <= activeBedMedian * 0.9;
  const isFairValue = targetBudget > activeBedMedian * 0.9 && targetBudget <= activeBedMedian * 1.15;
  const isUpperMarket = targetBudget > activeBedMedian * 1.15;

  const matchingFlatsCount = useMemo(() => {
    if (!liveListings.length) return null;
    return liveListings.filter(l =>
      l.suburb === selectedSuburb &&
      l.bedrooms === selectedBeds &&
      l.price <= targetBudget
    ).length;
  }, [liveListings, selectedSuburb, selectedBeds, targetBudget]);

  const statCards = [
    { num: stats ? stats.total : '—', lbl: 'Live listings', accent: true },
    { num: stats ? stats.suburbs : SUBURBS_LIST.length, lbl: 'Suburbs tracked' },
    { num: stats && stats.medianRate ? `R${stats.medianRate}` : '—', lbl: 'Median R/m²' },
    { num: stats ? stats.goodValue : '—', lbl: 'Good-value finds' },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
      {/* NAV */}
      <nav className="flex items-center justify-between mb-12 select-none border-b-2 border-ink pb-5">
        <div className="text-xl md:text-2xl font-black tracking-tight uppercase">
          Cape Town Rental<span className="text-blue">.</span>Intel
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="border-[3px] border-ink bg-paper text-ink font-black px-3.5 py-2 cursor-pointer transition-all select-none text-xs leading-none flex items-center justify-center shadow-[3px_3px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none uppercase tracking-wider"
            aria-label="Toggle theme mode"
          >
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
          <Link
            to="/dashboard"
            className="border-[3px] border-ink bg-ink text-paper font-black uppercase px-4 py-2 text-xs tracking-wider no-underline shadow-[4px_4px_0_#111111] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111]"
          >
            Open Dashboard →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="mb-16">
        <div className="fade-up flex flex-wrap items-center gap-2 mb-6">
          <div className="inline-block border-[3px] border-ink bg-yellow text-ink px-3.5 py-1.5 text-xs font-black uppercase tracking-wider shadow-[3px_3px_0_#111111]">
            Cape Town · Atlantic Seaboard · City Bowl · Southern Suburbs
          </div>
          <div className="inline-flex items-center gap-1.5 border-2 border-ink bg-white text-ink px-3 py-1 text-xs font-bold shadow-[2px_2px_0_#111111]">
            <span className={`w-2 h-2 rounded-full ${hasLiveData ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span>
              {hasLiveData
                ? `Snapshot: ${dataStatus?.lastScraped ? formatRelativeTime(dataStatus.lastScraped) : 'Active'} · 48h refresh cycle`
                : 'Baseline estimates · Snapshot on demand'}
            </span>
          </div>
        </div>
        <h1
          className="fade-up font-black uppercase leading-[0.93] tracking-tight mb-6"
          style={{ fontSize: 'clamp(2.5rem, 7.5vw, 5.2rem)', animationDelay: '60ms' }}
        >
          Rent smarter.<br />
          Spot <span className="text-blue underline decoration-4 underline-offset-8">underpriced</span> flats.
        </h1>
        <p
          className="fade-up text-lg md:text-xl font-medium max-w-[680px] mb-9 leading-relaxed text-ink/90"
          style={{ animationDelay: '140ms' }}
        >
          Residential rental intelligence for <b>7 Cape Town suburbs</b> — updated on demand with 48h refresh cycles. Every listing
          normalised, value-scored against median R/m², mapped, and analysed without promotional distortion.
        </p>
        <div className="fade-up flex flex-wrap items-center gap-4" style={{ animationDelay: '220ms' }}>
          <Link
            to="/dashboard"
            className="border-[3px] border-ink bg-blue text-white font-extrabold uppercase px-7 py-4 text-sm tracking-wider no-underline shadow-[6px_6px_0_#111111] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[7px_7px_0_#111111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            Explore Listings →
          </Link>
          <a
            href="#deal-calculator"
            className="border-[3px] border-ink bg-paper text-ink font-extrabold uppercase px-7 py-4 text-sm tracking-wider no-underline shadow-[4px_4px_0_#111111] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111]"
          >
            Test Rent Barometer ↓
          </a>
        </div>
      </header>

      {/* LIVE STAT STRIP */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
        {statCards.map((s, i) => (
          <div
            key={s.lbl}
            className={`fade-up border-[3px] border-ink shadow-[4px_4px_0_#111111] p-5 ${s.accent ? 'bg-yellow text-ink' : 'bg-white'}`}
            style={{ animationDelay: `${300 + i * 70}ms` }}
          >
            <div className={`text-3xl md:text-[2.375rem] font-black font-mono tracking-tight leading-none ${s.accent ? 'text-ink' : ''} ${!stats ? 'opacity-40' : ''}`}>
              {s.num}
            </div>
            <div className={`text-xs font-black uppercase tracking-wider mt-2.5 ${s.accent ? 'text-ink/80' : 'text-ink/70'}`}>
              {s.lbl}
              {!stats && <span className="block text-[10px] font-sans font-normal text-ink/50 normal-case mt-0.5">(baseline estimate)</span>}
            </div>
          </div>
        ))}
      </section>

      {/* INTERACTIVE DEAL BAROMETER / CALCULATOR */}
      <section id="deal-calculator" className="scroll-mt-6 border-[3px] border-ink bg-white shadow-[6px_6px_0_#111111] p-6 md:p-8 mb-20">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b-2 border-ink pb-4">
          <div>
            <span className="inline-block border-2 border-ink bg-yellow text-ink text-xs font-black uppercase px-3 py-1 mb-2 shadow-[2px_2px_0_#111111]">
              Live Utility
            </span>
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Rent Barometer · Test Your Budget
            </h2>
          </div>
          <p className="text-xs md:text-sm font-medium text-ink/70 max-w-sm">
            Select a suburb, choose bedroom count, and dial your budget to see how your money stacks up against actual market medians.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Suburb Selector */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-ink/80 mb-2">
                1. Select Suburb
              </label>
              <div className="flex flex-wrap gap-2">
                {SUBURBS_LIST.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSuburb(sub)}
                    className={`border-2 border-ink text-xs font-black px-3 py-2 uppercase transition-all duration-75 ${
                      selectedSuburb === sub
                        ? 'bg-ink text-paper shadow-[3px_3px_0_#111111] translate-x-[-1px] translate-y-[-1px]'
                        : 'bg-paper text-ink hover:bg-neutral-200'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Bedroom Selector */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-ink/80 mb-2">
                2. Bedroom Count
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 1, label: 'Studio / 1 Bed' },
                  { id: 2, label: '2 Bedrooms' },
                  { id: 3, label: '3 Bedrooms' },
                ].map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBeds(b.id)}
                    className={`border-2 border-ink text-xs font-black py-2.5 px-2 text-center uppercase transition-all ${
                      selectedBeds === b.id
                        ? 'bg-blue text-white shadow-[3px_3px_0_#111111]'
                        : 'bg-paper text-ink hover:bg-neutral-200'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly Budget Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="budget-slider" className="text-xs font-black uppercase tracking-wider text-ink/80">
                  3. Your Monthly Budget
                </label>
                <span className="font-mono font-black text-lg md:text-xl text-blue">
                  R{targetBudget.toLocaleString()} <span className="text-xs font-bold text-ink/60 font-sans">/ month</span>
                </span>
              </div>
              <input
                id="budget-slider"
                type="range"
                min="7000"
                max="50000"
                step="500"
                value={targetBudget}
                onChange={e => setTargetBudget(Number(e.target.value))}
                className="w-full h-3 bg-paper border-2 border-ink accent-blue cursor-pointer"
                aria-label="Adjust monthly target budget slider"
              />
              <div className="flex justify-between text-[11px] font-mono font-bold text-ink/50 mt-1">
                <span>R7 000</span>
                <span>R25 000</span>
                <span>R50 000</span>
              </div>
            </div>
          </div>

          {/* Verdict Box */}
          <div className="lg:col-span-5 border-[3px] border-ink bg-paper p-6 shadow-[4px_4px_0_#111111] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4 border-b-2 border-ink pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-ink/70">
                  Market Verdict
                </span>
                <span
                  className={`border-2 border-ink text-xs font-black uppercase px-2.5 py-1 ${
                    isGoodValue
                      ? 'bg-lime text-ink'
                      : isFairValue
                      ? 'bg-bgrey text-ink'
                      : 'bg-yellow text-ink'
                  }`}
                >
                  {isGoodValue ? '🎯 Under Market' : isFairValue ? '⚖ Fair Market' : '★ Upper Market'}
                </span>
              </div>

              <div className="mb-4">
                <div className="text-xs font-bold uppercase text-ink/60 mb-1">
                  {selectedSuburb} · {selectedBeds}-Bed Median
                </div>
                <div className="text-2xl md:text-3xl font-black font-mono text-ink">
                  R{activeBedMedian.toLocaleString()}{' '}
                  <span className="text-xs font-sans font-bold text-ink/60">/ month</span>
                </div>
              </div>

              <p className="text-xs md:text-sm font-medium text-ink/80 leading-relaxed mb-6">
                {isGoodValue && (
                  <>
                    At <b>R{targetBudget.toLocaleString()}</b>, your budget sits{' '}
                    <span className="font-bold text-ink">
                      R{Math.abs(budgetDiff).toLocaleString()} below
                    </span>{' '}
                    the {selectedSuburb} median. Any flat found at this price point delivers exceptional savings!
                  </>
                )}
                {isFairValue && (
                  <>
                    Your <b>R{targetBudget.toLocaleString()}</b> budget tracks right around the{' '}
                    {selectedSuburb} market median (R{activeBedMedian.toLocaleString()}). You have healthy options across standard rental inventory.
                  </>
                )}
                {isUpperMarket && (
                  <>
                    At <b>R{targetBudget.toLocaleString()}</b>, your budget is{' '}
                    <span className="font-bold text-ink">
                      R{Math.abs(budgetDiff).toLocaleString()} above
                    </span>{' '}
                    median. You can target luxury units with secure parking, private balconies, and top-tier finishes.
                  </>
                )}
              </p>
            </div>

            <Link
              to={`/dashboard?suburbs=${encodeURIComponent(selectedSuburb)}&maxPrice=${targetBudget}&minBeds=${selectedBeds}`}
              className="border-[3px] border-ink bg-blue text-white text-center font-black uppercase py-3.5 px-4 text-xs tracking-wider no-underline shadow-[4px_4px_0_#111111] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Explore {selectedSuburb} Deals in Dashboard →
              {matchingFlatsCount !== null && (
                <span className="block text-[11px] font-normal opacity-90 mt-0.5">
                  ({matchingFlatsCount} matching listings in current scrape)
                </span>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* THE SECRET WEAPON: HOW VALUE SCORING WORKS */}
      <section className="border-[3px] border-ink bg-ink text-paper p-6 md:p-10 shadow-[6px_6px_0_#111111] mb-20">
        <div className="max-w-2xl mb-8">
          <span className="inline-block border-2 border-paper bg-yellow text-ink text-xs font-black uppercase px-3 py-1 mb-3">
            Algorithmic Edge
          </span>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-paper mb-3">
            The Secret Weapon: Algorithmic Value Scoring
          </h2>
          <p className="text-sm md:text-base font-medium text-paper/80 leading-relaxed">
            Property portals show you prices in a vacuum. We calculate the exact rate per square meter (R/m²) for every unit and index it against the suburb benchmark.
          </p>
        </div>

        {/* Visual Formula Card */}
        <div className="border-[3px] border-paper/40 bg-white/5 p-6 mb-8 backdrop-blur-sm">
          <div className="text-xs font-black uppercase tracking-wider text-paper/60 mb-2">
            The Calculation
          </div>
          <div className="font-mono text-base md:text-xl font-bold tracking-tight text-yellow flex flex-wrap items-center gap-3">
            <span>Value Score</span>
            <span className="text-paper">=</span>
            <span className="border-b-2 border-yellow pb-0.5">Suburb Median (R/m²)</span>
            <span className="text-paper">÷</span>
            <span className="border-b-2 border-yellow pb-0.5">Listing Price per m²</span>
          </div>
        </div>

        {/* 3 Outcome Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-2 border-paper/30 bg-white/10 p-4">
            <span className="inline-block bg-lime text-ink text-xs font-black uppercase px-2 py-0.5 mb-2">
              Score &gt; 1.15
            </span>
            <h4 className="font-black text-sm uppercase text-paper mb-1">Underpriced Gem</h4>
            <p className="text-xs font-medium text-paper/70 leading-relaxed">
              You get &gt;15% more floor space or pay significantly less per m² than neighbours. Snatched up fast.
            </p>
          </div>
          <div className="border-2 border-paper/30 bg-white/10 p-4">
            <span className="inline-block bg-bgrey text-ink text-xs font-black uppercase px-2 py-0.5 mb-2">
              Score 0.85 – 1.15
            </span>
            <h4 className="font-black text-sm uppercase text-paper mb-1">Fair Market Value</h4>
            <p className="text-xs font-medium text-paper/70 leading-relaxed">
              Price closely reflects actual square meterage and location equilibrium. Fair rental contract.
            </p>
          </div>
          <div className="border-2 border-paper/30 bg-white/10 p-4">
            <span className="inline-block bg-bred text-white text-xs font-black uppercase px-2 py-0.5 mb-2">
              Score &lt; 0.85
            </span>
            <h4 className="font-black text-sm uppercase text-paper mb-1">Overpriced / Premium</h4>
            <p className="text-xs font-medium text-paper/70 leading-relaxed">
              High price tag relative to usable floor area. Justifiable only if spectacular views or ultra-luxury specs.
            </p>
          </div>
        </div>
      </section>

      {/* SUBURB INTELLIGENCE HUB: RANKED NEIGHBORHOOD TABLE */}
      <section className="mb-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <span className="inline-block border-2 border-ink bg-paper text-ink text-xs font-black uppercase px-2.5 py-1 mb-2 shadow-[2px_2px_0_#111111]">
              Coverage
            </span>
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              7 Suburbs Tracked · Neighborhood Benchmark Table
            </h2>
          </div>
          <p className="text-xs md:text-sm font-medium text-ink/70 max-w-sm">
            Ranked by floor area rate (R/m²). Click any suburb to open directly in the dashboard with preserved context.
          </p>
        </div>

        <div className="border-[3px] border-ink bg-white shadow-[6px_6px_0_#111111] overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-ink text-paper uppercase text-[11px] tracking-wider border-b-2 border-ink">
                <th className="p-3.5 font-black">Suburb</th>
                <th className="p-3.5 font-black">Region</th>
                <th className="p-3.5 font-black font-mono">Median Rent</th>
                <th className="p-3.5 font-black font-mono">Rate (R/m²)</th>
                <th className="p-3.5 font-black">Coverage / Sample</th>
                <th className="p-3.5 font-black text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {Object.entries(suburbStats)
                .sort(([, a], [, b]) => (a.medianRate || 0) - (b.medianRate || 0))
                .map(([suburb, data], idx) => (
                  <tr key={suburb} className="hover:bg-neutral-50 transition-colors">
                    <td className="p-3.5 font-black text-ink uppercase text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-neutral-400">#{idx + 1}</span>
                        <span>{suburb}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-bold text-neutral-500 uppercase text-xs">
                      {data.region}
                    </td>
                    <td className="p-3.5 font-black font-mono text-ink tabular-nums text-sm">
                      R{data.medianPrice.toLocaleString('en-ZA')}
                    </td>
                    <td className="p-3.5 font-bold font-mono text-neutral-700 tabular-nums">
                      R{data.medianRate}/m²
                    </td>
                    <td className="p-3.5 font-bold">
                      {data.count !== '—' ? (
                        <span className="inline-block border border-ink bg-yellow text-ink px-2 py-0.5 text-[10px] font-mono font-bold">
                          {data.count} listings
                        </span>
                      ) : (
                        <span className="inline-block border border-neutral-300 bg-neutral-100 text-neutral-500 px-2 py-0.5 text-[10px] font-sans">
                          Baseline estimate
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        to={`/dashboard?suburbs=${encodeURIComponent(suburb)}`}
                        className="inline-block border-2 border-ink bg-paper text-ink font-black uppercase px-3 py-1 text-xs hover:bg-yellow hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all shadow-[1px_1px_0_#111111] no-underline"
                      >
                        Explore →
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PROPERTY24 VS CT RENTAL INTEL COMPARISON TABLE */}
      <section className="border-[3px] border-ink bg-white p-6 md:p-8 shadow-[6px_6px_0_#111111] mb-20">
        <div className="max-w-xl mb-6">
          <span className="inline-block border-2 border-ink bg-yellow text-ink text-xs font-black uppercase px-2.5 py-1 mb-2 shadow-[2px_2px_0_#111111]">
            Why Switch?
          </span>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
            Property24 vs CT Rental Intel
          </h2>
          <p className="text-xs md:text-sm font-medium text-ink/70">
            Traditional property portals work for the listing agents. CT Rental Intel works for the tenant.
          </p>
        </div>

        <div className="overflow-x-auto border-[2px] border-ink">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-[3px] border-ink bg-ink text-paper text-xs uppercase tracking-wider">
                <th className="p-3.5 font-black">Capability</th>
                <th className="p-3.5 font-bold text-paper/70">Standard Portal (Property24)</th>
                <th className="p-3.5 font-black text-yellow">CT Rental Intel</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-ink text-xs md:text-sm">
              <tr className="bg-white">
                <td className="p-3.5 font-black">Sorting &amp; Ranking</td>
                <td className="p-3.5 text-ink/60">Paid agent promotions &amp; featured boosts</td>
                <td className="p-3.5 font-bold text-ink bg-lime/20">100% Unbiased: sort by R/m² or Value Score</td>
              </tr>
              <tr className="bg-paper">
                <td className="p-3.5 font-black">Price per m² (R/m²)</td>
                <td className="p-3.5 text-ink/60">Not calculated or hidden in description text</td>
                <td className="p-3.5 font-bold text-ink bg-lime/20">Calculated &amp; normalised for every single unit</td>
              </tr>
              <tr className="bg-white">
                <td className="p-3.5 font-black">Fair-Value Flagging</td>
                <td className="p-3.5 text-ink/60">None — tenant must calculate manual spreadsheets</td>
                <td className="p-3.5 font-bold text-ink bg-lime/20">Algorithmic badges: Good Value, Fair, Overpriced</td>
              </tr>
              <tr className="bg-paper">
                <td className="p-3.5 font-black">Price Drop History</td>
                <td className="p-3.5 text-ink/60">Untracked; drops blend into new listings</td>
                <td className="p-3.5 font-bold text-ink bg-lime/20">Tracks previous prices &amp; highlights price reductions</td>
              </tr>
              <tr className="bg-white">
                <td className="p-3.5 font-black">Market Synthesis</td>
                <td className="p-3.5 text-ink/60">Fragmented browsing across hundreds of tabs</td>
                <td className="p-3.5 font-bold text-ink bg-lime/20">Gemini 2.5 Flash writes an executive market readout</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* UPGRADED FEATURE SHOWCASE (INTERACTIVE TABS) */}
      <section className="mb-20">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <span className="inline-block border-2 border-ink bg-lime text-ink text-xs font-black uppercase px-2.5 py-1 mb-2 shadow-[2px_2px_0_#111111]">
              Platform Tour
            </span>
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              4 Ways to Analyze the Market
            </h2>
          </div>
          {/* Tab Switcher */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'table', label: '1. Filter Table' },
              { id: 'map', label: '2. Geographic Map' },
              { id: 'charts', label: '3. Price Trends' },
              { id: 'ai', label: '4. AI Analyst' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveShowcaseTab(tab.id)}
                className={`border-2 border-ink text-xs font-black px-3 py-2 uppercase transition-all ${
                  activeShowcaseTab === tab.id
                    ? 'bg-ink text-paper shadow-[3px_3px_0_#111111]'
                    : 'bg-white text-ink hover:bg-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Tab Content */}
        <div className="border-[3px] border-ink bg-white shadow-[6px_6px_0_#111111] p-6 md:p-8">
          {activeShowcaseTab === 'table' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b-2 border-ink pb-3">
                <h3 className="text-xl font-black uppercase">
                  Sort &amp; Filter Every Listing by Value
                </h3>
                <span className="border border-ink bg-yellow px-2 py-0.5 text-[10px] font-black uppercase text-ink shadow-[1px_1px_0_#111111]">
                  Example Illustrative Preview
                </span>
              </div>
              <p className="text-sm font-medium text-ink/70 mb-6 leading-relaxed max-w-2xl">
                Filter by suburb, bedroom count, maximum price, furnished status, and move-in availability. Sort by price per m² to immediately float the highest space-per-Rand deals to the top.
              </p>

              {/* Sample High-Contrast Table Preview */}
              <div className="border-[2px] border-ink bg-paper overflow-x-auto">
                <table className="w-full text-left text-xs font-medium">
                  <thead>
                    <tr className="border-b-2 border-ink bg-ink text-paper font-black uppercase">
                      <th className="p-2.5">Suburb</th>
                      <th className="p-2.5">Beds</th>
                      <th className="p-2.5">Floor Area</th>
                      <th className="p-2.5">Price</th>
                      <th className="p-2.5">Rate</th>
                      <th className="p-2.5">Value Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/20 font-bold">
                    <tr className="hover:bg-white/60">
                      <td className="p-2.5 font-black">Sea Point</td>
                      <td className="p-2.5">2</td>
                      <td className="p-2.5 font-mono">82 m²</td>
                      <td className="p-2.5 font-mono font-black text-ink">R16 500</td>
                      <td className="p-2.5 font-mono text-ink/70">R201/m²</td>
                      <td className="p-2.5">
                        <span className="inline-block bg-lime border border-ink text-[11px] font-black uppercase px-2 py-0.5">
                          1.29x Good Value
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-white/60">
                      <td className="p-2.5 font-black">Gardens</td>
                      <td className="p-2.5">1</td>
                      <td className="p-2.5 font-mono">54 m²</td>
                      <td className="p-2.5 font-mono font-black text-ink">R12 000</td>
                      <td className="p-2.5 font-mono text-ink/70">R222/m²</td>
                      <td className="p-2.5">
                        <span className="inline-block bg-lime border border-ink text-[11px] font-black uppercase px-2 py-0.5">
                          1.18x Good Value
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-white/60">
                      <td className="p-2.5 font-black">Green Point</td>
                      <td className="p-2.5">1</td>
                      <td className="p-2.5 font-mono">48 m²</td>
                      <td className="p-2.5 font-mono font-black text-ink">R18 500</td>
                      <td className="p-2.5 font-mono text-ink/70">R385/m²</td>
                      <td className="p-2.5">
                        <span className="inline-block bg-bgrey border border-ink text-[11px] font-black uppercase px-2 py-0.5">
                          0.98x Fair
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeShowcaseTab === 'map' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b-2 border-ink pb-3">
                <h3 className="text-xl font-black uppercase">
                  Spatial Price Distribution
                </h3>
                <span className="text-xs font-mono font-bold text-ink/60">
                  OpenStreetMap + Deterministic jitter
                </span>
              </div>
              <p className="text-sm font-medium text-ink/70 mb-6 leading-relaxed max-w-2xl">
                Pinpoint high-value pockets across Cape Town with color-coded markers. Instantly see how rental costs escalate along the coast versus the City Bowl.
              </p>

              {/* Price Legend Mockup */}
              <div className="border-2 border-ink bg-paper p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { color: '#10b981', label: '≤ R15 000', text: 'Affordable pockets' },
                  { color: '#f59e0b', label: 'R15k – R22k', text: 'Mid-range flats' },
                  { color: '#f97316', label: 'R22k – R35k', text: 'Upper market' },
                  { color: '#ef4444', label: '> R35 000', text: 'Luxury / Penthouse' },
                ].map(b => (
                  <div key={b.label} className="border border-ink bg-white p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3.5 h-3.5 border border-ink rounded-full" style={{ background: b.color }} />
                      <span className="text-xs font-black font-mono">{b.label}</span>
                    </div>
                    <span className="text-[11px] font-medium text-ink/60">{b.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeShowcaseTab === 'charts' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b-2 border-ink pb-3">
                <h3 className="text-xl font-black uppercase">
                  Track Rates &amp; Price History
                </h3>
                <span className="text-xs font-mono font-bold text-ink/60">
                  Recharts median R/m² benchmarks
                </span>
              </div>
              <p className="text-sm font-medium text-ink/70 mb-6 leading-relaxed max-w-2xl">
                Compare suburb medians side-by-side. Track whether landlords are raising asking rents or adjusting prices downward across scrape cycles.
              </p>

              {/* High-Contrast Suburb Bar Chart Preview */}
              <div className="border-2 border-ink bg-paper p-4">
                <div className="text-xs font-black uppercase tracking-wider text-ink/60 mb-3">
                  Relative Price per m² Benchmark (R/m²)
                </div>
                <div className="grid grid-cols-7 gap-2 items-end h-28 border-b-2 border-ink pb-2">
                  {[
                    { sub: 'De Waterkant', code: 'DW',  val: 'R320', pct: '88%', color: '#2563EB' },
                    { sub: 'Sea Point',    code: 'SP',  val: 'R300', pct: '80%', color: '#FFD23F' },
                    { sub: 'Green Point',  code: 'GP',  val: 'R285', pct: '74%', color: '#10b981' },
                    { sub: 'CBD',          code: 'CBD', val: 'R250', pct: '62%', color: '#06B6D4' },
                    { sub: 'Gardens',      code: 'GDN', val: 'R240', pct: '58%', color: '#9333EA' },
                    { sub: 'Woodstock',    code: 'WST', val: 'R190', pct: '40%', color: '#f97316' },
                    { sub: 'Claremont',    code: 'CLM', val: 'R180', pct: '36%', color: '#FF5436' },
                  ].map(b => (
                    <div key={b.code} className="flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-mono font-black text-ink">{b.val}</span>
                      <div
                        className="w-full border-2 border-ink transition-all"
                        style={{ height: b.pct, background: b.color }}
                        title={`${b.sub}: ${b.val}/m²`}
                      />
                      <span className="text-[11px] font-black uppercase text-ink/70 leading-none">{b.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeShowcaseTab === 'ai' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b-2 border-ink pb-3">
                <h3 className="text-xl font-black uppercase">
                  Executive Market Readout in 15 Seconds
                </h3>
                <span className="text-xs font-mono font-bold text-ink/60">
                  Powered by Gemini 2.5 Flash
                </span>
              </div>
              <p className="text-sm font-medium text-ink/70 mb-6 leading-relaxed max-w-2xl">
                On demand, Gemini reads the complete normalized dataset and generates a concise 3-paragraph executive briefing — pinpointing supply shifts, best bedroom sweet spots, and price drop trends.
              </p>

              {/* Sample AI Report Excerpt */}
              <div className="border-2 border-ink bg-paper p-5 font-mono text-xs md:text-sm leading-relaxed text-ink/90 border-l-[6px] border-l-blue">
                <p className="mb-2">
                  <strong className="text-ink uppercase font-sans font-black">Market Overview:</strong> Gardens and Woodstock continue to offer the sharpest value entry points in the metropolitan ring. In <strong>Gardens</strong>, the 1-bedroom median sits at <strong>R13 500</strong>, undercutting neighboring <strong>Green Point</strong> (median R16 500) by nearly 20% for comparable square meterage.
                </p>
                <p>
                  <strong className="text-ink uppercase font-sans font-black">Recommendation:</strong> If hunting for a 2-bedroom on the Atlantic Seaboard, Sea Point listings between R20 000 and R22 000 are achieving the highest value score ratios this cycle.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mb-20 scroll-mt-6 border-[3px] border-ink bg-paper shadow-[6px_6px_0_#111111] p-6 md:p-10">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-6">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <p className="text-base font-medium leading-relaxed text-ink/85 mb-4">
              On demand, our background worker crawls residential listings directly from Property24 across all 7 monitored suburbs.
            </p>
            <p className="text-base font-medium leading-relaxed text-ink/85">
              Every listing is cleaned, stripped of non-residential commercial anomalies, geocoded, and indexed against neighborhood medians. You get an analyst's cockpit — not a cluttered portal.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-4 border-[3px] border-ink bg-white p-4 shadow-[3px_3px_0_#111111]">
              <span className="font-black text-blue text-2xl font-mono leading-none select-none">1</span>
              <div>
                <div className="font-black text-sm uppercase tracking-tight mb-0.5">Scrape &amp; Deduplicate</div>
                <div className="text-xs font-medium text-ink/70 leading-relaxed">Pulls live rental inventory across Atlantic Seaboard, City Bowl &amp; Southern Suburbs.</div>
              </div>
            </div>
            <div className="flex items-start gap-4 border-[3px] border-ink bg-white p-4 shadow-[3px_3px_0_#111111]">
              <span className="font-black text-blue text-2xl font-mono leading-none select-none">2</span>
              <div>
                <div className="font-black text-sm uppercase tracking-tight mb-0.5">Normalise &amp; Score</div>
                <div className="text-xs font-medium text-ink/70 leading-relaxed">Computes R/m², historical price drops, and algorithmic fair-value ratings.</div>
              </div>
            </div>
            <div className="flex items-start gap-4 border-[3px] border-ink bg-white p-4 shadow-[3px_3px_0_#111111]">
              <span className="font-black text-blue text-2xl font-mono leading-none select-none">3</span>
              <div>
                <div className="font-black text-sm uppercase tracking-tight mb-0.5">Explore &amp; Act</div>
                <div className="text-xs font-medium text-ink/70 leading-relaxed">Filter, map, chart trends, or read the Gemini AI analyst report before signing.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="border-[3px] border-ink bg-ink text-paper shadow-[6px_6px_0_#111111] p-8 md:p-12 text-center">
        <h2 className="font-black uppercase leading-tight tracking-tight mb-4" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 3rem)' }}>
          Ready to hunt with an<span className="text-yellow"> unfair advantage?</span>
        </h2>
        <p className="text-paper/80 font-medium mb-8 max-w-[540px] mx-auto text-sm md:text-base leading-relaxed">
          Open the full live dashboard. Filter 7 suburbs, plot listings on the interactive map, and find your next apartment with complete pricing transparency.
        </p>
        <Link
          to="/dashboard"
          className="inline-block border-[3px] border-paper bg-yellow text-ink font-extrabold uppercase px-8 py-4 text-sm tracking-wider no-underline shadow-[6px_6px_0_#FAF6E9] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          Explore Live Listings Now →
        </Link>
      </section>

      <footer className="text-center mt-12 text-xs font-bold uppercase tracking-wider text-ink/50">
        Cape Town Rental.Intel · Residential rentals only · Built on Property24 data
      </footer>
    </div>
  );
}
