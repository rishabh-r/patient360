import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { callFhirApi, buildUrl } from '../services/fhir';
import '../styles/home.css';

const DATA_SOURCES = [
  { icon: 'clinical', label: 'Clinical', desc: 'EHR, EMR, clinical notes', color: '#3B82F6' },
  { icon: 'claims', label: 'Claims', desc: 'Medical, pharmacy, billing claims', color: '#22C55E' },
  { icon: 'membership', label: 'Membership & Eligibility', desc: 'Member, plan, and eligibility data', color: '#6366F1' },
  { icon: 'pharmacy', label: 'Pharmacy', desc: 'Prescriptions, dispensing, adherence', color: '#94A3B8' },
  { icon: 'labs', label: 'Labs', desc: 'Lab results and orders', color: '#EF4444' },
  { icon: 'sdoh', label: 'SDOH & Assessment', desc: 'Social determinants and assessments', color: '#94A3B8' },
  { icon: 'productivity', label: 'Productivity', desc: 'Operational and productivity metrics', color: '#6366F1' },
  { icon: 'billing', label: 'Patient Accounting / Billing', desc: 'Billing, payments, balances', color: '#14B8A6' },
  { icon: 'iot', label: 'IoT', desc: 'Devices, vitals, real-time data', color: '#3B82F6' },
];

const OUTCOMES = [
  { icon: 'patient', label: 'Patient View', desc: 'Personal health overview', route: '/patient-view' },
  { icon: 'provider', label: 'Healthcare Provider View', desc: 'Clinical care and treatment', route: '/healthcare-provider' },
  { icon: 'caremanager', label: 'Care Manager View', desc: 'Care coordination and tasks', route: '/care-manager' },
  { icon: 'healthplans', label: 'Health Plans View', desc: 'Population health and analytics', route: null },
  { icon: 'regulators', label: 'Regulators View', desc: 'Compliance and reporting', route: null },
  { icon: 'itops', label: 'IT/Ops Administrators View', desc: 'System and data operations', route: null },
  { icon: 'dashboards', label: 'Dashboards', desc: 'KPIs and performance insights', route: null },
];

function DataSourceIcon({ type, color }) {
  const icons = {
    clinical: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>,
    claims: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>,
    membership: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    pharmacy: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>,
    labs: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v7l5 8a2 2 0 0 1-1.7 3H5.7A2 2 0 0 1 4 18l5-8V3z"/><path d="M9 3h6"/></svg>,
    sdoh: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>,
    productivity: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
    billing: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    iot: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  };
  return (
    <div className="ds-icon" style={{ background: color }}>
      {icons[type]}
    </div>
  );
}

function OutcomeIcon({ type }) {
  const icons = {
    patient: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    provider: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a2 2 0 002 2h1a2 2 0 002-2V4a.3.3 0 00-.3-.3"/><path d="M8 15v1a6 6 0 006 6"/><path d="M22 20h-4l-2-2"/><path d="M13.3 7.7a2.5 2.5 0 013.5 3.5L12 16l-5-5 4.8-4.8z"/></svg>,
    caremanager: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    healthplans: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    regulators: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 10h1"/><path d="M14 10h1"/><path d="M9 14h1"/><path d="M14 14h1"/></svg>,
    itops: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    dashboards: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
  };
  return (
    <div className="oc-icon">
      {icons[type]}
    </div>
  );
}

export default function HomePage({ onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('id') || localStorage.getItem('p360_patient_id') || '';
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!patientId) return;
    callFhirApi(buildUrl('/baseR4/Patient', { _id: patientId, page: 0, size: 1 }))
      .then(res => {
        const pt = res?.entry?.[0]?.resource;
        const given = pt?.name?.[0]?.given?.join(' ') || '';
        const family = pt?.name?.[0]?.family || '';
        setUserName(`${given} ${family}`.trim() || 'User');
        const email = (pt?.telecom || []).find(t => t.system === 'email')?.value || '';
        setUserEmail(email);
      })
      .catch(() => setUserName(localStorage.getItem('p360_user') || 'User'));
  }, [patientId]);

  const goToView = (route) => {
    if (route) navigate(`${route}?id=${patientId}`);
  };

  return (
    <div className="home-page">
      <nav className="home-nav">
        <div className="home-nav-left">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
          <span className="home-nav-title">Patient 360 Portal</span>
        </div>
        <div className="home-nav-right">
          <div className="home-nav-bell">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="home-nav-badge">3</span>
          </div>
          <div className="home-nav-user">
            <div className="home-nav-user-info">
              <span className="home-nav-user-name">{userName}</span>
              <span className="home-nav-user-role">PATIENT</span>
            </div>
            <div className="home-profile-wrap" ref={profileRef}>
              <div className="home-nav-avatar" onClick={() => setShowProfile(!showProfile)} style={{ cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              {showProfile && (
                <div className="home-profile-dropdown">
                <div className="home-profile-info">
                  <span className="home-profile-name">{userName}</span>
                  <span className="home-profile-email">{userEmail}</span>
                </div>
                  <div className="home-profile-signout" onClick={onLogout}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign Out
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="home-content">
        <div className="home-col home-col-left">
          <div className="home-section-header">
            <h2 className="home-section-title">DATA SOURCES</h2>
            <p className="home-section-subtitle">Integrated health data</p>
          </div>
          <div className="ds-list">
            {DATA_SOURCES.map((ds, i) => (
              <div className="ds-card" key={i}>
                <DataSourceIcon type={ds.icon} color={ds.color} />
                <div className="ds-text">
                  <span className="ds-label">{ds.label}</span>
                  <span className="ds-desc">{ds.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="home-col home-col-center">
          <div className="hub-connector-area">
            <svg className="hub-svg" viewBox="0 0 400 700">
              <defs>
                <marker id="arrowBlue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#3B82F6" />
                </marker>
              </defs>
              {[62, 118, 174, 230, 286, 342, 398, 454, 510].map((y, i) => (
                <path key={`l${i}`} d={`M0,${y} Q100,${y} 110,350`}
                  fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="6,5" strokeLinecap="round" />
              ))}
              {[78, 148, 218, 288, 358, 428, 498].map((y, i) => (
                <path key={`r${i}`} d={`M290,350 Q300,${y} 400,${y}`}
                  fill="none" stroke="#3B82F6" strokeWidth="2" strokeDasharray="6,5"
                  strokeLinecap="round" markerEnd="url(#arrowBlue)" />
              ))}
            </svg>
            <div className="hub-circle">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              <span className="hub-label">Patient 360</span>
            </div>
          </div>
        </div>

        <div className="home-col home-col-right">
          <div className="home-section-header">
            <h2 className="home-section-title">OUTCOMES & EXPERIENCES</h2>
            <p className="home-section-subtitle">Role-based access via secure URLs</p>
          </div>
          <div className="oc-list">
            {OUTCOMES.map((oc, i) => (
              <div
                className={`oc-card${oc.route ? ' oc-clickable' : ''}`}
                key={i}
                onClick={() => goToView(oc.route)}
              >
                <OutcomeIcon type={oc.icon} />
                <div className="oc-text">
                  <span className="oc-label">{oc.label}</span>
                  <span className="oc-desc">{oc.desc}</span>
                </div>
                <svg className="oc-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
