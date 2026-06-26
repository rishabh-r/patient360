import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { callFhirApi, buildUrl } from '../services/fhir';
import { FHIR_BASE } from '../config/constants';
import { calculateHedisScores } from '../services/hedis';
import '../styles/caremanager.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

/** High > 50, medium 26–50, low ≤ 25 (same thresholds as risk stratification). */
function riskTierFromScore(score) {
  const s = Number(score);
  if (Number.isNaN(s)) return 'low';
  if (s > 50) return 'high';
  if (s > 25) return 'medium';
  return 'low';
}

/** Buckets for CareCoordinationNote risk scores (0–100), aligned with PatientView tiers. */
function stratifyRiskPatients(riskPatients) {
  let high = 0;
  let medium = 0;
  let low = 0;
  for (const p of riskPatients) {
    const s = Number(p.riskScore);
    if (Number.isNaN(s)) continue;
    if (s > 50) high += 1;
    else if (s > 25) medium += 1;
    else low += 1;
  }
  return { high, medium, low };
}

const RISK_TIER_ORDER = { high: 0, medium: 1, low: 2 };

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
  const [careGaps, setCareGaps] = useState([]);
  const [admissions, setAdmissions] = useState({ count: 0, pctChange: 0 });
  const [discharges, setDischarges] = useState({ count: 0, pctChange: 0 });
  const [alos, setAlos] = useState({ days: 0, pctChange: 0 });
  const [readmissionRate, setReadmissionRate] = useState({ rate: 0, pctChange: 0 });
  const [upcomingAppts, setUpcomingAppts] = useState([]);
  const [encounterTrend, setEncounterTrend] = useState(null);
  const [hedisScores, setHedisScores] = useState(null);
  const [hedisLoading, setHedisLoading] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(false);
  const analyticsLoadedOrg = useRef(null);

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
    if (!selectedOrg) return;
    const pts = orgPatients[selectedOrg] || [];
    if (!pts.length) { setRiskPatients([]); return; }
    if (analyticsLoadedOrg.current === selectedOrg) return;
    analyticsLoadedOrg.current = selectedOrg;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    async function fetchEncounterCount(orgId, status, dateGt, dateLt) {
      const url = new URL(`${FHIR_BASE}/baseR4/Encounter/$count`);
      url.searchParams.append('organization', orgId);
      if (status) url.searchParams.append('status', status);
      url.searchParams.append('date', `gt${dateGt}`);
      url.searchParams.append('date', `lt${dateLt}`);
      const res = await callFhirApi(url.toString());
      const param = res?.entry?.[0]?.resource?.parameter?.find(p => p.name === 'encounter-count');
      return param?.valueInteger || 0;
    }

    async function fetchFinishedEncounters(orgId, dateGt, dateLt) {
      const url = new URL(`${FHIR_BASE}/baseR4/Encounter`);
      url.searchParams.append('status', 'finished');
      url.searchParams.append('date', `gt${dateGt}`);
      url.searchParams.append('date', `lt${dateLt}`);
      url.searchParams.append('organization', orgId);
      url.searchParams.append('page', '0');
      url.searchParams.append('size', '500');
      const res = await callFhirApi(url.toString());
      return (res?.entry || []).map(e => e.resource).filter(Boolean);
    }

    function calcAlos(encounters) {
      let totalDays = 0;
      let count = 0;
      for (const enc of encounters) {
        const code = enc.class?.code || '';
        if (code !== 'IMP' && code !== 'INP') continue;
        const s = enc.period?.start;
        const e = enc.period?.end;
        if (!s || !e) continue;
        const days = (new Date(e) - new Date(s)) / 86400000;
        if (days > 0) { totalDays += days; count++; }
      }
      return count > 0 ? +(totalDays / count).toFixed(1) : 0;
    }

    function calcReadmissionRate(encounters) {
      const patientDiseaseMap = {};
      for (const enc of encounters) {
        const pid = enc.subject?.reference?.replace('Patient/', '') || '';
        if (!pid) continue;
        const disease = enc.diagnosis?.[0]?.condition?.display || '';
        const key = `${pid}::${disease.toLowerCase().trim()}`;
        patientDiseaseMap[key] = (patientDiseaseMap[key] || 0) + 1;
      }
      const uniquePatients = new Set(Object.keys(patientDiseaseMap).map(k => k.split('::')[0])).size;
      const patientsReadmittedSameDisease = new Set(
        Object.entries(patientDiseaseMap).filter(([, c]) => c > 1).map(([k]) => k.split('::')[0])
      ).size;
      return uniquePatients > 0 ? +((patientsReadmittedSameDisease / uniquePatients) * 100).toFixed(1) : 0;
    }

    setKpiLoading(true);
    (async () => {
      try {
        const [currAdm, prevAdm] = await Promise.all([
          fetchEncounterCount(selectedOrg, null, oneYearAgo, today),
          fetchEncounterCount(selectedOrg, null, twoYearsAgo, oneYearAgo),
        ]);
        const admPct = prevAdm > 0 ? Math.round(((currAdm - prevAdm) / prevAdm) * 100) : 0;
        setAdmissions({ count: currAdm, pctChange: admPct });

        const [currDis, prevDis] = await Promise.all([
          fetchEncounterCount(selectedOrg, 'finished', oneYearAgo, today),
          fetchEncounterCount(selectedOrg, 'finished', twoYearsAgo, oneYearAgo),
        ]);
        const disPct = prevDis > 0 ? Math.round(((currDis - prevDis) / prevDis) * 100) : 0;
        setDischarges({ count: currDis, pctChange: disPct });

        const [currYearEncs, prevYearEncs] = await Promise.all([
          fetchFinishedEncounters(selectedOrg, oneYearAgo, today),
          fetchFinishedEncounters(selectedOrg, twoYearsAgo, oneYearAgo),
        ]);

        const currAlos = calcAlos(currYearEncs);
        const prevAlos = calcAlos(prevYearEncs);
        const alosPct = prevAlos > 0 ? Math.round(((currAlos - prevAlos) / prevAlos) * 100) : 0;
        setAlos({ days: currAlos, pctChange: alosPct });

        const currReadm = calcReadmissionRate(currYearEncs);
        const prevReadm = calcReadmissionRate(prevYearEncs);
        const readmPctPt = +(currReadm - prevReadm).toFixed(1);
        setReadmissionRate({ rate: currReadm, pctChange: readmPctPt });

        const halfYears = [];
        for (let i = 3; i >= 0; i--) {
          const hEnd = new Date(now.getFullYear(), now.getMonth() - i * 6, now.getDate());
          const hStart = new Date(hEnd.getFullYear(), hEnd.getMonth() - 6, hEnd.getDate());
          halfYears.push({ start: hStart.toISOString().split('T')[0], end: hEnd.toISOString().split('T')[0] });
        }
        const trendData = await Promise.all(halfYears.map(h => fetchFinishedEncounters(selectedOrg, h.start, h.end)));
        const labels = halfYears.map(h => {
          const d = new Date(h.end);
          const m = d.toLocaleString('en-US', { month: 'short' });
          return `${m} ${d.getFullYear()}`;
        });
        const completed = trendData.map(encs => encs.filter(e => e.status === 'finished').length);
        const cancelled = trendData.map((_, idx) => {
          const h = halfYears[idx];
          return 0;
        });

        const cancelledPromises = halfYears.map(async h => {
          try {
            const url = new URL(`${FHIR_BASE}/baseR4/Encounter`);
            url.searchParams.append('status', 'cancelled');
            url.searchParams.append('date', `gt${h.start}`);
            url.searchParams.append('date', `lt${h.end}`);
            url.searchParams.append('organization', selectedOrg);
            url.searchParams.append('page', '0');
            url.searchParams.append('size', '500');
            const res = await callFhirApi(url.toString());
            return (res?.entry || []).length;
          } catch { return 0; }
        });
        const cancelledCounts = await Promise.all(cancelledPromises);

        setEncounterTrend({ labels, completed, cancelled: cancelledCounts });
      } catch {}
      setKpiLoading(false);
    })();

    Promise.all(pts.map(async p => {
      try {
        const res = await callFhirApi(`${FHIR_BASE}/baseR4/Appointment?patient=${p.id}&page=0&size=100`);
        const appts = (res?.entry || []).map(e => e.resource).filter(r => r.status === 'booked' && r.start);
        const future = appts.filter(a => new Date(a.start) >= now).sort((a, b) => new Date(a.start) - new Date(b.start));
        if (!future.length) return null;
        const a = future[0];
        const dt = new Date(a.start);
        const date = dt.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const practRef = a.participant?.find(x => x.individual?.reference?.startsWith('Practitioner/'))?.individual?.reference;
        let practName = '';
        if (practRef) {
          try {
            const pRes = await callFhirApi(`${FHIR_BASE}/baseR4/${practRef}`);
            const prefix = pRes?.name?.[0]?.prefix?.[0] || 'Dr.';
            const given = pRes?.name?.[0]?.given?.join(' ') || '';
            const family = pRes?.name?.[0]?.family || '';
            practName = `${prefix} ${given} ${family}`.trim();
          } catch { practName = ''; }
        }
        return { name: p.name, type: a.description || a.serviceType?.[0]?.text || 'Appointment', date, time, practitioner: practName, patientId: p.id };
      } catch { return null; }
    })).then(results => setUpcomingAppts(results.filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date))));

    Promise.all(pts.map(p =>
      callFhirApi(`${FHIR_BASE}/baseR4/CareCoordinationNote/risk-assignment?patientId=${p.id}&orgId=${selectedOrg}`)
        .then(res => res?.riskScore ? { ...p, riskScore: res.riskScore } : null)
        .catch(() => null)
    )).then(riskResults => {
      const riskPts = riskResults.filter(Boolean).sort((a, b) => b.riskScore - a.riskScore);
      setRiskPatients(riskPts);
      const highRiskOver50 = riskPts.filter(p => Number(p.riskScore) > 50).length;

      return Promise.all(riskPts.map(async p => {
        try {
          const [medRes, apptRes] = await Promise.all([
            callFhirApi(buildUrl('/baseR4/MedicationRequest', { patient: p.id, page: 0, size: 100 })).catch(() => null),
            callFhirApi(buildUrl('/baseR4/Appointment', { patient: p.id, page: 0, size: 100 })).catch(() => null),
          ]);
          const stoppedMeds = (medRes?.entry || []).filter(e => e.resource?.status === 'stopped').map(e => e.resource?.medicationCodeableConcept?.coding?.[0]?.display || e.resource?.medicationCodeableConcept?.text || '');
          const missedAppts = (apptRes?.entry || []).filter(e => e.resource?.status === 'noshow' || e.resource?.status === 'cancelled').map(e => e.resource?.description || e.resource?.serviceType?.[0]?.text || 'Appointment');
          if (!stoppedMeds.length && !missedAppts.length) return null;
          const issues = [];
          if (stoppedMeds.length) issues.push(`Missed medication: ${stoppedMeds[stoppedMeds.length - 1]}`);
          if (missedAppts.length) issues.push(`Missed follow-up: ${missedAppts[missedAppts.length - 1]}`);
          return { ...p, issues, gapCount: stoppedMeds.length + missedAppts.length };
        } catch { return null; }
      })).then(results => {
        if (!results) return;
        const gaps = results.filter(Boolean).sort((a, b) => {
          const pa = RISK_TIER_ORDER[riskTierFromScore(a.riskScore)];
          const pb = RISK_TIER_ORDER[riskTierFromScore(b.riskScore)];
          if (pa !== pb) return pa - pb;
          return b.gapCount - a.gapCount;
        });
        setCareGaps(gaps);
      });
    });
  }, [selectedOrg, orgPatients[selectedOrg]?.length]);

  useEffect(() => {
    if (!selectedOrg) return;
    const pts = orgPatients[selectedOrg] || [];
    if (!pts.length) return;
    if (analyticsLoadedOrg.current !== selectedOrg) return;
    setHedisLoading(true);
    calculateHedisScores(pts.map(p => p.id), callFhirApi, buildUrl, FHIR_BASE)
      .then(result => setHedisScores(result))
      .catch(() => setHedisScores(null))
      .finally(() => setHedisLoading(false));
  }, [selectedOrg, orgPatients[selectedOrg]?.length]);

  const selectedOrgData = orgs.find(o => o.id === selectedOrg);
  const patients = selectedOrg ? (orgPatients[selectedOrg] || []) : [];
  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));

  const riskStratification = useMemo(() => stratifyRiskPatients(riskPatients), [riskPatients]);
  const riskStratTotal = riskStratification.high + riskStratification.medium + riskStratification.low;

  const highRiskOver50Count = useMemo(
    () => riskPatients.filter(p => Number(p.riskScore) > 50).length,
    [riskPatients],
  );

  const riskStratPercents = useMemo(() => {
    const { high, medium, low } = riskStratification;
    const t = high + medium + low;
    if (!t) return { high: 0, medium: 0, low: 0 };
    const ph = Math.round((100 * high) / t);
    const pm = Math.round((100 * medium) / t);
    const pl = 100 - ph - pm;
    return { high: ph, medium: pm, low: pl };
  }, [riskStratification]);

  const riskStratPieData = useMemo(() => {
    const { high, medium, low } = riskStratification;
    const tiers = [
      { key: 'high', label: 'High Risk', count: high, color: '#e54d42' },
      { key: 'medium', label: 'Medium Risk', count: medium, color: '#f39c12' },
      { key: 'low', label: 'Low Risk', count: low, color: '#27ae60' },
    ].filter(x => x.count > 0);
    if (!tiers.length) return null;
    return {
      labels: tiers.map(x => x.label),
      datasets: [{
        data: tiers.map(x => x.count),
        backgroundColor: tiers.map(x => x.color),
        borderColor: '#fff',
        borderWidth: 2,
      }],
    };
  }, [riskStratification]);

  const riskStratPieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(ctx) {
            const v = ctx.raw ?? 0;
            const sum = (ctx.dataset.data || []).reduce((a, b) => a + b, 0);
            const pct = sum ? Math.round((100 * v) / sum) : 0;
            return ` ${v} patient${v === 1 ? '' : 's'} (${pct}%)`;
          },
        },
      },
    },
  }), []);

  return (
    <div className="cm-page">
      <nav className="cm-nav">
        <div className="cm-nav-left">
          <img src="/images/Rsystems_Logo_White.png" alt="R Systems" className="cm-nav-logo" />
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
            Clinic Locations
          </h2>

          <div className="cm-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search clinic locations..." value={search} onChange={e => { setSearch(e.target.value); setOrgPage(1); }} className="cm-search-input" />
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
              <div className="cm-empty-state"><p className="cm-empty-sub">No clinic locations found</p></div>
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
              <h3 className="cm-empty-title">Select a clinic location to view patients</h3>
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
                    {riskPatients.length > 0 ? riskPatients.map(p => {
                      const tier = riskTierFromScore(p.riskScore);
                      return (
                      <div className={`cm-an-risk-card cm-an-risk-card--${tier}`} key={p.id}>
                        <div className="cm-an-risk-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
                        <div className="cm-an-risk-info"><span className="cm-an-risk-name">{p.name}</span><span className="cm-an-risk-issue">{p.condition || 'Under monitoring'}</span></div>
                      </div>
                      );
                    }) : <p style={{ fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>No risk-assigned patients in this organization</p>}

                    <div className="cm-an-kpi-row">
                      <div className="cm-an-kpi">
                        <span className="cm-an-kpi-label">Recent Admissions</span>
                        {kpiLoading ? <span className="cm-an-kpi-val"><div className="cm-spinner-inline" /></span> : <>
                        <span className="cm-an-kpi-val">{admissions.count}</span>
                        <span className={`cm-an-kpi-change ${admissions.pctChange <= 0 ? 'down' : 'up'}`}>{admissions.pctChange <= 0 ? '↘' : '↗'} {Math.abs(admissions.pctChange)}% from last year</span>
                        </>}
                      </div>
                      <div className="cm-an-kpi">
                        <span className="cm-an-kpi-label">Discharges</span>
                        {kpiLoading ? <span className="cm-an-kpi-val"><div className="cm-spinner-inline" /></span> : <>
                        <span className="cm-an-kpi-val">{discharges.count}</span>
                        <span className={`cm-an-kpi-change ${discharges.pctChange <= 0 ? 'down' : 'up'}`}>{discharges.pctChange <= 0 ? '↘' : '↗'} {Math.abs(discharges.pctChange)}% from last year</span>
                        </>}
                      </div>
                    </div>

                    <h3 className="cm-an-section-title">Preventive & Clinical Care Gaps</h3>
                    {careGaps.length > 0 ? careGaps.map(p => {
                      const tier = riskTierFromScore(p.riskScore);
                      const priLabel = tier === 'high' ? 'High' : tier === 'medium' ? 'Medium' : 'Low';
                      return (
                      <div className="cm-an-gap-row" key={p.id}>
                        <div className="cm-an-gap-info">
                          <span className="cm-an-gap-name">{p.name}</span>
                          {p.issues.map((issue, j) => <span key={j} className="cm-an-gap-issue">{issue}</span>)}
                        </div>
                        <span className={`cm-an-pri-pill ${tier}`}>{priLabel} Risk</span>
                        <button className="cm-an-schedule-btn">Schedule</button>
                      </div>
                      );
                    }) : <p style={{ fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>No care gaps detected</p>}

                    <div className="cm-an-kpi-row">
                      <div className="cm-an-kpi">
                        <div className="cm-an-kpi-head"><span className="cm-an-kpi-label">ALOS</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
                        {kpiLoading ? <span className="cm-an-kpi-val"><div className="cm-spinner-inline" /></span> : <>
                        <span className="cm-an-kpi-val">{alos.days} days</span>
                        <span className={`cm-an-kpi-change ${alos.pctChange <= 0 ? 'down' : 'up'}`}>{alos.pctChange <= 0 ? '↓' : '↑'} {alos.pctChange > 0 ? '+' : ''}{alos.pctChange}% vs last year</span>
                        </>}
                      </div>
                      <div className="cm-an-kpi">
                        <div className="cm-an-kpi-head"><span className="cm-an-kpi-label">Readmission Rate</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg></div>
                        {kpiLoading ? <span className="cm-an-kpi-val"><div className="cm-spinner-inline" /></span> : <>
                        <span className="cm-an-kpi-val">{readmissionRate.rate}%</span>
                        <span className={`cm-an-kpi-change ${readmissionRate.pctChange <= 0 ? 'down' : 'up'}`}>{readmissionRate.pctChange <= 0 ? '↓' : '↑'} {Math.abs(readmissionRate.pctChange)}% vs last year</span>
                        </>}
                      </div>
                    </div>

                    <h3 className="cm-an-section-title">Population View</h3>
                    <div className="cm-an-pop-row cm-an-pop-row--4">
                      <div className="cm-an-pop-stat" style={{ borderLeftColor: '#3B82F6' }}><span className="cm-an-pop-num">{patients.length}</span><span className="cm-an-pop-label">Total Patients</span></div>
                      <div className="cm-an-pop-stat" style={{ borderLeftColor: '#EF4444' }}><span className="cm-an-pop-num">{highRiskOver50Count}</span><span className="cm-an-pop-label">High Risk</span></div>
                      <div className="cm-an-pop-stat" style={{ borderLeftColor: '#F59E0B' }}><span className="cm-an-pop-num">{careGaps.length}</span><span className="cm-an-pop-label">Care Gaps</span></div>
                      <div className="cm-an-pop-stat" style={{ borderLeftColor: '#6366F1' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ marginBottom: 2 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span className="cm-an-pop-num">{upcomingAppts.length}</span><span className="cm-an-pop-label">Upcoming Appts</span>
                      </div>
                    </div>

                    <div className="cm-an-strat-card">
                      <div className="cm-an-strat-head">
                        <h3 className="cm-an-strat-title">Risk Stratification</h3>
                        <p className="cm-an-strat-sub">Patient distribution by risk level.</p>
                      </div>
                      {riskStratTotal > 0 && riskStratPieData ? (
                        <div className="cm-an-strat-body">
                          <div className="cm-an-strat-chart-wrap">
                            <Pie data={riskStratPieData} options={riskStratPieOptions} />
                          </div>
                          <div className="cm-an-strat-legend">
                            <div className="cm-an-strat-row">
                              <span className="cm-an-strat-dot" style={{ background: '#e54d42' }} />
                              <div className="cm-an-strat-text">
                                <span className="cm-an-strat-tier">High Risk</span>
                                <span className="cm-an-strat-desc">Multiple chronic conditions, recent hospitalizations (risk score above 50)</span>
                              </div>
                              <span className="cm-an-strat-count">{riskStratification.high} patient{riskStratification.high === 1 ? '' : 's'} · {riskStratPercents.high}%</span>
                            </div>
                            <div className="cm-an-strat-row">
                              <span className="cm-an-strat-dot" style={{ background: '#f39c12' }} />
                              <div className="cm-an-strat-text">
                                <span className="cm-an-strat-tier">Medium Risk</span>
                                <span className="cm-an-strat-desc">1–2 chronic conditions, stable (risk score 26–50)</span>
                              </div>
                              <span className="cm-an-strat-count">{riskStratification.medium} patient{riskStratification.medium === 1 ? '' : 's'} · {riskStratPercents.medium}%</span>
                            </div>
                            <div className="cm-an-strat-row">
                              <span className="cm-an-strat-dot" style={{ background: '#27ae60' }} />
                              <div className="cm-an-strat-text">
                                <span className="cm-an-strat-tier">Low Risk</span>
                                <span className="cm-an-strat-desc">Well-controlled single condition (risk score 25 or below)</span>
                              </div>
                              <span className="cm-an-strat-count">{riskStratification.low} patient{riskStratification.low === 1 ? '' : 's'} · {riskStratPercents.low}%</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="cm-an-strat-empty">No risk-assigned patients to stratify. Risk scores appear in High-Risk & Deteriorating Patients when the API returns a score.</p>
                      )}
                    </div>

                    <div className="cm-an-trend-appt-row">
                      <div className="cm-an-trend-card">
                        <h3 className="cm-an-strat-title">Encounter Trend</h3>
                        <p className="cm-an-strat-sub">Half-yearly encounter activity and completion rates</p>
                        {encounterTrend ? (
                          <div className="cm-an-trend-chart">
                            <Bar
                              data={{
                                labels: encounterTrend.labels,
                                datasets: [
                                  { label: 'Completed', data: encounterTrend.completed, backgroundColor: '#22C55E', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.55 },
                                  { label: 'Cancelled', data: encounterTrend.cancelled, backgroundColor: '#F59E0B', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.55 },
                                ],
                              }}
                              options={{
                                responsive: true, maintainAspectRatio: false,
                                plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
                                scales: {
                                  x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                                  y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 11 }, stepSize: 6 } },
                                },
                              }}
                            />
                          </div>
                        ) : <p style={{ fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>Loading encounter trend...</p>}
                      </div>

                      <div className="cm-an-upcoming-card">
                        <h3 className="cm-an-strat-title">Upcoming Appointments</h3>
                        <p className="cm-an-strat-sub">Next scheduled appointments for panel patients</p>
                        {upcomingAppts.length > 0 ? (
                          <div className="cm-an-upcoming-list">
                            {upcomingAppts.map((a, i) => (
                              <div className="cm-an-upcoming-item" key={i}>
                                <div className="cm-an-upcoming-left">
                                  <span className="cm-an-upcoming-name">{a.name}</span>
                                  {a.type && <span className="cm-an-upcoming-type-pill">{a.type}</span>}
                                  {a.practitioner && <span className="cm-an-upcoming-pract">{a.practitioner}</span>}
                                </div>
                                <div className="cm-an-upcoming-right">
                                  <span className="cm-an-upcoming-date">{a.date}</span>
                                  <span className="cm-an-upcoming-time">{a.time}</span>
                      </div>
                    </div>
                  ))}
                          </div>
                        ) : <p style={{ fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>No upcoming appointments</p>}
                      </div>
                    </div>

                    <div className="cm-an-strat-card">
                      <div className="cm-an-strat-head">
                        <h3 className="cm-an-strat-title">HEDIS Quality Measures</h3>
                        <p className="cm-an-strat-sub">Healthcare Effectiveness Data and Information Set — patient quality scores</p>
                      </div>
                      {hedisLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: '#64748B', fontSize: 13 }}>
                          <div className="hp-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                          Calculating HEDIS scores...
                        </div>
                      ) : hedisScores && hedisScores.measures.length > 0 ? (
                        <div className="cm-hedis-grid">
                          {hedisScores.measures.map(m => (
                            <div className={`cm-hedis-card${m.invertedMeasure ? ' cm-hedis-inverted' : ''}`} key={m.id}>
                              <div className="cm-hedis-header">
                                <span className="cm-hedis-domain">{m.domain}</span>
                                <span className={`cm-hedis-rate${m.rate === null ? '' : m.invertedMeasure ? (m.rate <= 10 ? ' good' : m.rate <= 25 ? ' fair' : ' poor') : (m.rate >= 80 ? ' good' : m.rate >= 60 ? ' fair' : ' poor')}`}>
                                  {m.rate !== null ? `${m.rate}%` : 'N/A'}
                                </span>
                              </div>
                              <span className="cm-hedis-name">{m.name}</span>
                              <span className="cm-hedis-desc">{m.description}</span>
                              <div className="cm-hedis-bar-wrap">
                                <div className="cm-hedis-bar" style={{ width: `${m.rate || 0}%` }} />
                              </div>
                              <span className="cm-hedis-meta">{m.met} of {m.eligible} eligible patients</span>
                              {m.gapPatients.length > 0 && (
                                <details className="cm-hedis-gaps">
                                  <summary>{m.gapPatients.length} gap{m.gapPatients.length > 1 ? 's' : ''}</summary>
                                  <ul>{m.gapPatients.map((n, i) => <li key={i}>{n}</li>)}</ul>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="cm-an-strat-empty">No eligible patients for HEDIS measures</p>
                      )}
                    </div>

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
