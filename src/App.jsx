import { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import ListingsTable from './components/ListingsTable';
import SearchIntentBar from './components/SearchIntentBar';
import ResultsToolbar from './components/ResultsToolbar';
import ListingCardView from './components/ListingCardView';
import FirstRunState from './components/FirstRunState';
import DataStatusBar from './components/DataStatusBar';
import ShortlistWorkspace from './components/ShortlistWorkspace';
import SavedSearchesModal from './components/SavedSearchesModal';
import { SUBURBS_LIST } from './utils/suburbs';
import { exportCsv } from './utils/exportCsv';
import {
  loadUserData,
  addShortlistItem,
  removeShortlistItem,
  updateItemNote,
  saveSearchConfig,
  deleteSearchConfig,
  renameSearchConfig,
} from './utils/userStorage';

const PriceChart = lazy(() => import('./components/PriceChart'));
const MapView = lazy(() => import('./components/MapView'));
const AIPanel = lazy(() => import('./components/AIPanel'));
const SuburbComparison = lazy(() => import('./components/SuburbComparison'));
const ListingDrawer = lazy(() => import('./components/ListingDrawer'));

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [listings, setListings] = useState([]);
  const [history, setHistory] = useState([]);
  const [lastScraped, setLastScraped] = useState(null);
  const [dataStatus, setDataStatus] = useState(null);

  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const valid = ['table', 'cards', 'map', 'charts', 'compare', 'ai', 'shortlist'];
      return valid.includes(view) ? view : 'table';
    } catch {
      return 'table';
    }
  });
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  // Bedroom filter for the history chart (drives a separate /api/history fetch)
  const [historyBeds, setHistoryBeds] = useState(null);

  // Versioned User Data (Shortlist, Notes, Snapshots, Saved Searches)
  const [userData, setUserData] = useState(() => loadUserData());
  const shortlisted = useMemo(() => new Set(Object.keys(userData?.items || {})), [userData]);

  const toggleShortlist = (url, listing = null) => {
    if (shortlisted.has(url)) {
      setUserData(prev => removeShortlistItem(prev, url));
    } else {
      const item = listing || listings.find(l => l.url === url);
      setUserData(prev => addShortlistItem(prev, url, item));
    }
  };

  const handleUpdateNote = (url, note) => {
    setUserData(prev => updateItemNote(prev, url, note));
  };

  // Saved searches state & handlers
  const [showSavedSearchesModal, setShowSavedSearchesModal] = useState(false);
  const [recentlyDeletedSearch, setRecentlyDeletedSearch] = useState(null);

  const handleSaveCurrentSearch = (name) => {
    const { updated } = saveSearchConfig(userData, name, filters);
    setUserData(updated);
  };

  const handleDeleteSearch = (id) => {
    const { updated, deletedEntry } = deleteSearchConfig(userData, id);
    setUserData(updated);
    setRecentlyDeletedSearch(deletedEntry);
  };

  const handleUndoDeleteSearch = () => {
    if (!recentlyDeletedSearch) return;
    const { updated } = saveSearchConfig(userData, recentlyDeletedSearch.name, recentlyDeletedSearch.filters);
    setUserData(updated);
    setRecentlyDeletedSearch(null);
  };

  const handleRenameSearch = (id, newName) => {
    setUserData(prev => renameSearchConfig(prev, id, newName));
  };

  const handleApplySearch = (savedFilters) => {
    setFilters(prev => ({
      ...prev,
      ...savedFilters,
    }));
  };

  // "New since last visit" — record when the user last opened the dashboard
  const [lastVisit] = useState(() => {
    const prev = localStorage.getItem('lastVisit');
    localStorage.setItem('lastVisit', new Date().toISOString());
    return prev;
  });

  const [filters, setFilters] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const subParam = params.get('suburbs');
      const maxP = params.get('maxPrice');
      const beds = params.get('minBeds');
      const furn = params.get('furnished');
      const q = params.get('search');
      return {
        search: q || '',
        suburbs: subParam ? subParam.split(',').filter(s => SUBURBS_LIST.includes(s)) : [...SUBURBS_LIST],
        maxPrice: maxP ? parseInt(maxP, 10) : 80000,
        minBeds: beds ? parseInt(beds, 10) : null,
        furnished: furn === 'true' ? true : furn === 'false' ? false : null,
        goodValueOnly: params.get('goodValue') === 'true',
        priceDropOnly: params.get('priceDrop') === 'true',
        availableBefore: params.get('avail') || '',
        shortlistOnly: params.get('shortlist') === 'true',
      };
    } catch {
      return {
        search: '',
        suburbs: [...SUBURBS_LIST],
        maxPrice: 80000,
        minBeds: null,
        furnished: null,
        goodValueOnly: false,
        priceDropOnly: false,
        availableBefore: '',
        shortlistOnly: false,
      };
    }
  });

  // Keep URL in sync with active filters and view for shareable deep links
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      if (activeTab && activeTab !== 'table') params.set('view', activeTab);
      if (filters.search) params.set('search', filters.search);
      if (filters.suburbs.length < SUBURBS_LIST.length) params.set('suburbs', filters.suburbs.join(','));
      if (filters.maxPrice < 80000) params.set('maxPrice', String(filters.maxPrice));
      if (filters.minBeds !== null) params.set('minBeds', String(filters.minBeds));
      if (filters.furnished !== null) params.set('furnished', String(filters.furnished));
      if (filters.goodValueOnly) params.set('goodValue', 'true');
      if (filters.priceDropOnly) params.set('priceDrop', 'true');
      if (filters.availableBefore) params.set('avail', filters.availableBefore);
      if (filters.shortlistOnly) params.set('shortlist', 'true');

      const query = params.toString();
      const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      window.history.replaceState(null, '', nextUrl);
    } catch (err) {
      console.debug('Failed to sync filters to URL state:', err);
    }
  }, [filters, activeTab]);

  const pollRef = useRef(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    let fetchedLastScraped = null;
    try {
      const listUrl = silent ? `/api/listings?_t=${Date.now()}` : '/api/listings';
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const listData = await listRes.json();
        setListings(listData.listings || []);
        setLastScraped(listData.lastScraped);
        setDataStatus(listData.dataStatus || null);
        fetchedLastScraped = listData.lastScraped;
      }

      const histRes = await fetch('/api/history');
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(Array.isArray(histData.history) ? histData.history : []);
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
      .then(data => { if (data) setHistory(Array.isArray(data.history) ? data.history : []); })
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
          text: `Data is still fresh — updates are limited to once every 2 days (48h cooldown).${nextText ? ` Next snapshot available ${nextText}.` : ''}`
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
        setNotice({ type: 'error', text: 'Scrape failed to start — this is usually an Apify quota or API key issue. Try again in a few minutes.' });
        setScraping(false);
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: 'Error starting scraper.' });
      setScraping(false);
    }
  };

  const filteredListings = useMemo(() => listings.filter(item => {
    // Search query filter
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      const matchAddress = item.address && item.address.toLowerCase().includes(q);
      const matchSuburb = item.suburb && item.suburb.toLowerCase().includes(q);
      const matchType = item.property_type && item.property_type.toLowerCase().includes(q);
      const matchAgency = item.agency_name && item.agency_name.toLowerCase().includes(q);
      if (!matchAddress && !matchSuburb && !matchType && !matchAgency) return false;
    }
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

  const displayedListings = useMemo(() => {
    if (activeTab === 'shortlist') {
      return filteredListings.filter(l => shortlisted.has(l.url));
    }
    return filteredListings;
  }, [filteredListings, activeTab, shortlisted]);

  const activeSecondaryFilterCount = useMemo(() => {
    let count = 0;
    if (filters.furnished !== null) count++;
    if (filters.goodValueOnly) count++;
    if (filters.priceDropOnly) count++;
    if (filters.availableBefore) count++;
    return count;
  }, [filters]);

  const goodValueCount = filteredListings.filter(l => l.value_score > 1.15).length;
  const isFiltered = filteredListings.length !== listings.length;

  const rates = filteredListings.map(l => l.price_per_m2).filter(r => r !== null).sort((a, b) => a - b);
  let medianRate = '—';
  if (rates.length > 0) {
    const mid = Math.floor(rates.length / 2);
    medianRate = rates.length % 2 !== 0
      ? `R ${rates[mid]}`
      : `R ${Math.round((rates[mid - 1] + rates[mid]) / 2)}`;
  }

  const suburbMedianPrices = useMemo(() => {
    const groups = {};
    listings.forEach(l => {
      if (typeof l.price === 'number' && l.price > 0) {
        if (!groups[l.suburb]) groups[l.suburb] = [];
        groups[l.suburb].push(l.price);
      }
    });
    const result = {};
    Object.entries(groups).forEach(([suburb, prices]) => {
      const sorted = [...prices].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      result[suburb] = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    });
    return result;
  }, [listings]);

  const isFirstRun = !loading && (dataStatus?.state === 'empty' || (listings.length === 0 && !lastScraped));

  const handleDrillDown = (suburb, beds) => {
    setFilters(prev => ({ ...prev, suburbs: [suburb], minBeds: beds }));
    setActiveTab('table');
  };

  const formatScrapeDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
  };

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      {/* BRAND HEADER BAR */}
      <header className="bg-ink text-paper border-2 border-ink shadow-[4px_4px_0_#111111] flex flex-wrap items-center justify-between px-5 py-3.5 mb-6 rounded-none select-none">
        <Link to="/" className="text-xl md:text-2xl font-black tracking-tight uppercase no-underline text-paper hover:opacity-90">
          Cape Town Rental<span className="text-yellow">.</span>Intel
        </Link>
        <div className="flex items-center gap-3 text-[0.8125rem] font-bold flex-wrap">
          <Link to="/" className="opacity-70 hover:opacity-100 no-underline text-paper uppercase tracking-wider text-xs">← Home</Link>
          <span className="opacity-75 text-xs">Scraped: {formatScrapeDate(lastScraped)}</span>
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="border-2 border-paper bg-paper text-ink font-extrabold px-2.5 py-1 cursor-pointer hover:bg-neutral-100 transition-all select-none text-xs leading-none flex items-center justify-center rounded-none shadow-[2px_2px_0_#FAF6E9]"
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={scraping}
            className="border-2 border-ink bg-yellow text-ink font-black uppercase px-3 py-1.5 text-xs tracking-wide cursor-pointer transition-all duration-75 select-none hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed"
          >
            {scraping ? '⏳ Scraping P24...' : '↻ Refresh'}
          </button>
        </div>
      </header>

      {/* VISIBLE DATA STATUS & PROVENANCE BAR */}
      <DataStatusBar
        dataStatus={dataStatus}
        onRefresh={handleRefresh}
        isRefreshing={scraping}
        feedbackMessage={notice ? { type: notice.type === 'error' ? 'error' : 'info', message: notice.text } : null}
        onClearFeedback={() => setNotice(null)}
      />

      {/* FIRST RUN EMPTY STATE */}
      {isFirstRun ? (
        <FirstRunState onStartScrape={handleRefresh} isStarting={scraping} />
      ) : (
        <>
          {/* SEARCH INTENT BAR */}
          <SearchIntentBar
            filters={filters}
            setFilters={setFilters}
            listings={listings}
            onToggleMoreFilters={() => setShowMoreFilters(prev => !prev)}
            showMoreFilters={showMoreFilters}
            activeSecondaryFilterCount={activeSecondaryFilterCount}
            onOpenSavedSearches={() => setShowSavedSearchesModal(true)}
            savedSearchesCount={userData?.savedSearches?.length || 0}
          />

          {/* 3 STABLE KPI BENCHMARKS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 select-none">
            <div className="kpi-card bg-yellow border-2 border-ink shadow-[3px_3px_0_#111111] p-3.5">
              <div className="text-2xl md:text-3xl font-black font-mono tabular-nums leading-none text-ink">
                {displayedListings.length}
              </div>
              <div className="text-[11px] font-black uppercase tracking-wider text-ink/70 mt-1.5">
                Matching Rentals{isFiltered ? ' (filtered)' : ''}
              </div>
            </div>

            <div className="kpi-card bg-white border-2 border-ink shadow-[3px_3px_0_#111111] p-3.5">
              <div className="text-2xl md:text-3xl font-black font-mono tabular-nums leading-none text-ink">
                {goodValueCount}
              </div>
              <div className="text-[11px] font-black uppercase tracking-wider text-ink/70 mt-1.5">
                Value Opportunities
              </div>
            </div>

            <div className="kpi-card bg-white border-2 border-ink shadow-[3px_3px_0_#111111] p-3.5">
              <div className="text-2xl md:text-3xl font-black font-mono tabular-nums leading-none text-ink">
                {medianRate}
              </div>
              <div className="text-[11px] font-black uppercase tracking-wider text-ink/70 mt-1.5">
                Median Rate (R/m²)
              </div>
            </div>
          </div>

          {/* RESULTS TOOLBAR */}
          <ResultsToolbar
            totalCount={displayedListings.length}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            shortlistedCount={shortlisted.size}
            onExportCsv={() => exportCsv(displayedListings)}
            showExport={activeTab === 'table' || activeTab === 'cards' || activeTab === 'shortlist'}
          />

          {/* RENDER VIEW TAB CONTENT */}
          {loading ? (
            <div className="border-[3px] border-ink bg-white p-6 shadow-[6px_6px_0_#111111] animate-pulse">
              <div className="flex justify-between items-center mb-6">
                <div className="h-6 w-48 bg-neutral-200 border border-ink/20" />
                <div className="h-6 w-32 bg-neutral-200 border border-ink/20" />
              </div>
              <div className="space-y-3 mb-6">
                <div className="h-10 bg-neutral-100 border border-ink/10 w-full" />
                <div className="h-10 bg-neutral-100 border border-ink/10 w-full" />
                <div className="h-10 bg-neutral-100 border border-ink/10 w-full" />
                <div className="h-10 bg-neutral-100 border border-ink/10 w-full" />
              </div>
              <div className="text-center text-neutral-400 font-black text-xs uppercase tracking-wider py-2">
                ✦ Fetching live rental market intelligence...
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
                    filteredListings={displayedListings}
                    filters={filters}
                    setFilters={setFilters}
                    shortlisted={shortlisted}
                    toggleShortlist={toggleShortlist}
                    lastVisit={lastVisit}
                    onSelectListing={setSelectedListing}
                    selectedListingUrl={selectedListing?.url}
                  />
                )}

                {activeTab === 'cards' && (
                  <ListingCardView
                    listings={displayedListings}
                    onSelectListing={setSelectedListing}
                    shortlisted={shortlisted}
                    onToggleShortlist={toggleShortlist}
                  />
                )}

                {activeTab === 'shortlist' && (
                  <ShortlistWorkspace
                    shortlistedUrls={shortlisted}
                    userData={userData}
                    allListings={listings}
                    onToggleShortlist={toggleShortlist}
                    onUpdateNote={handleUpdateNote}
                    onSelectListing={setSelectedListing}
                  />
                )}

                {activeTab === 'charts' && (
                  <PriceChart
                    listings={filteredListings}
                    history={history}
                    historyBeds={historyBeds}
                    setHistoryBeds={setHistoryBeds}
                    onDrillDown={handleDrillDown}
                    theme={theme}
                  />
                )}

                {activeTab === 'map' && (
                  <MapView
                    listings={filteredListings}
                    theme={theme}
                    onSelectListing={setSelectedListing}
                    onFilterSuburb={(suburb) => {
                      setFilters(prev => ({ ...prev, suburbs: [suburb] }));
                      setActiveTab('table');
                    }}
                  />
                )}

                {activeTab === 'compare' && (
                  <SuburbComparison
                    listings={filteredListings}
                    history={history}
                    onDrillDown={handleDrillDown}
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
        </>
      )}
      {/* LISTING DETAIL DRAWER */}
      {selectedListing && (
        <Suspense fallback={null}>
          <ListingDrawer
            listing={selectedListing}
            suburbMedianPrices={suburbMedianPrices}
            shortlisted={shortlisted}
            toggleShortlist={toggleShortlist}
            onClose={() => setSelectedListing(null)}
          />
        </Suspense>
      )}

      {/* SAVED SEARCHES MODAL */}
      <SavedSearchesModal
        isOpen={showSavedSearchesModal}
        onClose={() => setShowSavedSearchesModal(false)}
        currentFilters={filters}
        savedSearches={userData?.savedSearches || []}
        onSaveCurrentSearch={handleSaveCurrentSearch}
        onApplySearch={handleApplySearch}
        onDeleteSearch={handleDeleteSearch}
        onRenameSearch={handleRenameSearch}
        onUndoDelete={handleUndoDeleteSearch}
        recentlyDeleted={recentlyDeletedSearch}
      />
    </div>
  );
}
