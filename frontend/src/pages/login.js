/**
 * Login page module.
 */
import { auth, setToken, setUser } from '../api.js';
import { showToast } from '../main.js';

export function renderLogin() {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-title">⚡ Welcome Back</div>
        <div class="auth-subtitle">Sign in to your EV Charge Hub account</div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" id="login-email" placeholder="you@example.com" required />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-input" type="password" id="login-password" placeholder="••••••••" required />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem" id="login-submit">
            Sign In
          </button>
        </form>
        <div class="auth-footer">
          Don't have an account? <a href="#/register">Create one</a>
        </div>
      </div>
    </div>
  `;
}

export function bindLogin() {
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-submit');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const data = await auth.login({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
      });
      setToken(data.access_token);
      setUser(data.user);
      showToast('Welcome back, ' + data.user.name + '! 🎉', 'success');
      location.hash = '#/';
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}
