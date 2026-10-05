import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import ListingsTable from './components/ListingsTable';
import SearchIntentBar from './components/SearchIntentBar';
import ResultsToolbar from './components/ResultsToolbar';
import { VIEW_TABS } from './constants/views';
import ListingCardView from './components/ListingCardView';
import FirstRunState from './components/FirstRunState';
import DataStatusBar from './components/DataStatusBar';
import ShortlistWorkspace from './components/ShortlistWorkspace';
import SavedSearchesModal from './components/SavedSearchesModal';
import Icon from './components/Icon';
import { useRentalData } from './hooks/useRentalData';
import { exportCsv } from './utils/exportCsv';
import { getInitialTheme, applyTheme } from './utils/theme';
import { buildComparables, getListingValuation, isValueOpportunity } from './utils/valuation';
import {
  matchesFilters,
  sortListings,
  sortFromId,
  sortToId,
  filtersFromSearch,
  filtersToParams,
  normaliseFilters,
} from './utils/filters';
import { DEFAULT_FILTERS, DEFAULT_SORT } from './constants/filterConstants';
import {
  loadUserData,
  addShortlistItem,
  removeShortlistItem,
  restoreShortlistItem,
  updateItemNote,
  saveSearchConfig,
  deleteSearchConfig,
  restoreSearchConfig,
  renameSearchConfig,
  markSearchViewed,
} from './utils/userStorage';

const PriceChart = lazy(() => import('./components/PriceChart'));
const MapView = lazy(() => import('./components/MapView'));
const AIPanel = lazy(() => import('./components/AIPanel'));
const SuburbComparison = lazy(() => import('./components/SuburbComparison'));
const ListingDrawer = lazy(() => import('./components/ListingDrawer'));

const VALID_VIEWS = VIEW_TABS.map(t => t.id);
const MOBILE_QUERY = '(max-width: 767px)';

function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function readInitialUrlState() {
  try {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const isMobile = window.matchMedia?.(MOBILE_QUERY).matches;
    const shared = (params.get('shared') || '').split(',').map(s => s.trim()).filter(Boolean);
    return {
      // Wide tables are hard to read on phones, so default to cards there.
      view: VALID_VIEWS.includes(view) ? view : isMobile ? 'cards' : 'table',
      filters: filtersFromSearch(window.location.search),
      sort: params.get('sort') ? sortFromId(params.get('sort')) : { ...DEFAULT_SORT },
      shared,
    };
  } catch {
    return { view: 'table', filters: { ...DEFAULT_FILTERS }, sort: { ...DEFAULT_SORT }, shared: [] };
  }
}

const fmtRate = (n) => (n == null ? '—' : `R${n.toLocaleString('en-ZA')}`);

export default function App() {
  const [initialUrl] = useState(readInitialUrlState);

  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    applyTheme(theme, false);
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    setTheme(next);
  };

  const {
    listings,
    dataStatus,
    loading,
    refreshing,
    feedbackMessage,
    setFeedbackMessage,
    refetch,
    triggerRefresh,
  } = useRentalData({ pollWhileRefreshing: true });

  const [history, setHistory] = useState([]);
  const [historyBeds, setHistoryBeds] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const url = historyBeds ? `/api/history?beds=${historyBeds}` : '/api/history';
    fetch(url, { signal: controller.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data) setHistory(Array.isArray(data.history) ? data.history : []); })
      .catch(() => {});
    return () => controller.abort();
  }, [historyBeds]);

  const [activeTab, setActiveTab] = useState(initialUrl.view);
  const [filters, setFilters] = useState(initialUrl.filters);
  const [sort, setSort] = useState(initialUrl.sort);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selected, setSelected] = useState(null);
  const resetFilters = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), []);

  useEffect(() => {
    document.title = 'Dashboard | Cape Town Rental Intel';
  }, []);

  // "New since last visit"
  const [lastVisit] = useState(() => {
    try {
      const prev = localStorage.getItem('lastVisit');
      localStorage.setItem('lastVisit', new Date().toISOString());
      return prev;
    } catch {
      return null;
    }
  });

  // Keep the URL in sync for shareable deep links.
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      if (activeTab) params.set('view', activeTab);
      filtersToParams(filters, params);
      if (sortToId(sort) !== sortToId(DEFAULT_SORT)) params.set('sort', sortToId(sort));
      const query = params.toString();
      window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
    } catch (err) {
      console.debug('Failed to sync filters to URL state:', err);
    }
  }, [filters, activeTab, sort]);

  // ---- Valuation evidence -------------------------------------------------
  const comparables = useMemo(() => buildComparables(listings), [listings]);
  const enriched = useMemo(
    () => listings.map(l => ({ ...l, valuation: getListingValuation(l, comparables) })),
    [listings, comparables]
  );
  const byUrl = useMemo(() => new Map(enriched.map(l => [l.url, l])), [enriched]);

  // Like-for-like rent medians (suburb + bedrooms) for the drawer and AI read.
  const rentMedians = useMemo(() => {
    const groups = {};
    for (const l of listings) {
      if (typeof l.price !== 'number' || l.price <= 0) continue;
      (groups[`${l.suburb}|${l.bedrooms ?? 'na'}`] ||= []).push(l.price);
      (groups[`${l.suburb}|all`] ||= []).push(l.price);
    }
    const out = {};
    for (const [k, v] of Object.entries(groups)) out[k] = { median: median(v), n: v.length };
    return out;
  }, [listings]);

  // ---- User data: shortlist, notes, saved searches -------------------------
  const [userData, setUserData] = useState(loadUserData);
  const shortlisted = useMemo(() => new Set(Object.keys(userData?.items || {})), [userData]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast]);

  const toggleShortlist = (url, listing = null) => {
    if (shortlisted.has(url)) {
      const entry = userData.items[url];
      setUserData(prev => removeShortlistItem(prev, url));
      setToast({
        message: 'Removed from shortlist',
        undo: () => setUserData(prev => restoreShortlistItem(prev, url, entry)),
      });
    } else {
      const item = listing || byUrl.get(url);
      setUserData(prev => addShortlistItem(prev, url, item));
    }
  };

  const handleUpdateNote = (url, note) => setUserData(prev => updateItemNote(prev, url, note));

  // Shared shortlist links (?shared=<listing ids>)
  const [sharedIds, setSharedIds] = useState(initialUrl.shared);
  const sharedListings = useMemo(
    () => (sharedIds.length ? enriched.filter(l => l.listing_id && sharedIds.includes(String(l.listing_id))) : []),
    [enriched, sharedIds]
  );
  const importShared = () => {
    setUserData(prev => sharedListings.reduce((acc, l) => (acc.items?.[l.url] ? acc : addShortlistItem(acc, l.url, l)), prev));
    setSharedIds([]);
    setActiveTab('shortlist');
    setToast({ message: `Added ${sharedListings.length} shared listing${sharedListings.length === 1 ? '' : 's'} to your shortlist` });
  };

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
    setUserData(prev => restoreSearchConfig(prev, recentlyDeletedSearch));
    setRecentlyDeletedSearch(null);
  };
  const handleRenameSearch = (id, newName) => setUserData(prev => renameSearchConfig(prev, id, newName));
  const handleApplySearch = (search) => {
    setFilters(normaliseFilters(search.filters));
    setUserData(prev => markSearchViewed(prev, search.id));
  };

  const savedSearches = useMemo(() => userData?.savedSearches || [], [userData]);
  const savedSearchCounts = useMemo(() => {
    const out = {};
    for (const s of savedSearches) {
      const since = s.lastViewedAt || s.createdAt;
      let total = 0;
      let fresh = 0;
      for (const l of enriched) {
        if (!matchesFilters(l, s.filters, { shortlisted })) continue;
        total++;
        if (since && l.created_at && l.created_at > since) fresh++;
      }
      out[s.id] = { total, fresh };
    }
    return out;
  }, [savedSearches, enriched, shortlisted]);
  const savedSearchNewCount = Object.values(savedSearchCounts).reduce((sum, c) => sum + c.fresh, 0);

  // ---- Results -------------------------------------------------------------
  const filteredListings = useMemo(
    () => enriched.filter(item => matchesFilters(item, filters, { shortlisted })),
    [enriched, filters, shortlisted]
  );
  const sortedListings = useMemo(() => sortListings(filteredListings, sort), [filteredListings, sort]);

  const handleHeaderSort = (field) => {
    setSort(prev => (prev.field === field
      ? { field, asc: !prev.asc }
      : { field, asc: !['value_score', 'size_m2'].includes(field) }));
  };

  const activeSecondaryFilterCount = [
    filters.minPrice > 0,
    filters.minSize > 0,
    filters.minBaths !== null,
    filters.propertyTypes.length > 0,
    filters.furnished !== null,
    filters.goodValueOnly,
    filters.priceDropOnly,
    Boolean(filters.availableBefore),
  ].filter(Boolean).length;

  const valueCount = filteredListings.filter(l => isValueOpportunity(l.valuation)).length;
  const medianRate = median(filteredListings.map(l => l.price_per_m2).filter(r => typeof r === 'number' && r > 0));
  const newCount = lastVisit ? filteredListings.filter(l => l.created_at && l.created_at > lastVisit).length : 0;

  // ---- Drawer --------------------------------------------------------------
  const shortlistNavList = useMemo(
    () => sortListings(enriched.filter(l => shortlisted.has(l.url)), sort),
    [enriched, shortlisted, sort]
  );
  const navList = activeTab === 'shortlist' ? shortlistNavList : sortedListings;
  const current = selected ? byUrl.get(selected.url) || selected : null;
  const navIndex = current ? navList.findIndex(l => l.url === current.url) : -1;
  const goPrev = navIndex > 0 ? () => setSelected(navList[navIndex - 1]) : null;
  const goNext = navIndex >= 0 && navIndex < navList.length - 1 ? () => setSelected(navList[navIndex + 1]) : null;
  const closeDrawer = useCallback(() => setSelected(null), []);

  const drawerMedian = (() => {
    if (!current) return { median: null, label: 'median' };
    const like = rentMedians[`${current.suburb}|${current.bedrooms ?? 'na'}`];
    if (current.bedrooms != null && like && like.n >= 3) {
      return { median: like.median, label: current.bedrooms === 0 ? 'studio median' : `${current.bedrooms}-bed median` };
    }
    return { median: rentMedians[`${current.suburb}|all`]?.median ?? null, label: 'median rent (all sizes)' };
  })();

  const handleDrillDown = (suburb, beds) => {
    setFilters(prev => ({ ...prev, suburbs: [suburb], minBeds: beds }));
    setActiveTab(window.matchMedia?.(MOBILE_QUERY).matches ? 'cards' : 'table');
  };

  const isUnavailable = !loading && dataStatus?.state === 'unavailable' && listings.length === 0;
  const isFirstRun = !loading && dataStatus?.state === 'empty';
  const exportRows = activeTab === 'shortlist'
    ? shortlistNavList.map(l => ({ ...l, userNote: userData.items[l.url]?.note || '' }))
    : sortedListings;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <header className="bg-ink text-paper border-2 border-ink shadow-[4px_4px_0_#111111] flex items-center justify-between gap-3 px-4 sm:px-5 py-3 mb-5">
        <Link to="/" className="text-lg md:text-2xl font-black tracking-tight uppercase no-underline text-paper hover:opacity-90" aria-label="Cape Town Rental Intel — home">
          Cape Town Rental<span className="text-yellow">.</span>Intel
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="w-10 h-10 shrink-0 border-2 border-paper bg-paper text-ink inline-flex items-center justify-center cursor-pointer hover:bg-neutral-100"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
      </header>

      <DataStatusBar
        dataStatus={dataStatus}
        onRefresh={triggerRefresh}
        onRetry={isUnavailable ? null : () => refetch(false)}
        isRefreshing={refreshing}
        feedbackMessage={feedbackMessage}
        onClearFeedback={() => setFeedbackMessage(null)}
      />

      {sharedIds.length > 0 && !loading && (
        <div role="region" aria-label="Shared shortlist" className="mb-4 border-2 border-ink bg-white p-3 flex flex-wrap items-center justify-between gap-3 shadow-[2px_2px_0_#111111]">
          <p className="text-sm font-bold text-ink m-0">
            Someone shared a shortlist with you: {sharedListings.length} of {sharedIds.length} listing{sharedIds.length === 1 ? ' is' : 's are'} still available.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={importShared}
              disabled={sharedListings.length === 0}
              className="min-h-[38px] border-2 border-ink bg-yellow text-ink text-xs font-black uppercase px-3 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add to my shortlist
            </button>
            <button type="button" onClick={() => setSharedIds([])} className="min-h-[38px] border-2 border-ink bg-white text-ink text-xs font-black uppercase px-3 cursor-pointer">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isUnavailable ? (
        <div className="border-[3px] border-ink bg-white p-8 text-center shadow-[4px_4px_0_#111111]">
          <Icon name="warning" size={32} className="mx-auto mb-3 text-bred" />
          <h2 className="text-lg font-black uppercase text-ink mb-2">We couldn&rsquo;t load market data</h2>
          <p className="text-sm text-ink/80 max-w-md mx-auto mb-5">
            The listings service didn&rsquo;t respond. Nothing is wrong with your filters — this is usually temporary.
          </p>
          <button
            type="button"
            onClick={() => refetch(false)}
            className="border-[3px] border-ink bg-yellow text-ink text-sm font-black uppercase px-5 py-2.5 cursor-pointer shadow-[3px_3px_0_#111111] inline-flex items-center gap-2"
          >
            <Icon name="refresh" /> Try again
          </button>
        </div>
      ) : isFirstRun ? (
        <FirstRunState onStartScrape={triggerRefresh} isStarting={refreshing} />
      ) : (
        <>
          <SearchIntentBar
            filters={filters}
            setFilters={setFilters}
            listings={listings}
            onToggleMoreFilters={() => setShowMoreFilters(prev => !prev)}
            showMoreFilters={showMoreFilters}
            activeSecondaryFilterCount={activeSecondaryFilterCount}
            onOpenSavedSearches={() => setShowSavedSearchesModal(true)}
            savedSearchesCount={savedSearches.length}
            savedSearchNewCount={savedSearchNewCount}
          />

          <dl className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 m-0">
            <div className="kpi-card bg-yellow border-2 border-ink shadow-[3px_3px_0_#111111] p-2.5 sm:p-3.5 flex flex-col-reverse justify-end">
              <dt className="text-[11px] font-black uppercase tracking-wider text-ink/80 mt-1.5">
                Matching{newCount > 0 && <span className="normal-case tracking-normal"> · {newCount} new</span>}
              </dt>
              <dd className="text-xl sm:text-3xl font-black font-mono tabular-nums leading-none text-ink m-0">{filteredListings.length}</dd>
            </div>
            <div className="kpi-card bg-white border-2 border-ink shadow-[3px_3px_0_#111111] p-2.5 sm:p-3.5 flex flex-col-reverse justify-end">
              <dt className="text-[11px] font-black uppercase tracking-wider text-ink/80 mt-1.5">Value picks</dt>
              <dd className="text-xl sm:text-3xl font-black font-mono tabular-nums leading-none text-ink m-0">{valueCount}</dd>
            </div>
            <div className="kpi-card bg-white border-2 border-ink shadow-[3px_3px_0_#111111] p-2.5 sm:p-3.5 flex flex-col-reverse justify-end">
              <dt className="text-[11px] font-black uppercase tracking-wider text-ink/80 mt-1.5">Median R/m²</dt>
              <dd className="text-xl sm:text-3xl font-black font-mono tabular-nums leading-none text-ink m-0">{fmtRate(medianRate)}</dd>
            </div>
          </dl>

          <ResultsToolbar
            totalCount={activeTab === 'shortlist' ? shortlisted.size : sortedListings.length}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            shortlistedCount={shortlisted.size}
            onExportCsv={() => exportCsv(exportRows, activeTab === 'shortlist' ? 'ct-shortlist' : 'ct-rentals')}
            showExport={activeTab === 'table' || activeTab === 'cards'}
            sort={sort}
            onSortChange={(id) => setSort(sortFromId(id))}
            showSort={['table', 'cards', 'shortlist'].includes(activeTab)}
          />

          <main id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={-1}>
            {loading ? (
              <div className="border-[3px] border-ink bg-white p-6 shadow-[6px_6px_0_#111111] animate-pulse" role="status" aria-label="Loading listings">
                <div className="space-y-3">
                  {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-neutral-100 border border-ink/10 w-full" />)}
                </div>
                <div className="text-center text-ink/80 font-black text-xs uppercase tracking-wider pt-4">Loading market data…</div>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="border-[3px] border-ink bg-white p-16 text-center shadow-[6px_6px_0_#111111]" role="status">
                    <div className="text-ink/80 font-extrabold text-lg animate-pulse">Loading view…</div>
                  </div>
                }
              >
                {activeTab === 'table' && (
                  <ListingsTable
                    listings={sortedListings}
                    totalListings={listings.length}
                    filters={filters}
                    onResetFilters={resetFilters}
                    sort={sort}
                    onSort={handleHeaderSort}
                    shortlisted={shortlisted}
                    toggleShortlist={toggleShortlist}
                    lastVisit={lastVisit}
                    onSelectListing={setSelected}
                    selectedListingUrl={current?.url}
                  />
                )}

                {activeTab === 'cards' && (
                  <ListingCardView
                    listings={sortedListings}
                    filters={filters}
                    onResetFilters={resetFilters}
                    onSelectListing={setSelected}
                    shortlisted={shortlisted}
                    onToggleShortlist={toggleShortlist}
                    lastVisit={lastVisit}
                  />
                )}

                {activeTab === 'shortlist' && (
                  <ShortlistWorkspace
                    shortlistedUrls={shortlisted}
                    userData={userData}
                    allListings={enriched}
                    comparables={comparables}
                    sort={sort}
                    onToggleShortlist={toggleShortlist}
                    onUpdateNote={handleUpdateNote}
                    onSelectListing={setSelected}
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
                    onSelectListing={setSelected}
                    onResetFilters={resetFilters}
                    onFilterSuburb={(suburb) => {
                      setFilters(prev => ({ ...prev, suburbs: [suburb] }));
                      setActiveTab(window.matchMedia?.(MOBILE_QUERY).matches ? 'cards' : 'table');
                    }}
                  />
                )}

                {activeTab === 'compare' && (
                  <SuburbComparison listings={filteredListings} history={history} onDrillDown={handleDrillDown} />
                )}

                {activeTab === 'ai' && <AIPanel filteredListings={filteredListings} filters={filters} />}
              </Suspense>
            )}
          </main>
        </>
      )}

      {current && (
        <Suspense fallback={null}>
          <ListingDrawer
            listing={current}
            medianPrice={drawerMedian.median}
            medianLabel={drawerMedian.label}
            shortlisted={shortlisted}
            toggleShortlist={toggleShortlist}
            onClose={closeDrawer}
            onPrev={goPrev}
            onNext={goNext}
            position={navIndex >= 0 ? { index: navIndex, total: navList.length } : null}
          />
        </Suspense>
      )}

      <SavedSearchesModal
        isOpen={showSavedSearchesModal}
        onClose={() => setShowSavedSearchesModal(false)}
        currentFilters={filters}
        savedSearches={savedSearches}
        matchCounts={savedSearchCounts}
        onSaveCurrentSearch={handleSaveCurrentSearch}
        onApplySearch={handleApplySearch}
        onDeleteSearch={handleDeleteSearch}
        onRenameSearch={handleRenameSearch}
        onUndoDelete={handleUndoDeleteSearch}
        recentlyDeleted={recentlyDeletedSearch}
      />

      <div aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md pointer-events-none">
        {toast && (
          <div className="toast-in pointer-events-auto border-2 border-ink bg-ink text-paper px-4 py-3 flex items-center justify-between gap-3 shadow-[3px_3px_0_#FFD23F]">
            <span className="text-sm font-bold">{toast.message}</span>
            <div className="flex items-center gap-1">
              {toast.undo && (
                <button
                  type="button"
                  onClick={() => { toast.undo(); setToast(null); }}
                  className="min-h-[36px] px-3 text-xs font-black uppercase text-yellow underline cursor-pointer"
                >
                  Undo
                </button>
              )}
              <button type="button" onClick={() => setToast(null)} className="w-8 h-8 inline-flex items-center justify-center cursor-pointer" aria-label="Dismiss">
                <Icon name="close" size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
