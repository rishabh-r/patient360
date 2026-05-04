import { LOGIN_URL } from '../config/constants';

export async function doLogin(email, password) {
  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 400) throw new Error('Invalid credentials. Please try again.');
    throw new Error(`Login failed (${res.status}). Please try again.`);
  }

  const data = await res.json();
  const token = data.token;
  if (!token) throw new Error('Login failed: no token received.');

  const role = data.role || '';
  const userId = data.userId || '';
  const userEmail = data.email || email;
  const name = email.split('@')[0];
  const refId = data.refId || '';

  localStorage.setItem('p360_token', token);
  localStorage.setItem('p360_user', name);
  localStorage.setItem('p360_email', userEmail);
  localStorage.setItem('p360_role', role);
  localStorage.setItem('p360_user_id', userId);
  localStorage.setItem('p360_ref_id', refId);
  localStorage.setItem('p360_login_ts', Date.now().toString());

  return { name, role, refId };
}

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export function isSessionExpired() {
  const ts = localStorage.getItem('p360_login_ts');
  if (!ts) return true;
  return Date.now() - parseInt(ts, 10) > SESSION_TIMEOUT_MS;
}

export function clearSession() {
  const keys = ['p360_token', 'p360_user', 'p360_email', 'p360_role', 'p360_user_id', 'p360_ref_id', 'p360_login_ts'];
  keys.forEach(k => localStorage.removeItem(k));
}
