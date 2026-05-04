import { useState } from 'react';
import { doLogin } from '../services/auth';
import '../styles/login.css';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setShowOverlay(true);

    try {
      await doLogin(email, password);
      setShowOverlay(false);
      onLoginSuccess();
    } catch (err) {
      setShowOverlay(false);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ls-page">
      <div className="ls-topbar">
        <div className="ls-topbar-brand">
          <img src="/images/LogoRsi.png" alt="R Systems" className="ls-topbar-logo" />
          <span className="ls-topbar-title">Patient 360 Portal</span>
        </div>
        <span className="ls-topbar-badge">Secure Healthcare Access</span>
      </div>

      <div className="ls-body">
        <div className="ls-left">
          <div className="ls-content">
            <h1 className="ls-heading">
              Your Complete <span className="ls-highlight">Health Story</span><br />One Secure Portal
            </h1>
            <p className="ls-desc">
              Access your health records, medications, appointments, and care plans — all in one place.
              <b> Powered by AI</b> and <b>fully integrated with your healthcare provider's systems</b>.
            </p>
            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="ls-form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email" id="email" placeholder="Enter your email"
                  required autoComplete="username"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="ls-form-group">
                <label htmlFor="password">Password</label>
                <div className="ls-pw-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'} id="password"
                    placeholder="Enter your password"
                    required autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="ls-pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              {error && (
                <div className="ls-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="ls-submit" disabled={isLoading}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
                <span>{isLoading ? 'Signing in...' : 'Launch Patient 360'}</span>
                {isLoading && <span className="ls-spinner"></span>}
              </button>
            </form>
            <p className="ls-footer">Secure access for patients &amp; healthcare professionals</p>
          </div>
        </div>

        <div className="ls-right">
          <div className="ls-hero">
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
              <circle cx="100" cy="100" r="90" fill="url(#heroGrad)" opacity="0.15" />
              <circle cx="100" cy="100" r="60" fill="url(#heroGrad)" opacity="0.25" />
              <g transform="translate(60, 55)">
                <rect x="8" y="0" width="64" height="90" rx="8" fill="#fff" stroke="#2563EB" strokeWidth="2" />
                <line x1="22" y1="20" x2="58" y2="20" stroke="#DBEAFE" strokeWidth="3" strokeLinecap="round" />
                <line x1="22" y1="30" x2="50" y2="30" stroke="#DBEAFE" strokeWidth="3" strokeLinecap="round" />
                <line x1="22" y1="40" x2="55" y2="40" stroke="#DBEAFE" strokeWidth="3" strokeLinecap="round" />
                <line x1="22" y1="50" x2="45" y2="50" stroke="#DBEAFE" strokeWidth="3" strokeLinecap="round" />
                <circle cx="40" cy="72" r="10" fill="#DBEAFE" stroke="#2563EB" strokeWidth="1.5" />
                <path d="M36 72l3 3 6-6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M45 -8 L55 -8 L55 8 L48 8 L48 2 L32 2 L32 8 L25 8 L25 -8 L35 -8" fill="#2563EB" rx="2" />
                <line x1="35" y1="-5" x2="45" y2="-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <line x1="40" y1="-8" x2="40" y2="-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </g>
              <defs>
                <linearGradient id="heroGrad" x1="0" y1="0" x2="200" y2="200">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {showOverlay && (
        <div className="ls-overlay">
          <div className="ls-overlay-box">
            <div className="ls-spinner-dark"></div>
            <p>Signing you in...</p>
          </div>
        </div>
      )}
    </div>
  );
}
