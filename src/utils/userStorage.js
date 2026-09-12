/**
 * Versioned Local Storage Manager (v2)
 * Manages shortlist items with notes and snapshots, plus saved searches.
 * Provides backward-compatible migration from legacy string-array shortlists.
 */

const STORAGE_KEY_V2 = 'rental_intel_userdata_v2';
const LEGACY_SHORTLIST_KEY = 'shortlist';

export const INITIAL_USER_DATA = {
  version: 2,
  items: {},
  savedSearches: [],
};

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

/**
 * Safely parse JSON or return fallback
 */
function safeJsonParse(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Load user data from localStorage with v1 -> v2 migration
 */
export function loadUserData() {
  const storage = getStorage();
  if (!storage) {
    return { ...INITIAL_USER_DATA };
  }

  try {
    const rawV2 = storage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = safeJsonParse(rawV2, null);
      if (parsed && typeof parsed === 'object' && parsed.version === 2) {
        return {
          version: 2,
          items: (parsed.items && typeof parsed.items === 'object') ? parsed.items : {},
          savedSearches: Array.isArray(parsed.savedSearches) ? parsed.savedSearches : [],
        };
      }
    }

    // Migrate from legacy shortlist array if present
    const legacyRaw = storage.getItem(LEGACY_SHORTLIST_KEY);
    const legacyArray = safeJsonParse(legacyRaw, []);
    const items = {};

    if (Array.isArray(legacyArray)) {
      const now = new Date().toISOString();
      legacyArray.forEach(url => {
        if (typeof url === 'string' && url.trim()) {
          items[url.trim()] = {
            addedAt: now,
            note: '',
            snapshot: null,
          };
        }
      });
    }

    const migrated = {
      version: 2,
      items,
      savedSearches: [],
    };

    // Save migrated structure
    saveUserData(migrated);
    return migrated;
  } catch (err) {
    console.warn('Failed to load user storage, using defaults:', err);
    return { ...INITIAL_USER_DATA };
  }
}

/**
 * Persist user data to localStorage
 */
export function saveUserData(data) {
  const storage = getStorage();
  if (!storage) return;
  try {
    const payload = {
      version: 2,
      items: data?.items || {},
      savedSearches: Array.isArray(data?.savedSearches) ? data.savedSearches : [],
    };
    storage.setItem(STORAGE_KEY_V2, JSON.stringify(payload));

    // Also keep legacy key synced as URL array for any external tools
    const urls = Object.keys(payload.items);
    storage.setItem(LEGACY_SHORTLIST_KEY, JSON.stringify(urls));
  } catch (err) {
    console.warn('Failed to save user storage:', err);
  }
}

/**
 * Extract clean listing snapshot
 */
export function extractSnapshot(listing) {
  if (!listing) return null;
  return {
    suburb: listing.suburb || '',
    price: typeof listing.price === 'number' ? listing.price : null,
    bedrooms: listing.bedrooms !== undefined ? listing.bedrooms : null,
    bathrooms: listing.bathrooms !== undefined ? listing.bathrooms : null,
    size_m2: listing.size_m2 !== undefined ? listing.size_m2 : null,
    price_per_m2: listing.price_per_m2 !== undefined ? listing.price_per_m2 : null,
    property_type: listing.property_type || '',
    agency_name: listing.agency_name || '',
    value_score: listing.value_score !== undefined ? listing.value_score : null,
    available_date: listing.available_date || null,
    image_url: listing.image_url || null,
  };
}

/**
 * Add or update shortlist item
 */
export function addShortlistItem(currentData, url, listing = null, note = '') {
  if (!url) return currentData;
  const nextItems = {
    ...(currentData?.items || {}),
    [url]: {
      addedAt: currentData?.items?.[url]?.addedAt || new Date().toISOString(),
      note: note !== undefined ? note : (currentData?.items?.[url]?.note || ''),
      snapshot: listing ? extractSnapshot(listing) : (currentData?.items?.[url]?.snapshot || null),
    }
  };
  const updated = { ...currentData, items: nextItems };
  saveUserData(updated);
  return updated;
}

/**
 * Remove shortlist item
 */
export function removeShortlistItem(currentData, url) {
  if (!url || !currentData?.items?.[url]) return currentData;
  const nextItems = { ...currentData.items };
  delete nextItems[url];
  const updated = { ...currentData, items: nextItems };
  saveUserData(updated);
  return updated;
}

/**
 * Update note for shortlisted listing
 */
export function updateItemNote(currentData, url, note) {
  if (!url || !currentData?.items?.[url]) return currentData;
  const nextItems = {
    ...currentData.items,
    [url]: {
      ...currentData.items[url],
      note: note || '',
    }
  };
  const updated = { ...currentData, items: nextItems };
  saveUserData(updated);
  return updated;
}

/**
 * Save a search configuration
 */
export function saveSearchConfig(currentData, name, filters) {
  const id = `search_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const searchEntry = {
    id,
    name: name?.trim() || `Saved Search (${new Date().toLocaleDateString('en-ZA')})`,
    createdAt: new Date().toISOString(),
    filters: { ...filters },
  };

  const updated = {
    ...currentData,
    savedSearches: [searchEntry, ...(currentData?.savedSearches || [])],
  };
  saveUserData(updated);
  return { updated, savedEntry: searchEntry };
}

/**
 * Delete a saved search
 */
export function deleteSearchConfig(currentData, id) {
  const existing = currentData?.savedSearches || [];
  const target = existing.find(s => s.id === id);
  const updated = {
    ...currentData,
    savedSearches: existing.filter(s => s.id !== id),
  };
  saveUserData(updated);
  return { updated, deletedEntry: target };
}

/**
 * Rename a saved search
 */
export function renameSearchConfig(currentData, id, newName) {
  if (!newName?.trim()) return currentData;
  const updated = {
    ...currentData,
    savedSearches: (currentData?.savedSearches || []).map(s =>
      s.id === id ? { ...s, name: newName.trim() } : s
    ),
  };
  saveUserData(updated);
  return updated;
}
