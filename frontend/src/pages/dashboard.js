/**
 * Dashboard page — station grid with filters, stats, AI predictions,
 * source selector (local/external/all), and interactive map view.
 */
import { stations, predictions, getUser } from '../api.js';
import { renderStationCard } from '../components/station-card.js';
import { initMap, setMarkers, destroyMap, focusStation } from '../components/map.js';
import { onWSMessage } from '../ws.js';
import { showToast } from '../main.js';

let allStations = [];
let currentView = 'list';  // 'list' | 'map'
let currentSource = 'local'; // 'local' | 'external' | 'all'
let recommendedStationId = null;

export function renderDashboard() {
  return `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">⚡ Charging Stations</h1>
        <p class="page-subtitle"><span class="live-dot"></span> Real-time availability • AI-powered predictions • Live map</p>
      </div>

      <div class="stats-row" id="stats-row">
        <div class="stat-card"><div class="stat-icon">🏪</div><div class="stat-value" id="stat-total">—</div><div class="stat-label">Total Stations</div></div>
        <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value" id="stat-available">—</div><div class="stat-label">Available Now</div></div>
        <div class="stat-card"><div class="stat-icon">🔌</div><div class="stat-value" id="stat-slots">—</div><div class="stat-label">Open Slots</div></div>
        <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-value" id="stat-rating">—</div><div class="stat-label">Avg Rating</div></div>
      </div>

      <div id="recommendations-section"></div>

      <div class="filters-bar">
        <input class="form-input" type="text" id="filter-search" placeholder="🔍 Search by name, location, or area..." />
        <select class="form-input" id="filter-connector" style="max-width:180px">
          <option value="">All Connectors</option>
          <option value="CCS2">CCS2</option>
          <option value="CHAdeMO">CHAdeMO</option>
          <option value="Type2">Type 2</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:0.85rem;cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="filter-available" /> Available only
        </label>

        <div class="toolbar-right">
          <!-- Source selector -->
          <div class="source-toggle" id="source-toggle" aria-label="Data source">
            <button class="source-btn active" data-source="local" title="Local database stations">🏠 Local</button>
            <button class="source-btn" data-source="all" title="Local + OpenChargeMap stations">🌍 All</button>
            <button class="source-btn" data-source="external" title="OpenChargeMap real-world stations">🌐 External</button>
          </div>

          <!-- View toggle -->
          <div class="view-toggle" id="view-toggle" aria-label="View mode">
            <button class="view-btn active" data-view="list" title="List view">📋 List</button>
            <button class="view-btn" data-view="map" title="Map view">🗺️ Map</button>
          </div>
        </div>
      </div>

      <!-- Station grid (list view) -->
      <div id="station-grid" class="station-grid">
        <div class="loading"><div class="spinner"></div>Loading stations...</div>
      </div>

      <!-- Map container (map view) -->
      <div id="map-container" style="display:none" aria-label="Interactive station map"></div>

      <!-- External data notice (shown when source != local) -->
      <div id="external-notice" style="display:none" class="external-notice">
        🌐 <strong>External stations</strong> — availability &amp; pricing are simulated. Real-time data via <a href="https://openchargemap.org" target="_blank" rel="noopener">OpenChargeMap</a>.
      </div>

      <!-- Prediction modal -->
      <div id="prediction-modal" style="display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;padding:2rem">
        <div class="prediction-panel" style="max-width:460px;width:100%">
          <div class="card-header">
            <h3 class="card-title">🤖 AI Wait-Time Prediction</h3>
            <button class="btn btn-icon btn-secondary" id="close-prediction">✕</button>
          </div>
          <div id="prediction-content"></div>
        </div>
      </div>
    </div>
  `;
}

export async function bindDashboard() {
  // Load initial stations
  await loadStations();

  // Load AI recommendations
  loadRecommendations();

  // Filters
  document.getElementById('filter-search')?.addEventListener('input', applyFilters);
  document.getElementById('filter-connector')?.addEventListener('change', applyFilters);
  document.getElementById('filter-available')?.addEventListener('change', applyFilters);

  // Source toggle
  document.getElementById('source-toggle')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.source-btn');
    if (!btn) return;
    document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSource = btn.dataset.source;
    loadStations();
    updateExternalNotice();
  });

  // View toggle
  document.getElementById('view-toggle')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    switchView(btn.dataset.view);
  });

  // Real-time updates (only affect local stations)
  onWSMessage((msg) => {
    if (msg.type === 'station_update') {
      const s = allStations.find(st => st.id === msg.data.id);
      if (s) {
        Object.assign(s, msg.data);
        applyFilters();
        updateStats(allStations);
        if (currentView === 'map') refreshMap(getFiltered());
      }
    }
  });

  // Close prediction modal
  document.getElementById('close-prediction')?.addEventListener('click', closePrediction);
  document.getElementById('prediction-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'prediction-modal') closePrediction();
  });
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadStations() {
  const grid = document.getElementById('station-grid');
  if (grid) grid.innerHTML = '<div class="loading"><div class="spinner"></div>Loading stations...</div>';

  try {
    allStations = await stations.list({ source: currentSource });
    applyFilters();
    updateStats(allStations);
  } catch (err) {
    if (grid) grid.innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Failed to load stations. Is the backend running?</p></div>';
  }
}

// ── View switching ────────────────────────────────────────────────────────────

function switchView(view) {
  currentView = view;
  const grid = document.getElementById('station-grid');
  const mapEl = document.getElementById('map-container');

  if (view === 'map') {
    grid.style.display = 'none';
    mapEl.style.display = 'block';
    // Small delay to ensure container is painted before Leaflet measures it
    setTimeout(() => {
      initMap('map-container');
      refreshMap(getFiltered());
    }, 50);
  } else {
    destroyMap();
    mapEl.style.display = 'none';
    grid.style.display = '';
    renderStations(getFiltered());
  }
}

function refreshMap(filtered) {
  setMarkers(filtered, recommendedStationId, (stationId) => {
    if (!getUser()) {
      showToast('Please login to book a slot', 'error');
      location.hash = '#/login';
      return;
    }
    location.hash = `#/book/${stationId}`;
  });
}

// ── Filters ───────────────────────────────────────────────────────────────────

function getFiltered() {
  const search = (document.getElementById('filter-search')?.value || '').toLowerCase();
  const connector = document.getElementById('filter-connector')?.value || '';
  const availableOnly = document.getElementById('filter-available')?.checked || false;

  return allStations.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search) ||
      s.location.toLowerCase().includes(search) ||
      (s.area || '').toLowerCase().includes(search);
    const matchConnector = !connector || s.connector_type === connector;
    const matchAvailable = !availableOnly || s.available_slots > 0;
    return matchSearch && matchConnector && matchAvailable;
  });
}

function applyFilters() {
  const filtered = getFiltered();
  if (currentView === 'list') {
    renderStations(filtered);
  } else {
    refreshMap(filtered);
  }
}

// ── Render helpers ─────────────────────────────────────────────────────────────

function renderStations(list) {
  const grid = document.getElementById('station-grid');
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>No stations found matching your filters</p></div>';
    return;
  }

  grid.innerHTML = list.map(renderStationCard).join('');

  // Bind book buttons
  grid.querySelectorAll('.book-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!getUser()) {
        showToast('Please login to book a slot', 'error');
        location.hash = '#/login';
        return;
      }
      location.hash = `#/book/${btn.dataset.id}`;
    });
  });

  // Bind predict buttons
  grid.querySelectorAll('.predict-btn').forEach(btn => {
    btn.addEventListener('click', () => showPrediction(parseInt(btn.dataset.id)));
  });

  // Highlight recommended card
  if (recommendedStationId) {
    const card = grid.querySelector(`[data-station-id="${recommendedStationId}"]`);
    if (card) card.classList.add('station-card--recommended');
  }
}

function updateStats(list) {
  const el = (id) => document.getElementById(id);
  if (!el('stat-total')) return;
  el('stat-total').textContent = list.length;
  el('stat-available').textContent = list.filter(s => s.available_slots > 0).length;
  el('stat-slots').textContent = list.reduce((a, s) => a + s.available_slots, 0);
  const avg = list.length ? (list.reduce((a, s) => a + s.rating, 0) / list.length).toFixed(1) : '—';
  el('stat-rating').textContent = avg;
}

function updateExternalNotice() {
  const notice = document.getElementById('external-notice');
  if (!notice) return;
  notice.style.display = currentSource !== 'local' ? 'block' : 'none';
}

// ── Prediction modal ──────────────────────────────────────────────────────────

async function showPrediction(stationId) {
  const modal = document.getElementById('prediction-modal');
  const content = document.getElementById('prediction-content');
  modal.style.display = 'flex';

  const now = new Date();

  content.innerHTML = '<div class="loading"><div class="spinner"></div>Running AI model...</div>';

  try {
    const result = await predictions.waitTime({
      station_id: stationId,
      hour: now.getHours(),
      day_of_week: now.getDay(),
    });

    content.innerHTML = `
      <p style="text-align:center;color:var(--text-secondary);font-size:0.9rem;margin-top:0.5rem">${result.station_name}</p>
      <div class="prediction-value">${result.predicted_wait_minutes} min</div>
      <p style="text-align:center;margin-bottom:1rem">
        <span class="badge ${result.confidence === 'high' ? 'badge-success' : result.confidence === 'medium' ? 'badge-warning' : 'badge-danger'}">
          ${result.confidence} confidence
        </span>
      </p>
      <ul class="prediction-recommendations">
        ${result.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    `;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><p>⚠️ ${err.message}</p></div>`;
  }
}

function closePrediction() {
  document.getElementById('prediction-modal').style.display = 'none';
}

// ── Smart Recommendations ────────────────────────────────────────────────────

async function loadRecommendations() {
  const section = document.getElementById('recommendations-section');
  if (!section) return;

  try {
    const data = await stations.recommend();
    recommendedStationId = data.best?.station?.id || null;
    renderRecommendations(section, data);
  } catch {
    section.innerHTML = ''; // silently skip if endpoint fails
  }
}

function renderRecommendations(container, data) {
  const best = data.best;
  const runners = data.ranked.slice(1, 4); // top 3 runners-up

  const scoreBar = (label, value, color) => `
    <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
      <span style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;width:80px;letter-spacing:0.03em">${label}</span>
      <div style="flex:1;height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden">
        <div style="width:${value}%;height:100%;background:${color};border-radius:3px;transition:width 0.6s ease"></div>
      </div>
      <span style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);width:32px;text-align:right">${value}</span>
    </div>
  `;

  container.innerHTML = `
    <div style="margin-bottom:1.5rem">
      <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:1rem;display:flex;align-items:center;gap:8px">
        🏆 Recommended for You
        <span class="badge badge-info" style="font-size:0.65rem">AI-POWERED</span>
      </h2>

      <div class="rec-hero" style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
        <!-- Best Pick Hero -->
        <div class="card" style="border-color:var(--primary);box-shadow:0 0 25px rgba(0,212,170,0.15);position:relative;overflow:hidden">
          <div style="position:absolute;top:12px;right:12px">
            <span class="badge badge-success" style="font-size:0.7rem">👑 #1 BEST PICK</span>
          </div>
          <h3 class="card-title" style="margin-bottom:4px;padding-right:100px">${best.station.name}</h3>
          <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1rem">📍 ${best.station.area}, ${best.station.location}</p>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:1rem">
            <div style="text-align:center;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm)">
              <div style="font-size:1.4rem;font-weight:800;background:linear-gradient(135deg,var(--primary),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${best.score}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Score</div>
            </div>
            <div style="text-align:center;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm)">
              <div style="font-size:1.4rem;font-weight:800;color:var(--primary)">${best.predicted_wait_minutes}<span style="font-size:0.7rem"> min</span></div>
              <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Wait</div>
            </div>
            <div style="text-align:center;padding:10px;background:var(--bg-input);border-radius:var(--radius-sm)">
              <div style="font-size:1.4rem;font-weight:800;color:var(--success)">${best.station.available_slots}/${best.station.total_slots}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase">Slots</div>
            </div>
          </div>

          <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:1rem;font-style:italic">💡 ${best.reason}</p>

          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" style="flex:1" onclick="${best.station.available_slots > 0 ? `location.hash='#/book/${best.station.id}'` : ''}" ${best.station.available_slots <= 0 ? 'disabled' : ''}>
              ⚡ Book Best Station
            </button>
            <button class="btn btn-secondary" id="rec-view-map-btn" title="View on map">🗺️</button>
          </div>
        </div>

        <!-- Score Breakdown -->
        <div class="card">
          <h3 class="card-title" style="margin-bottom:12px;font-size:0.95rem">📊 Score Breakdown — ${best.station.name.split('—')[0].trim()}</h3>
          ${scoreBar('Availability', best.score_breakdown.availability, 'var(--success)')}
          ${scoreBar('Wait Time', best.score_breakdown.wait_time, 'var(--primary)')}
          ${scoreBar('Price', best.score_breakdown.price, 'var(--warning)')}
          ${scoreBar('Capacity', best.score_breakdown.capacity, 'var(--accent-light)')}

          <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">Station details</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <span style="font-size:0.85rem">⚡ ${best.station.capacity_kw} kW</span>
              <span style="font-size:0.85rem">🔌 ${best.station.connector_type}</span>
              <span style="font-size:0.85rem">💰 ₹${best.station.price_per_kwh}/kWh</span>
              <span style="font-size:0.85rem">⭐ ${best.station.rating}</span>
            </div>
          </div>
        </div>
      </div>

      ${runners.length > 0 ? `
        <div style="display:grid;grid-template-columns:repeat(${runners.length}, 1fr);gap:1rem;margin-top:1rem">
          ${runners.map((r, i) => `
            <div class="card" style="padding:1rem">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span class="badge badge-info" style="font-size:0.65rem">#${i + 2}</span>
                <span style="font-size:0.8rem;font-weight:700;color:var(--primary)">${r.score} pts</span>
              </div>
              <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:4px">${r.station.name}</h4>
              <p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">📍 ${r.station.area} • ~${r.predicted_wait_minutes} min wait</p>
              <div style="display:flex;gap:6px">
                <button class="btn btn-primary btn-sm" style="flex:1;font-size:0.75rem" onclick="location.hash='#/book/${r.station.id}'" ${r.station.available_slots <= 0 ? 'disabled' : ''}>
                  Book
                </button>
                <button class="btn btn-secondary btn-sm predict-btn" style="flex:1;font-size:0.75rem" data-id="${r.station.id}">
                  🤖 Predict
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  // Bind predict buttons in recommendations
  container.querySelectorAll('.predict-btn').forEach(btn => {
    btn.addEventListener('click', () => showPrediction(parseInt(btn.dataset.id)));
  });

  // "View on map" button in recommendations
  document.getElementById('rec-view-map-btn')?.addEventListener('click', () => {
    // Switch to map view and zoom to best station
    const mapViewBtn = document.querySelector('.view-btn[data-view="map"]');
    if (mapViewBtn) mapViewBtn.click();
    setTimeout(() => focusStation(best.station.id, allStations), 200);
  });
}
