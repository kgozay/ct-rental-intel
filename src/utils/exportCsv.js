function daysAgo(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  if (isNaN(diff)) return null;
  return Math.max(0, Math.floor(diff / 86400000));
}

export function exportCsv(rows, filenamePrefix = 'ct-rentals') {
  if (!rows || rows.length === 0) return;

  const headers = [
    'Suburb', 'Address', 'Type', 'Beds', 'Baths', 'Price (ZAR)',
    'Size (m²)', 'R/m²', 'Value', 'Furnished', 'Available', 'Days Listed', 'Agency', 'URL'
  ];

  const escape = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csv = [
    headers.join(','),
    ...rows.map(l => [
      l.suburb,
      l.address ?? '',
      l.property_type,
      l.bedrooms ?? '',
      l.bathrooms ?? '',
      l.price,
      l.size_m2 ?? '',
      l.price_per_m2 ?? '',
      l.value_score > 1.15 ? 'Good value' : l.value_score < 0.85 ? 'Expensive' : 'Fair',
      l.furnished === true ? 'Yes' : l.furnished === false ? 'No' : '',
      l.available_date ?? '',
      daysAgo(l.created_at) ?? '',
      l.agency_name ?? '',
      l.url
    ].map(escape).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
