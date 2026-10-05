import { useState, useEffect, useCallback, useRef } from 'react';

const POLL_INTERVAL_MS = 15000;
// The backend expires runs that never report back (see api/lifecycle.js);
// stop polling well after that so the UI can't spin forever either.
const MAX_POLL_MS = 45 * 60 * 1000;

const formatWhen = (iso) => new Date(iso).toLocaleString('en-ZA', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
}).replace(',', '');

/**
 * Owns listing requests, scrape triggering and refresh polling.
 *
 * @param {{ pollWhileRefreshing?: boolean }} options
 *   pollWhileRefreshing — keep polling while the backend reports a running
 *   scrape (including one started before this page was opened).
 */
export function useRentalData({ pollWhileRefreshing = false } = {}) {
  const [listings, setListings] = useState([]);
  const [medians, setMedians] = useState({});
  const [dataStatus, setDataStatus] = useState(null);
  const [comparables, setComparables] = useState({});
  const [lastScraped, setLastScraped] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [awaitingRun, setAwaitingRun] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const pollStartedRef = useRef(null);

  const fetchData = useCallback(async (silent = false, signal = null) => {
    try {
      const url = silent ? `/api/listings?_t=${Date.now()}` : '/api/listings';
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Listings service returned HTTP ${res.status}`);

      const data = await res.json();
      setListings(Array.isArray(data.listings) ? data.listings : []);
      setMedians(data.medians || {});
      setComparables(data.comparables || {});
      setLastScraped(data.lastScraped || null);
      setDataStatus(data.dataStatus || {
        state: data.listings?.length ? 'live' : 'empty',
        listingCount: data.listings?.length || 0,
        isRefreshing: false,
      });
      setError(null);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      console.error('Failed to fetch rental listings:', err);
      // A failed background poll must not wipe a good snapshot off the screen.
      if (!silent) {
        setError(err.message || 'Failed to fetch rental data');
        setDataStatus({ state: 'unavailable', error: err.message, isRefreshing: false });
      }
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Deferred a microtask: fetchData only sets state after awaiting the network.
    Promise.resolve().then(() => fetchData(false, controller.signal));
    return () => controller.abort();
  }, [fetchData]);

  const serverRefreshing = Boolean(dataStatus?.isRefreshing);
  const shouldPoll = pollWhileRefreshing && (serverRefreshing || awaitingRun);

  // Poll while a scrape is running; announce when it lands.
  useEffect(() => {
    if (!shouldPoll) {
      pollStartedRef.current = null;
      return undefined;
    }
    pollStartedRef.current ??= Date.now();
    const id = setInterval(async () => {
      if (Date.now() - pollStartedRef.current > MAX_POLL_MS) {
        clearInterval(id);
        setAwaitingRun(false);
        setFeedbackMessage({
          type: 'info',
          message: 'The update is taking longer than expected. Showing the last good snapshot — reload later to check again.',
        });
        return;
      }
      const data = await fetchData(true);
      if (data?.dataStatus?.isRefreshing) setAwaitingRun(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [shouldPoll, fetchData]);

  // Announce when a running scrape finishes (derived during render, not in an effect).
  const [prevServerRefreshing, setPrevServerRefreshing] = useState(false);
  if (serverRefreshing !== prevServerRefreshing) {
    setPrevServerRefreshing(serverRefreshing);
    if (prevServerRefreshing && !serverRefreshing && dataStatus) {
      const partial = dataStatus.state === 'partial';
      setFeedbackMessage({
        type: partial ? 'info' : 'success',
        message: partial
          ? `Update finished with partial coverage (${dataStatus.completedSuburbs?.length || 0} of ${dataStatus.expectedSuburbs || 7} suburbs).`
          : 'Listings updated with the latest market snapshot.',
      });
    }
  }

  // Request a fresh scrape (on-demand, subject to the 48-hour cooldown).
  const triggerRefresh = useCallback(async () => {
    if (requesting || serverRefreshing || awaitingRun) return;
    setRequesting(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (data.skipped && data.reason === 'cooldown') {
        setFeedbackMessage({
          type: 'info',
          message: `This snapshot is still current — updates are limited to once every 48 hours.${data.nextAllowed ? ` Next update available ${formatWhen(data.nextAllowed)}.` : ''}`,
        });
        return;
      }
      if (!res.ok) {
        throw new Error(data.error
          ? `Update failed to start: ${data.error}`
          : 'Update failed to start — usually an Apify quota or API key issue. Try again in a few minutes.');
      }

      setFeedbackMessage({
        type: 'info',
        message: 'Update started. New listings usually land within 5–15 minutes; you can keep using the current snapshot.',
      });
      setAwaitingRun(true);
      fetchData(true);
    } catch (err) {
      console.error('Failed to trigger refresh:', err);
      setFeedbackMessage({ type: 'error', message: err.message || 'Failed to start update.' });
    } finally {
      setRequesting(false);
    }
  }, [requesting, serverRefreshing, awaitingRun, fetchData]);

  return {
    listings,
    medians,
    dataStatus,
    comparables,
    lastScraped,
    loading,
    refreshing: requesting || awaitingRun || serverRefreshing,
    error,
    feedbackMessage,
    setFeedbackMessage,
    refetch: fetchData,
    triggerRefresh,
  };
}
