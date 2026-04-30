import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { callFhirApi, buildUrl } from '../services/fhir';
import { callAI } from '../services/ai';
import { HEALTH_STATUS_PROMPT, CONDITIONS_PROMPT, TASKS_PROMPT } from '../config/prompts';
import '../styles/patient.css';

const NOTIFICATIONS = [
  { text: 'Lab results are ready for review', time: '2 hours ago' },
  { text: 'New message from your care team', time: '5 hours ago' },
  { text: 'Upcoming appointment reminder', time: '1 day ago' },
];

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

const OBS_PER_PAGE = 3;

function statusColor(status) {
  switch ((status || '').toLowerCase()) {
    case 'good': return 'pv-status-good';
    case 'fair': return 'pv-status-fair';
    case 'poor': return 'pv-status-poor';
    case 'critical': return 'pv-status-critical';
    default: return 'pv-status-fair';
  }
}

export default function PatientView({ onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('id') || localStorage.getItem('p360_patient_id') || '';

  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [healthStatus, setHealthStatus] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [lastMed, setLastMed] = useState(null);
  const [observations, setObservations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);
  const [obsPage, setObsPage] = useState(1);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!patientId) return;
    loadData();
  }, [patientId]);

  async function loadData() {
    try {
      const [patientRes, condRes, medRes, obsRes] = await Promise.all([
        callFhirApi(buildUrl('/baseR4/Patient', { _id: patientId, page: 0, size: 1 })),
        callFhirApi(buildUrl('/baseR4/Condition', { patient: patientId, page: 0, size: 100 })),
        callFhirApi(buildUrl('/baseR4/MedicationRequest', { patient: patientId, page: 0, size: 100 })),
        callFhirApi(buildUrl('/baseR4/Observation/search', { patient: patientId, page: 0, size: 100 })),
      ]);

      const pt = patientRes?.entry?.[0]?.resource;
      const given = pt?.name?.[0]?.given?.join(' ') || '';
      const family = pt?.name?.[0]?.family || '';
      const fullName = `${given} ${family}`.trim();
      setPatientName(fullName || 'Patient');
      const email = (pt?.telecom || []).find(t => t.system === 'email')?.value || '';
      setPatientEmail(email);

      const condEntries = condRes?.entry || [];
      const condData = condEntries.map(e => {
        const r = e.resource;
        return {
          code: r.code?.coding?.[0]?.code || '',
          display: r.code?.coding?.[0]?.display || '',
          clinicalStatus: r.clinicalStatus?.coding?.[0]?.code || '',
        };
      });

      const medEntries = medRes?.entry || [];
      const meds = medEntries.map(e => {
        const r = e.resource;
        return {
          name: r.medicationCodeableConcept?.coding?.[0]?.display || r.medicationCodeableConcept?.text || 'Unknown',
          status: r.status || '',
          authoredOn: r.authoredOn || '',
          dosage: r.dosageInstruction?.[0]?.text || '',
        };
      }).sort((a, b) => (b.authoredOn || '').localeCompare(a.authoredOn || ''));
      setLastMed(meds[0] || null);

      const obsEntries = obsRes?.entry || [];
      const obsMap = {};
      obsEntries.forEach(e => {
        const r = e.resource;
        const code = r.code?.coding?.[0]?.code || '';
        const display = r.code?.coding?.[0]?.display || '';
        const value = r.valueQuantity?.value ?? r.valueString ?? '';
        const unit = r.valueQuantity?.unit || '';
        const date = r.effectiveDateTime || r.issued || '';
        if (!code) return;
        if (!obsMap[code] || (date > (obsMap[code].date || ''))) {
          obsMap[code] = { code, display, value, unit, date };
        }
      });
      const latestObs = Object.values(obsMap).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setObservations(latestObs);
      setLoading(false);

      const condSummary = condData.map(c => `${c.display} (${c.clinicalStatus})`).join(', ');
      const obsSummary = latestObs.map(o => `${o.display}: ${o.value} ${o.unit}`).join(', ');
      const medSummary = meds.map(m => `${m.name} (${m.status})`).join(', ');
      const patientContext = `Patient: ${fullName}\nConditions: ${condSummary || 'None found'}\nObservations: ${obsSummary || 'None found'}\nMedications: ${medSummary || 'None found'}`;

      const today = new Date().toISOString().split('T')[0];
      const tasksCacheKey = `p360_tasks_${patientId}_${today}`;
      const cachedTasks = sessionStorage.getItem(tasksCacheKey);
      let tasksPromise;
      if (cachedTasks) {
        tasksPromise = Promise.resolve({ status: 'cached', value: cachedTasks });
      } else {
        tasksPromise = callAI(TASKS_PROMPT, patientContext).then(v => ({ status: 'fulfilled', value: v })).catch(() => ({ status: 'rejected' }));
      }

      const [statusResult, condResult, tasksResult] = await Promise.all([
        callAI(HEALTH_STATUS_PROMPT, patientContext).then(v => ({ status: 'fulfilled', value: v })).catch(() => ({ status: 'rejected' })),
        callAI(CONDITIONS_PROMPT, `Condition data: ${JSON.stringify(condData)}`).then(v => ({ status: 'fulfilled', value: v })).catch(() => ({ status: 'rejected' })),
        tasksPromise,
      ]);

      if (statusResult.status === 'fulfilled') {
        try { setHealthStatus(JSON.parse(statusResult.value)); }
        catch { setHealthStatus({ status: 'Fair', reason: 'Unable to assess' }); }
      } else {
        setHealthStatus({ status: 'Fair', reason: 'Unable to assess' });
      }

      if (condResult.status === 'fulfilled') {
        try {
          const parsed = JSON.parse(condResult.value);
          setConditions(Array.isArray(parsed) ? parsed.slice(0, 2) : []);
        } catch {
          setConditions(condData.map(c => c.display).filter(Boolean).slice(0, 2));
        }
      } else {
        setConditions(condData.map(c => c.display).filter(Boolean).slice(0, 2));
      }

      if (tasksResult.status === 'cached') {
        try { setTasks(JSON.parse(tasksResult.value)); }
        catch { setTasks(['Stay hydrated throughout the day', 'Take a short walk after meals']); }
      } else if (tasksResult.status === 'fulfilled') {
        try {
          const parsed = JSON.parse(tasksResult.value);
          const taskList = Array.isArray(parsed) ? parsed.slice(0, 2) : [];
          setTasks(taskList);
          sessionStorage.setItem(tasksCacheKey, JSON.stringify(taskList));
        } catch {
          setTasks(['Stay hydrated throughout the day', 'Take a short walk after meals']);
        }
      } else {
        setTasks(['Stay hydrated throughout the day', 'Take a short walk after meals']);
      }

      setAiLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
      setAiLoading(false);
    }
  }

  return (
    <div className="pv-page">
      {/* Navbar */}
      <nav className="pv-nav">
        <div className="pv-nav-left">
          <img src="/images/R_Systems_White.png" alt="R Systems" className="pv-nav-logo" />
          <span className="pv-nav-title">Patient 360 Portal</span>
        </div>
        <div className="pv-nav-right">
          <div className="pv-nav-bell-wrap" ref={notifRef}>
            <div className="pv-nav-bell" onClick={() => setShowNotif(!showNotif)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span className="pv-nav-badge">3</span>
            </div>
            {showNotif && (
              <div className="pv-notif-dropdown">
                <div className="pv-notif-header">Notifications</div>
                {NOTIFICATIONS.map((n, i) => (
                  <div className="pv-notif-item" key={i}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div className="pv-notif-text">
                      <span>{n.text}</span>
                      <span className="pv-notif-time">{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pv-nav-user">
            <span className="pv-nav-user-name">{patientName || 'Loading...'}</span>
            <span className="pv-nav-user-role">PATIENT</span>
          </div>
          <div className="pv-profile-wrap" ref={profileRef}>
            <div className="pv-nav-avatar" onClick={() => setShowProfile(!showProfile)} style={{ cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            {showProfile && (
              <div className="pv-profile-dropdown">
                <div className="pv-profile-info">
                  <span className="pv-profile-name">{patientName}</span>
                  <span className="pv-profile-email">{patientEmail}</span>
                </div>
                <div className="pv-profile-signout" onClick={onLogout}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign Out
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Sub-header */}
      <div className="pv-subheader">
        <h1 className="pv-page-title">My Health Dashboard</h1>
        <button className="pv-back" onClick={() => navigate(`/?id=${patientId}`)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back to Home
        </button>
      </div>

      {/* ── Top Row ── */}
      <div className="pv-grid pv-grid-top">

        {/* ── My Health (DYNAMIC) ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#EF4444" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            My Health
          </h2>

          {loading ? (
            <div className="pv-loading">
              <div className="pv-spinner"></div>
              <span>Loading health data...</span>
            </div>
          ) : (
            <>
              <div className="pv-health-status">
                Health Status:{' '}
                {aiLoading ? (
                  <span className="pv-pill pv-status-loading">Analyzing...</span>
                ) : healthStatus ? (
                  <span className={`pv-pill ${statusColor(healthStatus.status)}`}>{healthStatus.status}</span>
                ) : (
                  <span className="pv-pill pv-status-fair">Fair</span>
                )}
              </div>

              <h3 className="pv-section-label">My Conditions</h3>
              {aiLoading ? (
                <p className="pv-loading-text">Evaluating conditions...</p>
              ) : conditions.length > 0 ? (
                <ul className="pv-condition-list">
                  {conditions.map((c, i) => (
                    <li key={i}><span className="pv-check green">✓</span> {c}</li>
                  ))}
                </ul>
              ) : (
                <p className="pv-empty-text">No conditions found</p>
              )}

              <h3 className="pv-section-label">Last Medication Taken</h3>
              {lastMed ? (
                <div className="pv-last-med">
                  <span className="pv-check green">✓</span>
                  <div className="pv-last-med-info">
                    <span>{lastMed.name}</span>
                    {lastMed.authoredOn && <span className="pv-med-date">{formatDateTime(lastMed.authoredOn)}</span>}
                  </div>
                </div>
              ) : (
                <p className="pv-empty-text">No medications found</p>
              )}

              <h3 className="pv-section-label">Recent Test Results</h3>
              {observations.length > 0 ? (
                <>
                  <div className="pv-test-results">
                    {observations.slice((obsPage - 1) * OBS_PER_PAGE, obsPage * OBS_PER_PAGE).map((o, i) => (
                      <div className="pv-test-row" key={i}>
                        <span>{o.display}:</span>
                        <span className="pv-test-val">{o.value} {o.unit}</span>
                      </div>
                    ))}
                  </div>
                  {observations.length > OBS_PER_PAGE && (
                    <div className="pv-obs-pagination">
                      <button
                        className="pv-obs-page-btn"
                        disabled={obsPage <= 1}
                        onClick={() => setObsPage(obsPage - 1)}
                      >Prev</button>
                      {Array.from({ length: Math.ceil(observations.length / OBS_PER_PAGE) }, (_, i) => (
                        <button
                          key={i}
                          className={`pv-obs-page-btn${obsPage === i + 1 ? ' pv-obs-page-active' : ''}`}
                          onClick={() => setObsPage(i + 1)}
                        >{i + 1}</button>
                      ))}
                      <button
                        className="pv-obs-page-btn"
                        disabled={obsPage >= Math.ceil(observations.length / OBS_PER_PAGE)}
                        onClick={() => setObsPage(obsPage + 1)}
                      >Next</button>
                    </div>
                  )}
                </>
              ) : (
                <p className="pv-empty-text">No test results found</p>
              )}

              <h3 className="pv-section-label">Things to Do Today</h3>
              {aiLoading ? (
                <p className="pv-loading-text">Generating tasks...</p>
              ) : tasks.length > 0 ? (
                <ul className="pv-todo-list">
                  {tasks.map((t, i) => (
                    <li key={i}>
                      <span className="pv-todo-dot"></span>
                      {t}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pv-empty-text">No tasks for today</p>
              )}
            </>
          )}
        </div>

        {/* ── My Health Summary (unchanged) ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            My Health Summary
          </h2>

          <h3 className="pv-section-label">Conditions Explained</h3>
          <div className="pv-condition-card">
            <p><strong>Type 2 Diabetes:</strong> Your body doesn't use insulin well. We're managing this with medication and lifestyle changes.</p>
          </div>
          <div className="pv-condition-card">
            <p><strong>Hypertension:</strong> High blood pressure. Controlled with daily medication and low-salt diet.</p>
          </div>

          <h3 className="pv-section-label">Current Care Plan & Goals</h3>
          <ul className="pv-goals">
            <li><span className="pv-goal-dot"></span> Keep blood sugar under 140 mg/dL</li>
            <li><span className="pv-goal-dot"></span> Walk 30 minutes daily</li>
            <li><span className="pv-goal-dot"></span> Reduce sodium intake</li>
          </ul>

          <div className="pv-allergy-card">
            <h3 className="pv-allergy-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Allergies & Safety Info
            </h3>
            <p className="pv-allergy-item">• Penicillin - severe reaction</p>
            <p className="pv-allergy-item">• Shellfish - moderate</p>
          </div>

          <h3 className="pv-section-label">My Care Team</h3>
          <div className="pv-care-team">
            <div className="pv-team-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Dr. Michael Chen - Primary Care
            </div>
            <div className="pv-team-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Dr. Lisa Park - Endocrinologist
            </div>
            <div className="pv-team-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Jane Smith RN - Care Manager
            </div>
          </div>

          <h3 className="pv-section-label">Test Results Trend</h3>
          <p className="pv-trend-sub">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg>
            Blood Sugar · Last 3 Months
          </p>
          <div className="pv-trend-bars">
            <div className="pv-bar" style={{ height: 60, background: '#3B82F6' }}></div>
            <div className="pv-bar" style={{ height: 52, background: '#60A5FA' }}></div>
            <div className="pv-bar" style={{ height: 48, background: '#60A5FA' }}></div>
            <div className="pv-bar" style={{ height: 40, background: '#22C55E' }}></div>
          </div>
          <p className="pv-trend-label">↓ Improving trend</p>
        </div>

        {/* ── Appointments & Visits (unchanged) ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Appointments & Visits
          </h2>

          <h3 className="pv-section-label">Upcoming Appointments</h3>
          <div className="pv-appt-card pv-appt-upcoming">
            <div className="pv-appt-info">
              <span className="pv-appt-doc">Dr. Michael Chen</span>
              <span className="pv-appt-type">Quarterly Check-up</span>
            </div>
            <span className="pv-appt-date blue">Apr 18, 2:00 PM</span>
          </div>
          <div className="pv-appt-card">
            <div className="pv-appt-info">
              <span className="pv-appt-doc">Dr. Lisa Park</span>
              <span className="pv-appt-type">Diabetes Follow-Up</span>
            </div>
            <span className="pv-appt-date">May 2, 10:00 AM</span>
          </div>

          <button className="pv-televisit-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Start Tele-Visit
          </button>

          <h3 className="pv-section-label">Past Appointments</h3>
          <div className="pv-appt-card">
            <div className="pv-appt-info">
              <span className="pv-appt-doc">Dr. Michael Chen</span>
              <span className="pv-appt-type">Annual Physical</span>
            </div>
            <span className="pv-appt-date">Jan 15, 2026</span>
          </div>
          <a href="#" className="pv-view-summary">View Summary</a>

          <h3 className="pv-section-label">Follow-up Instructions</h3>
          <div className="pv-followup-card">
            <p>• Monitor blood sugar daily</p>
            <p>• Schedule eye exam within 3 months</p>
            <p>• Continue current medications</p>
          </div>

          <h3 className="pv-section-label">Authorizations</h3>
          <div className="pv-auth-row">
            <span>MRI - Lower Back</span>
            <span className="pv-pill pv-pill-green">Approved</span>
          </div>
        </div>
      </div>

      {/* ── Bottom Row (unchanged) ── */}
      <div className="pv-grid pv-grid-bottom">

        {/* ── My Medications ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3"/></svg>
            My Medications
          </h2>

          <div className="pv-med-card">
            <div className="pv-med-header">
              <span className="pv-med-name">Metformin 500mg</span>
              <span className="pv-pill pv-pill-green">Active</span>
            </div>
            <p className="pv-med-detail"><strong>Purpose:</strong> Controls blood sugar levels</p>
            <p className="pv-med-detail"><strong>Dose:</strong> 1 tablet, twice daily (morning & evening)</p>
            <div className="pv-med-detail">
              <span>Refill Status:</span>
              <span className="pv-pill pv-pill-blue-outline">15 days left</span>
            </div>
            <p className="pv-med-reminder">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Daily reminder: 8:00 AM, 8:00 PM
            </p>
          </div>

          <div className="pv-med-card">
            <div className="pv-med-header">
              <span className="pv-med-name">Lisinopril 10mg</span>
              <span className="pv-pill pv-pill-green">Active</span>
            </div>
            <p className="pv-med-detail"><strong>Purpose:</strong> Lowers blood pressure</p>
            <p className="pv-med-detail"><strong>Dose:</strong> 1 tablet, once daily (evening)</p>
            <div className="pv-med-detail">
              <span>Refill Status:</span>
              <span className="pv-pill pv-pill-blue-outline">30 days left</span>
            </div>
            <p className="pv-med-reminder">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Daily reminder: 8:00 PM
            </p>
          </div>

          <div className="pv-missed-alert">
            <div className="pv-missed-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Missed Dose Alert
            </div>
            <p>You missed Metformin yesterday at 8:00 PM</p>
            <a href="#" className="pv-mark-taken">Mark as taken</a>
          </div>

          <button className="pv-refill-btn">Request Refill</button>
        </div>

        {/* ── My Care Plan & Tasks ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
            My Care Plan & Tasks
          </h2>

          <h3 className="pv-section-label">Today's Tasks</h3>
          <label className="pv-task"><input type="checkbox" /> Take morning medication</label>
          <label className="pv-task"><input type="checkbox" /> Take evening medication</label>
          <label className="pv-task"><input type="checkbox" /> Get lab test (fasting glucose)</label>
          <label className="pv-task"><input type="checkbox" /> Schedule follow-up appointment</label>

          <h3 className="pv-section-label">Lifestyle Goals</h3>
          <div className="pv-goal-row">
            <span className="pv-goal-label">Daily Steps</span>
            <span className="pv-goal-value">7,340 / 10,000</span>
          </div>
          <div className="pv-progress-bar">
            <div className="pv-progress-fill green" style={{ width: '73.4%' }}></div>
          </div>

          <div className="pv-goal-row">
            <span className="pv-goal-label">Water Intake (8 glasses)</span>
            <span className="pv-goal-value">5 / 8</span>
          </div>
          <div className="pv-progress-bar">
            <div className="pv-progress-fill blue" style={{ width: '62.5%' }}></div>
          </div>

          <div className="pv-goal-row">
            <span className="pv-goal-label">Exercise (30 min)</span>
            <span className="pv-goal-value">20 / 30 min</span>
          </div>
          <div className="pv-progress-bar">
            <div className="pv-progress-fill red" style={{ width: '66.7%' }}></div>
          </div>

          <div className="pv-weekly-ring">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#E2E8F0" strokeWidth="6" />
              <circle cx="40" cy="40" r="32" fill="none" stroke="#22C55E" strokeWidth="6"
                strokeDasharray={`${0.70 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                strokeLinecap="round" transform="rotate(-90 40 40)" />
            </svg>
            <div className="pv-ring-text">
              <span className="pv-ring-pct">70%</span>
              <span className="pv-ring-label">Weekly</span>
            </div>
          </div>
        </div>

        {/* ── Documents ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            Documents
          </h2>

          {[
            { icon: '#3B82F6', title: 'Visit Summary - Jan 15, 2026', sub: 'Annual Physical Exam' },
            { icon: '#EF4444', title: 'Prescription - Metformin', sub: 'Issued: Jan 15, 2026' },
            { icon: '#22C55E', title: 'Discharge Notes - Dec 2025', sub: 'Hospital Stay Summary' },
            { icon: '#8B5CF6', title: 'Vaccination Records', sub: 'COVID-19, Flu, etc.' },
            { icon: '#3B82F6', title: 'Education Materials', sub: 'Managing Type 2 Diabetes' },
            { icon: '#EF4444', title: 'Diet & Nutrition Guide', sub: 'Low-sodium meal plans' },
          ].map((doc, i) => (
            <div className="pv-doc-row" key={i}>
              <div className="pv-doc-icon" style={{ color: doc.icon }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              </div>
              <div className="pv-doc-text">
                <span className="pv-doc-title">{doc.title}</span>
                <span className="pv-doc-sub">{doc.sub}</span>
              </div>
              <a href="#" className="pv-doc-view">View</a>
            </div>
          ))}

          <button className="pv-upload-btn">Upload Document</button>
        </div>
      </div>
    </div>
  );
}
