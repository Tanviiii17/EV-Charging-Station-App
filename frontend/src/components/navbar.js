/**
 * Navbar component — renders top navigation with auth state.
 */
import { getUser, clearToken } from '../api.js';

export function renderNavbar() {
  const user = getUser();
  const hash = window.location.hash || '#/';

  const isActive = (path) => hash === path ? 'active' : '';

  if (!user) {
    return `
      <nav class="navbar">
        <div class="navbar-brand" onclick="location.hash='#/'">
          ⚡ <span>EV Charge Hub</span>
        </div>
        <div class="navbar-links">
          <button class="nav-link ${isActive('#/login')}" onclick="location.hash='#/login'">Login</button>
          <button class="nav-link btn btn-primary btn-sm" onclick="location.hash='#/register'" style="color:#0a0e1a">Sign Up</button>
        </div>
      </nav>
    `;
  }

  return `
    <nav class="navbar">
      <div class="navbar-brand" onclick="location.hash='#/'">
        ⚡ <span>EV Charge Hub</span>
      </div>
      <div class="navbar-links">
        <button class="nav-link ${isActive('#/')}" onclick="location.hash='#/'">Dashboard</button>
        <button class="nav-link ${isActive('#/bookings')}" onclick="location.hash='#/bookings'">My Bookings</button>
        <button class="nav-link ${isActive('#/analytics')}" onclick="location.hash='#/analytics'">Analytics</button>
        <div class="nav-user">👤 ${user.name}</div>
        <button class="nav-link nav-logout" id="logout-btn">Logout</button>
      </div>
    </nav>
  `;
}

export function bindNavbar() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearToken();
      location.hash = '#/login';
    });
  }
}
