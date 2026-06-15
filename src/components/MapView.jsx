import { useEffect, useRef, useMemo } from 'react';
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

export default function MapView({ listings, onFilterSuburb }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersLayer = useRef(L.layerGroup());

  // Aggregate listings by suburb
  const suburbData = useMemo(() => {
    const groups = {};
    listings.forEach(item => {
      if (!item.lat || !item.lng || isNaN(item.lat) || isNaN(item.lng)) return;
      if (!groups[item.suburb]) {
        groups[item.suburb] = { lat: item.lat, lng: item.lng, prices: [], goodValue: 0 };
      }
      groups[item.suburb].prices.push(item.price);
      if (item.value_score > 1.15) groups[item.suburb].goodValue++;
    });
    return Object.entries(groups).map(([suburb, d]) => ({
      suburb,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lng),
      count: d.prices.length,
      medianPrice: calcMedian(d.prices),
      goodValue: d.goodValue,
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    markersLayer.current.addTo(map);

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Keep window callback in sync
  useEffect(() => {
    window._ctRentalFilterSuburb = onFilterSuburb || null;
    return () => { window._ctRentalFilterSuburb = null; };
  }, [onFilterSuburb]);

  // Redraw suburb bubbles whenever data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersLayer.current.clearLayers();

    suburbData.forEach(({ suburb, lat, lng, count, medianPrice, goodValue }) => {
      const color = priceColor(medianPrice);
      const radius = Math.max(14, Math.min(38, Math.sqrt(count) * 6));

      const popupHtml = `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;padding:2px;color:#111;min-width:160px;">
          <b style="font-size:13px;text-transform:uppercase;display:block;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:8px;">${esc(suburb)}</b>
          <div style="font-size:12px;font-weight:700;margin-bottom:4px;">
            ${count} listing${count !== 1 ? 's' : ''}
          </div>
          <div style="font-size:11px;font-weight:600;color:#555;margin-bottom:${goodValue > 0 ? '4px' : '10px'};">
            Median R ${medianPrice ? medianPrice.toLocaleString('en-ZA') : '—'}/mo
          </div>
          ${goodValue > 0 ? `<div style="font-size:10px;font-weight:800;color:#111;background:#A3E635;border:2px solid #111;display:inline-block;padding:1px 7px;margin-bottom:10px;">${goodValue} good value</div>` : ''}
          <button onclick="if(window._ctRentalFilterSuburb)window._ctRentalFilterSuburb('${esc(suburb)}')" style="display:block;width:100%;text-align:center;border:2px solid #111;background:#FAF6E9;padding:5px;font-size:11px;font-weight:900;text-transform:uppercase;color:#111;cursor:pointer;box-sizing:border-box;">
            View listings →
          </button>
        </div>
      `;

      const marker = L.circleMarker([lat, lng], {
        radius,
        fillColor: color,
        color: '#111111',
        weight: 2.5,
        fillOpacity: 0.75,
        opacity: 1.0,
      });

      marker.bindPopup(popupHtml, { closeButton: true, offset: L.point(0, -6) });
      marker.addTo(markersLayer.current);
    });
  }, [suburbData]);

  return (
    <div className="relative border-[3px] border-ink bg-neutral-100 shadow-[6px_6px_0_#111111] mb-7 h-[450px] z-0">
      <div ref={mapContainer} className="w-full h-full" />

      {listings.length === 0 && (
        <div className="absolute inset-0 bg-white/95 border-[3px] border-ink flex flex-col items-center justify-center z-[1000] p-6 text-center select-none">
          <div className="text-4xl mb-4">📍</div>
          <div className="text-base font-black uppercase tracking-tight text-ink mb-1">No Listings to Map</div>
          <div className="text-xs text-neutral-500 font-bold max-w-xs">
            All listings have been filtered out. Try adjusting your suburb or price filters.
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute left-4 bottom-4 bg-white border-[3px] border-ink p-3 shadow-[4px_4px_0_#111111] text-xs font-bold z-[1000] rounded-none max-w-[180px] select-none pointer-events-auto">
        <div className="font-extrabold uppercase tracking-wide border-b-2 border-ink pb-1 mb-2">Median Price</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#10b981]" /><span>≤ R15k</span></div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#f59e0b]" /><span>R15k – R22k</span></div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#f97316]" /><span>R22k – R35k</span></div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#ef4444]" /><span>&gt; R35k</span></div>
        </div>
        <div className="mt-2 pt-1.5 border-t border-dashed border-ink/40 text-[0.5625rem] opacity-60">
          Bubble size = listing count
        </div>
      </div>
    </div>
  );
}
