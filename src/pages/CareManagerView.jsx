import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { callFhirApi } from '../services/fhir';
import { FHIR_BASE } from '../config/constants';
import '../styles/caremanager.css';

function nameFromEmail(email) {
  if (!email) return '';
  const local = email.split('@')[0];
  return local.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

const ORGS_PER_PAGE = 5;

export default function CareManagerView({ onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cmId = searchParams.get('id') || localStorage.getItem('p360_ref_id') || '';
  const role = localStorage.getItem('p360_role') || '';
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);
  const [orgs, setOrgs] = useState([]);
  const [orgPatients, setOrgPatients] = useState({});
  const [loading, setLoading] = useState(true);
  const [orgPage, setOrgPage] = useState(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [mainTab, setMainTab] = useState('patients');
  const [riskPatients, setRiskPatients] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!cmId) return;
    loadOrgs();
  }, [cmId]);

  async function loadOrgs() {
    setLoading(true);
    try {
      const orgRes = await callFhirApi(`${FHIR_BASE}/baseR4/Organization/by-care-manager?_id=${cmId}`);
      const orgList = (orgRes?.entry || []).map(e => {
        const r = e.resource;
        return { id: r.id, name: r.name || 'Unknown', type: r.type?.[0]?.coding?.[0]?.display || '', city: r.address?.[0]?.city || '', state: r.address?.[0]?.state || '' };
      });
      const uniqueOrgs = orgList.filter((o, i, arr) => arr.findIndex(x => x.id === o.id) === i);
      setOrgs(uniqueOrgs);
    } catch {}
    setLoading(false);
  }

  const filtered = orgs.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  const totalOrgPages = Math.ceil(filtered.length / ORGS_PER_PAGE);
  const visibleOrgs = filtered.slice((orgPage - 1) * ORGS_PER_PAGE, orgPage * ORGS_PER_PAGE);

  useEffect(() => {
    if (!visibleOrgs.length) return;
    visibleOrgs.forEach(org => {
      if (orgPatients[org.id] !== undefined) return;
      callFhirApi(`${FHIR_BASE}/baseR4/Organization/patients?orgId=${org.id}`)
        .then(res => {
          const pts = (res?.entry || []).map(e => {
            const r = e.resource;
            const given = r.name?.[0]?.given?.join(' ') || '';
            const family = r.name?.[0]?.family || '';
            const mrn = (r.identifier || []).find(id => id.type?.coding?.[0]?.code === 'MR')?.value || '';
            const disease = (r.extension || []).find(x => x.url === 'disease')?.valueString || '';
            const birthDate = r.birthDate || '';
            const age = birthDate ? Math.floor((Date.now() - new Date(birthDate)) / 31557600000) : '';
            const phone = (r.telecom || []).find(t => t.system === 'phone')?.value || '';
            return { id: r.id, name: `${given} ${family}`.trim(), mrn, age, condition: disease, phone };
          });
          setOrgPatients(prev => ({ ...prev, [org.id]: pts }));
        })
        .catch(() => setOrgPatients(prev => ({ ...prev, [org.id]: [] })));
    });
  }, [visibleOrgs.map(o => o.id).join(','), orgPage]);

  useEffect(() => {
    if (!selectedOrg || mainTab !== 'analytics') return;
    const pts = orgPatients[selectedOrg] || [];
    if (!pts.length) { setRiskPatients([]); return; }
    Promise.all(pts.map(p =>
      callFhirApi(`${FHIR_BASE}/baseR4/CareCoordinationNote/risk-assignment?patientId=${p.id}&orgId=${selectedOrg}`)
        .then(res => res?.riskScore ? { ...p, riskScore: res.riskScore } : null)
        .catch(() => null)
    )).then(results => setRiskPatients(results.filter(Boolean).sort((a, b) => b.riskScore - a.riskScore)));

    const today = new Date().toISOString().split('T')[0];
    Promise.all(pts.map(p =>
      callFhirApi(`${FHIR_BASE}/baseR4/Appointment?patient=${p.id}&page=0&size=100`)
        .then(res => {
          const appts = (res?.entry || []).map(e => e.resource).filter(r => r.status === 'booked' && r.start);
          const todayAppt = appts.find(a => a.start.startsWith(today));
          if (!todayAppt) return null;
          const time = new Date(todayAppt.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          return { name: p.name, time, type: todayAppt.description || todayAppt.serviceType?.[0]?.text || 'Appointment', patientId: p.id };
        }).catch(() => null)
    )).then(results => setTodaySchedule(results.filter(Boolean).sort((a, b) => a.time.localeCompare(b.time))));
  }, [selectedOrg, mainTab, orgPatients[selectedOrg]?.length]);

  const selectedOrgData = orgs.find(o => o.id === selectedOrg);
  const patients = selectedOrg ? (orgPatients[selectedOrg] || []) : [];
  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()));

  return (
    <div className="cm-page">
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
            <span className="cm-nav-user-name">{role === 'ADMIN' ? (localStorage.getItem('p360_user') || 'Admin') : nameFromEmail(localStorage.getItem('p360_email'))}</span>
            <span className="cm-nav-user-role">{role || 'CARE_MANAGER'}</span>
          </div>
          <div className="cm-profile-wrap" ref={profileRef}>
            <div className="cm-nav-avatar" onClick={() => setShowProfile(!showProfile)} style={{ cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            {showProfile && (
              <div className="cm-profile-dropdown">
                <div className="cm-profile-info">
                  <span className="cm-profile-name">{role === 'ADMIN' ? (localStorage.getItem('p360_user') || 'Admin') : nameFromEmail(localStorage.getItem('p360_email'))}</span>
                  <span className="cm-profile-email">{localStorage.getItem('p360_email') || ''}</span>
                </div>
                <div className="cm-profile-signout" onClick={onLogout}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign Out
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="cm-subheader">
        <h1 className="cm-page-title">Care Manager Dashboard</h1>
        <button className="cm-back" onClick={() => navigate('/')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to Home
        </button>
      </div>

      <div className="cm-content">
        <div className="cm-orgs-panel">
          <h2 className="cm-orgs-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
            Organizations
          </h2>

          <div className="cm-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search organizations..." value={search} onChange={e => { setSearch(e.target.value); setOrgPage(1); }} className="cm-search-input" />
          </div>

          <div className="cm-org-list">
            {loading ? (
              <div className="cm-empty-state"><p className="cm-empty-sub">Loading organizations...</p></div>
            ) : visibleOrgs.length > 0 ? (
              visibleOrgs.map(org => (
                <div className={`cm-org-card${selectedOrg === org.id ? ' cm-org-active' : ''}`} key={org.id} onClick={() => { setSelectedOrg(org.id); setPatientSearch(''); }}>
                  <div className="cm-org-info">
                    <div className="cm-org-name">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
                      {org.name}
                    </div>
                    <span className="cm-org-type">{org.type}</span>
                  </div>
                  <div className="cm-org-count">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {orgPatients[org.id] !== undefined ? `${orgPatients[org.id].length} patients` : '...'}
                  </div>
                </div>
              ))
            ) : (
              <div className="cm-empty-state"><p className="cm-empty-sub">No organizations found</p></div>
            )}
          </div>

          {totalOrgPages > 1 && (
            <div className="cm-org-pagination">
              <button className="cm-page-btn" disabled={orgPage <= 1} onClick={() => setOrgPage(orgPage - 1)}>Prev</button>
              {Array.from({ length: totalOrgPages }, (_, i) => (
                <button key={i} className={`cm-page-btn${orgPage === i + 1 ? ' cm-page-active' : ''}`} onClick={() => setOrgPage(i + 1)}>{i + 1}</button>
              ))}
              <button className="cm-page-btn" disabled={orgPage >= totalOrgPages} onClick={() => setOrgPage(orgPage + 1)}>Next</button>
            </div>
          )}
        </div>

        <div className="cm-patients-panel">
          {!selectedOrg ? (
            <div className="cm-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              <h3 className="cm-empty-title">Select an organization to view patients</h3>
              <p className="cm-empty-sub">Choose from the list on the left</p>
            </div>
          ) : (
            <>
              <div className="cm-main-tabs">
                <button className={`cm-main-tab${mainTab === 'patients' ? ' active' : ''}`} onClick={() => setMainTab('patients')}>Patients</button>
                <button className={`cm-main-tab${mainTab === 'analytics' ? ' active' : ''}`} onClick={() => setMainTab('analytics')}>Analytics</button>
              </div>

              {mainTab === 'patients' && (
                <>
                  <div className="cm-patients-header">
                    <div>
                      <h2 className="cm-patients-title">{selectedOrgData?.name || 'Organization'}</h2>
                      <span className="cm-patients-subtitle">{filteredPatients.length} total</span>
                    </div>
                    <div className="cm-patient-search">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input type="text" placeholder="Search patients..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
                    </div>
                  </div>
                  {!orgPatients[selectedOrg] ? (
                    <div className="cm-empty-state"><p className="cm-empty-sub">Loading patients...</p></div>
                  ) : filteredPatients.length === 0 ? (
                    <div className="cm-empty-state"><p className="cm-empty-sub">No patients found</p></div>
                  ) : (
                    <div className="cm-table-wrap">
                      <table className="cm-table">
                        <thead><tr><th>Patient Name</th><th>MRN</th><th>Age</th><th>Condition</th><th>Contact</th><th>Actions</th></tr></thead>
                        <tbody>
                          {filteredPatients.map(p => (
                            <tr key={p.id}>
                              <td className="cm-td-name"><div className="cm-patient-avatar">{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>{p.name}</td>
                              <td>{p.mrn}</td><td>{p.age}</td>
                              <td>{p.condition ? <span className="cm-condition-pill">{p.condition}</span> : '—'}</td>
                              <td className="cm-td-contact">{p.phone && (<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>{p.phone}</>)}</td>
                              <td><button className="cm-view-details" onClick={() => navigate(`/patient-view?id=${p.id}`)}>View Details</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {mainTab === 'analytics' && (
                <div className="cm-analytics">
                  <div className="cm-analytics-scroll">
                    <h3 className="cm-an-section-title">High-Risk & Deteriorating Patients <span className="cm-an-count">{riskPatients.length} {riskPatients.length === 1 ? 'Patient' : 'Patients'}</span></h3>
                    {riskPatients.length > 0 ? riskPatients.map((p, i) => (
                      <div className="cm-an-risk-card" key={i}>
                        <div className="cm-an-risk-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
                        <div className="cm-an-risk-info"><span className="cm-an-risk-name">{p.name}</span><span className="cm-an-risk-issue">{p.condition || 'Under monitoring'}</span></div>
                        <div className="cm-an-risk-score"><span className="cm-an-score-label">Risk Score</span><span className="cm-an-score-val">{p.riskScore}</span></div>
                      </div>
                    )) : <p style={{ fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>No risk-assigned patients in this organization</p>}

                    <div className="cm-an-kpi-row">
                      <div className="cm-an-kpi"><span className="cm-an-kpi-label">Recent Admissions</span><span className="cm-an-kpi-val">12</span><span className="cm-an-kpi-change down">↘ 8% from last week</span></div>
                      <div className="cm-an-kpi"><span className="cm-an-kpi-label">ER Visits</span><span className="cm-an-kpi-val">8</span><span className="cm-an-kpi-change up">↗ 12% from last week</span></div>
                      <div className="cm-an-kpi"><span className="cm-an-kpi-label">Discharges</span><span className="cm-an-kpi-val">15</span><span className="cm-an-kpi-change up">↗ 15% from last week</span></div>
                    </div>

                    <h3 className="cm-an-section-title">Preventive & Clinical Care Gaps</h3>
                    {patients.slice(0, 4).map((p, i) => (
                      <div className="cm-an-gap-row" key={i}>
                        <div className="cm-an-gap-info"><span className="cm-an-gap-name">{p.name}</span><span className="cm-an-gap-issue">{p.condition ? `${p.condition} screening overdue` : 'Follow-up needed'}</span></div>
                        <span className={`cm-an-pri-pill ${i < 2 ? 'high' : i === 2 ? 'med' : 'low'}`}>{i < 2 ? 'High' : i === 2 ? 'Medium' : 'Low'} Priority</span>
                        <button className="cm-an-schedule-btn">Schedule</button>
                      </div>
                    ))}

                    <div className="cm-an-hedis-row">
                      <div className="cm-an-hedis">
                        <h3 className="cm-an-section-title">HEDIS Measures</h3>
                        {[{ label: 'Diabetes Care', pct: 87, color: '#3B82F6' }, { label: 'Hypertension Control', pct: 92, color: '#22C55E' }, { label: 'Preventive Care', pct: 78, color: '#F59E0B' }].map((m, i) => (
                          <div className="cm-an-hedis-item" key={i}>
                            <div className="cm-an-hedis-meta"><span>{m.label}</span><span className="cm-an-hedis-pct">{m.pct}%</span></div>
                            <div className="cm-an-hedis-bar"><div style={{ width: `${m.pct}%`, background: m.color, height: '100%', borderRadius: 5 }} /></div>
                          </div>
                        ))}
                      </div>
                      <div className="cm-an-mips">
                        <h3 className="cm-an-section-title">MIPS Performance</h3>
                        <div className="cm-an-mips-donut">
                          <svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" fill="none" stroke="#E2E8F0" strokeWidth="10" /><circle cx="60" cy="60" r="46" fill="none" stroke="#14B8A6" strokeWidth="10" strokeDasharray={`${0.85 * 2 * Math.PI * 46} ${2 * Math.PI * 46}`} strokeLinecap="round" transform="rotate(-90 60 60)" /></svg>
                          <div className="cm-an-mips-text"><span className="cm-an-mips-score">85</span><span className="cm-an-mips-label">Score</span></div>
                        </div>
                        <p className="cm-an-mips-status">Above Target</p>
                      </div>
                    </div>

                    <div className="cm-an-kpi-row">
                      <div className="cm-an-kpi">
                        <div className="cm-an-kpi-head"><span className="cm-an-kpi-label">ALOS</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
                        <span className="cm-an-kpi-val">4.2 days</span><span className="cm-an-kpi-change down">↓ 5% vs last month</span>
                        <div className="cm-an-mini-bars">{[18,22,15,25,20,30,18,24,16,28].map((h,i)=><div key={i} className="cm-an-mini-bar" style={{height:h,background:'#99F6E4'}}/>)}</div>
                      </div>
                      <div className="cm-an-kpi">
                        <div className="cm-an-kpi-head"><span className="cm-an-kpi-label">Readmission Rate</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg></div>
                        <span className="cm-an-kpi-val">8.5%</span><span className="cm-an-kpi-change up">↑ 2% vs last month</span>
                        <div className="cm-an-mini-bars">{[20,18,25,22,28,15,30,20,24,18].map((h,i)=><div key={i} className="cm-an-mini-bar" style={{height:h,background:'#FDE68A'}}/>)}</div>
                      </div>
                      <div className="cm-an-kpi">
                        <div className="cm-an-kpi-head"><span className="cm-an-kpi-label">No Show Rate</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                        <span className="cm-an-kpi-val">12.3%</span><span className="cm-an-kpi-change down">↓ 8% vs last month</span>
                        <div className="cm-an-mini-bars">{[25,20,22,18,15,28,20,24,16,22].map((h,i)=><div key={i} className="cm-an-mini-bar" style={{height:h,background:'#DDD6FE'}}/>)}</div>
                      </div>
                    </div>

                    <h3 className="cm-an-section-title">Population View</h3>
                    <div className="cm-an-pop-row">
                      <div className="cm-an-pop-stat" style={{ borderLeftColor: '#3B82F6' }}><span className="cm-an-pop-num">{patients.length}</span><span className="cm-an-pop-label">Total Patients</span></div>
                      <div className="cm-an-pop-stat" style={{ borderLeftColor: '#EF4444' }}><span className="cm-an-pop-num">{riskPatients.length}</span><span className="cm-an-pop-label">High Risk</span></div>
                      <div className="cm-an-pop-stat" style={{ borderLeftColor: '#F59E0B' }}><span className="cm-an-pop-num">{Math.min(patients.length, 4)}</span><span className="cm-an-pop-label">Care Gaps</span></div>
                      <div className="cm-an-pop-stat" style={{ borderLeftColor: '#8B5CF6' }}><span className="cm-an-pop-num">{Math.round(patients.length * 0.13)}</span><span className="cm-an-pop-label">Non-Adherent</span></div>
                    </div>

                    <h3 className="cm-an-section-title">Today's Schedule</h3>
                    {todaySchedule.length > 0 ? (
                      <div className="cm-table-wrap">
                        <table className="cm-table">
                          <thead><tr><th>Patient Name</th><th>Time</th><th>Visit Type</th><th>Actions</th></tr></thead>
                          <tbody>
                            {todaySchedule.map((s, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{s.name}</td>
                                <td>{s.time}</td>
                                <td>{s.type}</td>
                                <td><button className="cm-view-details" onClick={() => navigate(`/patient-view?id=${s.patientId}`)}>View</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>No appointments scheduled for today</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
