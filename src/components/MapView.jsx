import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set public token from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

export default function MapView({ listings }) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  // 1. Convert filtered listings to GeoJSON FeatureCollection
  const getGeoJSON = (items) => {
    const features = items
      .filter(item => item.lat && item.lng && !isNaN(item.lat) && !isNaN(item.lng))
      .map(item => {
        // Enforce bounds checks for Cape Town
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(item.lng), parseFloat(item.lat)] // Mapbox requires [lng, lat]
          },
          properties: {
            id: item.id,
            address: item.address || item.suburb,
            price: item.price,
            price_text: `R ${item.price.toLocaleString('en-ZA')}`,
            bedrooms: item.bedrooms,
            size_m2: item.size_m2,
            price_per_m2: item.price_per_m2,
            value_score: item.value_score,
            url: item.url,
            suburb: item.suburb,
            geocode_precise: item.geocode_precise ? 1 : 0
          }
        };
      });

    return {
      type: 'FeatureCollection',
      features
    };
  };

  // 2. Initialise Mapbox Map instance
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [18.4241, -33.9249], // CBD [lng, lat]
      zoom: 11.8 // Fitting Woodstock to Sea Point & Claremont
    });

    const m = map.current;

    // Add navigation controls
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    m.on('load', () => {
      // Add data source
      m.addSource('listings', {
        type: 'geojson',
        data: getGeoJSON(listings)
      });

      // Add circle layer
      m.addLayer({
        id: 'listings-layer',
        type: 'circle',
        source: 'listings',
        paint: {
          // Circle color by price
          'circle-color': [
            'step',
            ['get', 'price'],
            '#10b981', // <= R15k (Green)
            15001, '#f59e0b', // R15k - R22k (Amber)
            22001, '#f97316', // R22k - R35k (Orange)
            35001, '#ef4444'  // > R35k (Red)
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 6,
            15, 12
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#111111',
          // Opacity: 0.7 for precise geocode, 0.3 for approximate
          'circle-opacity': [
            'case',
            ['==', ['get', 'geocode_precise'], 1], 0.7,
            0.3
          ]
        }
      });

      // 3. Click popup handler
      m.on('click', 'listings-layer', (e) => {
        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates.slice();
        const p = feature.properties;

        // Construct HTML for ValueBadge inside popup
        let valueBadgeHtml = '';
        if (p.value_score !== null && p.value_score !== undefined && p.value_score !== 'null') {
          const score = parseFloat(p.value_score);
          let label = 'Fair';
          let bg = '#E5E1D4'; // bgrey
          let fg = '#111111';
          
          if (score > 1.15) {
            label = 'Good value';
            bg = '#A3E635'; // lime
          } else if (score < 0.85) {
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

        // Popup HTML structure
        const html = `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 2px; color: #111;">
            <b style="font-size: 13px; text-transform: uppercase; display: block; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 6px;">${p.address}</b>
            <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">
              ${p.bedrooms && p.bedrooms !== 'null' ? p.bedrooms + ' bed' : 'Room/Studio'} 
              ${p.size_m2 && p.size_m2 !== 'null' ? '· ' + p.size_m2 + 'm²' : ''} 
              <span style="opacity: 0.6; font-size: 9px;">(${p.suburb})</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
              <span style="font-weight: 900; font-size: 14px; color: #111;">${p.price_text}</span>
              <span style="font-size: 10px; font-weight: 800; opacity: 0.7;">${p.price_per_m2 && p.price_per_m2 !== 'null' ? p.price_per_m2 + ' R/m²' : ''}</span>
            </div>
            ${valueBadgeHtml}
            <div style="margin-top: 10px;">
              <a href="${p.url}" target="_blank" style="display: block; text-align: center; border: 2px solid #111; background: #FFD23F; padding: 4px; font-size: 11px; font-weight: 900; text-decoration: none; color: #111; box-shadow: 2px 2px 0 #111;">
                VIEW LISTING ↗
              </a>
            </div>
          </div>
        `;

        // Ensure popup is placed correctly
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(html)
          .addTo(m);
      });

      // Change cursor on hover
      m.on('mouseenter', 'listings-layer', () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'listings-layer', () => {
        m.getCanvas().style.cursor = '';
      });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 4. Update map source when listings change
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded() && map.current.getSource('listings')) {
      map.current.getSource('listings').setData(getGeoJSON(listings));
    }
  }, [listings]);

  return (
    <div className="relative border-[3px] border-ink bg-neutral-100 shadow-[6px_6px_0_#111111] mb-7 h-[450px]">
      {/* Map Element */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Brutalist Legend */}
      <div className="absolute left-4 bottom-4 bg-white border-[3px] border-ink p-3 shadow-[4px_4px_0_#111111] text-xs font-bold z-10 rounded-none max-w-[160px] select-none pointer-events-auto">
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
