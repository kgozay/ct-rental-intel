import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadUserData,
  addShortlistItem,
  removeShortlistItem,
  updateItemNote,
  saveSearchConfig,
  deleteSearchConfig,
  renameSearchConfig,
  restoreShortlistItem,
  restoreSearchConfig,
  markSearchViewed,
} from './userStorage';

describe('userStorage module', () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    const mockLocalStorage = {
      getItem: (key) => mockStore[key] ?? null,
      setItem: (key, val) => { mockStore[key] = String(val); },
      removeItem: (key) => { delete mockStore[key]; },
      clear: () => { mockStore = {}; },
    };
    vi.stubGlobal('localStorage', mockLocalStorage);
    if (typeof window !== 'undefined') {
      window.localStorage = mockLocalStorage;
    }
  });

  it('loads initial user data when localStorage is empty', () => {
    const data = loadUserData();
    expect(data.version).toBe(2);
    expect(data.items).toEqual({});
    expect(data.savedSearches).toEqual([]);
  });

  it('migrates legacy string array shortlist gracefully to v2 format', () => {
    mockStore['shortlist'] = JSON.stringify([
      'https://property24.com/to-rent/gardens/111',
      'https://property24.com/to-rent/sea-point/222',
    ]);

    const data = loadUserData();
    expect(data.version).toBe(2);
    expect(Object.keys(data.items)).toHaveLength(2);
    expect(data.items['https://property24.com/to-rent/gardens/111']).toBeDefined();
    expect(data.items['https://property24.com/to-rent/gardens/111'].note).toBe('');
    expect(data.items['https://property24.com/to-rent/gardens/111'].addedAt).toBeDefined();

    // Verify v2 was saved
    expect(mockStore['rental_intel_userdata_v2']).toBeDefined();
  });

  it('safely handles malformed corrupted JSON without crashing', () => {
    mockStore['rental_intel_userdata_v2'] = '{ invalid json :::';
    const data = loadUserData();
    expect(data.version).toBe(2);
    expect(data.items).toEqual({});
  });

  it('adds and removes shortlist items with listing snapshots', () => {
    let state = loadUserData();
    const mockListing = {
      suburb: 'Sea Point',
      price: 22000,
      bedrooms: 2,
      bathrooms: 1,
      size_m2: 70,
      price_per_m2: 314,
      property_type: 'Apartment',
      agency_name: 'Dogon Group',
      value_score: 1.25,
    };

    state = addShortlistItem(state, 'https://property24.com/123', mockListing, 'Great balcony');
    expect(state.items['https://property24.com/123']).toBeDefined();
    expect(state.items['https://property24.com/123'].note).toBe('Great balcony');
    expect(state.items['https://property24.com/123'].snapshot.price).toBe(22000);
    expect(state.items['https://property24.com/123'].snapshot.suburb).toBe('Sea Point');

    // Update note
    state = updateItemNote(state, 'https://property24.com/123', 'Updated note: check pet policy');
    expect(state.items['https://property24.com/123'].note).toBe('Updated note: check pet policy');

    // Remove item
    state = removeShortlistItem(state, 'https://property24.com/123');
    expect(state.items['https://property24.com/123']).toBeUndefined();
  });

  it('saves, renames, and deletes saved searches', () => {
    let state = loadUserData();
    const filterConfig = { suburbs: ['Gardens', 'Oranjezicht'], maxPrice: 25000, minBeds: 2 };

    const { updated: state1, savedEntry } = saveSearchConfig(state, 'City Bowl 2 Beds', filterConfig);
    expect(state1.savedSearches).toHaveLength(1);
    expect(state1.savedSearches[0].name).toBe('City Bowl 2 Beds');
    expect(state1.savedSearches[0].filters.maxPrice).toBe(25000);

    // Rename
    const state2 = renameSearchConfig(state1, savedEntry.id, 'City Bowl 2-Bed Luxury');
    expect(state2.savedSearches[0].name).toBe('City Bowl 2-Bed Luxury');

    // Delete
    const { updated: state3, deletedEntry } = deleteSearchConfig(state2, savedEntry.id);
    expect(state3.savedSearches).toHaveLength(0);
    expect(deletedEntry.name).toBe('City Bowl 2-Bed Luxury');
  });

  it('restores a removed shortlist item with its note intact (undo)', () => {
    let state = loadUserData();
    state = addShortlistItem(state, 'u1', { suburb: 'Gardens', price: 15000, main_image_url: 'img.jpg' });
    state = updateItemNote(state, 'u1', 'viewing Sat 10am');
    expect(state.items.u1.snapshot.main_image_url).toBe('img.jpg');
    const entry = state.items.u1;
    state = removeShortlistItem(state, 'u1');
    state = restoreShortlistItem(state, 'u1', entry);
    expect(state.items.u1.note).toBe('viewing Sat 10am');
    // Re-adding an existing item keeps its note
    state = addShortlistItem(state, 'u1', { suburb: 'Gardens', price: 14000 });
    expect(state.items.u1.note).toBe('viewing Sat 10am');
    expect(loadUserData().items.u1.note).toBe('viewing Sat 10am');
  });

  it('restores deleted searches with their id and tracks last viewed time', () => {
    const { updated, savedEntry } = saveSearchConfig(loadUserData(), 'A', { maxPrice: 20000 });
    expect(savedEntry.lastViewedAt).toBeTruthy();
    const viewed = markSearchViewed(updated, savedEntry.id, '2030-01-01T00:00:00.000Z');
    expect(viewed.savedSearches[0].lastViewedAt).toBe('2030-01-01T00:00:00.000Z');
    const { updated: afterDelete, deletedEntry } = deleteSearchConfig(viewed, savedEntry.id);
    const restored = restoreSearchConfig(afterDelete, deletedEntry);
    expect(restored.savedSearches[0].id).toBe(savedEntry.id);
    expect(restored.savedSearches[0].lastViewedAt).toBe('2030-01-01T00:00:00.000Z');
  });
});
