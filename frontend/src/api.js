/**
 * API Client — Fetch wrapper with JWT auth headers.
 */

const BASE = '';  // Same origin via Vite proxy

function getToken() {
  return localStorage.getItem('ev_token');
}

export function setToken(token) {
  localStorage.setItem('ev_token', token);
}

export function clearToken() {
  localStorage.removeItem('ev_token');
  localStorage.removeItem('ev_user');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('ev_user'));
  } catch { return null; }
}

export function setUser(user) {
  localStorage.setItem('ev_user', JSON.stringify(user));
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.hash = '#/login';
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me:       ()     => request('/api/auth/me'),
};

// ── Stations ─────────────────────────────────────────────────────────────────
export const stations = {
  /**
   * List stations.
   * @param {Object} filters  Optional: { source: 'local'|'external'|'all', location, connector_type, available_only }
   */
  list: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.source) params.set('source', filters.source);
    if (filters.location) params.set('location', filters.location);
    if (filters.connector_type) params.set('connector_type', filters.connector_type);
    if (filters.available_only) params.set('available_only', 'true');
    const qs = params.toString();
    return request(`/api/stations/${qs ? '?' + qs : ''}`);
  },
  listExternal: () => request('/api/stations/external'),
  get:          (id)       => request(`/api/stations/${id}`),
  create:       (body)     => request('/api/stations/', { method: 'POST', body: JSON.stringify(body) }),
  update:       (id, body) => request(`/api/stations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  recommend:    ()         => request('/api/stations/recommend'),
};

// ── Bookings ─────────────────────────────────────────────────────────────────
export const bookings = {
  create: (body) => request('/api/bookings/', { method: 'POST', body: JSON.stringify(body) }),
  my:     ()     => request('/api/bookings/my'),
  cancel: (id)   => request(`/api/bookings/${id}`, { method: 'DELETE' }),
};

// ── Predictions ──────────────────────────────────────────────────────────────
export const predictions = {
  waitTime: (body) => request('/api/predict/wait-time', { method: 'POST', body: JSON.stringify(body) }),
};
