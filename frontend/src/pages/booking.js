/**
 * Booking page — select a slot and confirm booking at a specific station.
 */
import { stations, bookings, getUser } from '../api.js';
import { showToast } from '../main.js';

let selectedSlot = null;
let stationData = null;

export function renderBooking(stationId) {
  return `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">🔌 Book a Charging Slot</h1>
        <p class="page-subtitle">Select your preferred slot and time</p>
      </div>
      <div id="booking-content">
        <div class="loading"><div class="spinner"></div>Loading station details...</div>
      </div>
    </div>
  `;
}

export async function bindBooking(stationId) {
  const user = getUser();
  if (!user) { location.hash = '#/login'; return; }

  const container = document.getElementById('booking-content');
  try {
    stationData = await stations.get(stationId);
  } catch {
    container.innerHTML = '<div class="empty-state"><p>⚠️ Station not found</p></div>';
    return;
  }

  // Get booked slots
  let bookedSlots = [];
  try {
    const myBookings = await bookings.my();
    bookedSlots = myBookings
      .filter(b => b.station_id == stationId && b.status === 'confirmed')
      .map(b => b.slot_number);
  } catch { /* ignore */ }

  const now = new Date();
  const minDate = now.toISOString().slice(0, 16);

  container.innerHTML = `
    <div class="booking-detail">
      <div>
        <div class="card" style="margin-bottom:1.5rem">
          <h3 class="card-title" style="margin-bottom:0.5rem">${stationData.name}</h3>
          <p style="color:var(--text-secondary);margin-bottom:1rem">📍 ${stationData.area}, ${stationData.location}</p>
          <div class="station-meta">
            <div class="station-meta-item">
              <span class="station-meta-label">Slots</span>
              <span class="station-meta-value">${stationData.available_slots} / ${stationData.total_slots}</span>
            </div>
            <div class="station-meta-item">
              <span class="station-meta-label">Power</span>
              <span class="station-meta-value">${stationData.capacity_kw} kW</span>
            </div>
            <div class="station-meta-item">
              <span class="station-meta-label">Connector</span>
              <span class="station-meta-value">${stationData.connector_type}</span>
            </div>
            <div class="station-meta-item">
              <span class="station-meta-label">Price</span>
              <span class="station-meta-value">₹${stationData.price_per_kwh}/kWh</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title" style="margin-bottom:1rem">Select Slot</h3>
          <div class="slot-grid" id="slot-grid">
            ${Array.from({ length: stationData.total_slots }, (_, i) => {
              const num = i + 1;
              const taken = bookedSlots.includes(num);
              return `<button class="slot-btn ${taken ? 'slot-taken' : ''}" data-slot="${num}" ${taken ? 'disabled' : ''}>
                Slot ${num}
              </button>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <h3 class="card-title" style="margin-bottom:1rem">Booking Details</h3>
          <form id="booking-form">
            <div class="form-group">
              <label class="form-label">Start Time</label>
              <input class="form-input" type="datetime-local" id="book-start" min="${minDate}" required />
            </div>
            <div class="form-group">
              <label class="form-label">End Time</label>
              <input class="form-input" type="datetime-local" id="book-end" min="${minDate}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Vehicle Number (optional)</label>
              <input class="form-input" type="text" id="book-vehicle" placeholder="MH 12 AB 1234" />
            </div>
            <div id="selected-slot-info" style="margin:1rem 0;padding:12px;border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text-muted);font-size:0.9rem;text-align:center">
              ← Select a slot first
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%" id="book-submit" disabled>
              Confirm Booking
            </button>
          </form>
        </div>

        <button class="btn btn-secondary" style="width:100%;margin-top:1rem" onclick="location.hash='#/'">
          ← Back to Dashboard
        </button>
      </div>
    </div>
  `;

  selectedSlot = null;

  // Bind slot selection
  document.querySelectorAll('.slot-btn:not(.slot-taken)').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('slot-selected'));
      btn.classList.add('slot-selected');
      selectedSlot = parseInt(btn.dataset.slot);
      document.getElementById('selected-slot-info').innerHTML =
        `✅ <strong>Slot ${selectedSlot}</strong> selected`;
      document.getElementById('selected-slot-info').style.color = 'var(--primary)';
      document.getElementById('book-submit').disabled = false;
    });
  });

  // Bind form submit
  document.getElementById('booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedSlot) { showToast('Please select a slot', 'error'); return; }

    const start = document.getElementById('book-start').value;
    const end = document.getElementById('book-end').value;

    if (!start || !end) { showToast('Please select start and end times', 'error'); return; }
    if (new Date(start) >= new Date(end)) { showToast('End time must be after start time', 'error'); return; }

    const btn = document.getElementById('book-submit');
    btn.disabled = true;
    btn.textContent = 'Booking...';

    try {
      await bookings.create({
        station_id: parseInt(stationId),
        slot_number: selectedSlot,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        vehicle_number: document.getElementById('book-vehicle').value || '',
      });
      showToast('Booking confirmed! ⚡', 'success');
      location.hash = '#/bookings';
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Confirm Booking';
    }
  });
}
