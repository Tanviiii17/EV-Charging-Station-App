/**
 * My Bookings page — shows user's booking history with cancel functionality.
 */
import { bookings, getUser } from '../api.js';
import { showToast } from '../main.js';

export function renderMyBookings() {
  return `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">📋 My Bookings</h1>
        <p class="page-subtitle">View and manage your charging reservations</p>
      </div>
      <div id="bookings-list">
        <div class="loading"><div class="spinner"></div>Loading bookings...</div>
      </div>
    </div>
  `;
}

export async function bindMyBookings() {
  if (!getUser()) { location.hash = '#/login'; return; }
  await loadBookings();
}

async function loadBookings() {
  const container = document.getElementById('bookings-list');
  try {
    const list = await bookings.my();

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p>No bookings yet</p>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="location.hash='#/'">Browse Stations</button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(b => {
      const statusClass = b.status === 'confirmed' ? 'badge-success' :
                          b.status === 'completed' ? 'badge-info' : 'badge-danger';
      const stationName = b.station ? b.station.name : `Station #${b.station_id}`;
      const stationLoc = b.station ? `${b.station.area}, ${b.station.location}` : '';
      const startDate = new Date(b.start_time).toLocaleString();
      const endDate = new Date(b.end_time).toLocaleString();

      return `
        <div class="booking-item">
          <div class="booking-info">
            <h3>⚡ ${stationName}</h3>
            <p>📍 ${stationLoc} • Slot ${b.slot_number}</p>
            <p>🕐 ${startDate} → ${endDate}</p>
            ${b.vehicle_number ? `<p>🚗 ${b.vehicle_number}</p>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="badge ${statusClass}">${b.status}</span>
            ${b.status === 'confirmed' ? `<button class="btn btn-danger btn-sm cancel-btn" data-id="${b.id}">Cancel</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Bind cancel buttons
    container.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancel this booking?')) return;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await bookings.cancel(parseInt(btn.dataset.id));
          showToast('Booking cancelled', 'success');
          await loadBookings();
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Cancel';
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>⚠️ ${err.message}</p></div>`;
  }
}
