import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/caremanager.css';

const ORGANIZATIONS = [
  { name: 'City Medical Center', type: 'Hospital', patients: 245 },
  { name: 'Community Health Clinic', type: 'Clinic', patients: 182 },
  { name: 'Senior Care Partners', type: 'Long-term Care', patients: 156 },
  { name: 'Metro Hospital Network', type: 'Hospital', patients: 398 },
  { name: 'Family Practice Associates', type: 'Clinic', patients: 127 },
  { name: 'Regional Medical Group', type: 'Hospital', patients: 209 },
  { name: 'Sunrise Rehabilitation Center', type: 'Long-term Care', patients: 94 },
  { name: 'Downtown Urgent Care', type: 'Clinic', patients: 163 },
];

const MOCK_PATIENTS = {
  'City Medical Center': [
    { name: 'James Mitchell', age: 47, condition: 'Type 2 Diabetes', risk: 'High' },
    { name: 'Sarah Cooper', age: 71, condition: 'CHF', risk: 'High' },
    { name: 'Robert Wilson', age: 63, condition: 'COPD', risk: 'Medium' },
    { name: 'Linda Garcia', age: 55, condition: 'Hypertension', risk: 'Low' },
    { name: 'Michael Brown', age: 68, condition: 'CKD Stage 3', risk: 'High' },
  ],
  'Community Health Clinic': [
    { name: 'Patricia Johnson', age: 42, condition: 'Asthma', risk: 'Low' },
    { name: 'David Lee', age: 59, condition: 'Type 2 Diabetes', risk: 'Medium' },
    { name: 'Maria Rodriguez', age: 36, condition: 'Hypertension', risk: 'Low' },
  ],
  'Senior Care Partners': [
    { name: 'Dorothy Williams', age: 82, condition: 'Alzheimer\'s', risk: 'High' },
    { name: 'Frank Thompson', age: 78, condition: 'CHF', risk: 'High' },
    { name: 'Helen Davis', age: 85, condition: 'Osteoporosis', risk: 'Medium' },
    { name: 'George Martin', age: 76, condition: 'Parkinson\'s', risk: 'Medium' },
  ],
};

function getRiskClass(risk) {
  if (risk === 'High') return 'cm-risk-high';
  if (risk === 'Medium') return 'cm-risk-med';
  return 'cm-risk-low';
}

export default function CareManagerView({ onLogout }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(null);

  const filtered = ORGANIZATIONS.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const patients = selectedOrg ? (MOCK_PATIENTS[selectedOrg] || []) : [];

  return (
    <div className="cm-page">
      {/* Navbar */}
      <nav className="cm-nav">
        <div className="cm-nav-left">
          <img src="/images/R_Systems_White.png" alt="R Systems" className="cm-nav-logo" />
          <span className="cm-nav-title">Patient 360 Portal</span>
        </div>
        <div className="cm-nav-right">
          <div className="cm-nav-bell">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="cm-nav-badge">6</span>
          </div>
          <div className="cm-nav-user">
            <span className="cm-nav-user-name">Dr. Amanda Foster</span>
            <span className="cm-nav-user-role">CARE MANAGER</span>
          </div>
          <div className="cm-nav-avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        </div>
      </nav>

      {/* Sub-header */}
      <div className="cm-subheader">
        <h1 className="cm-page-title">Care Manager Dashboard</h1>
        <button className="cm-back" onClick={() => navigate('/')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to Home
        </button>
      </div>

      {/* Main Content */}
      <div className="cm-content">
        {/* Left — Organizations */}
        <div className="cm-orgs-panel">
          <h2 className="cm-orgs-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
            Organizations
          </h2>

          <div className="cm-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="cm-search-input"
            />
          </div>

          <div className="cm-org-list">
            {filtered.map((org, i) => (
              <div
                className={`cm-org-card${selectedOrg === org.name ? ' cm-org-active' : ''}`}
                key={i}
                onClick={() => setSelectedOrg(org.name)}
              >
                <div className="cm-org-info">
                  <div className="cm-org-name">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
                    {org.name}
                  </div>
                  <span className="cm-org-type">{org.type}</span>
                </div>
                <div className="cm-org-count">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  {org.patients} patients
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Patients or Empty State */}
        <div className="cm-patients-panel">
          {!selectedOrg ? (
            <div className="cm-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              <h3 className="cm-empty-title">Select an organization to view patients</h3>
              <p className="cm-empty-sub">Choose from the list on the left</p>
            </div>
          ) : (
            <>
              <div className="cm-patients-header">
                <h2 className="cm-patients-title">{selectedOrg}</h2>
                <span className="cm-patients-count">{patients.length} Patients</span>
              </div>
              {patients.length === 0 ? (
                <div className="cm-empty-state">
                  <p className="cm-empty-sub">No patient data available for this organization</p>
                </div>
              ) : (
                <div className="cm-patient-list">
                  {patients.map((p, i) => (
                    <div className="cm-patient-card" key={i}>
                      <div className="cm-patient-avatar">
                        {p.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="cm-patient-info">
                        <span className="cm-patient-name">{p.name}</span>
                        <span className="cm-patient-details">Age {p.age} · {p.condition}</span>
                      </div>
                      <span className={`cm-risk-pill ${getRiskClass(p.risk)}`}>{p.risk}</span>
                      <div className="cm-patient-actions">
                        <button className="cm-action-btn" title="Call">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        </button>
                        <button className="cm-action-btn" title="Email">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
                        </button>
                        <button className="cm-action-btn cm-view-btn">View</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
