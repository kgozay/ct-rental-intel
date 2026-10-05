import { daysAgo, isPriceDrop } from './filters';

export function exportCsv(rows, filenamePrefix = 'ct-rentals') {
  if (!rows || rows.length === 0) return;

  const headers = [
    'Suburb', 'Address', 'Type', 'Beds', 'Baths', 'Price (ZAR)', 'Previous Price (ZAR)',
    'Size (m²)', 'R/m²', 'Value Score', 'Value', 'Comparables', 'Furnished', 'Available',
    'Days Listed', 'Agency', 'Note', 'URL',
  ];

  const escape = (val) => {
    if (val === null || val === undefined) return '""';
    let s = String(val);
    // Neutralise spreadsheet formula injection from scraped text.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(','),
    ...rows.map(l => [
      l.suburb,
      l.address ?? '',
      l.property_type,
      l.bedrooms === 0 ? 'Studio' : l.bedrooms ?? '',
      l.bathrooms ?? '',
      l.price,
      isPriceDrop(l) ? l.previous_price : '',
      l.size_m2 ?? '',
      l.price_per_m2 ?? '',
      l.value_score ?? '',
      l.valuation?.label ?? '',
      l.valuation?.basis ? l.valuation.sampleSize : '',
      l.furnished === true ? 'Yes' : l.furnished === false ? 'No' : '',
      l.available_date ?? '',
      daysAgo(l.created_at) ?? '',
      l.agency_name ?? '',
      l.userNote ?? '',
      l.url,
    ].map(escape).join(','))
  ].join('\n');

  // BOM so Excel opens the UTF-8 (R/m², em dashes) correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
