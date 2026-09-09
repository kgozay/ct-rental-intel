import { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function priceColor(median) {
  if (median <= 15000) return '#10b981';
  if (median <= 22000) return '#f59e0b';
  if (median <= 35000) return '#f97316';
  return '#ef4444';
}

function calcMedian(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// Simple deterministic hash to jitter individual listings around their suburb centroid
function pseudoJitter(str, index) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const angle = ((Math.abs(hash) + index * 137.5) % 360) * (Math.PI / 180);
  const dist = 0.002 + ((Math.abs(hash) % 100) / 100) * 0.007; // ~200m - 900m
  return {
    dLat: Math.sin(angle) * dist,
    dLng: Math.cos(angle) * dist * 1.2
  };
}

export default function MapView({ listings, theme, onSelectListing, onFilterSuburb }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayer = useRef(L.layerGroup());
  const [viewMode, setViewMode] = useState('suburbs'); // 'suburbs' | 'listings'

  // Aggregate listings by suburb
  const suburbData = useMemo(() => {
    const groups = {};
    listings.forEach(item => {
      if (!item.lat || !item.lng || isNaN(item.lat) || isNaN(item.lng)) return;
      if (!groups[item.suburb]) {
        groups[item.suburb] = { lat: item.lat, lng: item.lng, prices: [], goodValue: 0, items: [] };
      }
      groups[item.suburb].prices.push(item.price);
      groups[item.suburb].items.push(item);
      if (item.value_score > 1.15) groups[item.suburb].goodValue++;
    });
    return Object.entries(groups).map(([suburb, d]) => ({
      suburb,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lng),
      count: d.prices.length,
      medianPrice: calcMedian(d.prices),
      goodValue: d.goodValue,
      items: d.items
    }));
  }, [listings]);

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
      suburbData.forEach(({ suburb, lat, lng, count, medianPrice, goodValue }) => {
        const color = priceColor(medianPrice || 20000);
        const radius = Math.max(16, Math.min(42, Math.sqrt(count) * 6.5));

        const popupHtml = `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;padding:2px;color:#111;min-width:170px;">
            <b style="font-size:13px;text-transform:uppercase;display:block;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:8px;">${esc(suburb)}</b>
            <div style="font-size:12px;font-weight:800;margin-bottom:4px;">
              ${count} listing${count !== 1 ? 's' : ''}
            </div>
            <div style="font-size:11px;font-weight:700;color:#555;margin-bottom:${goodValue > 0 ? '4px' : '10px'};">
              Median R ${medianPrice ? medianPrice.toLocaleString('en-ZA') : '—'}/mo
            </div>
            ${goodValue > 0 ? `<div style="font-size:10px;font-weight:800;color:#111;background:#A3E635;border:2px solid #111;display:inline-block;padding:1px 7px;margin-bottom:10px;">${goodValue} good value</div>` : ''}
            <div style="display:flex;flex-direction:column;gap:5px;">
              <button onclick="if(window._ctRentalFilterSuburb)window._ctRentalFilterSuburb('${esc(suburb)}')" style="display:block;width:100%;text-align:center;border:2px solid #111;background:#FFD23F;padding:6px;font-size:11px;font-weight:900;text-transform:uppercase;color:#111;cursor:pointer;box-sizing:border-box;">
                Filter Table →
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
      // Individual Listings Pin Mode (Jittered)
      listings.forEach((item, idx) => {
        if (!item.lat || !item.lng || isNaN(item.lat) || isNaN(item.lng)) return;
        const { dLat, dLng } = pseudoJitter(item.url || item.address, idx);
        const pinLat = parseFloat(item.lat) + dLat;
        const pinLng = parseFloat(item.lng) + dLng;

        const isGoodValue = item.value_score > 1.15;
        const isPriceDrop = item.previous_price && item.price < item.previous_price;
        const isExpensive = item.value_score != null && item.value_score < 0.85;
        const color = isGoodValue ? '#10b981' : isExpensive ? '#ef4444' : '#2563EB';

        const imgHtml = item.main_image_url
          ? `<img src="${esc(item.main_image_url)}" alt="${esc(item.address || item.suburb)}" style="width:100%;height:85px;object-fit:cover;border:2px solid #111;margin-bottom:6px;" onerror="this.style.display='none'"/>`
          : '';

        const popupHtml = `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;padding:2px;color:#111;min-width:180px;max-width:220px;">
            ${imgHtml}
            <div style="font-size:10px;font-weight:900;text-transform:uppercase;color:#666;">${esc(item.suburb)}</div>
            <b style="font-size:12px;line-height:1.2;display:block;margin-bottom:4px;">${esc(item.address || item.suburb)}</b>
            <div style="font-size:14px;font-weight:900;color:#2563EB;margin-bottom:3px;">
              R ${item.price.toLocaleString('en-ZA')}/mo
            </div>
            ${isPriceDrop ? `<div style="font-size:10px;font-weight:800;color:#2563EB;margin-bottom:4px;">↓ was R ${item.previous_price.toLocaleString('en-ZA')}</div>` : ''}
            <div style="font-size:11px;font-weight:700;color:#444;margin-bottom:6px;">
              ${item.bedrooms != null ? `${item.bedrooms} Bed` : ''} ${item.size_m2 ? `· ${item.size_m2}m²` : ''} ${item.furnished ? '· Furnished' : ''}
            </div>
            ${isGoodValue ? `<div style="font-size:10px;font-weight:900;background:#A3E635;border:2px solid #111;padding:1px 6px;margin-bottom:8px;display:inline-block;">GOOD VALUE (${item.value_score}x)</div>` : ''}
            <div style="display:flex;gap:4px;">
              <button onclick="if(window._ctRentalSelectListingUrl)window._ctRentalSelectListingUrl('${esc(item.url)}')" style="flex:1;text-align:center;border:2px solid #111;background:#FFD23F;padding:5px;font-size:10px;font-weight:900;text-transform:uppercase;color:#111;cursor:pointer;">
                Details 🔍
              </button>
              <a href="${esc(item.url)}" target="_blank" rel="noreferrer" style="border:2px solid #111;background:#FAF6E9;padding:5px 8px;font-size:11px;font-weight:900;color:#111;text-decoration:none;display:inline-block;">
                ↗
              </a>
            </div>
          </div>
        `;

        const marker = L.circleMarker([pinLat, pinLng], {
          radius: isGoodValue ? 7 : 5.5,
          fillColor: color,
          color: '#111111',
          weight: 2,
          fillOpacity: 0.9,
          opacity: 1.0,
        });

        marker.bindPopup(popupHtml, { closeButton: true, offset: L.point(0, -4) });
        marker.addTo(markersLayer.current);
      });
    }
  }, [suburbData, listings, viewMode]);

  return (
    <div className="relative border-[3px] border-ink bg-neutral-100 shadow-[6px_6px_0_#111111] mb-7 h-[500px] z-0">
      <div ref={mapContainer} className="w-full h-full" />

      {listings.length === 0 && (
        <div className="absolute inset-0 bg-white/95 dark:bg-neutral-900/95 border-[3px] border-ink flex flex-col items-center justify-center z-[1000] p-6 text-center select-none">
          <div className="text-4xl mb-4">📍</div>
          <div className="text-base font-black uppercase tracking-tight text-ink mb-1">No Listings to Map</div>
          <div className="text-xs text-neutral-500 font-bold max-w-xs">
            All listings have been filtered out. Try adjusting your suburb or price filters.
          </div>
        </div>
      )}

      {/* Layer Mode Switcher Controls */}
      <div className="absolute top-4 left-4 z-[1000] flex gap-1 bg-white border-[3px] border-ink p-1 shadow-[4px_4px_0_#111111] select-none">
        <button
          onClick={() => setViewMode('suburbs')}
          className={`px-3 py-1 text-xs font-black uppercase transition-colors cursor-pointer border border-transparent ${
            viewMode === 'suburbs' ? 'bg-ink text-paper border-ink' : 'bg-transparent text-ink hover:bg-neutral-100'
          }`}
        >
          Suburb Overview
        </button>
        <button
          onClick={() => setViewMode('listings')}
          className={`px-3 py-1 text-xs font-black uppercase transition-colors cursor-pointer border border-transparent ${
            viewMode === 'listings' ? 'bg-ink text-paper border-ink' : 'bg-transparent text-ink hover:bg-neutral-100'
          }`}
        >
          All Pins ({listings.length})
        </button>
      </div>

      {/* Legend */}
      <div className="absolute left-4 bottom-4 bg-white border-[3px] border-ink p-3 shadow-[4px_4px_0_#111111] text-xs font-bold z-[1000] rounded-none max-w-[200px] select-none pointer-events-auto">
        <div className="font-extrabold uppercase tracking-wide border-b-2 border-ink pb-1 mb-2">
          {viewMode === 'suburbs' ? 'Median Price' : 'Rental Value Tier'}
        </div>
        <div className="flex flex-col gap-1.5">
          {viewMode === 'listings' ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#10b981]" />
                <span className="font-extrabold text-emerald-800">Good Value (&gt;1.15x)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#2563EB]" />
                <span className="font-bold text-blue">Fair / Market Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#ef4444]" />
                <span className="font-bold text-rose-700">Premium / High</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#10b981]" /><span>≤ R15k</span></div>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#f59e0b]" /><span>R15k – R22k</span></div>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#f97316]" /><span>R22k – R35k</span></div>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#ef4444]" /><span>&gt; R35k</span></div>
            </>
          )}
        </div>
        <div className="mt-2 pt-1.5 border-t border-dashed border-ink/40 text-[0.5625rem] opacity-60">
          {viewMode === 'suburbs' ? 'Bubble size = listing count' : 'Pins jittered near suburb centroid'}
        </div>
      </div>
    </div>
  );
}
