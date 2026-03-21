/**
 * Analytics page — charts and summary stats for the EV charging network.
 * Uses HTML5 Canvas for lightweight bar and line charts (no external libraries).
 */
import { stations } from '../api.js';
import { getUser } from '../api.js';

async function fetchAnalytics() {
  const res = await fetch('/api/analytics/overview');
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

export function renderAnalytics() {
  return `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">📊 Analytics Dashboard</h1>
        <p class="page-subtitle">Network-wide insights and AI-powered usage patterns</p>
      </div>

      <div id="analytics-content">
        <div class="loading"><div class="spinner"></div>Crunching the numbers...</div>
      </div>
    </div>
  `;
}

export async function bindAnalytics() {
  const container = document.getElementById('analytics-content');
  try {
    const data = await fetchAnalytics();
    renderAnalyticsContent(container, data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function renderAnalyticsContent(container, data) {
  const s = data.summary;

  container.innerHTML = `
    <!-- Summary Cards -->
    <div class="stats-row" style="margin-bottom:1.5rem">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${s.total_bookings}</div>
        <div class="stat-label">Total Bookings</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${s.active_bookings}</div>
        <div class="stat-label">Active Bookings</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-value">${data.avg_wait_minutes}<span style="font-size:0.8rem"> min</span></div>
        <div class="stat-label">Avg Wait Time</div>
      </div>
      <div class="stat-card" style="border-color:var(--primary)">
        <div class="stat-icon">🏆</div>
        <div class="stat-value" style="font-size:1rem">${data.most_used_station.split('—')[0].trim()}</div>
        <div class="stat-label">Top Station (${data.most_used_count} bookings)</div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
      <!-- Bar Chart: Bookings per Station -->
      <div class="card">
        <h3 class="card-title" style="margin-bottom:1rem">🏪 Bookings per Station</h3>
        <canvas id="bar-chart" height="280" style="width:100%"></canvas>
      </div>

      <!-- Line Chart: Peak Hours -->
      <div class="card">
        <h3 class="card-title" style="margin-bottom:1rem">🕐 Peak Hours — Avg Wait Time</h3>
        <canvas id="line-chart" height="280" style="width:100%"></canvas>
      </div>
    </div>

    <!-- Station Capacity Table -->
    <div class="card">
      <h3 class="card-title" style="margin-bottom:1rem">⚡ Station Capacity Overview</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:10px" id="capacity-bars"></div>
    </div>
  `;

  // Draw charts after DOM is ready
  requestAnimationFrame(() => {
    drawBarChart(document.getElementById('bar-chart'), data.bookings_per_station);
    drawLineChart(document.getElementById('line-chart'), data.peak_hours);
    drawCapacityBars(document.getElementById('capacity-bars'), s);
  });
}

// ── Bar Chart (Canvas) ───────────────────────────────────────────────────────

function drawBarChart(canvas, stationData) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 280 * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = 280;

  const PAD_LEFT = 40, PAD_BOTTOM = 60, PAD_TOP = 20, PAD_RIGHT = 20;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  const items = stationData.slice(0, 8);
  const maxVal = Math.max(...items.map(d => d.bookings), 1);
  const barW = Math.min(40, (chartW / items.length) * 0.6);
  const gap = chartW / items.length;

  // Background grid
  ctx.strokeStyle = 'rgba(148,163,184,0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD_TOP + chartH - (chartH * i / 4);
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, y);
    ctx.lineTo(W - PAD_RIGHT, y);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * i / 4), PAD_LEFT - 6, y + 4);
  }

  // Bars
  items.forEach((d, i) => {
    const x = PAD_LEFT + gap * i + (gap - barW) / 2;
    const barH = (d.bookings / maxVal) * chartH;
    const y = PAD_TOP + chartH - barH;

    // Gradient bar
    const grad = ctx.createLinearGradient(x, y, x, PAD_TOP + chartH);
    grad.addColorStop(0, '#00d4aa');
    grad.addColorStop(1, '#6c5ce7');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
    ctx.fill();

    // Value on top
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.bookings, x + barW / 2, y - 6);

    // Label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.save();
    ctx.translate(x + barW / 2, PAD_TOP + chartH + 8);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = 'right';
    const label = d.station.length > 18 ? d.station.slice(0, 16) + '…' : d.station;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

// ── Line Chart (Canvas) ──────────────────────────────────────────────────────

function drawLineChart(canvas, hourData) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 280 * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = 280;

  const PAD_LEFT = 40, PAD_BOTTOM = 30, PAD_TOP = 20, PAD_RIGHT = 20;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  const maxWait = Math.max(...hourData.map(d => d.avg_wait_minutes), 1);
  const stepX = chartW / (hourData.length - 1);

  // Grid
  ctx.strokeStyle = 'rgba(148,163,184,0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD_TOP + chartH - (chartH * i / 4);
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, y);
    ctx.lineTo(W - PAD_RIGHT, y);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((maxWait * i / 4).toFixed(1), PAD_LEFT - 6, y + 4);
  }

  // X labels (every 3 hours)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  hourData.forEach((d, i) => {
    if (i % 3 === 0) {
      const x = PAD_LEFT + stepX * i;
      ctx.fillText(d.label, x, H - 8);
    }
  });

  // Area fill
  const gradient = ctx.createLinearGradient(0, PAD_TOP, 0, PAD_TOP + chartH);
  gradient.addColorStop(0, 'rgba(0,212,170,0.25)');
  gradient.addColorStop(1, 'rgba(0,212,170,0)');
  ctx.beginPath();
  ctx.moveTo(PAD_LEFT, PAD_TOP + chartH);
  hourData.forEach((d, i) => {
    const x = PAD_LEFT + stepX * i;
    const y = PAD_TOP + chartH - (d.avg_wait_minutes / maxWait) * chartH;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(PAD_LEFT + stepX * (hourData.length - 1), PAD_TOP + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#00d4aa';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  hourData.forEach((d, i) => {
    const x = PAD_LEFT + stepX * i;
    const y = PAD_TOP + chartH - (d.avg_wait_minutes / maxWait) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots at peak hours
  hourData.forEach((d, i) => {
    if (d.avg_wait_minutes > maxWait * 0.6) {
      const x = PAD_LEFT + stepX * i;
      const y = PAD_TOP + chartH - (d.avg_wait_minutes / maxWait) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00d4aa';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0e1a';
      ctx.fill();
    }
  });
}

// ── Capacity Bars ────────────────────────────────────────────────────────────

function drawCapacityBars(container, summary) {
  if (!container) return;
  const utilization = ((summary.total_slots - summary.available_slots) / Math.max(summary.total_slots, 1) * 100).toFixed(0);

  const items = [
    { label: 'Network Utilization', value: utilization, max: 100, color: 'var(--primary)', suffix: '%' },
    { label: 'Total Capacity', value: summary.total_slots, max: summary.total_slots, color: 'var(--accent-light)', suffix: ' slots' },
    { label: 'Currently Available', value: summary.available_slots, max: summary.total_slots, color: 'var(--success)', suffix: ' slots' },
    { label: 'Average Rating', value: summary.avg_rating, max: 5, color: 'var(--warning)', suffix: ' / 5.0' },
  ];

  container.innerHTML = items.map(item => `
    <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius-sm)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:0.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.03em">${item.label}</span>
        <span style="font-size:0.9rem;font-weight:700;color:var(--text-primary)">${item.value}${item.suffix}</span>
      </div>
      <div style="height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden">
        <div style="width:${(item.value / item.max * 100).toFixed(0)}%;height:100%;background:${item.color};border-radius:3px;transition:width 0.8s ease"></div>
      </div>
    </div>
  `).join('');
}
