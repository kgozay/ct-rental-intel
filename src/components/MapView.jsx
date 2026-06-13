import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapView({ listings }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersLayer = useRef(L.layerGroup());

  // 1. Initialise Leaflet Map
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    // Create Leaflet map: center at [-33.9249, 18.4241] (Cape Town CBD), zoom 12
    const map = L.map(mapContainer.current, {
      center: [-33.9249, 18.4241], // Leaflet uses [lat, lng]
      zoom: 12,
      zoomControl: false // Position zoom control manually
    });

    mapRef.current = map;

    // Add standard Zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add CartoDB Voyager Tile Layer (High contrast, beautiful, completely free)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Add the markers layer group to the map
    markersLayer.current.addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Redraw markers whenever listings array updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing pins
    markersLayer.current.clearLayers();

    // Plot listings as CircleMarkers
    listings
      .filter(item => item.lat && item.lng && !isNaN(item.lat) && !isNaN(item.lng))
      .forEach(item => {
        // Price color bands
        let color = '#10b981'; // <= R15k (Green)
        if (item.price > 35000) {
          color = '#ef4444'; // > R35k (Red)
        } else if (item.price > 22000) {
          color = '#f97316'; // R22k - R35k (Orange)
        } else if (item.price > 15000) {
          color = '#f59e0b'; // R15k - R22k (Amber)
        }

        // Opacity: 0.7 for precise geocodes, 0.3 for approximate centroids
        const opacity = item.geocode_precise ? 0.7 : 0.3;

        // Custom Value Badge HTML inside popup
        let valueBadgeHtml = '';
        if (item.value_score !== null && item.value_score !== undefined) {
          let label = 'Fair';
          let bg = '#E5E1D4'; // bgrey
          let fg = '#111111';
          
          if (item.value_score > 1.15) {
            label = 'Good value';
            bg = '#A3E635'; // lime
          } else if (item.value_score < 0.85) {
            label = 'Expensive';
            bg = '#FF5436'; // bred
            fg = '#ffffff';
          }
          
          valueBadgeHtml = `
            <div style="margin-top: 8px;">
              <span style="display: inline-block; border: 2px solid #111; padding: 2px 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: ${bg}; color: ${fg};">
                ${label}
              </span>
            </div>
          `;
        }

        // Neo-Brutalist Popup HTML Template
        const popupHtml = `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 2px; color: #111;">
            <b style="font-size: 13px; text-transform: uppercase; display: block; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 6px;">${item.address || item.suburb}</b>
            <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">
              ${item.bedrooms ? item.bedrooms + ' bed' : 'Room/Studio'} 
              ${item.size_m2 ? '· ' + item.size_m2 + 'm²' : ''} 
              <span style="opacity: 0.6; font-size: 9px;">(${item.suburb})</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
              <span style="font-weight: 900; font-size: 14px; color: #111;">R ${item.price.toLocaleString('en-ZA')}</span>
              <span style="font-size: 10px; font-weight: 800; opacity: 0.7;">${item.price_per_m2 ? item.price_per_m2 + ' R/m²' : ''}</span>
            </div>
            ${valueBadgeHtml}
            <div style="margin-top: 10px;">
              <a href="${item.url}" target="_blank" style="display: block; text-align: center; border: 2px solid #111; background: #FFD23F; padding: 4px; font-size: 11px; font-weight: 900; text-decoration: none; color: #111; box-shadow: 2px 2px 0 #111;">
                VIEW LISTING ↗
              </a>
            </div>
          </div>
        `;

        let lat = parseFloat(item.lat);
        let lng = parseFloat(item.lng);
        
        // If the geocode is not precise, add a deterministic jitter to spread approximate listings around the suburb centroid
        if (!item.geocode_precise) {
          const idNum = parseInt(item.listing_id, 10) || 0;
          const latJitter = ((idNum % 100) / 100 - 0.5) * 0.006; // -0.003 to 0.003 degrees offset
          const lngJitter = (((idNum / 100) % 100) / 100 - 0.5) * 0.006;
          lat += latJitter;
          lng += lngJitter;
        }

        // Create Leaflet circleMarker
        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: color,
          color: '#111111', // ink outline
          weight: 2,
          fillOpacity: opacity,
          opacity: 1.0
        });

        // Bind popup and add to layer group
        marker.bindPopup(popupHtml, {
          closeButton: true,
          offset: L.point(0, -6)
        });
        
        marker.addTo(markersLayer.current);
      });
  }, [listings]);

  return (
    <div className="relative border-[3px] border-ink bg-neutral-100 shadow-[6px_6px_0_#111111] mb-7 h-[450px] z-0">
      {/* Map Element */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Brutalist Legend */}
      <div className="absolute left-4 bottom-4 bg-white border-[3px] border-ink p-3 shadow-[4px_4px_0_#111111] text-xs font-bold z-[1000] rounded-none max-w-[160px] select-none pointer-events-auto">
        <div className="font-extrabold uppercase tracking-wide border-b-2 border-ink pb-1 mb-2">Price Band</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#10b981]" />
            <span>≤ R15k</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#f59e0b]" />
            <span>R15k – R22k</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#f97316]" />
            <span>R22k – R35k</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-ink rounded-full bg-[#ef4444]" />
            <span>&gt; R35k</span>
          </div>
        </div>
        <div className="mt-2 pt-1.5 border-t border-dashed border-ink/40 text-[9px] opacity-60">
          * Solid color = precise geocode<br/>
          * Faded color = approximate suburb centroid
        </div>
      </div>
    </div>
  );
}
