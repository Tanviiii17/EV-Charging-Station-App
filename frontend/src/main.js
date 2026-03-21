/**
 * Main SPA Router — hash-based routing, app initialization, toast system.
 */
import { renderNavbar, bindNavbar } from './components/navbar.js';
import { renderLogin, bindLogin } from './pages/login.js';
import { renderRegister, bindRegister } from './pages/register.js';
import { renderDashboard, bindDashboard } from './pages/dashboard.js';
import { renderBooking, bindBooking } from './pages/booking.js';
import { renderMyBookings, bindMyBookings } from './pages/my-bookings.js';
import { renderAnalytics, bindAnalytics } from './pages/analytics.js';
import { connectWS } from './ws.js';
import { getUser } from './api.js';

const app = document.getElementById('app');

// ── Toast System ─────────────────────────────────────────────────────────────

export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Router ───────────────────────────────────────────────────────────────────

async function route() {
  const hash = window.location.hash || '#/';
  const [path, param] = hash.slice(2).split('/');

  let pageHTML = '';
  let bindFn = null;

  switch (path) {
    case 'login':
      pageHTML = renderLogin();
      bindFn = bindLogin;
      break;
    case 'register':
      pageHTML = renderRegister();
      bindFn = bindRegister;
      break;
    case 'book':
      pageHTML = renderBooking(param);
      bindFn = () => bindBooking(param);
      break;
    case 'bookings':
      pageHTML = renderMyBookings();
      bindFn = bindMyBookings;
      break;
    case 'analytics':
      pageHTML = renderAnalytics();
      bindFn = bindAnalytics;
      break;
    default:
      pageHTML = renderDashboard();
      bindFn = bindDashboard;
      break;
  }

  app.innerHTML = renderNavbar() + pageHTML;
  bindNavbar();
  if (bindFn) await bindFn();
}

// ── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('hashchange', route);
window.addEventListener('load', () => {
  connectWS();
  route();
});
