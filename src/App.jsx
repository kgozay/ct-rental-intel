import { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import ListingsTable from './components/ListingsTable';
import { SUBURBS_LIST } from './utils/suburbs';

const PriceChart = lazy(() => import('./components/PriceChart'));
const MapView = lazy(() => import('./components/MapView'));
const AIPanel = lazy(() => import('./components/AIPanel'));
const SuburbComparison = lazy(() => import('./components/SuburbComparison'));

export default function App() {
  const [listings, setListings] = useState([]);
  const [medians, setMedians] = useState({});
  const [history, setHistory] = useState([]);
  const [lastScraped, setLastScraped] = useState(null);

  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState('table');

  // Bedroom filter for the history chart (drives a separate /api/history fetch)
  const [historyBeds, setHistoryBeds] = useState(null);

  // Shortlist — persisted to localStorage
  const [shortlisted, setShortlisted] = useState(
    () => new Set(JSON.parse(localStorage.getItem('shortlist') || '[]'))
  );
  const toggleShortlist = (url) => {
    setShortlisted(prev => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      localStorage.setItem('shortlist', JSON.stringify([...next]));
      return next;
    });
  };

  // "New since last visit" — record when the user last opened the dashboard
  const [lastVisit] = useState(() => {
    const prev = localStorage.getItem('lastVisit');
    localStorage.setItem('lastVisit', new Date().toISOString());
    return prev;
  });

  const [filters, setFilters] = useState({
    suburbs: [...SUBURBS_LIST],
    maxPrice: 80000,
    minBeds: null,
    furnished: null,
    goodValueOnly: false,
    priceDropOnly: false,
    availableBefore: '',
    shortlistOnly: false,
  });

  const pollRef = useRef(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    let fetchedLastScraped = null;
    try {
      const listRes = await fetch('/api/listings');
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
    document.title = "Dashboard | Cape Town Rental Intel";
    Promise.resolve().then(() => {
      fetchData();
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Re-fetch history when the bedroom filter on the chart changes
  useEffect(() => {
    const url = historyBeds ? `/api/history?beds=${historyBeds}` : '/api/history';
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setHistory(data.history); })
      .catch(() => {});
  }, [historyBeds]);

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

  const filteredListings = useMemo(() => listings.filter(item => {
    if (filters.suburbs.length > 0 && !filters.suburbs.includes(item.suburb)) return false;
    if (item.price > filters.maxPrice) return false;
    if (filters.minBeds !== null && (item.bedrooms === null || item.bedrooms < filters.minBeds)) return false;
    if (filters.furnished !== null && item.furnished !== filters.furnished) return false;
    if (filters.goodValueOnly && (item.value_score === null || item.value_score <= 1.15)) return false;
    if (filters.priceDropOnly && !(item.previous_price && item.price < item.previous_price)) return false;
    if (filters.availableBefore && item.available_date && item.available_date > filters.availableBefore) return false;
    if (filters.shortlistOnly && !shortlisted.has(item.url)) return false;
    return true;
  }), [listings, filters, shortlisted]);

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

  const formatScrapeDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
  };

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      {/* BRAND HEADER BAR */}
      <header className="bg-ink text-paper border-[3px] border-ink shadow-[6px_6px_0_#111111] flex flex-wrap items-center justify-between px-6 py-4.5 mb-8 rounded-none select-none">
        <Link to="/" className="text-2xl font-black tracking-tight uppercase no-underline text-paper hover:opacity-90">
          Cape Town Rental<span className="text-yellow">.</span>Intel
        </Link>
        <div className="flex items-center gap-5 text-[0.8125rem] font-bold">
          <Link to="/" className="opacity-70 hover:opacity-100 no-underline text-paper uppercase tracking-wider">← Home</Link>
          <span className="opacity-80">Last scrape: {formatScrapeDate(lastScraped)}</span>
          <button
            onClick={handleRefresh}
            disabled={scraping}
            className="border-3 border-ink bg-yellow text-ink font-extrabold uppercase px-[1.125rem] py-[0.6875rem] text-[0.8125rem] tracking-[0.5px] cursor-pointer transition-all duration-75 select-none hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#111111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed"
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
      <div className="flex flex-wrap gap-3.5 mb-6 select-none">
        {[
          { id: 'table', label: 'Table' },
          { id: 'charts', label: 'Charts' },
          { id: 'map', label: 'Map' },
          { id: 'compare', label: 'Compare' },
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
        <div className="kpi-card bg-yellow border-[3px] border-ink shadow-[4px_4px_0_#111111] p-4 rounded-none">
          <div className="text-3xl md:text-[2.125rem] font-black line-clamp-1 leading-none text-ink">
            {filteredListings.length}
          </div>
          <div className="text-[0.6875rem] font-black uppercase tracking-wider text-ink/70 mt-1.5">
            Listings
          </div>
        </div>
        <div className="kpi-card bg-white border-[3px] border-ink shadow-[4px_4px_0_#111111] p-4 rounded-none">
          <div className="text-3xl md:text-[2.125rem] font-black line-clamp-1 leading-none text-ink">
            {activeSuburbsCount}
          </div>
          <div className="text-[0.6875rem] font-black uppercase tracking-wider text-ink/70 mt-1.5">
            Suburbs
          </div>
        </div>
        <div className="kpi-card bg-white border-[3px] border-ink shadow-[4px_4px_0_#111111] p-4 rounded-none">
          <div className="text-3xl md:text-[2.125rem] font-black line-clamp-1 leading-none text-ink">
            {medianRate}
          </div>
          <div className="text-[0.6875rem] font-black uppercase tracking-wider text-ink/70 mt-1.5">
            Median R/m²
          </div>
        </div>
        <div className="kpi-card bg-white border-[3px] border-ink shadow-[4px_4px_0_#111111] p-4 rounded-none">
          <div className="text-3xl md:text-[2.125rem] font-black line-clamp-1 leading-none text-ink">
            {shortlisted.size > 0 ? shortlisted.size : goodValueCount}
          </div>
          <div className="text-[0.6875rem] font-black uppercase tracking-wider text-ink/70 mt-1.5">
            {shortlisted.size > 0 ? 'Shortlisted' : 'Good Value'}
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
          <Suspense
            fallback={
              <div className="border-[3px] border-ink bg-white p-16 text-center shadow-[6px_6px_0_#111111]">
                <div className="text-neutral-400 font-extrabold text-lg animate-pulse">
                  ⏳ Loading view...
                </div>
              </div>
            }
          >
            {activeTab === 'table' && (
              <ListingsTable
                listings={listings}
                filteredListings={filteredListings}
                filters={filters}
                setFilters={setFilters}
                shortlisted={shortlisted}
                toggleShortlist={toggleShortlist}
                lastVisit={lastVisit}
              />
            )}

            {activeTab === 'charts' && (
              <PriceChart
                listings={filteredListings}
                history={history}
                historyBeds={historyBeds}
                setHistoryBeds={setHistoryBeds}
              />
            )}

            {activeTab === 'map' && (
              <MapView listings={filteredListings} />
            )}

            {activeTab === 'compare' && (
              <SuburbComparison
                listings={listings}
                history={history}
                medians={medians}
              />
            )}

            {activeTab === 'ai' && (
              <AIPanel
                filteredListings={filteredListings}
                filters={filters}
              />
            )}
          </Suspense>
        </main>
      )}
    </div>
  );
}
