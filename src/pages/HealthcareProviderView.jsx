import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/provider.css';

const HIGH_RISK = [
  { name: 'Robert Wilson', issue: 'Critical glucose levels', score: 92, trend: 'up' },
  { name: 'Patricia Brown', issue: 'BP spike detected', score: 88, trend: 'up' },
  { name: 'Michael Johnson', issue: 'Missed medications', score: 85, trend: 'down' },
];

const CARE_GAPS = [
  { name: 'Sarah Martinez', issue: 'Annual diabetes screening overdue', priority: 'High' },
  { name: 'David Lee', issue: 'Flu vaccination needed', priority: 'Medium' },
  { name: 'Linda White', issue: 'Mammography screening due', priority: 'High' },
  { name: 'Carlos Rodriguez', issue: 'Follow-up appointment needed', priority: 'Low' },
];

const SCHEDULE = [
  { name: 'Robert Wilson', time: '9:00 AM', type: 'Follow-up', risk: 'High' },
  { name: 'Maria Garcia', time: '10:30 AM', type: 'Routine Check', risk: 'Low' },
  { name: 'James Taylor', time: '1:00 PM', type: 'Care Plan Review', risk: 'Medium' },
  { name: 'Patricia Brown', time: '2:30 PM', type: 'Urgent Consult', risk: 'High' },
  { name: 'John Davis', time: '4:00 PM', type: 'Telehealth', risk: 'Low' },
];

const PATIENT_PANEL = [
  { name: 'Robert Wilson', age: 68, gender: 'M', condition: 'CHF', risk: 'high' },
  { name: 'Maria Garcia', age: 54, gender: 'F', condition: 'Diabetes', risk: 'low' },
  { name: 'James Taylor', age: 72, gender: 'M', condition: 'COPD', risk: 'medium' },
  { name: 'Patricia Brown', age: 61, gender: 'F', condition: 'Hypertension', risk: 'high' },
  { name: 'John Davis', age: 45, gender: 'M', condition: 'Diabetes', risk: 'low' },
  { name: 'Sarah Martinez', age: 58, gender: 'F', condition: 'CHF', risk: 'medium' },
  { name: 'Michael Johnson', age: 76, gender: 'M', condition: 'CKD', risk: 'high' },
  { name: 'Linda White', age: 63, gender: 'F', condition: 'Asthma', risk: 'low' },
];

function riskClass(r) {
  if (r === 'High') return 'hp-risk-high';
  if (r === 'Medium') return 'hp-risk-med';
  return 'hp-risk-low';
}

function priorityClass(p) {
  if (p === 'High') return 'hp-pri-high';
  if (p === 'Medium') return 'hp-pri-med';
  return 'hp-pri-low';
}

function MiniBarChart({ color, count }) {
  const heights = Array.from({ length: count }, () => 15 + Math.random() * 25);
  return (
    <div className="hp-mini-bars">
      {heights.map((h, i) => (
        <div key={i} className="hp-mini-bar" style={{ height: h, background: color }} />
      ))}
    </div>
  );
}

function MIPSDonut({ score }) {
  const r = 52, circ = 2 * Math.PI * r, pct = score / 100;
  return (
    <div className="hp-mips-donut">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#E2E8F0" strokeWidth="10" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="#14B8A6" strokeWidth="10"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 70 70)" />
      </svg>
      <div className="hp-mips-text">
        <span className="hp-mips-score">{score}</span>
        <span className="hp-mips-label">Score</span>
      </div>
    </div>
  );
}

export default function HealthcareProviderView({ onLogout }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('analytics');

  return (
    <div className="hp-page">
      {/* Navbar */}
      <nav className="hp-nav">
        <div className="hp-nav-left">
          <img src="/images/R_Systems_White.png" alt="R Systems" className="hp-nav-logo" />
          <span className="hp-nav-title">Patient 360 Portal</span>
        </div>
        <div className="hp-nav-right">
          <div className="hp-nav-bell">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="hp-nav-badge">8</span>
          </div>
          <div className="hp-nav-user">
            <span className="hp-nav-user-name">Kelly Petra</span>
            <span className="hp-nav-user-role">HEALTHCARE PROVIDER</span>
          </div>
          <div className="hp-nav-avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        </div>
      </nav>

      {/* Sub-header */}
      <div className="hp-subheader">
        <h1 className="hp-page-title">Healthcare Provider Dashboard</h1>
        <button className="hp-back" onClick={() => navigate('/')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to Home
        </button>
      </div>

      {/* Tabs */}
      <div className="hp-tabs">
        <button className={`hp-tab${tab === 'analytics' ? ' hp-tab-active' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
        <button className={`hp-tab${tab === 'panel' ? ' hp-tab-active' : ''}`} onClick={() => setTab('panel')}>Patient Panel</button>
      </div>

      {tab === 'analytics' ? (
        <div className="hp-analytics">

          {/* High-Risk Patients */}
          <div className="hp-card">
            <div className="hp-card-head">
              <h2 className="hp-card-title">High-Risk & Deteriorating Patients</h2>
              <span className="hp-count-red">{HIGH_RISK.length} Patients</span>
            </div>
            <div className="hp-risk-list">
              {HIGH_RISK.map((p, i) => (
                <div className="hp-risk-row" key={i}>
                  <div className="hp-risk-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div className="hp-risk-info">
                    <span className="hp-risk-name">{p.name}</span>
                    <span className="hp-risk-issue">{p.issue}</span>
                  </div>
                  <div className="hp-risk-score">
                    <span className="hp-risk-score-label">Risk Score</span>
                    <span className="hp-risk-score-val">{p.score}</span>
                  </div>
                  <div className="hp-risk-actions">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={p.trend === 'up' ? '#DC2626' : '#22C55E'} strokeWidth="2">
                      {p.trend === 'up'
                        ? <path d="M23 6l-9.5 9.5-5-5L1 18"/>
                        : <path d="M23 18l-9.5-9.5-5 5L1 6"/>}
                    </svg>
                    <button className="hp-icon-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>
                    <button className="hp-icon-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KPI Row 1 */}
          <div className="hp-kpi-row">
            <div className="hp-kpi-card">
              <div className="hp-kpi-head"><span className="hp-kpi-label">Recent Admissions</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg>
              </div>
              <span className="hp-kpi-val">12</span>
              <span className="hp-kpi-change down">↘ 8% from last week</span>
              <MiniBarChart color="#BFDBFE" count={10} />
            </div>
            <div className="hp-kpi-card">
              <div className="hp-kpi-head"><span className="hp-kpi-label">ER Visits</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <span className="hp-kpi-val">8</span>
              <span className="hp-kpi-change up">↗ 12% from last week</span>
              <MiniBarChart color="#FECACA" count={10} />
            </div>
            <div className="hp-kpi-card">
              <div className="hp-kpi-head"><span className="hp-kpi-label">Discharges</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </div>
              <span className="hp-kpi-val">15</span>
              <span className="hp-kpi-change up">↗ 15% from last week</span>
              <MiniBarChart color="#DDD6FE" count={10} />
            </div>
          </div>

          {/* Care Gaps */}
          <div className="hp-card">
            <h2 className="hp-card-title">Preventive & Clinical Care Gaps</h2>
            <div className="hp-gaps-list">
              {CARE_GAPS.map((g, i) => (
                <div className="hp-gap-row" key={i}>
                  <div className="hp-gap-info">
                    <span className="hp-gap-name">{g.name}</span>
                    <span className="hp-gap-issue">{g.issue}</span>
                  </div>
                  <div className="hp-gap-actions">
                    <span className={`hp-pri-pill ${priorityClass(g.priority)}`}>{g.priority} Priority</span>
                    <button className="hp-schedule-btn">Schedule</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HEDIS + MIPS */}
          <div className="hp-hedis-row">
            <div className="hp-card hp-hedis-card">
              <h2 className="hp-card-title">HEDIS Measures</h2>
              {[
                { label: 'Diabetes Care', pct: 87, color: '#3B82F6' },
                { label: 'Hypertension Control', pct: 92, color: '#22C55E' },
                { label: 'Preventive Care', pct: 78, color: '#F59E0B' },
              ].map((m, i) => (
                <div className="hp-hedis-item" key={i}>
                  <div className="hp-hedis-meta">
                    <span className="hp-hedis-label">{m.label}</span>
                    <span className="hp-hedis-pct">{m.pct}%</span>
                  </div>
                  <div className="hp-hedis-bar">
                    <div className="hp-hedis-fill" style={{ width: `${m.pct}%`, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="hp-card hp-mips-card">
              <h2 className="hp-card-title">MIPS Performance</h2>
              <MIPSDonut score={85} />
              <p className="hp-mips-status">Above Target</p>
            </div>
          </div>

          {/* KPI Row 2 */}
          <div className="hp-kpi-row">
            <div className="hp-kpi-card">
              <div className="hp-kpi-head"><span className="hp-kpi-label">ALOS</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </div>
              <span className="hp-kpi-val">4.2 days</span>
              <span className="hp-kpi-change down">↓ 5% vs last month</span>
              <MiniBarChart color="#99F6E4" count={10} />
            </div>
            <div className="hp-kpi-card">
              <div className="hp-kpi-head"><span className="hp-kpi-label">Readmission Rate</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg>
              </div>
              <span className="hp-kpi-val">8.5%</span>
              <span className="hp-kpi-change up">↑ 2% vs last month</span>
              <MiniBarChart color="#FDE68A" count={10} />
            </div>
            <div className="hp-kpi-card">
              <div className="hp-kpi-head"><span className="hp-kpi-label">No Show Rate</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span className="hp-kpi-val">12.3%</span>
              <span className="hp-kpi-change down">↓ 8% vs last month</span>
              <MiniBarChart color="#DDD6FE" count={10} />
            </div>
          </div>

          {/* Population View */}
          <div className="hp-card">
            <div className="hp-card-head">
              <h2 className="hp-card-title">Population View</h2>
              <div className="hp-pop-controls">
                <select className="hp-select"><option>All Conditions</option></select>
                <select className="hp-select"><option>All Risk Levels</option></select>
                <button className="hp-bulk-btn">Bulk Message</button>
              </div>
            </div>
            <div className="hp-pop-cards">
              <div className="hp-pop-stat" style={{ borderLeftColor: '#3B82F6' }}>
                <span className="hp-pop-num">342</span><span className="hp-pop-label">Total Patients</span>
              </div>
              <div className="hp-pop-stat" style={{ borderLeftColor: '#EF4444' }}>
                <span className="hp-pop-num">87</span><span className="hp-pop-label">High Risk</span>
              </div>
              <div className="hp-pop-stat" style={{ borderLeftColor: '#F59E0B' }}>
                <span className="hp-pop-num">156</span><span className="hp-pop-label">Care Gaps</span>
              </div>
              <div className="hp-pop-stat" style={{ borderLeftColor: '#8B5CF6' }}>
                <span className="hp-pop-num">45</span><span className="hp-pop-label">Non-Adherent</span>
              </div>
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="hp-card">
            <h2 className="hp-card-title">Today's Schedule</h2>
            <table className="hp-schedule-table">
              <thead>
                <tr>
                  <th>Patient Name</th><th>Time</th><th>Visit Type</th><th>Risk Level</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE.map((s, i) => (
                  <tr key={i}>
                    <td className="hp-sched-name">{s.name}</td>
                    <td>{s.time}</td>
                    <td>{s.type}</td>
                    <td><span className={`hp-risk-pill ${riskClass(s.risk)}`}>{s.risk}</span></td>
                    <td><a href="#" className="hp-view-link">View</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Patient Panel Tab */
        <div className="hp-panel-layout">
          <div className="hp-pp-left">
            <div className="hp-pp-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search patients..." className="hp-pp-input" />
            </div>
            <button className="hp-pp-filters">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
              Filters
            </button>
            <div className="hp-pp-list">
              {PATIENT_PANEL.map((p, i) => (
                <div className="hp-pp-card" key={i}>
                  <div className="hp-pp-card-top">
                    <span className="hp-pp-name">{p.name}</span>
                    <span className={`hp-risk-pill ${riskClass(p.risk)}`}>{p.risk}</span>
                  </div>
                  <div className="hp-pp-card-bottom">
                    <span className="hp-pp-meta">{p.age}y / {p.gender}</span>
                    <span className="hp-pp-sep">•</span>
                    <span className="hp-pp-condition">{p.condition}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hp-pp-right">
            <div className="hp-pp-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <h3 className="hp-pp-empty-title">Select a patient to view details</h3>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
