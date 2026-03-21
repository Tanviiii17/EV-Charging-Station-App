/**
 * Station Card component — reusable card for the station grid.
 */

export function renderStationCard(station) {
  const availability = station.available_slots / station.total_slots;
  const barColor = availability > 0.5 ? 'var(--success)' :
                   availability > 0.2 ? 'var(--warning)' : 'var(--danger)';
  const badgeClass = availability > 0.5 ? 'badge-success' :
                     availability > 0.2 ? 'badge-warning' : 'badge-danger';
  const statusText = station.available_slots > 0 ? `${station.available_slots} available` : 'Full';

  const icons = ['⚡', '🔋', '🔌', '🏭', '⛽'];
  const icon = icons[station.id % icons.length];

  return `
    <div class="station-card" data-station-id="${station.id}">
      <div class="station-card-image">${icon}</div>
      <div class="station-card-body">
        <div class="card-header">
          <div>
            <div class="station-name">${station.name}</div>
            <div class="station-location">📍 ${station.area}, ${station.location}</div>
          </div>
          <span class="badge ${badgeClass}">${statusText}</span>
        </div>

        <div class="station-slots-bar">
          <div class="station-slots-fill" style="width:${availability * 100}%; background:${barColor}"></div>
        </div>

        <div class="station-meta">
          <div class="station-meta-item">
            <span class="station-meta-label">Capacity</span>
            <span class="station-meta-value">${station.capacity_kw} kW</span>
          </div>
          <div class="station-meta-item">
            <span class="station-meta-label">Connector</span>
            <span class="station-meta-value">${station.connector_type}</span>
          </div>
          <div class="station-meta-item">
            <span class="station-meta-label">Price</span>
            <span class="station-meta-value">₹${station.price_per_kwh}/kWh</span>
          </div>
          <div class="station-meta-item">
            <span class="station-meta-label">Rating</span>
            <span class="station-meta-value">⭐ ${station.rating}</span>
          </div>
        </div>

        <div class="station-card-actions">
          <button class="btn btn-primary btn-sm book-btn" data-id="${station.id}" ${station.available_slots <= 0 ? 'disabled' : ''}>
            ${station.available_slots > 0 ? '🔌 Book Slot' : '🚫 Full'}
          </button>
          <button class="btn btn-secondary btn-sm predict-btn" data-id="${station.id}">
            🤖 AI Predict
          </button>
        </div>
      </div>
    </div>
  `;
}
