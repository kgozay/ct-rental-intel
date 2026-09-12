import { SUBURBS_LIST } from '../utils/suburbs';

export const PRICE_PRESETS = [
  { label: 'Any', value: 80000 },
  { label: '≤ R18k', value: 18000 },
  { label: '≤ R25k', value: 25000 },
  { label: '≤ R35k', value: 35000 },
  { label: '≤ R50k', value: 50000 },
];

export const DEFAULT_FILTERS = {
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
