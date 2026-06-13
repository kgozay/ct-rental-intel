import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import ListingsTable from './components/ListingsTable';
import MapView from './components/MapView';
import PriceChart from './components/PriceChart';
import AIPanel from './components/AIPanel';
import { SUBURBS_LIST } from './utils/suburbs';

export default function App() {
  const [listings, setListings] = useState([]);
  const [medians, setMedians] = useState({});
  const [history, setHistory] = useState([]);
  const [lastScraped, setLastScraped] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'info' | 'error', text }
  const [activeTab, setActiveTab] = useState('table');
  
  const [filters, setFilters] = useState({
    suburbs: [...SUBURBS_LIST],
    maxPrice: 80000,
    minBeds: null,
    furnished: null,
    goodValueOnly: false
  });

  // Bounded poll timer for the async scrape (cleared on unmount).
  const pollRef = useRef(null);

  // 1. Fetch latest listings and historical medians. Returns the lastScraped value
  //    so the scrape poll can detect when fresh data has landed. Pass silent=true to
  //    refresh data without flashing the full-page loading state.
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    let fetchedLastScraped = null;
    try {
      const listRes = await fetch('/api/listings?latestOnly=true');
      if (listRes.ok) {
        const listData = await listRes.json();
        setListings(listData.listings);
        setMedians(listData.medians);
        setLastScraped(listData.lastScraped);
        fetchedLastScraped = listData.lastScraped;
      }

      const histRes = await fetch('/api/history');
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.history);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      if (!silent) setLoading(false);
    }
    return fetchedLastScraped;
  };

  useEffect(() => {
    fetchData();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // 2. Refresh Listings — launches an async scrape. /api/scrape only STARTS the Apify
  //    runs; results arrive via webhook ingest over the next minute or two, so we poll
  //    the dashboard data until lastScraped advances (or we time out).
  const handleRefresh = async () => {
    if (scraping) return;
    setScraping(true);
    setNotice(null);
    const baselineLastScraped = lastScraped;
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.skipped) {
        // Cooldown active — data is still fresh, no Apify credits spent.
        const next = data.nextAllowed ? new Date(data.nextAllowed) : null;
        const nextText = next
          ? next.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '')
          : null;
        setNotice({
          type: 'info',
          text: `Listings are still fresh — a new scrape is skipped to save credits.${nextText ? ` Next refresh available ${nextText}.` : ''}`
        });
        setScraping(false);
      } else if (response.ok && data.started) {
        setNotice({
          type: 'info',
          text: 'Scrape started — new listings appear within a minute or two. Refreshing automatically…'
        });
        // Poll for fresh data: every 20s for up to ~2 min.
        if (pollRef.current) clearInterval(pollRef.current);
        let attempts = 0;
        const MAX_ATTEMPTS = 6;
        pollRef.current = setInterval(async () => {
          attempts += 1;
          const newLastScraped = await fetchData(true);
          const landed = newLastScraped && newLastScraped !== baselineLastScraped;
          if (landed || attempts >= MAX_ATTEMPTS) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setScraping(false);
            setNotice(landed
              ? { type: 'info', text: 'Listings updated with the latest scrape.' }
              : { type: 'info', text: 'Scrape is still running — data will update shortly. You can keep using the dashboard.' });
          }
        }, 20000);
      } else {
        setNotice({ type: 'error', text: 'Scraping request failed. Check API logs.' });
        setScraping(false);
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: 'Error starting scraper.' });
      setScraping(false);
    }
  };

  // 3. Client-side filtration logic (memoized — only recompute when data/filters change)
  const filteredListings = useMemo(() => listings.filter(item => {
    // Suburbs
    if (filters.suburbs.length > 0 && !filters.suburbs.includes(item.suburb)) return false;
    // Max Price
    if (item.price > filters.maxPrice) return false;
    // Min Beds
    if (filters.minBeds !== null && (item.bedrooms === null || item.bedrooms < filters.minBeds)) return false;
    // Furnished
    if (filters.furnished !== null && item.furnished !== filters.furnished) return false;
    // Good Value Only
    if (filters.goodValueOnly && (item.value_score === null || item.value_score <= 1.15)) return false;

    return true;
  }), [listings, filters]);

  // 4. Compute Top KPI Summaries Dynamically
  const activeSuburbsCount = new Set(filteredListings.map(l => l.suburb)).size;
  const goodValueCount = filteredListings.filter(l => l.value_score > 1.15).length;
  
  const rates = filteredListings.map(l => l.price_per_m2).filter(r => r !== null).sort((a, b) => a - b);
  let medianRate = '—';
  if (rates.length > 0) {
    const mid = Math.floor(rates.length / 2);
    medianRate = rates.length % 2 !== 0 
      ? `R ${rates[mid]}` 
      : `R ${Math.round((rates[mid - 1] + rates[mid]) / 2)}`;
  }

  // Format Date format to match mockup header
  const formatScrapeDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false };
    return date.toLocaleString('en-ZA', options).replace(',', '');
  };

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      {/* BRAND HEADER BAR */}
      <header className="bg-ink text-paper border-[3px] border-ink shadow-[6px_6px_0_#111111] flex flex-wrap items-center justify-between px-6 py-4.5 mb-8 rounded-none select-none">
        <Link to="/" className="text-2xl font-black tracking-tight uppercase no-underline text-paper hover:opacity-90">
          Cape Town Rental<span className="text-yellow">.</span>Intel
        </Link>
        <div className="flex items-center gap-5 text-[13px] font-bold">
          <Link to="/" className="opacity-70 hover:opacity-100 no-underline text-paper uppercase tracking-wider">← Home</Link>
          <span className="opacity-80">Last scrape: {formatScrapeDate(lastScraped)}</span>
          <button
            onClick={handleRefresh}
            disabled={scraping}
            className={`border-3 border-ink bg-yellow text-ink font-extrabold uppercase px-[18px] py-[11px] text-[13px] tracking-[0.5px] cursor-pointer transition-all duration-75 select-none hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed`}
          >
            {scraping ? '⏳ Scraping P24 (~120s)...' : '↻ Refresh Listings'}
          </button>
        </div>
      </header>

      {/* REFRESH NOTICE BANNER */}
      {notice && (
        <div
          className={`border-[3px] border-ink shadow-[4px_4px_0_#111111] px-5 py-3 mb-6 flex items-center justify-between font-bold text-sm ${
            notice.type === 'error' ? 'bg-bred text-white' : 'bg-lime text-ink'
          }`}
        >
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="font-black text-base px-2 cursor-pointer hover:opacity-70"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* DASHBOARD TAB CONTROLS */}
      <div className="flex gap-3.5 mb-6 select-none">
        {[
          { id: 'table', label: 'Table' },
          { id: 'charts', label: 'Charts' },
          { id: 'map', label: 'Map' },
          { id: 'ai', label: 'AI Analysis' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-[3px] border-ink font-extrabold uppercase text-sm px-6 py-2.5 cursor-pointer transition-all duration-75 ${
                isActive
                  ? 'bg-blue text-white translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0_#111111]'
                  : 'bg-paper text-ink shadow-[4px_4px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111111]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* KEY KPI CARDS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4.5 mb-7 select-none">
        <div className="bg-yellow border-[3px] border-ink shadow-[4px_4px_0_#111111] p-4 rounded-none">
          <div className="text-3xl md:text-[34px] font-black line-clamp-1 leading-none text-ink">
            {filteredListings.length}
          </div>
          <div className="text-[11px] font-black uppercase tracking-wider text-ink/70 mt-1.5">
            Listings
          </div>
        </div>
        <div className="bg-white border-[3px] border-ink shadow-[4px_4px_0_#111111] p-4 rounded-none">
          <div className="text-3xl md:text-[34px] font-black line-clamp-1 leading-none text-ink">
            {activeSuburbsCount}
          </div>
          <div className="text-[11px] font-black uppercase tracking-wider text-ink/70 mt-1.5">
            Suburbs
          </div>
        </div>
        <div className="bg-white border-[3px] border-ink shadow-[4px_4px_0_#111111] p-4 rounded-none">
          <div className="text-3xl md:text-[34px] font-black line-clamp-1 leading-none text-ink">
            {medianRate}
          </div>
          <div className="text-[11px] font-black uppercase tracking-wider text-ink/70 mt-1.5">
            Median R/m²
          </div>
        </div>
        <div className="bg-white border-[3px] border-ink shadow-[4px_4px_0_#111111] p-4 rounded-none">
          <div className="text-3xl md:text-[34px] font-black line-clamp-1 leading-none text-ink">
            {goodValueCount}
          </div>
          <div className="text-[11px] font-black uppercase tracking-wider text-ink/70 mt-1.5">
            Good Value
          </div>
        </div>
      </div>

      {/* RENDER VIEW TAB CONTENT */}
      {loading ? (
        <div className="border-[3px] border-ink bg-white p-16 text-center shadow-[6px_6px_0_#111111]">
          <div className="text-neutral-400 font-extrabold text-lg animate-pulse">
            ⏳ Loading Cape Town Rental Intelligence Dashboard...
          </div>
        </div>
      ) : (
        <main>
          {activeTab === 'table' && (
            <ListingsTable
              listings={listings}
              filteredListings={filteredListings}
              filters={filters}
              setFilters={setFilters}
            />
          )}

          {activeTab === 'charts' && (
            <PriceChart
              listings={filteredListings}
              history={history}
            />
          )}

          {activeTab === 'map' && (
            <MapView
              listings={filteredListings}
            />
          )}

          {activeTab === 'ai' && (
            <AIPanel
              filteredListings={filteredListings}
              filters={filters}
            />
          )}
        </main>
      )}
    </div>
  );
}
