import { useState, useEffect, useCallback, useRef } from 'react';

export function useRentalData() {
  const [listings, setListings] = useState([]);
  const [medians, setMedians] = useState({});
  const [dataStatus, setDataStatus] = useState(null);
  const [comparables, setComparables] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const pollIntervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const fetchData = useCallback(async (silent = false, signal = null) => {
    try {
      const url = silent ? `/api/listings?_t=${Date.now()}` : '/api/listings';
      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setListings(data.listings || []);
      setMedians(data.medians || {});
      setDataStatus(data.dataStatus || {
        state: (data.listings && data.listings.length > 0) ? 'live' : 'empty',
        listingCount: (data.listings || []).length,
        isRefreshing: false
      });
      setComparables(data.comparables || {});

      // If backend reports scrape is no longer running, stop refreshing state
      if (data.dataStatus && !data.dataStatus.isRefreshing) {
        setRefreshing(false);
        stopPolling();
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch rental listings:', err);
      setError(err.message || 'Failed to fetch rental data');
      setDataStatus({
        state: 'unavailable',
        error: err.message,
        isRefreshing: false
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [stopPolling]);

  // Initial load with AbortController
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => {
      fetchData(false, controller.signal);
    });

    return () => {
      controller.abort();
      stopPolling();
    };
  }, [fetchData, stopPolling]);

  // Request a fresh scrape (on-demand, subject to 48-hour cooldown)
  const triggerRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const data = await res.json();

      if (data.skipped && data.reason === 'cooldown') {
        setRefreshing(false);
        const nextTime = data.nextAllowed
          ? new Date(data.nextAllowed).toLocaleDateString('en-ZA', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })
          : 'soon';
        setFeedbackMessage({
          type: 'info',
          message: `Snapshot is up-to-date. Next manual refresh available on ${nextTime} (48h cooldown).`
        });
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start scrape');
      }

      setFeedbackMessage({
        type: 'success',
        message: 'Market snapshot initiated. Ingesting Cape Town suburbs in background...'
      });

      // Poll periodically until complete
      stopPolling();
      pollIntervalRef.current = setInterval(() => {
        fetchData(true);
      }, 5000);

    } catch (err) {
      console.error('Failed to trigger refresh:', err);
      setRefreshing(false);
      setFeedbackMessage({
        type: 'error',
        message: err.message || 'Failed to start refresh'
      });
    }
  }, [refreshing, fetchData, stopPolling]);

  return {
    listings,
    medians,
    dataStatus,
    comparables,
    loading,
    refreshing,
    error,
    feedbackMessage,
    setFeedbackMessage,
    refetch: fetchData,
    triggerRefresh,
  };
}
