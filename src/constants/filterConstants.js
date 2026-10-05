import { SUBURBS_LIST } from '../utils/suburbs';

export const PRICE_CAP = 80000;

export const PRICE_PRESETS = [
  { label: 'Any', value: PRICE_CAP },
  { label: '≤ R18k', value: 18000 },
  { label: '≤ R25k', value: 25000 },
  { label: '≤ R35k', value: 35000 },
  { label: '≤ R50k', value: 50000 },
];

// minBeds: null = any, 'studio' = exactly 0 bedrooms, n = n or more bedrooms.
export const BED_OPTIONS = [
  { label: 'Any', value: null },
  { label: 'Studio', value: 'studio' },
  { label: '1+', value: 1 },
  { label: '2+', value: 2 },
  { label: '3+', value: 3 },
];

export const BATH_OPTIONS = [
  { label: 'Any', value: null },
  { label: '1+', value: 1 },
  { label: '2+', value: 2 },
  { label: '3+', value: 3 },
];

export const DEFAULT_FILTERS = {
  search: '',
  suburbs: [...SUBURBS_LIST],
  minPrice: 0,
  maxPrice: PRICE_CAP,
  minBeds: null,
  minBaths: null,
  minSize: 0,
  propertyTypes: [],
  furnished: null,
  goodValueOnly: false,
  priceDropOnly: false,
  availableBefore: '',
  includeUnknownAvail: true,
  shortlistOnly: false,
};

export const SORT_OPTIONS = [
  { id: 'value_score:desc', label: 'Best value' },
  { id: 'price:asc', label: 'Price: low to high' },
  { id: 'price:desc', label: 'Price: high to low' },
  { id: 'price_per_m2:asc', label: 'Lowest R/m²' },
  { id: 'size_m2:desc', label: 'Largest' },
  { id: 'days:asc', label: 'Newest' },
  { id: 'available:asc', label: 'Soonest available' },
];

export const DEFAULT_SORT = { field: 'value_score', asc: false };
