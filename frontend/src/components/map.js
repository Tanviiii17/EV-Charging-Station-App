/**
 * Interactive Leaflet map component for station visualization.
 *
 * Usage:
 *   import { initMap, setMarkers, destroyMap } from './map.js';
 *
 *   initMap('map-container');
 *   setMarkers(stations, recommendedStationId);
 *   destroyMap();
 */
import L from 'leaflet';

// Fix Leaflet's default icon path when bundled with Vite
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
});

// ── Icon definitions ──────────────────────────────────────────────────────────

/** Default teal icon for local stations */
const iconLocal = L.divIcon({
  className: '',
  html: `<div class="map-marker map-marker--local">⚡</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -38],
});

/** Cloud icon for external (OCM) stations */
const iconExternal = L.divIcon({
  className: '',
  html: `<div class="map-marker map-marker--external">🌐</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -38],
});

/** Gold star icon for the top-recommended station */
const iconRecommended = L.divIcon({
  className: '',
  html: `<div class="map-marker map-marker--recommended">👑</div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -44],
});

// ── Module state ──────────────────────────────────────────────────────────────

let _map = null;
let _markers = [];


// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise the Leaflet map inside `containerId`.
 * Safe to call multiple times — destroys previous instance first.
 * @param {string} containerId  DOM element ID of the map container
 */
export function initMap(containerId) {
  destroyMap();

  const el = document.getElementById(containerId);
  if (!el) {
    console.warn('[map] Element #%s not found', containerId);
    return;
  }

  // India centred, zoom 5
  _map = L.map(containerId, {
    center: [20.5937, 78.9629],
    zoom: 5,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(_map);
}


/**
 * Plot station markers on the map.
 * @param {Array}  stations          Array of station objects (StationOut shape)
 * @param {number|null} recommendedId Station id to highlight as recommended
 * @param {Function} onBook          Callback(stationId) when Book is clicked inside popup
 */
export function setMarkers(stations, recommendedId = null, onBook = null) {
  if (!_map) return;

  // Clear existing markers
  _markers.forEach(m => m.remove());
  _markers = [];

  const validStations = stations.filter(
    s => s.latitude && s.longitude && !(s.latitude === 0 && s.longitude === 0)
  );

  if (validStations.length === 0) {
    return;
  }

  const bounds = [];

  validStations.forEach(station => {
    const isRecommended = station.id === recommendedId;
    const isExternal = station.source === 'external';

    const icon = isRecommended ? iconRecommended
                : isExternal   ? iconExternal
                :                iconLocal;

    const availClass = station.available_slots > 0 ? 'avail-yes' : 'avail-no';
    const availText  = station.available_slots > 0
      ? `<span class="pop-avail ${availClass}">✅ ${station.available_slots}/${station.total_slots} slots free</span>`
      : `<span class="pop-avail ${availClass}">🔴 No slots available</span>`;

    const sourceTag = isExternal
      ? `<span class="pop-source">🌐 OpenChargeMap</span>`
      : `<span class="pop-source">🏠 Local DB</span>`;

    const recBadge = isRecommended
      ? `<div class="pop-rec-badge">👑 AI Top Pick</div>`
      : '';

    const bookBtn = station.available_slots > 0 && !isExternal
      ? `<button class="pop-book-btn" data-id="${station.id}">⚡ Book Now</button>`
      : station.available_slots === 0
        ? `<button class="pop-book-btn" disabled>Fully Booked</button>`
        : `<button class="pop-book-btn" disabled title="Booking for external stations coming soon">External Station</button>`;

    const popupHtml = `
      <div class="map-popup">
        ${recBadge}
        <div class="pop-name">${station.name}</div>
        <div class="pop-loc">📍 ${station.area}, ${station.location}</div>
        <div class="pop-row">
          ${availText}
          ${sourceTag}
        </div>
        <div class="pop-stats">
          <div class="pop-stat"><span class="pop-stat-label">Price</span><span class="pop-stat-val">₹${station.price_per_kwh}/kWh</span></div>
          <div class="pop-stat"><span class="pop-stat-label">Power</span><span class="pop-stat-val">${station.capacity_kw} kW</span></div>
          <div class="pop-stat"><span class="pop-stat-label">Rating</span><span class="pop-stat-val">⭐ ${station.rating}</span></div>
          <div class="pop-stat"><span class="pop-stat-label">Type</span><span class="pop-stat-val">${station.connector_type}</span></div>
        </div>
        ${bookBtn}
      </div>
    `;

    const marker = L.marker([station.latitude, station.longitude], { icon })
      .addTo(_map)
      .bindPopup(popupHtml, { maxWidth: 280, className: 'ev-popup' });

    // Wire up Book button after popup opens
    marker.on('popupopen', () => {
      const btn = document.querySelector('.pop-book-btn[data-id]');
      if (btn) {
        btn.addEventListener('click', () => {
          const sid = parseInt(btn.dataset.id);
          if (onBook) onBook(sid);
          else location.hash = `#/book/${sid}`;
        });
      }
    });

    _markers.push(marker);
    bounds.push([station.latitude, station.longitude]);
  });

  // Fit map to show all markers (with padding)
  if (bounds.length > 0) {
    try {
      _map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    } catch (_) { /* ignore edge cases */ }
  }
}


/**
 * Pan/zoom map to highlight a specific station by id.
 * @param {number} stationId
 * @param {Array}  stations
 */
export function focusStation(stationId, stations) {
  if (!_map) return;
  const station = stations.find(s => s.id === stationId);
  if (!station || !station.latitude) return;
  _map.setView([station.latitude, station.longitude], 13, { animate: true, duration: 0.8 });
}


/**
 * Destroy the map instance and clean up markers.
 */
export function destroyMap() {
  if (_map) {
    _markers.forEach(m => m.remove());
    _markers = [];
    _map.remove();
    _map = null;
  }
}


/** Returns true if a map instance is currently active */
export function isMapActive() {
  return _map !== null;
}
