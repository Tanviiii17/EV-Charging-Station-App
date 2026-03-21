/**
 * Register page module.
 */
import { auth, setToken, setUser } from '../api.js';
import { showToast } from '../main.js';

export function renderRegister() {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-title">⚡ Join EV Charge Hub</div>
        <div class="auth-subtitle">Create your account and start charging smarter</div>
        <form id="register-form">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input class="form-input" type="text" id="reg-name" placeholder="John Doe" required minlength="2" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" id="reg-email" placeholder="you@example.com" required />
          </div>
          <div class="form-group">
            <label class="form-label">Mobile</label>
            <input class="form-input" type="tel" id="reg-mobile" placeholder="9876543210" />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-input" type="password" id="reg-password" placeholder="Min 4 characters" required minlength="4" />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem" id="reg-submit">
            Create Account
          </button>
        </form>
        <div class="auth-footer">
          Already have an account? <a href="#/login">Sign in</a>
        </div>
      </div>
    </div>
  `;
}

export function bindRegister() {
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('reg-submit');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      const data = await auth.register({
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        mobile: document.getElementById('reg-mobile').value || '',
        password: document.getElementById('reg-password').value,
      });
      setToken(data.access_token);
      setUser(data.user);
      showToast('Account created! Welcome, ' + data.user.name + ' 🎉', 'success');
      location.hash = '#/';
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}
