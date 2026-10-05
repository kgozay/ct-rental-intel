import { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from './Icon';
import { VALUE_THRESHOLDS } from '../utils/confidence';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Sequential single-hue ramp (light → dark blue): readable for colour-blind users.
const RATE_RAMP = ['#DBEAFE', '#93C5FD', '#3B82F6', '#1E3A8A'];

// Value tiers use blue/orange (colour-blind safe) AND distinct shapes.
const TIER_STYLE = {
  good_value: { color: '#2563EB', shape: 'diamond', label: 'Good value' },
  potential_value: { color: '#2563EB', shape: 'diamond-outline', label: 'Potential value' },
  typical_price: { color: '#9CA3AF', shape: 'circle', label: 'Typical price' },
  premium_price: { color: '#F59E0B', shape: 'square', label: 'Premium price' },
  unrated: { color: '#FFFFFF', shape: 'circle-outline', label: 'Unrated' },
};

function markerHtml(shape, color) {
  const base = 'display:block;box-sizing:border-box;border:2px solid #111;';
  switch (shape) {
    case 'diamond':
      return `<span style="${base}width:13px;height:13px;background:${color};transform:rotate(45deg);"></span>`;
    case 'diamond-outline':
      return `<span style="${base}width:13px;height:13px;background:#fff;border:3px solid ${color};outline:1px solid #111;transform:rotate(45deg);"></span>`;
    case 'square':
      return `<span style="${base}width:12px;height:12px;background:${color};"></span>`;
    case 'circle-outline':
      return `<span style="${base}width:11px;height:11px;border-radius:50%;background:#fff;"></span>`;
    default:
      return `<span style="${base}width:11px;height:11px;border-radius:50%;background:${color};"></span>`;
  }
}

function legendSwatch(shape, color) {
  return <span aria-hidden="true" className="inline-flex w-4 justify-center" dangerouslySetInnerHTML={{ __html: markerHtml(shape, color) }} />;
}

function calcMedian(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// Deterministic jitter seeded only by the listing URL, so a pin stays put when
// filters change. Only applied to approximate (suburb-level) geocodes.
function pseudoJitter(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const dist = 0.002 + ((Math.abs(hash) % 100) / 100) * 0.007; // ~200m - 900m
  return {
    dLat: Math.sin(angle) * dist,
    dLng: Math.cos(angle) * dist * 1.2
  };
}

export default function MapView({ listings, theme, onSelectListing, onFilterSuburb, onResetFilters }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(L.layerGroup());
  const [viewMode, setViewMode] = useState('suburbs'); // 'suburbs' | 'listings'

  // Aggregate listings by suburb (centroid = mean of listing coordinates)
  const suburbData = useMemo(() => {
    const groups = {};
    listings.forEach(item => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lng);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      const g = (groups[item.suburb] ||= { lats: [], lngs: [], prices: [], rates: [], goodValue: 0 });
      g.lats.push(lat);
      g.lngs.push(lng);
      g.prices.push(item.price);
      if (item.price_per_m2) g.rates.push(item.price_per_m2);
      if (item.valuation?.verdict === 'good_value' || item.valuation?.verdict === 'potential_value') g.goodValue++;
    });
    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return Object.entries(groups).map(([suburb, d]) => ({
      suburb,
      lat: mean(d.lats),
      lng: mean(d.lngs),
      count: d.prices.length,
      medianPrice: calcMedian(d.prices),
      medianRate: calcMedian(d.rates),
      goodValue: d.goodValue,
    }));
  }, [listings]);

  // Bucket suburb median R/m² into four equal-width bands for the colour ramp.
  const rateBands = useMemo(() => {
    const rates = suburbData.map(s => s.medianRate).filter(Boolean);
    if (rates.length === 0) return null;
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const step = (max - min) / RATE_RAMP.length || 1;
    const bandOf = (rate) => (rate == null ? -1 : Math.min(RATE_RAMP.length - 1, Math.floor((rate - min) / step)));
    const labels = RATE_RAMP.map((_, i) => {
      const lo = Math.round(min + step * i);
      const hi = Math.round(min + step * (i + 1));
      return max === min ? `R${lo}/m²` : `R${lo}–R${hi}/m²`;
    });
    return { bandOf, labels: max === min ? labels.slice(0, 1) : labels };
  }, [suburbData]);

  // Initialise Leaflet map once
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const map = L.map(mapContainer.current, {
      center: [-33.9249, 18.4241],
      zoom: 12,
      zoomControl: false,
    });
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 150);
    L.control.zoom({ position: 'topright' }).addTo(map);

    markersLayer.current.addTo(map);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update tiles when dark mode changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const isDark = theme === 'dark';
    const cartoKey = import.meta.env.VITE_CARTO_API_KEY;

    if (cartoKey) {
      const tileUrl = isDark
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
        : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`;

      tileLayerRef.current = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(mapRef.current);
    } else {
      // Free OpenStreetMap tiles with zero API key requirement
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abc',
        maxZoom: 19,
        className: isDark ? 'dark-mode-tiles' : '',
      }).addTo(mapRef.current);
    }
  }, [theme]);

  // Keep window callbacks in sync for popup buttons
  useEffect(() => {
    window._ctRentalFilterSuburb = onFilterSuburb || null;
    window._ctRentalSelectListingUrl = (url) => {
      const match = listings.find(l => l.url === url);
      if (match && onSelectListing) {
        onSelectListing(match);
      }
    };
    return () => {
      window._ctRentalFilterSuburb = null;
      window._ctRentalSelectListingUrl = null;
    };
  }, [onFilterSuburb, onSelectListing, listings]);

  // Redraw markers whenever data or viewMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersLayer.current.clearLayers();

    if (viewMode === 'suburbs') {
      // Suburb Overview Mode
      suburbData.forEach(({ suburb, lat, lng, count, medianPrice, medianRate, goodValue }) => {
        const band = rateBands ? rateBands.bandOf(medianRate) : -1;
        const color = band >= 0 ? RATE_RAMP[band] : '#FFFFFF';
        const radius = Math.max(16, Math.min(42, Math.sqrt(count) * 6.5));

        const popupHtml = `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;padding:2px;color:#111;min-width:170px;">
            <b style="font-size:13px;text-transform:uppercase;display:block;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:8px;">${esc(suburb)}</b>
            <div style="font-size:12px;font-weight:800;margin-bottom:4px;">
              ${count} listing${count !== 1 ? 's' : ''}
            </div>
            <div style="font-size:11px;font-weight:700;color:#555;margin-bottom:${goodValue > 0 ? '4px' : '10px'};">
              Median R ${medianPrice ? medianPrice.toLocaleString('en-ZA') : '—'}/mo${medianRate ? ` · R ${medianRate}/m²` : ''}
            </div>
            ${goodValue > 0 ? `<div style="font-size:10px;font-weight:800;color:#111;background:#A3E635;border:2px solid #111;display:inline-block;padding:1px 7px;margin-bottom:10px;">${goodValue} value pick${goodValue !== 1 ? 's' : ''}</div>` : ''}
            <div style="display:flex;flex-direction:column;gap:5px;">
              <button onclick="if(window._ctRentalFilterSuburb)window._ctRentalFilterSuburb('${esc(suburb)}')" style="display:block;width:100%;text-align:center;border:2px solid #111;background:#FFD23F;padding:6px;font-size:11px;font-weight:900;text-transform:uppercase;color:#111;cursor:pointer;box-sizing:border-box;">
                Show these listings →
              </button>
            </div>
          </div>
        `;

        const marker = L.circleMarker([lat, lng], {
          radius,
          fillColor: color,
          color: '#111111',
          weight: 3,
          fillOpacity: 0.85,
          opacity: 1.0,
        });

        marker.bindPopup(popupHtml, { closeButton: true, offset: L.point(0, -6) });
        marker.addTo(markersLayer.current);
      });
    } else {
      // Individual listing pins. Approximate geocodes are jittered around the
      // suburb centroid; precise geocodes are plotted exactly.
      listings.forEach((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
        const { dLat, dLng } = item.geocode_precise ? { dLat: 0, dLng: 0 } : pseudoJitter(item.url || item.address);
        const pinLat = lat + dLat;
        const pinLng = lng + dLng;

        const verdict = item.valuation?.verdict || 'unrated';
        const tier = TIER_STYLE[verdict] || TIER_STYLE.unrated;
        const isGoodValue = verdict === 'good_value' || verdict === 'potential_value';
        const isPriceDrop = item.previous_price && item.price < item.previous_price;

        const imgHtml = item.main_image_url
          ? `<img src="${esc(item.main_image_url)}" alt="${esc(item.address || item.suburb)}" style="width:100%;height:85px;object-fit:cover;border:2px solid #111;margin-bottom:6px;" onerror="this.style.display='none'"/>`
          : '';

        const popupHtml = `
          <div style="font-family:inherit;padding:2px;color:#111;min-width:180px;max-width:230px;">
            ${imgHtml}
            ${item.geocode_precise ? '' : '<div style="font-size:10px;color:#555;font-weight:800;text-transform:uppercase;margin-bottom:2px;">Approximate location</div>'}
            <div style="font-size:10px;font-weight:900;text-transform:uppercase;color:#666;letter-spacing:0.5px;">${esc(item.suburb)}</div>
            <b style="font-size:12px;line-height:1.2;display:block;margin-bottom:4px;color:#111;">${esc(item.address || item.suburb)}</b>
            <div style="font-size:14px;font-weight:900;font-family:monospace;color:#2563EB;margin-bottom:3px;">
              R ${item.price.toLocaleString('en-ZA')}/mo
            </div>
            ${isPriceDrop ? `<div style="font-size:10px;font-weight:800;color:#2563EB;margin-bottom:4px;">↓ was R ${item.previous_price.toLocaleString('en-ZA')}</div>` : ''}
            <div style="font-size:11px;font-weight:700;color:#444;margin-bottom:6px;">
              ${item.bedrooms === 0 ? 'Studio' : item.bedrooms != null ? `${item.bedrooms} Bed` : ''} ${item.size_m2 ? `· ${item.size_m2}m²` : ''} ${item.furnished ? '· Furnished' : ''}
            </div>
            ${isGoodValue ? `<div style="font-size:10px;font-weight:900;background:#A3E635;color:#111;border:1.5px solid #111;padding:1px 6px;margin-bottom:8px;display:inline-block;">${esc(item.valuation.label).toUpperCase()} (${item.value_score}×)</div>` : ''}
            <div style="display:flex;gap:4px;margin-top:4px;">
              <button onclick="if(window._ctRentalSelectListingUrl)window._ctRentalSelectListingUrl('${esc(item.url)}')" style="flex:1;text-align:center;border:2px solid #111;background:#FFD23F;padding:5px;font-size:10px;font-weight:900;text-transform:uppercase;color:#111;cursor:pointer;box-shadow:1px 1px 0 #111;">
                Details
              </button>
              <a href="${esc(item.url)}" target="_blank" rel="noreferrer" style="border:2px solid #111;background:#fff;padding:5px 8px;font-size:11px;font-weight:900;color:#111;text-decoration:none;display:inline-block;box-shadow:1px 1px 0 #111;">
                ↗
              </a>
            </div>
          </div>
        `;

        const marker = L.marker([pinLat, pinLng], {
          icon: L.divIcon({
            html: markerHtml(tier.shape, tier.color),
            className: 'ct-pin',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
          keyboard: true,
          title: `${item.suburb} R${item.price.toLocaleString('en-ZA')} — ${tier.label}`,
          zIndexOffset: isGoodValue ? 500 : 0,
        });

        marker.bindPopup(popupHtml, { closeButton: true, offset: L.point(0, -4) });
        marker.addTo(markersLayer.current);
      });
    }
  }, [viewMode, listings, suburbData, rateBands]);

  return (
    <div className="relative border-2 border-ink bg-neutral-100 shadow-[3px_3px_0_#111111] mb-6 h-[520px] z-0">
      <div ref={mapContainer} className="w-full h-full" />

      {listings.length === 0 && (
        <div className="absolute inset-0 bg-white/95 dark:bg-neutral-900/95 flex flex-col items-center justify-center z-[1000] p-6 text-center">
          <Icon name="pin" size={36} className="mb-3 text-ink/70" />
          <div className="text-base font-black uppercase tracking-tight text-ink mb-1">No listings to map</div>
          <div className="text-xs text-ink/80 font-medium max-w-xs mb-4">
            None of the current listings match your filters.
          </div>
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="border-2 border-ink bg-yellow text-ink text-xs font-black uppercase px-4 py-2 cursor-pointer shadow-[2px_2px_0_#111111] hover:translate-x-[-1px] hover:translate-y-[-1px]"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Layer Mode Switcher Controls */}
      <div className="absolute top-4 left-4 z-[1000] flex gap-1 bg-white border-2 border-ink p-1 shadow-[2px_2px_0_#111111] select-none">
        <button
          type="button"
          aria-pressed={viewMode === 'suburbs'}
          onClick={() => setViewMode('suburbs')}
          className={`min-h-[34px] px-3 py-1 text-xs font-black uppercase transition-colors cursor-pointer border border-transparent ${
            viewMode === 'suburbs' ? 'bg-ink text-paper border-ink' : 'bg-transparent text-ink hover:bg-neutral-100'
          }`}
        >
          Suburbs
        </button>
        <button
          type="button"
          aria-pressed={viewMode === 'listings'}
          onClick={() => setViewMode('listings')}
          className={`min-h-[34px] px-3 py-1 text-xs font-black uppercase transition-colors cursor-pointer border border-transparent ${
            viewMode === 'listings' ? 'bg-ink text-paper border-ink' : 'bg-transparent text-ink hover:bg-neutral-100'
          }`}
        >
          All Pins ({listings.length})
        </button>
      </div>

      {/* Legend */}
      <div className="absolute left-3 bottom-3 bg-white border-2 border-ink p-3 shadow-[2px_2px_0_#111111] text-xs font-bold z-[1000] max-w-[220px]">
        <div className="font-extrabold uppercase tracking-wide border-b-2 border-ink pb-1 mb-2">
          {viewMode === 'suburbs' ? 'Median R/m²' : 'Value tier'}
        </div>
        <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
          {viewMode === 'listings' ? (
            ['good_value', 'potential_value', 'typical_price', 'premium_price', 'unrated'].map(key => (
              <li key={key} className="flex items-center gap-2">
                {legendSwatch(TIER_STYLE[key].shape, TIER_STYLE[key].color)}
                <span>
                  {TIER_STYLE[key].label}
                  {key === 'good_value' && ` (≥ ${VALUE_THRESHOLDS.GOOD.toFixed(2)}×)`}
                  {key === 'premium_price' && ` (≤ ${VALUE_THRESHOLDS.PREMIUM.toFixed(2)}×)`}
                </span>
              </li>
            ))
          ) : rateBands ? (
            rateBands.labels.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-ink rounded-full" style={{ background: RATE_RAMP[i] }} aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))
          ) : (
            <li>No size data</li>
          )}
        </ul>
        <div className="mt-2 pt-1.5 border-t border-dashed border-ink/40 text-[11px] text-ink/80 font-semibold">
          {viewMode === 'suburbs' ? 'Bubble size = listing count. Darker = pricier per m².' : 'Pins without an exact address are placed near the suburb centre.'}
        </div>
      </div>
    </div>
  );
}
