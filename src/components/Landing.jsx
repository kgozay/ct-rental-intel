import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SUBURBS_LIST } from '../utils/suburbs';

export default function Landing() {
  const [stats, setStats] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.title = "Cape Town Rental Intelligence — Live Rental Data for 7 Suburbs";
    let cancelled = false;
    fetch('/api/listings?latestOnly=true')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data || !data.listings) return;
        const listings = data.listings;
        const suburbs = new Set(listings.map(l => l.suburb)).size;
        const rates = listings.map(l => l.price_per_m2).filter(r => r != null).sort((a, b) => a - b);
        let medianRate = null;
        if (rates.length) {
          const mid = Math.floor(rates.length / 2);
          medianRate = rates.length % 2 ? rates[mid] : Math.round((rates[mid - 1] + rates[mid]) / 2);
        }
        const goodValue = listings.filter(l => l.value_score > 1.15).length;
        setStats({ total: listings.length, suburbs, medianRate, goodValue });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const statCards = [
    { num: stats ? stats.total : '—', lbl: 'Live listings', accent: true },
    { num: stats ? stats.suburbs : SUBURBS_LIST.length, lbl: 'Suburbs tracked' },
    { num: stats && stats.medianRate ? `R${stats.medianRate}` : '—', lbl: 'Median R/m²' },
    { num: stats ? stats.goodValue : '—', lbl: 'Good-value finds' },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6">
      {/* NAV */}
      <nav className="flex items-center justify-between mb-12 select-none">
        <div className="text-xl md:text-2xl font-black tracking-tight uppercase">
          Cape Town Rental<span className="text-blue">.</span>Intel
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="border-[3px] border-ink bg-paper text-ink font-extrabold px-3 py-2 cursor-pointer hover:bg-neutral-100 transition-all select-none text-xs leading-none flex items-center justify-center rounded-none shadow-[3px_3px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none uppercase tracking-wide"
            aria-label="Toggle theme mode"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <Link
            to="/dashboard"
            className="border-[3px] border-ink bg-ink text-paper font-extrabold uppercase px-4 py-2 text-xs tracking-wider no-underline shadow-[4px_4px_0_#111111] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111]"
          >
            Explore listings →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="mb-16">
        <div className="fade-up inline-block border-[3px] border-ink bg-yellow px-3 py-1 text-[0.6875rem] font-black uppercase tracking-[1px] shadow-[3px_3px_0_#111111] mb-6">
          Cape Town · Atlantic Seaboard · City Bowl · Southern Suburbs
        </div>
        <h1
          className="fade-up font-black uppercase leading-[0.95] tracking-tight mb-6"
          style={{ fontSize: 'clamp(2.5rem, 8vw, 5.5rem)', animationDelay: '60ms' }}
        >
          Rent smarter.<br />
          See the <span className="text-blue">whole</span> market.
        </h1>
        <p
          className="fade-up text-lg md:text-xl font-medium max-w-[640px] mb-9 leading-relaxed"
          style={{ animationDelay: '140ms' }}
        >
          Live residential rental intelligence for <b>7 Cape Town suburbs</b> — every listing
          normalised, value-scored, mapped, and analysed. Find the under-priced flats before
          everyone else does.
        </p>
        <div className="fade-up flex flex-wrap items-center gap-4" style={{ animationDelay: '220ms' }}>
          <Link
            to="/dashboard"
            className="border-[3px] border-ink bg-blue text-white font-extrabold uppercase px-7 py-4 text-sm tracking-[0.5px] no-underline shadow-[6px_6px_0_#111111] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[7px_7px_0_#111111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            Explore Live Listings →
          </Link>
          <a
            href="#how"
            className="border-[3px] border-ink bg-paper text-ink font-extrabold uppercase px-7 py-4 text-sm tracking-[0.5px] no-underline shadow-[4px_4px_0_#111111] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111]"
          >
            How it works
          </a>
        </div>
      </header>

      {/* LIVE STAT STRIP */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
        {statCards.map((s, i) => (
          <div
            key={s.lbl}
            className={`fade-up border-[3px] border-ink shadow-[4px_4px_0_#111111] p-5 ${s.accent ? 'bg-yellow' : 'bg-white'}`}
            style={{ animationDelay: `${300 + i * 70}ms` }}
          >
            <div className={`text-3xl md:text-[2.375rem] font-black leading-none text-ink line-clamp-1 ${!stats ? 'opacity-30' : ''}`}>
              {s.num}
            </div>
            <div className="text-[0.6875rem] font-black uppercase tracking-wider text-ink/70 mt-2">
              {s.lbl}
            </div>
          </div>
        ))}
      </section>

      {/* FEATURE SHOWCASE — asymmetric grid, not identical cards */}
      <section className="mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* TABLE — primary feature, 7 cols */}
          <div className="lg:col-span-7 border-[3px] border-ink bg-white shadow-[6px_6px_0_#111111] p-6 flex flex-col">
            <span className="inline-block border-[3px] border-ink bg-yellow text-ink text-xs font-black uppercase tracking-wider px-3 py-1 mb-5 shadow-[3px_3px_0_#111111] self-start">
              Table
            </span>
            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2 leading-tight">
              Every listing,<br />filtered your way
            </h3>
            <p className="text-sm font-medium text-ink/70 mb-6 max-w-sm leading-relaxed">
              Sort by price, R/m², or value score. Filter by suburb, beds, furnished status, and move-in date. Export to CSV for your own analysis.
            </p>
            {/* Mini UI mockup */}
            <div className="mt-auto border-[3px] border-ink bg-paper p-3">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {['Sea Point', 'De Waterkant', 'Green Point'].map(s => (
                  <span key={s} className="border-2 border-ink bg-ink text-paper text-[0.6875rem] font-black px-2 py-0.5">{s}</span>
                ))}
                <span className="border-2 border-ink bg-white text-ink/40 text-[0.6875rem] font-bold px-2 py-0.5">+ 4 more</span>
              </div>
              <div className="border-t-2 border-ink pt-2 grid grid-cols-4 gap-2 text-[0.5625rem] font-extrabold uppercase text-ink/40 tracking-wider mb-1.5">
                <span>Suburb</span><span>Beds</span><span>Price</span><span>Value</span>
              </div>
              <div className="border-t-2 border-ink pt-2 grid grid-cols-4 gap-2 items-center text-xs font-bold">
                <span className="font-extrabold">Sea Point</span>
                <span>2</span>
                <span className="font-black">R16 500</span>
                <span className="inline-block bg-lime border-2 border-ink text-[0.5625rem] font-black uppercase px-1.5 py-0.5 leading-none">Good value</span>
              </div>
              <div className="border-t border-ink/20 mt-2 pt-2 grid grid-cols-4 gap-2 items-center text-xs font-bold opacity-50">
                <span>Green Point</span>
                <span>1</span>
                <span className="font-black">R21 000</span>
                <span className="inline-block bg-bgrey border-2 border-ink text-[0.5625rem] font-black uppercase px-1.5 py-0.5 leading-none">Fair</span>
              </div>
            </div>
          </div>

          {/* MAP — 5 cols, dark */}
          <div className="lg:col-span-5 border-[3px] border-ink bg-ink text-paper shadow-[6px_6px_0_#111111] p-6 flex flex-col">
            <span className="inline-block border-[3px] border-paper bg-blue text-white text-xs font-black uppercase tracking-wider px-3 py-1 mb-5 shadow-[3px_3px_0_#FAF6E9] self-start">
              Map
            </span>
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2 text-paper leading-tight">
              See where<br />the value sits
            </h3>
            <p className="text-sm font-medium text-paper/70 mb-6 leading-relaxed">
              All listings plotted across 7 suburbs, colour-coded by price band. Spot the affordable pockets without reading a single number.
            </p>
            {/* Price legend mockup */}
            <div className="mt-auto">
              <div className="text-[0.6875rem] font-black uppercase tracking-wider text-paper/40 mb-3">Price bands</div>
              <div className="flex flex-col gap-2.5">
                {[
                  { color: '#10b981', label: '≤ R15k' },
                  { color: '#f59e0b', label: 'R15k – R22k' },
                  { color: '#f97316', label: 'R22k – R35k' },
                  { color: '#ef4444', label: '> R35k' },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="w-4 h-4 border-2 border-paper/30 rounded-full flex-shrink-0" style={{ background: b.color }} />
                    <span className="text-xs font-bold text-paper/80">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CHARTS — 5 cols */}
          <div className="lg:col-span-5 border-[3px] border-ink bg-paper shadow-[4px_4px_0_#111111] p-6 flex flex-col">
            <span className="inline-block border-[3px] border-ink bg-lime text-ink text-xs font-black uppercase tracking-wider px-3 py-1 mb-5 shadow-[3px_3px_0_#111111] self-start">
              Charts
            </span>
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2 leading-tight">
              Track prices<br />over time
            </h3>
            <p className="text-sm font-medium text-ink/70 mb-6 leading-relaxed">
              Median R/m² per suburb, trend lines over scrape history, and price-vs-size scatter. See the direction before you commit.
            </p>
            {/* Bar chart mockup */}
            <div className="mt-auto border-[3px] border-ink bg-white p-3">
              <div className="text-[0.5625rem] font-black uppercase text-ink/40 tracking-wider mb-2">Median R/m² by suburb</div>
              <div className="flex items-end gap-1.5 h-16">
                {[
                  { sub: 'DW',  pct: '70', color: '#2563EB' },
                  { sub: 'GP',  pct: '55', color: '#10b981' },
                  { sub: 'SP',  pct: '85', color: '#FFD23F' },
                  { sub: 'Gdn', pct: '42', color: '#9333EA' },
                  { sub: 'WS',  pct: '36', color: '#f97316' },
                  { sub: 'CBD', pct: '62', color: '#06B6D4' },
                  { sub: 'Clmt',pct: '30', color: '#FF5436' },
                ].map(b => (
                  <div key={b.sub} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full border-[2px] border-ink"
                      style={{ height: `${b.pct}%`, background: b.color }}
                    />
                    <span className="text-[0.4375rem] font-black text-ink/50 leading-none">{b.sub}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI ANALYSIS — 7 cols */}
          <div className="lg:col-span-7 border-[3px] border-ink bg-white shadow-[6px_6px_0_#111111] p-6 flex flex-col">
            <span className="inline-block border-[3px] border-ink bg-bred text-white text-xs font-black uppercase tracking-wider px-3 py-1 mb-5 shadow-[3px_3px_0_#111111] self-start">
              AI Analysis
            </span>
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2 leading-tight">
              A written market read,<br />in 15 seconds
            </h3>
            <p className="text-sm font-medium text-ink/70 mb-6 leading-relaxed">
              Gemini 2.5 Flash reads the live listings and writes a 3-paragraph analyst report — value picks by suburb and bedroom count, supply patterns, and where to focus your search.
            </p>
            {/* Sample analysis excerpt */}
            <div className="mt-auto border-[3px] border-ink bg-paper p-4 text-sm leading-relaxed font-medium text-ink/80">
              <strong className="font-black text-ink">Gardens</strong> and{' '}
              <strong className="font-black text-ink">Woodstock</strong> deliver the strongest
              value right now. In <strong className="font-black text-ink">Gardens</strong>, the
              1-bedroom median sits at <strong className="font-black text-ink">R14 500</strong>,
              undercutting <strong className="font-black text-ink">Green Point</strong> (median{' '}
              <strong className="font-black text-ink">R21 000</strong>) by a margin that rarely
              persists beyond one scrape cycle.
              <span className="inline-block w-[8px] h-[16px] bg-ink ml-0.5 align-middle opacity-70" />
            </div>
            <div className="mt-3 text-[0.5625rem] font-bold text-neutral-400 uppercase tracking-wider">
              Sample output — your report reflects live listings
            </div>
          </div>

        </div>
      </section>

      {/* COVERAGE */}
      <section className="mb-20">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-5">
          7 suburbs, fully covered
        </h2>
        <div className="flex flex-wrap gap-3">
          {SUBURBS_LIST.map((s) => (
            <span
              key={s}
              className="border-[3px] border-ink bg-white px-4 py-2.5 text-sm font-bold shadow-[3px_3px_0_#111111] transition-all duration-75 hover:bg-lime hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111]"
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mb-20 scroll-mt-6 border-[3px] border-ink bg-paper shadow-[6px_6px_0_#111111] p-8 md:p-10">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-6">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <p className="text-base font-medium leading-relaxed text-ink/80 mb-4">
              On demand (up to once a day), the scraper pulls all residential rentals from Property24 across
              the 7 tracked suburbs. Each listing is cleaned, deduplicated, and scored for
              value against the suburb's median price per m².
            </p>
            <p className="text-base font-medium leading-relaxed text-ink/80">
              The result is a live, filterable dataset — not a property portal, but an analyst's
              view of the whole market in one place.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-4 border-[3px] border-ink bg-white p-4 shadow-[3px_3px_0_#111111]">
              <span className="font-black text-blue text-xl leading-none mt-0.5 select-none">1</span>
              <div>
                <div className="font-black text-sm uppercase tracking-tight mb-0.5">Scrape Property24</div>
                <div className="text-xs font-medium text-ink/60 leading-relaxed">Residential rentals across all 7 suburbs, refreshed once a day on demand</div>
              </div>
            </div>
            <div className="flex items-start gap-4 border-[3px] border-ink bg-white p-4 shadow-[3px_3px_0_#111111]">
              <span className="font-black text-blue text-xl leading-none mt-0.5 select-none">2</span>
              <div>
                <div className="font-black text-sm uppercase tracking-tight mb-0.5">Normalise & score</div>
                <div className="text-xs font-medium text-ink/60 leading-relaxed">Cleaned, deduplicated, and value-scored against suburb medians</div>
              </div>
            </div>
            <div className="flex items-start gap-4 border-[3px] border-ink bg-white p-4 shadow-[3px_3px_0_#111111]">
              <span className="font-black text-blue text-xl leading-none mt-0.5 select-none">3</span>
              <div>
                <div className="font-black text-sm uppercase tracking-tight mb-0.5">Explore & analyse</div>
                <div className="text-xs font-medium text-ink/60 leading-relaxed">Browse, filter, map, chart, and generate an AI market report</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="border-[3px] border-ink bg-ink text-paper shadow-[6px_6px_0_#111111] p-8 md:p-12 text-center">
        <h2 className="font-black uppercase leading-tight tracking-tight mb-4" style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)' }}>
          Ready to find your<span className="text-yellow"> next place?</span>
        </h2>
        <p className="text-paper/70 font-medium mb-8 max-w-[520px] mx-auto">
          Jump into the live dashboard. Data refreshes on demand — up to once a day.
        </p>
        <Link
          to="/dashboard"
          className="inline-block border-[3px] border-paper bg-yellow text-ink font-extrabold uppercase px-8 py-4 text-sm tracking-[0.5px] no-underline shadow-[6px_6px_0_#FAF6E9] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          Explore Live Listings →
        </Link>
      </section>

      <footer className="text-center mt-10 text-xs font-bold uppercase tracking-wider text-ink/50">
        Cape Town Rental.Intel · Residential rentals only · Built on Property24 data
      </footer>
    </div>
  );
}
