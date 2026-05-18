import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { callFhirApi, buildUrl } from '../services/fhir';
import { FHIR_BASE } from '../config/constants';
import '../styles/provider.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function nameFromEmail(email) {
  if (!email) return '';
  const local = email.split('@')[0];
  return local.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function riskLabel(score) {
  const s = Number(score);
  if (Number.isNaN(s)) return 'low';
  if (s > 75) return 'critical';
  if (s > 50) return 'high';
  if (s > 25) return 'medium';
  return 'low';
}

export default function HealthcareProviderView({ onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const practId = searchParams.get('id') || localStorage.getItem('p360_ref_id') || '';
  const role = localStorage.getItem('p360_role') || '';

  const [practName, setPractName] = useState('');
  const [practEmail, setPractEmail] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [vitalsPage, setVitalsPage] = useState(1);
  const [labPage, setLabPage] = useState(1);
  const ITEMS_PER_PAGE = 4;

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!practId) return;
    (async () => {
      try {
        const res = await callFhirApi(`${FHIR_BASE}/baseR4/Practitioner?_id=${practId}&page=0&size=1`);
        const pr = res?.entry?.[0]?.resource;
        if (pr) {
          const prefix = pr.name?.[0]?.prefix?.[0] || '';
          const given = pr.name?.[0]?.given?.join(' ') || '';
          const family = pr.name?.[0]?.family || '';
          setPractName(`${prefix} ${given} ${family}`.trim() || nameFromEmail(localStorage.getItem('p360_email')));
          setPractEmail(pr.telecom?.find(t => t.system === 'email')?.value || localStorage.getItem('p360_email') || '');
        }
      } catch {
        setPractName(nameFromEmail(localStorage.getItem('p360_email')));
        setPractEmail(localStorage.getItem('p360_email') || '');
      }
    })();
  }, [practId]);

  useEffect(() => {
    if (!practId) return;
    (async () => {
      setPatientsLoading(true);
      try {
        const res = await callFhirApi(`${FHIR_BASE}/baseR4/Practitioner/fetch-patients-by-practitioner?id=${practId}`);
        const pts = (res?.entry || []).map(e => {
          const r = e.resource;
          const given = r.name?.[0]?.given?.join(' ') || '';
          const family = r.name?.[0]?.family || '';
          const birthDate = r.birthDate || '';
          const age = birthDate ? Math.floor((Date.now() - new Date(birthDate)) / 31557600000) : '';
          const gender = r.gender === 'male' ? 'M' : r.gender === 'female' ? 'F' : '';
          const disease = (r.extension || []).find(x => x.url === 'disease')?.valueString || '';
          const riskExt = (r.extension || []).find(x => x.url === 'riskLevel');
          const riskVal = riskExt?.valueString || '';
          return { id: r.id, name: `${given} ${family}`.trim(), age, gender, condition: disease, risk: riskVal || 'low' };
        });
        setPatients(pts.sort((a, b) => a.name.localeCompare(b.name)));
      } catch { setPatients([]); }
      setPatientsLoading(false);
    })();
  }, [practId]);

  async function loadPatientDetail(pid) {
    setDetailLoading(true);
    setPatientDetail(null);
    try {
      const [ptRes, obsRes, vitalsRes, medRes] = await Promise.all([
        callFhirApi(buildUrl('/baseR4/Patient/find', { id: pid })),
        callFhirApi(buildUrl('/baseR4/Observation/search', { patient: pid, page: 0, size: 200 })),
        callFhirApi(`${FHIR_BASE}/baseR4/Observation/vitals/search?patient=${pid}`),
        callFhirApi(buildUrl('/baseR4/MedicationRequest', { patient: pid, page: 0, size: 100 })),
      ]);

      const pt = ptRes?.entry?.[0]?.resource || ptRes;
      const given = pt?.name?.[0]?.given?.join(' ') || '';
      const family = pt?.name?.[0]?.family || '';
      const name = `${given} ${family}`.trim();
      const dob = pt?.birthDate || '';
      const mrn = (pt?.identifier || []).find(id => id.type?.coding?.[0]?.code === 'MR')?.value || '';
      const phone = (pt?.telecom || []).find(t => t.system === 'phone')?.value || '';
      const email = (pt?.telecom || []).find(t => t.system === 'email')?.value || '';
      const insurance = (pt?.extension || []).find(e => e.url === 'insurance')?.valueString || '';

      const allVitals = (vitalsRes?.entry || []).map(e => e.resource).filter(Boolean)
        .sort((a, b) => new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0));

      const latestVitalsMap = {};
      for (const v of allVitals) {
        const code = v.code?.coding?.[0]?.display || v.code?.text || '';
        if (code && !latestVitalsMap[code]) {
          latestVitalsMap[code] = {
            name: code,
            value: v.valueQuantity ? `${v.valueQuantity.value} ${v.valueQuantity.unit || ''}`.trim() : v.valueString || '',
          };
        }
      }
      const recentVitals = Object.values(latestVitalsMap);

      const allObs = (obsRes?.entry || []).map(e => e.resource).filter(Boolean);
      const labObs = allObs
        .sort((a, b) => new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0));

      const latestLabMap = {};
      for (const o of labObs) {
        const code = o.code?.coding?.[0]?.display || o.code?.text || '';
        if (code && !latestLabMap[code]) {
          latestLabMap[code] = {
            name: code,
            value: o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit || ''}`.trim() : o.valueString || '',
          };
        }
      }
      const latestLab = Object.values(latestLabMap);

      const obsGrouped = {};
      for (const o of labObs) {
        const code = o.code?.coding?.[0]?.display || o.code?.text || '';
        if (!code) continue;
        if (!obsGrouped[code]) obsGrouped[code] = [];
        obsGrouped[code].push({
          date: o.effectiveDateTime || '',
          value: o.valueQuantity?.value ?? null,
          unit: o.valueQuantity?.unit || '',
        });
      }
      for (const k of Object.keys(obsGrouped)) {
        obsGrouped[k].sort((a, b) => new Date(a.date) - new Date(b.date));
      }
      const trendTypes = Object.keys(obsGrouped).filter(k => obsGrouped[k].length >= 2);

      const trendDirections = {};
      for (const type of trendTypes) {
        const vals = obsGrouped[type].map(d => d.value).filter(v => v !== null);
        if (vals.length < 2) { trendDirections[type] = 'Stable'; continue; }
        const first = vals.slice(0, Math.ceil(vals.length / 2));
        const second = vals.slice(Math.ceil(vals.length / 2));
        const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
        const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
        const diff = ((avgSecond - avgFirst) / avgFirst) * 100;
        if (Math.abs(diff) < 5) trendDirections[type] = 'Stable';
        else if (diff < 0) trendDirections[type] = 'Improving';
        else trendDirections[type] = 'Not Improving';
      }

      const activeMeds = (medRes?.entry || [])
        .map(e => e.resource)
        .filter(r => r?.status === 'active')
        .map(r => ({
          name: r.medicationCodeableConcept?.coding?.[0]?.display || r.medicationCodeableConcept?.text || '',
          dosage: r.dosageInstruction?.[0]?.text || '',
        }));

      setPatientDetail({
        name, dob, mrn, phone, email,
        recentVitals, latestLab, trendTypes, trendDirections, obsGrouped, activeMeds,
      });
    } catch {
      setPatientDetail(null);
    }
    setDetailLoading(false);
  }

  useEffect(() => {
    if (selectedPatient) {
      setVitalsPage(1);
      setLabPage(1);
      loadPatientDetail(selectedPatient);
    }
  }, [selectedPatient]);

  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="hp-page">
      <nav className="hp-nav">
        <div className="hp-nav-left">
          <img src="/images/Rsystems_Logo_White.png" alt="R Systems" className="hp-nav-logo" />
          <span className="hp-nav-title">Patient 360 Portal</span>
        </div>
        <div className="hp-nav-right">
          <div className="hp-nav-bell">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="hp-nav-badge">8</span>
          </div>
          <div className="hp-nav-user">
            <span className="hp-nav-user-name">{practName || nameFromEmail(localStorage.getItem('p360_email'))}</span>
            <span className="hp-nav-user-role">HEALTHCARE PROVIDER</span>
          </div>
          <div className="hp-profile-wrap" ref={profileRef}>
            <div className="hp-nav-avatar" onClick={() => setShowProfile(!showProfile)} style={{ cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            {showProfile && (
              <div className="hp-profile-dropdown">
                <div className="hp-profile-info">
                  <span className="hp-profile-name">{practName}</span>
                  <span className="hp-profile-email">{practEmail}</span>
                </div>
                <div className="hp-profile-signout" onClick={onLogout}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign Out
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="hp-subheader">
        <h1 className="hp-page-title">Healthcare Provider Dashboard</h1>
        <button className="hp-back" onClick={() => navigate('/')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to Home
        </button>
      </div>

      <div className="hp-panel-layout">
        <div className="hp-pp-left">
          <div className="hp-pp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search patients..." className="hp-pp-input" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="hp-pp-filters">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            Filters
          </button>
          <div className="hp-pp-list">
            {patientsLoading ? (
              <p className="hp-pp-loading">Loading patients...</p>
            ) : filteredPatients.length > 0 ? filteredPatients.map(p => (
              <div className={`hp-pp-card${selectedPatient === p.id ? ' hp-pp-card-active' : ''}`} key={p.id} onClick={() => setSelectedPatient(p.id)}>
                <div className="hp-pp-card-top">
                  <span className="hp-pp-name">{p.name}</span>
                  <span className={`hp-risk-pill hp-risk-${p.risk}`}>{p.risk}</span>
                </div>
                <div className="hp-pp-card-bottom">
                  <span className="hp-pp-meta">{p.age}y / {p.gender}</span>
                  <span className="hp-pp-sep">&bull;</span>
                  <span className="hp-pp-condition">{p.condition || '—'}</span>
                </div>
              </div>
            )) : <p className="hp-pp-loading">No patients found</p>}
          </div>
        </div>

        <div className="hp-pp-right">
          {!selectedPatient ? (
            <div className="hp-pp-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <h3 className="hp-pp-empty-title">Select a patient to view details</h3>
            </div>
          ) : detailLoading ? (
            <div className="hp-pp-empty"><p className="hp-pp-loading">Loading patient details...</p></div>
          ) : patientDetail ? (
            <div className="hp-detail-scroll">
              {/* 1. Demographics */}
              <div className="hp-detail-card">
                <h3 className="hp-detail-title">Patient Demographics</h3>
                <div className="hp-demo-grid">
                  <div><span className="hp-demo-label">Name</span><span className="hp-demo-value">{patientDetail.name}</span></div>
                  <div><span className="hp-demo-label">DOB</span><span className="hp-demo-value">{patientDetail.dob ? new Date(patientDetail.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span></div>
                  <div><span className="hp-demo-label">MRN</span><span className="hp-demo-value">{patientDetail.mrn || '—'}</span></div>
                  <div><span className="hp-demo-label">Phone</span><span className="hp-demo-value">{patientDetail.phone || '—'}</span></div>
                  <div><span className="hp-demo-label">Email</span><span className="hp-demo-value">{patientDetail.email || '—'}</span></div>
                </div>
              </div>

              {/* 2. Clinical Outcomes (Observation trends — horizontal scroll, 2 visible) */}
              {patientDetail.trendTypes.length > 0 && (
                <div className="hp-detail-card">
                  <h3 className="hp-detail-title">Clinical Outcomes</h3>
                  <div className="hp-outcomes-scroll">
                    {patientDetail.trendTypes.map(type => {
                      const data = patientDetail.obsGrouped[type];
                      const direction = patientDetail.trendDirections[type] || 'Stable';
                      const dirColor = direction === 'Improving' ? '#16A34A' : direction === 'Not Improving' ? '#DC2626' : '#64748B';
                      const dirArrow = direction === 'Improving' ? '↓' : direction === 'Not Improving' ? '↑' : '→';
                      return (
                        <div key={type} className="hp-outcome-item">
                          <span className="hp-outcome-label">{type} Trend</span>
                          <div className="hp-outcome-chart">
                            <Bar
                              data={{
                                labels: data.map(() => ''),
                                datasets: [{ data: data.map(d => d.value), backgroundColor: '#93C5FD', borderRadius: 3, barPercentage: 0.65 }],
                              }}
                              options={{
                                responsive: true, maintainAspectRatio: false,
                                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.raw} ${data[0]?.unit || ''}` } } },
                                scales: {
                                  x: { display: false },
                                  y: { display: false },
                                },
                              }}
                            />
                          </div>
                          <span className="hp-outcome-direction" style={{ color: dirColor }}>{direction} {dirArrow}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Recent Vitals (paginated, 4 per page) */}
              {patientDetail.recentVitals.length > 0 && (() => {
                const totalVPages = Math.ceil(patientDetail.recentVitals.length / ITEMS_PER_PAGE);
                const visibleVitals = patientDetail.recentVitals.slice((vitalsPage - 1) * ITEMS_PER_PAGE, vitalsPage * ITEMS_PER_PAGE);
                return (
                <div className="hp-detail-card hp-detail-half">
                  <h3 className="hp-detail-title">Recent Vitals</h3>
                  <div className="hp-vitals-list hp-vitals-fixed">
                    {visibleVitals.map((v, i) => (
                      <div className="hp-vital-row" key={i}>
                        <span className="hp-vital-name">{v.name}</span>
                        <span className="hp-vital-val">{v.value}</span>
                      </div>
                    ))}
                  </div>
                  {totalVPages > 1 && (
                    <div className="hp-pagination">
                      <button className="hp-page-btn" disabled={vitalsPage <= 1} onClick={() => setVitalsPage(vitalsPage - 1)}>Prev</button>
                      <span className="hp-page-info">{vitalsPage} / {totalVPages}</span>
                      <button className="hp-page-btn" disabled={vitalsPage >= totalVPages} onClick={() => setVitalsPage(vitalsPage + 1)}>Next</button>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* 4. Lab Results (paginated, 4 per page) */}
              {patientDetail.latestLab.length > 0 && (() => {
                const totalLPages = Math.ceil(patientDetail.latestLab.length / ITEMS_PER_PAGE);
                const visibleLabs = patientDetail.latestLab.slice((labPage - 1) * ITEMS_PER_PAGE, labPage * ITEMS_PER_PAGE);
                return (
                <div className="hp-detail-card hp-detail-half">
                  <h3 className="hp-detail-title">Lab Results</h3>
                  <div className="hp-vitals-list hp-vitals-fixed">
                    {visibleLabs.map((l, i) => (
                      <div className="hp-vital-row" key={i}>
                        <span className="hp-vital-name">{l.name}</span>
                        <span className="hp-vital-val hp-lab-val">{l.value}</span>
                      </div>
                    ))}
                  </div>
                  {totalLPages > 1 && (
                    <div className="hp-pagination">
                      <button className="hp-page-btn" disabled={labPage <= 1} onClick={() => setLabPage(labPage - 1)}>Prev</button>
                      <span className="hp-page-info">{labPage} / {totalLPages}</span>
                      <button className="hp-page-btn" disabled={labPage >= totalLPages} onClick={() => setLabPage(labPage + 1)}>Next</button>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* 5. Current Medications */}
              {patientDetail.activeMeds.length > 0 && (
                <div className="hp-detail-card">
                  <h3 className="hp-detail-title">Current Medications</h3>
                  <div className="hp-meds-list">
                    {patientDetail.activeMeds.map((m, i) => (
                      <div className="hp-med-row" key={i}>
                        <div className="hp-med-info">
                          <span className="hp-med-name">{m.name}</span>
                          {m.dosage && <span className="hp-med-dosage">{m.dosage}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hp-pp-empty"><p className="hp-pp-loading">Failed to load patient details</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
