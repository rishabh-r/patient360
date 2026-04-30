import { LOGIN_URL, PATIENT_MAP } from '../config/constants';
import { maybeDecrypt } from './fhir';

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

  const raw = await res.json();
  const data = await maybeDecrypt(raw);
  const token = data.idToken || data.token || data.access_token;
  if (!token) throw new Error('Login failed: no token received.');

  const name = data.displayName || data.name || email.split('@')[0];
  const patientId = PATIENT_MAP[email.toLowerCase()] || '';

  localStorage.setItem('p360_token', token);
  localStorage.setItem('p360_user', name);
  localStorage.setItem('p360_email', email);
  localStorage.setItem('p360_patient_id', patientId);
  localStorage.setItem('p360_login_ts', Date.now().toString());

  return { name, patientId };
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export function isSessionExpired() {
  const ts = localStorage.getItem('p360_login_ts');
  if (!ts) return true;
  return Date.now() - parseInt(ts, 10) > SESSION_TIMEOUT_MS;
}

export function clearSession() {
  localStorage.removeItem('p360_token');
  localStorage.removeItem('p360_user');
  localStorage.removeItem('p360_email');
  localStorage.removeItem('p360_patient_id');
  localStorage.removeItem('p360_login_ts');
}
