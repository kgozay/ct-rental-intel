import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SUBURBS_LIST } from '../utils/suburbs';

const FEATURES = [
  {
    tag: 'Table',
    color: 'bg-yellow',
    title: 'Filterable listings',
    body: 'Every residential rental across 7 suburbs in one sortable table — filter by price, beds, furnishing and value, with price-drop flags.'
  },
  {
    tag: 'Charts',
    color: 'bg-lime',
    title: 'Price intelligence',
    body: 'Median R/m² by suburb and price trends over time, so you can see where the market is moving before you commit.'
  },
  {
    tag: 'Map',
    color: 'bg-blue text-white',
    title: 'Geographic view',
    body: 'Listings plotted on an interactive map, colour-banded by price — spot the value pockets at a glance.'
  },
  {
    tag: 'AI',
    color: 'bg-bred text-white',
    title: 'Market analysis',
    body: 'A data-driven written report that reads the current listings and tells you where the value and the anomalies are.'
  }
];

const STEPS = [
  { n: '01', title: 'Scrape Property24', body: 'Live residential rental listings pulled across all 7 suburbs.' },
  { n: '02', title: 'Normalise & score', body: 'Cleaned, deduplicated, and scored for value against suburb medians.' },
  { n: '03', title: 'Explore & analyse', body: 'Browse, filter, map, chart, and generate an AI market report.' }
];

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
    document.title = "Cape Town Rental Intelligence — Neo-Brutalist Property Dashboard";
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
    { num: stats ? stats.total : '7', lbl: 'Live listings', accent: true },
    { num: stats ? stats.suburbs : SUBURBS_LIST.length, lbl: 'Suburbs tracked' },
    { num: stats && stats.medianRate ? `R${stats.medianRate}` : 'R/m²', lbl: 'Median R/m²' },
    { num: stats ? stats.goodValue : '✦', lbl: 'Good-value finds' }
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
            className="border-[3px] border-ink bg-paper text-ink font-extrabold px-3 py-2 cursor-pointer hover:bg-neutral-100 transition-all select-none text-sm leading-none flex items-center justify-center rounded-none shadow-[3px_3px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            aria-label="Toggle theme mode"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link
            to="/dashboard"
            className="border-[3px] border-ink bg-ink text-paper font-extrabold uppercase px-4 py-2 text-xs tracking-wider no-underline shadow-[4px_4px_0_#111111] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111]"
          >
            Open dashboard →
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
            Launch Dashboard →
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
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4.5 mb-20">
        {statCards.map((s, i) => (
          <div
            key={s.lbl}
            className={`fade-up border-[3px] border-ink shadow-[4px_4px_0_#111111] p-5 ${s.accent ? 'bg-yellow' : 'bg-white'}`}
            style={{ animationDelay: `${300 + i * 70}ms` }}
          >
            <div className="text-3xl md:text-[2.375rem] font-black leading-none text-ink line-clamp-1">
              {s.num}
            </div>
            <div className="text-[0.6875rem] font-black uppercase tracking-wider text-ink/70 mt-2">
              {s.lbl}
            </div>
          </div>
        ))}
      </section>

      {/* FEATURE GRID */}
      <section className="mb-20">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-[1px] px-3 py-1.5 mb-7">
          Four ways to read the market
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.tag}
              className="border-[3px] border-ink bg-white shadow-[6px_6px_0_#111111] p-6 transition-all duration-75 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_#111111]"
            >
              <span className={`inline-block border-[3px] border-ink ${f.color} text-xs font-black uppercase tracking-wider px-3 py-1 mb-4 shadow-[3px_3px_0_#111111]`}>
                {f.tag}
              </span>
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">{f.title}</h3>
              <p className="text-[0.9375rem] font-medium leading-relaxed text-ink/80">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COVERAGE */}
      <section className="mb-20">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-[1px] px-3 py-1.5 mb-7">
          7 suburbs, fully covered
        </h2>
        <div className="flex flex-wrap gap-3">
          {SUBURBS_LIST.map((s) => (
            <span
              key={s}
              className="border-[3px] border-ink bg-white px-4 py-2.5 text-sm font-bold shadow-[3px_3px_0_#111111] transition-all duration-75 hover:bg-lime hover:translate-x-[-1px] hover:translate-y-[-1px]"
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mb-20 scroll-mt-6">
        <h2 className="inline-block bg-ink text-paper text-xs font-black uppercase tracking-[1px] px-3 py-1.5 mb-7">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step) => (
            <div key={step.n} className="border-[3px] border-ink bg-paper shadow-[4px_4px_0_#111111] p-6">
              <div className="text-5xl font-black text-blue leading-none mb-4">{step.n}</div>
              <h3 className="text-lg font-black uppercase tracking-tight mb-2">{step.title}</h3>
              <p className="text-sm font-medium leading-relaxed text-ink/80">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="border-[3px] border-ink bg-ink text-paper shadow-[6px_6px_0_#111111] p-8 md:p-12 text-center">
        <h2 className="font-black uppercase leading-tight tracking-tight mb-4" style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)' }}>
          Ready to find your<span className="text-yellow"> next place?</span>
        </h2>
        <p className="text-paper/70 font-medium mb-8 max-w-[520px] mx-auto">
          Jump straight into the live dashboard. Data refreshes every few days, automatically.
        </p>
        <Link
          to="/dashboard"
          className="inline-block border-[3px] border-paper bg-yellow text-ink font-extrabold uppercase px-8 py-4 text-sm tracking-[0.5px] no-underline shadow-[6px_6px_0_#FAF6E9] transition-all duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          Launch Dashboard →
        </Link>
      </section>

      <footer className="text-center mt-10 text-xs font-bold uppercase tracking-wider text-ink/50">
        Cape Town Rental.Intel · Residential rentals only · Built on Property24 data
      </footer>
    </div>
  );
}
