import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { callFhirApi, buildUrl } from '../services/fhir';
import { callAI } from '../services/ai';
import { FHIR_BASE } from '../config/constants';
import { HEALTH_STATUS_PROMPT } from '../config/prompts';
import { calculateHedisScores } from '../services/hedis';
import { runAllAgents } from '../services/agents';
import '../styles/provider.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

function nameFromEmail(email) {
  if (!email) return '';
  const local = email.split('@')[0];
  return local.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export default function HealthcareProviderView({ onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const practId = searchParams.get('id') || localStorage.getItem('p360_ref_id') || '';

  const [practName, setPractName] = useState('');
  const [practEmail, setPractEmail] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  const [tab, setTab] = useState('patients');
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [vitalsPage, setVitalsPage] = useState(1);
  const [labPage, setLabPage] = useState(1);
  const [medPage, setMedPage] = useState(1);
  const [docPage, setDocPage] = useState(1);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [agentResults, setAgentResults] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentStage, setAgentStage] = useState(0);
  const [aiInstructions, setAiInstructions] = useState([]);
  const [aiActions, setAiActions] = useState([]);
  const [selectedInstr, setSelectedInstr] = useState([]);
  const [selectedAct, setSelectedAct] = useState([]);
  const [instrApproving, setInstrApproving] = useState(false);
  const [actApproving, setActApproving] = useState(false);
  const [approvalToast, setApprovalToast] = useState('');
  const [approvedActions, setApprovedActions] = useState([]);
  const [actionTab, setActionTab] = useState('recommended');
  const ITEMS_PER_PAGE = 4;
  const DOCS_PER_PAGE = 5;

  const [todayAppts, setTodayAppts] = useState([]);
  const [yearlyVisits, setYearlyVisits] = useState({ count: 0, pctChange: 0 });
  const [avgLos, setAvgLos] = useState({ days: 0, pctChange: 0 });
  const [medAdherence, setMedAdherence] = useState({ pct: 0 });
  const [erVisits, setErVisits] = useState([]);
  const [recentAdmissions, setRecentAdmissions] = useState([]);
  const [recentDischarges, setRecentDischarges] = useState([]);
  const [careGaps, setCareGaps] = useState([]);
  const [highRiskPatients, setHighRiskPatients] = useState([]);
  const [highRiskLoading, setHighRiskLoading] = useState(false);
  const [yearlyTrend, setYearlyTrend] = useState(null);
  const [patientOutcomes, setPatientOutcomes] = useState(null);
  const [hedisScores, setHedisScores] = useState(null);
  const [hedisLoading, setHedisLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const analyticsLoaded = useRef(false);

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
          return { id: r.id, name: `${given} ${family}`.trim(), age, gender, condition: disease };
        });
        setPatients(pts.sort((a, b) => a.name.localeCompare(b.name)));
      } catch { setPatients([]); }
      setPatientsLoading(false);
    })();
  }, [practId]);

  useEffect(() => {
    if (!patients.length || analyticsLoaded.current) return;
    analyticsLoaded.current = true;
    setAnalyticsLoading(true);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0];
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0];
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate()).toISOString().split('T')[0];

    Promise.all(patients.map(p =>
      callFhirApi(`${FHIR_BASE}/baseR4/Appointment?patient=${p.id}&page=0&size=100`)
        .then(res => {
          const appts = (res?.entry || []).map(e => e.resource).filter(r => r.status === 'booked' && r.start);
          const todayAppt = appts.filter(a => a.start.startsWith(today));
          return todayAppt.map(a => {
            const time = new Date(a.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            return { name: p.name, mrn: '', time, type: a.description || a.serviceType?.[0]?.text || 'Appointment', patientId: p.id };
          });
        }).catch(() => [])
    )).then(results => {
      setTodayAppts(results.flat().sort((a, b) => a.time.localeCompare(b.time)));
    });

    async function fetchEncountersForPatient(pid, status, dateGt, dateLt) {
      try {
        const url = new URL(`${FHIR_BASE}/baseR4/Encounter`);
        url.searchParams.append('patient', pid);
        if (status) url.searchParams.append('status', status);
        url.searchParams.append('date', `gt${dateGt}`);
        url.searchParams.append('date', `lt${dateLt}`);
        url.searchParams.append('page', '0');
        url.searchParams.append('size', '200');
        const res = await callFhirApi(url.toString());
        return (res?.entry || []).map(e => e.resource).filter(Boolean);
      } catch { return []; }
    }

    async function fetchAllFinished(dateGt, dateLt) {
      const all = [];
      for (const p of patients) {
        const encs = await fetchEncountersForPatient(p.id, 'finished', dateGt, dateLt);
        all.push(...encs);
      }
      return all;
    }

    (async () => {
      try {
        const [currEncs, prevEncs] = await Promise.all([
          fetchAllFinished(oneYearAgo, today),
          fetchAllFinished(twoYearsAgo, oneYearAgo),
        ]);

        const currCount = currEncs.length;
        const prevCount = prevEncs.length;
        const yPct = prevCount > 0 ? Math.round(((currCount - prevCount) / prevCount) * 100) : 0;
        setYearlyVisits({ count: currCount, pctChange: yPct });

        function calcAlos(encounters) {
          let totalDays = 0, count = 0;
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

        const [currAlosEncs, prevAlosEncs] = await Promise.all([
          fetchAllFinished(oneMonthAgo, today),
          fetchAllFinished(twoMonthsAgo, oneMonthAgo),
        ]);
        const currAlos = calcAlos(currAlosEncs);
        const prevAlos = calcAlos(prevAlosEncs);
        const alosDiff = prevAlos > 0 ? +((currAlos - prevAlos).toFixed(1)) : 0;
        setAvgLos({ days: currAlos, pctChange: alosDiff });

        const allEncountersAllStatus = [];
        for (const p of patients) {
          try {
            const url = new URL(`${FHIR_BASE}/baseR4/Encounter`);
            url.searchParams.append('patient', p.id);
            url.searchParams.append('page', '0');
            url.searchParams.append('size', '200');
            const res = await callFhirApi(url.toString());
            const encs = (res?.entry || []).map(e => ({ ...e.resource, _patientName: p.name, _patientAge: p.age, _patientId: p.id })).filter(Boolean);
            allEncountersAllStatus.push(...encs);
          } catch {}
        }

        const patientLatestEr = {};
        for (const e of allEncountersAllStatus) {
          if (e.class?.code !== 'EMER' || e.status !== 'finished') continue;
          const pid = e._patientId;
          const startDate = new Date(e.period?.start || 0);
          if (!patientLatestEr[pid] || startDate > new Date(patientLatestEr[pid].period?.start || 0)) {
            patientLatestEr[pid] = e;
          }
        }
        const erList = Object.values(patientLatestEr)
          .sort((a, b) => new Date(b.period?.start || 0) - new Date(a.period?.start || 0))
          .map(e => {
            const clinicalNotes = (e.extension || []).find(x => x.url === 'clinicalNotes')?.valueString || '';
            const diagnosis = e.diagnosis?.[0]?.condition?.display || clinicalNotes || '';
            const dateStr = e.period?.start ? new Date(e.period.start).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
            return { name: e._patientName, age: e._patientAge, mrn: '', diagnosis, date: dateStr, status: 'Completed' };
          });
        setErVisits(erList);

        const patientLatestAdm = {};
        for (const e of allEncountersAllStatus) {
          const code = e.class?.code || '';
          if ((code !== 'IMP' && code !== 'INP') || !e.period?.start || e.status === 'cancelled') continue;
          const pid = e._patientId;
          const startDate = new Date(e.period.start);
          if (!patientLatestAdm[pid] || startDate > new Date(patientLatestAdm[pid].period.start)) {
            patientLatestAdm[pid] = e;
          }
        }
        const admList = Object.values(patientLatestAdm)
          .sort((a, b) => new Date(b.period.start) - new Date(a.period.start))
          .map(e => {
            const diagnosis = e.diagnosis?.[0]?.condition?.display || '';
            const dept = e.location?.[0]?.location?.display || '';
            const practRef = e.participant?.[0]?.individual?.reference || '';
            const dateStr = new Date(e.period.start).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true });
            return { name: e._patientName, age: e._patientAge, mrn: '', diagnosis, department: dept, physician: practRef.replace('Practitioner/', ''), date: dateStr };
          });
        setRecentAdmissions(admList);

        const patientLatestDis = {};
        for (const e of allEncountersAllStatus) {
          const code = e.class?.code || '';
          if (e.status !== 'finished' || (code !== 'IMP' && code !== 'INP') || !e.period?.end) continue;
          const pid = e._patientId;
          const endDate = new Date(e.period.end);
          if (!patientLatestDis[pid] || endDate > new Date(patientLatestDis[pid].period.end)) {
            patientLatestDis[pid] = e;
          }
        }

        const apptMap = {};
        for (const p of patients) {
          try {
            const res = await callFhirApi(`${FHIR_BASE}/baseR4/Appointment?patient=${p.id}&page=0&size=100`);
            apptMap[p.id] = (res?.entry || []).map(e => e.resource).filter(Boolean);
          } catch { apptMap[p.id] = []; }
        }

        const disList = Object.values(patientLatestDis)
          .sort((a, b) => new Date(b.period.end) - new Date(a.period.end))
          .map(e => {
            const diagnosis = e.diagnosis?.[0]?.condition?.display || '';
            const startD = new Date(e.period.start);
            const endD = new Date(e.period.end);
            const los = Math.max(1, Math.round((endD - startD) / 86400000));
            const disposition = e.location?.find(l => l.location?.display?.toLowerCase().includes('home'))?.location?.display || '';
            const dateStr = new Date(e.period.end).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true });

            let followUp = '';
            const pAppts = apptMap[e._patientId] || [];
            const diagLower = diagnosis.toLowerCase();
            const futureAppt = pAppts
              .filter(a => a.status === 'booked' && a.start && new Date(a.start) > endD)
              .sort((a, b) => new Date(a.start) - new Date(b.start))
              .find(a => {
                const desc = (a.description || '').toLowerCase();
                return diagLower && desc.includes(diagLower.split(' ')[0]);
              });
            if (futureAppt) {
              followUp = new Date(futureAppt.start).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
            }

            return { name: e._patientName, age: e._patientAge, mrn: '', diagnosis, los: `${los} days`, disposition, followUp, date: dateStr };
          });
        setRecentDischarges(disList);
      } catch {}
      setAnalyticsLoading(false);
    })();

    Promise.all(patients.map(p =>
      callFhirApi(buildUrl('/baseR4/MedicationRequest', { patient: p.id, page: 0, size: 200 }))
        .then(res => {
          const allMeds = (res?.entry || []).map(e => e.resource).filter(Boolean);
          return { total: allMeds.length, stopped: allMeds.filter(m => m.status === 'stopped').length };
        }).catch(() => ({ total: 0, stopped: 0 }))
    )).then(results => {
      const overallTotal = results.reduce((s, r) => s + r.total, 0);
      const overallStopped = results.reduce((s, r) => s + r.stopped, 0);
      const adherentPct = overallTotal > 0 ? Math.round(((overallTotal - overallStopped) / overallTotal) * 100) : 100;
      setMedAdherence({ pct: adherentPct });
    });

    Promise.all(patients.map(async p => {
      try {
        const [medRes, apptRes, encRes] = await Promise.all([
          callFhirApi(buildUrl('/baseR4/MedicationRequest', { patient: p.id, page: 0, size: 100 })).catch(() => null),
          callFhirApi(buildUrl('/baseR4/Appointment', { patient: p.id, page: 0, size: 100 })).catch(() => null),
          callFhirApi(buildUrl('/baseR4/Encounter', { patient: p.id, page: 0, size: 200 })).catch(() => null),
        ]);
        const stoppedMeds = (medRes?.entry || []).filter(e => e.resource?.status === 'stopped').map(e => e.resource?.medicationCodeableConcept?.coding?.[0]?.display || e.resource?.medicationCodeableConcept?.text || '');
        const noshowAppts = (apptRes?.entry || []).filter(e => e.resource?.status === 'noshow').map(e => ({
          desc: e.resource?.description || e.resource?.serviceType?.[0]?.text || 'Appointment',
          reason: e.resource?.reasonCode?.[0]?.text || '',
        }));

        const encEntries = (encRes?.entry || []).map(e => e.resource).filter(Boolean);
        const hasReturned = encEntries.some(enc => {
          const notes = (enc.extension || []).find(x => x.url === 'clinicalNotes')?.valueString || '';
          return notes.toUpperCase().includes('CARE GAP RETURN');
        });

        if (!stoppedMeds.length && !noshowAppts.length) return null;
        const issues = [];
        if (stoppedMeds.length) issues.push(`Missed medication: ${stoppedMeds[stoppedMeds.length - 1]}`);
        if (noshowAppts.length) issues.push(`Missed follow-up: ${noshowAppts[noshowAppts.length - 1].desc}`);
        return { ...p, issues, gapCount: stoppedMeds.length + noshowAppts.length, returned: hasReturned };
      } catch { return null; }
    })).then(results => {
      setCareGaps(results.filter(Boolean).sort((a, b) => b.gapCount - a.gapCount));
    });

    setHighRiskLoading(true);
    (async () => {
      const riskList = [];
      for (const p of patients) {
        try {
          const [condRes, obsRes, medRes] = await Promise.all([
            callFhirApi(buildUrl('/baseR4/Condition', { patient: p.id, page: 0, size: 100 })).catch(() => null),
            callFhirApi(buildUrl('/baseR4/Observation/search', { patient: p.id, page: 0, size: 100 })).catch(() => null),
            callFhirApi(buildUrl('/baseR4/MedicationRequest', { patient: p.id, page: 0, size: 100 })).catch(() => null),
          ]);
          const conds = (condRes?.entry || []).map(e => `${e.resource?.code?.coding?.[0]?.display || ''} (${e.resource?.clinicalStatus?.coding?.[0]?.code || ''})`).join(', ');
          const obs = (obsRes?.entry || []).map(e => { const r = e.resource; return `${r?.code?.coding?.[0]?.display || ''}: ${r?.valueQuantity?.value ?? ''} ${r?.valueQuantity?.unit || ''}`; }).join(', ');
          const meds = (medRes?.entry || []).map(e => `${e.resource?.medicationCodeableConcept?.coding?.[0]?.display || ''} (${e.resource?.status || ''})`).join(', ');
          const ctx = `Patient: ${p.name}\nConditions: ${conds || 'None'}\nObservations: ${obs || 'None'}\nMedications: ${meds || 'None'}`;
          const aiRes = await callAI(HEALTH_STATUS_PROMPT, ctx);
          const parsed = JSON.parse(aiRes);
          if (parsed.status === 'Poor' || parsed.status === 'Critical') {
            const lastEnc = (obsRes?.entry || []).map(e => e.resource?.effectiveDateTime).filter(Boolean).sort().pop();
            riskList.push({ ...p, riskScore: parsed.riskScore || 75, status: parsed.status, reason: parsed.reason, lastVisit: lastEnc ? lastEnc.split('T')[0] : '' });
          }
        } catch {}
      }
      setHighRiskPatients(riskList.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)));
      setHighRiskLoading(false);
    })();

    (async () => {
      const halves = [];
      const now2 = new Date();
      for (let i = 3; i >= 0; i--) {
        const hEnd = new Date(now2.getFullYear(), now2.getMonth() - i * 6, now2.getDate());
        const hStart = new Date(hEnd.getFullYear(), hEnd.getMonth() - 6, hEnd.getDate());
        const label = `${hEnd.toLocaleString('en-US', { month: 'short' })} ${hEnd.getFullYear()}`;
        halves.push({ label, start: hStart.toISOString().split('T')[0], end: hEnd.toISOString().split('T')[0] });
      }
      const counts = [];
      for (const h of halves) {
        let total = 0;
        for (const p of patients) {
          try {
            const url = new URL(`${FHIR_BASE}/baseR4/Encounter`);
            url.searchParams.append('patient', p.id);
            url.searchParams.append('status', 'finished');
            url.searchParams.append('date', `gt${h.start}`);
            url.searchParams.append('date', `lt${h.end}`);
            url.searchParams.append('page', '0');
            url.searchParams.append('size', '200');
            const res = await callFhirApi(url.toString());
            total += (res?.entry || []).length;
          } catch {}
        }
        counts.push(total);
      }
      setYearlyTrend({ labels: halves.map(h => h.label), data: counts });
    })();

    (async () => {
      const halves = [];
      const now3 = new Date();
      for (let i = 3; i >= 0; i--) {
        const hEnd = new Date(now3.getFullYear(), now3.getMonth() - i * 6, now3.getDate());
        const hStart = new Date(hEnd.getFullYear(), hEnd.getMonth() - 6, hEnd.getDate());
        const label = `${hEnd.toLocaleString('en-US', { month: 'short' })} ${hEnd.getFullYear()}`;
        halves.push({ label, start: hStart.toISOString().split('T')[0], end: hEnd.toISOString().split('T')[0] });
      }
      const improved = [], stable = [], declined = [];
      for (const h of halves) {
        let imp = 0, stb = 0, dec = 0;
        for (const p of patients) {
          try {
            const url = new URL(`${FHIR_BASE}/baseR4/Observation/search`);
            url.searchParams.append('patient', p.id);
            url.searchParams.append('date', `gt${h.start}`);
            url.searchParams.append('date', `lt${h.end}`);
            url.searchParams.append('page', '0');
            url.searchParams.append('size', '200');
            const currRes = await callFhirApi(url.toString());
            const currObs = (currRes?.entry || []).map(e => e.resource).filter(o => o?.valueQuantity?.value != null);

            const prevUrl = new URL(`${FHIR_BASE}/baseR4/Observation/search`);
            prevUrl.searchParams.append('patient', p.id);
            const prevStart = new Date(new Date(h.start).getFullYear(), new Date(h.start).getMonth() - 6, new Date(h.start).getDate());
            prevUrl.searchParams.append('date', `gt${prevStart.toISOString().split('T')[0]}`);
            prevUrl.searchParams.append('date', `lt${h.start}`);
            prevUrl.searchParams.append('page', '0');
            prevUrl.searchParams.append('size', '200');
            const prevRes = await callFhirApi(prevUrl.toString());
            const prevObs = (prevRes?.entry || []).map(e => e.resource).filter(o => o?.valueQuantity?.value != null);

            if (!currObs.length || !prevObs.length) { stb++; continue; }
            const avgCurr = currObs.reduce((s, o) => s + o.valueQuantity.value, 0) / currObs.length;
            const avgPrev = prevObs.reduce((s, o) => s + o.valueQuantity.value, 0) / prevObs.length;
            const diff = avgPrev !== 0 ? ((avgCurr - avgPrev) / avgPrev) * 100 : 0;
            if (diff < -5) imp++;
            else if (diff > 5) dec++;
            else stb++;
          } catch { stb++; }
        }
        improved.push(imp); stable.push(stb); declined.push(dec);
      }
      setPatientOutcomes({ labels: halves.map(h => h.label), improved, stable, declined });
    })();

    setHedisLoading(true);
    calculateHedisScores(patients.map(p => p.id), callFhirApi, buildUrl, FHIR_BASE)
      .then(result => setHedisScores(result))
      .catch(() => setHedisScores(null))
      .finally(() => setHedisLoading(false));
  }, [patients.length]);

  async function loadPatientDetail(pid) {
    setDetailLoading(true);
    setPatientDetail(null);
    try {
      const [ptRes, obsRes, vitalsRes, medRes, docsRes] = await Promise.all([
        callFhirApi(buildUrl('/baseR4/Patient/find', { id: pid })),
        callFhirApi(buildUrl('/baseR4/Observation/search', { patient: pid, page: 0, size: 200 })),
        callFhirApi(`${FHIR_BASE}/baseR4/Observation/vitals/search?patient=${pid}`),
        callFhirApi(buildUrl('/baseR4/MedicationRequest', { patient: pid, page: 0, size: 100 })),
        callFhirApi(buildUrl('/baseR4/DocumentReference', { patient: pid, page: 0, size: 100 })),
      ]);

      const pt = ptRes?.entry?.[0]?.resource || ptRes;
      const given = pt?.name?.[0]?.given?.join(' ') || '';
      const family = pt?.name?.[0]?.family || '';
      const name = `${given} ${family}`.trim();
      const dob = pt?.birthDate || '';
      const mrn = (pt?.identifier || []).find(id => id.type?.coding?.[0]?.code === 'MR')?.value || '';
      const phone = (pt?.telecom || []).find(t => t.system === 'phone')?.value || '';
      const email = (pt?.telecom || []).find(t => t.system === 'email')?.value || '';

      const allVitals = (vitalsRes?.entry || []).map(e => e.resource).filter(Boolean)
        .sort((a, b) => new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0));
      const latestVitalsMap = {};
      for (const v of allVitals) {
        const code = v.code?.coding?.[0]?.display || v.code?.text || '';
        if (code && !latestVitalsMap[code]) {
          latestVitalsMap[code] = { name: code, value: v.valueQuantity ? `${v.valueQuantity.value} ${v.valueQuantity.unit || ''}`.trim() : v.valueString || '' };
        }
      }
      const recentVitals = Object.values(latestVitalsMap);

      const allObs = (obsRes?.entry || []).map(e => e.resource).filter(Boolean);
      const labObs = allObs.sort((a, b) => new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0));
      const latestLabMap = {};
      for (const o of labObs) {
        const code = o.code?.coding?.[0]?.display || o.code?.text || '';
        if (code && !latestLabMap[code]) {
          latestLabMap[code] = { name: code, value: o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit || ''}`.trim() : o.valueString || '' };
        }
      }
      const latestLab = Object.values(latestLabMap);

      const obsGrouped = {};
      for (const o of labObs) {
        const code = o.code?.coding?.[0]?.display || o.code?.text || '';
        if (!code) continue;
        if (!obsGrouped[code]) obsGrouped[code] = [];
        obsGrouped[code].push({ date: o.effectiveDateTime || '', value: o.valueQuantity?.value ?? null, unit: o.valueQuantity?.unit || '' });
      }
      for (const k of Object.keys(obsGrouped)) obsGrouped[k].sort((a, b) => new Date(a.date) - new Date(b.date));
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

      const activeMeds = (medRes?.entry || []).map(e => e.resource).filter(r => r?.status === 'active')
        .map(r => ({ name: r.medicationCodeableConcept?.coding?.[0]?.display || r.medicationCodeableConcept?.text || '', dosage: r.dosageInstruction?.[0]?.text || '' }));

      const documents = (docsRes?.entry || []).map(e => {
        const r = e.resource;
        return {
          id: r.id, title: r.content?.[0]?.attachment?.title || r.description || 'Untitled',
          description: r.description || '', author: r.author?.[0]?.display || 'Unknown',
          specialty: r.author?.[0]?.extension?.find(x => x.url === 'specialty')?.valueString || '',
          date: r.date || '', type: r.type?.coding?.[0]?.display || 'Document',
          contentType: r.content?.[0]?.attachment?.contentType || 'text/plain',
          data: r.content?.[0]?.attachment?.data || '',
        };
      }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      setPatientDetail({ name, dob, mrn, phone, email, recentVitals, latestLab, trendTypes, trendDirections, obsGrouped, activeMeds, documents });
    } catch { setPatientDetail(null); }
    setDetailLoading(false);
  }

  function fetchApprovedActions(pid) {
    callFhirApi(buildUrl('/baseR4/Patient/ai-recommended-actions', { patientId: pid }))
      .then(res => {
        const completed = (res?.entry || [])
          .filter(e => e.resource?.status === 'completed')
          .map(e => {
            const ext = e.resource?.extension || [];
            return {
              title: ext.find(x => x.url?.includes('action-title'))?.valueString || '',
              description: (e.resource?.payload || []).map(p => p.contentString).filter(Boolean).join(' '),
              priority: ext.find(x => x.url?.includes('action-priority'))?.valueString || '',
              timeframe: ext.find(x => x.url?.includes('action-urgency-note'))?.valueString || '',
            };
          });
        setApprovedActions(completed);
      }).catch(() => setApprovedActions([]));
  }

  function startAgentAnalysis() {
    if (!selectedPatient || agentLoading) return;
    setAgentLoading(true);
    setAgentStage(1);
    setAgentResults(null); setAiActions([]); setSelectedAct([]);
    runAllAgents(selectedPatient)
      .then(async res => {
        setAgentStage(2);
        setAgentResults(res.agents || {});
        await new Promise(r => setTimeout(r, 2000));
        const recs = res.recommendations || {};
        const newActions = Array.isArray(recs.actions) ? recs.actions : [];
        let filtered = newActions;
        if (approvedActions.length > 0 && newActions.length > 0) {
          try {
            const dedupRes = await callAI(
              `You are a semantic comparison AI. Compare new AI-generated actions against already-approved actions. Return ONLY the indices (0-based) of new actions that are genuinely DIFFERENT in meaning from ALL approved actions.\n\nIf a new action covers the same clinical intent, test, treatment, or intervention as any approved action — even if worded differently — it is a DUPLICATE and should be excluded.\n\nReturn ONLY a valid JSON array of integers, e.g. [0, 2, 4]. If all are duplicates, return [].`,
              `APPROVED ACTIONS:\n${approvedActions.map((a, i) => `${i + 1}. ${a.title}: ${a.description}`).join('\n')}\n\nNEW ACTIONS:\n${newActions.map((a, i) => `${i}. ${a.title}: ${a.description}`).join('\n')}`
            );
            const keepIndices = JSON.parse(dedupRes);
            if (Array.isArray(keepIndices)) {
              filtered = newActions.filter((_, i) => keepIndices.includes(i));
            }
          } catch {
            const approvedTitles = approvedActions.map(a => a.title.toLowerCase().trim());
            filtered = newActions.filter(a => !approvedTitles.includes((a.title || '').toLowerCase().trim()));
          }
        }
        setAiActions(filtered);
        setAgentStage(3);
        await new Promise(r => setTimeout(r, 1500));
        setAgentLoading(false);
      })
      .catch(() => { setAgentResults({}); setAgentStage(0); setAgentLoading(false); });
  }

  useEffect(() => {
    if (selectedPatient) {
      setVitalsPage(1); setLabPage(1); setMedPage(1); setDocPage(1); setViewingDoc(null);
      setAgentResults(null); setAiInstructions([]); setAiActions([]); setSelectedInstr([]); setSelectedAct([]); setApprovalToast('');
      setAgentStage(0); setAgentLoading(false); setActionTab('recommended');
      loadPatientDetail(selectedPatient);
      fetchApprovedActions(selectedPatient);
    }
  }, [selectedPatient]);

  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  async function handleApproveInstructions() {
    const selected = aiInstructions.filter((_, i) => selectedInstr.includes(i));
    if (!selected.length) return;
    setInstrApproving(true);
    try {
      await fetch(`${FHIR_BASE}/baseR4/Practitioner/ai-recommendation-instructions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('p360_token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: selectedPatient, practitionerId: localStorage.getItem('p360_ref_id') || '', payloads: selected }),
      });
      setApprovalToast('Instructions approved');
      setTimeout(() => setApprovalToast(''), 2000);
      setAiInstructions(prev => prev.filter((_, i) => !selectedInstr.includes(i)));
      setSelectedInstr([]);
    } catch {}
    setInstrApproving(false);
  }

  async function handleApproveActions() {
    const selected = aiActions.filter((_, i) => selectedAct.includes(i));
    if (!selected.length) return;
    setActApproving(true);
    try {
      for (const a of selected) {
        await fetch(`${FHIR_BASE}/baseR4/Practitioner/ai-recommended-action`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('p360_token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: selectedPatient, practitionerId: localStorage.getItem('p360_ref_id') || '', title: a.title, description: a.description, priority: a.priority, urgencyNote: a.timeframe }),
        });
      }
      setApprovalToast('Actions approved');
      setTimeout(() => setApprovalToast(''), 2000);
      setAiActions(prev => prev.filter((_, i) => !selectedAct.includes(i)));
      setSelectedAct([]);
      fetchApprovedActions(selectedPatient);
    } catch {}
    setActApproving(false);
  }
  const todayDate = new Date();
  const todayFormatted = todayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

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

      <div className="hp-tabs">
        <button className={`hp-tab${tab === 'patients' ? ' hp-tab-active' : ''}`} onClick={() => setTab('patients')}>Patients</button>
        <button className={`hp-tab${tab === 'analytics' ? ' hp-tab-active' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
      </div>

      {tab === 'patients' && (
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
                              <Bar data={{ labels: data.map(d => { const dt = new Date(d.date); return dt.toLocaleString('en-US', { month: 'short', year: '2-digit' }); }), datasets: [{ data: data.map(d => d.value), backgroundColor: '#93C5FD', borderRadius: 2, barPercentage: 0.88, categoryPercentage: 0.92 }] }}
                                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.raw} ${data[0]?.unit || ''}` } } }, scales: { x: { display: true, grid: { display: false }, ticks: { font: { size: 8 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 8 } }, y: { display: false } } }} />
                            </div>
                            <span className="hp-outcome-direction" style={{ color: dirColor }}>{direction} {dirArrow}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {patientDetail.recentVitals.length > 0 && (() => {
                  const totalVPages = Math.ceil(patientDetail.recentVitals.length / ITEMS_PER_PAGE);
                  const visibleVitals = patientDetail.recentVitals.slice((vitalsPage - 1) * ITEMS_PER_PAGE, vitalsPage * ITEMS_PER_PAGE);
                  return (
                  <div className="hp-detail-card hp-detail-half">
                    <h3 className="hp-detail-title">Recent Vitals</h3>
                    <div className="hp-vitals-list hp-vitals-fixed">
                      {visibleVitals.map((v, i) => <div className="hp-vital-row" key={i}><span className="hp-vital-name">{v.name}</span><span className="hp-vital-val">{v.value}</span></div>)}
                    </div>
                    {totalVPages > 1 && <div className="hp-pagination"><button className="hp-page-btn" disabled={vitalsPage <= 1} onClick={() => setVitalsPage(vitalsPage - 1)}>Prev</button><span className="hp-page-info">{vitalsPage} / {totalVPages}</span><button className="hp-page-btn" disabled={vitalsPage >= totalVPages} onClick={() => setVitalsPage(vitalsPage + 1)}>Next</button></div>}
                  </div>);
                })()}

                {patientDetail.latestLab.length > 0 && (() => {
                  const totalLPages = Math.ceil(patientDetail.latestLab.length / ITEMS_PER_PAGE);
                  const visibleLabs = patientDetail.latestLab.slice((labPage - 1) * ITEMS_PER_PAGE, labPage * ITEMS_PER_PAGE);
                  return (
                  <div className="hp-detail-card hp-detail-half">
                    <h3 className="hp-detail-title">Lab Results</h3>
                    <div className="hp-vitals-list hp-vitals-fixed">
                      {visibleLabs.map((l, i) => <div className="hp-vital-row" key={i}><span className="hp-vital-name">{l.name}</span><span className="hp-vital-val hp-lab-val">{l.value}</span></div>)}
                    </div>
                    {totalLPages > 1 && <div className="hp-pagination"><button className="hp-page-btn" disabled={labPage <= 1} onClick={() => setLabPage(labPage - 1)}>Prev</button><span className="hp-page-info">{labPage} / {totalLPages}</span><button className="hp-page-btn" disabled={labPage >= totalLPages} onClick={() => setLabPage(labPage + 1)}>Next</button></div>}
                  </div>);
                })()}

                {patientDetail.activeMeds.length > 0 && (() => {
                  const totalMPages = Math.ceil(patientDetail.activeMeds.length / ITEMS_PER_PAGE);
                  const visibleMeds = patientDetail.activeMeds.slice((medPage - 1) * ITEMS_PER_PAGE, medPage * ITEMS_PER_PAGE);
                  return (
                  <div className="hp-detail-card">
                    <h3 className="hp-detail-title">Current Medications</h3>
                    <div className="hp-meds-list hp-vitals-fixed">
                      {visibleMeds.map((m, i) => (
                        <div className="hp-med-row" key={i}><div className="hp-med-info"><span className="hp-med-name">{m.name}</span>{m.dosage && <span className="hp-med-dosage">{m.dosage}</span>}</div></div>
                      ))}
                    </div>
                    {totalMPages > 1 && <div className="hp-pagination"><button className="hp-page-btn" disabled={medPage <= 1} onClick={() => setMedPage(medPage - 1)}>Prev</button><span className="hp-page-info">{medPage} / {totalMPages}</span><button className="hp-page-btn" disabled={medPage >= totalMPages} onClick={() => setMedPage(medPage + 1)}>Next</button></div>}
                  </div>
                  );
                })()}

                {patientDetail.documents && patientDetail.documents.length > 0 && (() => {
                  const totalDocPages = Math.ceil(patientDetail.documents.length / DOCS_PER_PAGE);
                  const visibleDocs = patientDetail.documents.slice((docPage - 1) * DOCS_PER_PAGE, docPage * DOCS_PER_PAGE);
                  function fmtDate(d) { if (!d) return ''; const dt = new Date(d); return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }
                  function downloadDoc(doc) {
                    if (!doc.data) return;
                    const blob = new Blob([atob(doc.data)], { type: doc.contentType || 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = doc.title || 'document'; a.click(); URL.revokeObjectURL(url);
                  }
                  return (
                  <div className="hp-detail-card">
                    <h3 className="hp-detail-title">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" style={{ marginRight: 6, verticalAlign: 'text-bottom' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                      Documents
                    </h3>
                    {visibleDocs.map((doc, i) => (
                      <div className="hp-doc-row" key={doc.id || i}>
                        <div className="hp-doc-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        </div>
                        <div className="hp-doc-text">
                          <span className="hp-doc-title">{doc.description || doc.title}</span>
                          <span className="hp-doc-sub">{doc.author}{doc.specialty ? ` · ${doc.specialty}` : ''} · {fmtDate(doc.date)}</span>
                        </div>
                        <div className="hp-doc-actions">
                          <a href="#" className="hp-doc-view" onClick={e => { e.preventDefault(); setViewingDoc(doc); }}>View</a>
                          <a href="#" className="hp-doc-dl" onClick={e => { e.preventDefault(); downloadDoc(doc); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </a>
                        </div>
                      </div>
                    ))}
                    {totalDocPages > 1 && (
                      <div className="hp-pagination">
                        <button className="hp-page-btn" disabled={docPage <= 1} onClick={() => setDocPage(docPage - 1)}>Prev</button>
                        <span className="hp-page-info">{docPage} / {totalDocPages}</span>
                        <button className="hp-page-btn" disabled={docPage >= totalDocPages} onClick={() => setDocPage(docPage + 1)}>Next</button>
                      </div>
                    )}
                  </div>
                  );
                })()}

                {viewingDoc && (
                  <div className="hp-modal-overlay" onClick={() => setViewingDoc(null)}>
                    <div className="hp-modal" onClick={e => e.stopPropagation()}>
                      <div className="hp-modal-header">
                        <h3>Document</h3>
                        <button className="hp-modal-close" onClick={() => setViewingDoc(null)}>×</button>
                      </div>
                      <div className="hp-modal-body">
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>{viewingDoc.description || viewingDoc.title}</p>
                        <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>{viewingDoc.author}{viewingDoc.specialty ? ` · ${viewingDoc.specialty}` : ''}</p>
                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.6, color: '#374151' }}>
                          {viewingDoc.data ? atob(viewingDoc.data) : viewingDoc.description}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="hp-detail-card">
                  <h3 className="hp-detail-title">AI Agent Pipeline</h3>
                  {!agentLoading && !agentResults && (
                    <div className="hp-pipeline-start">
                      <p className="hp-pipeline-start-text">Run AI Clinical Agent to analyze this patient's data and generate recommended actions.</p>
                      <button className="hp-pipeline-start-btn" onClick={startAgentAnalysis}>Start Analysis</button>
                    </div>
                  )}
                  {agentLoading && (
                    <div className="hp-pipeline">
                      <div className="hp-pipeline-header">
                        <span className="hp-pipeline-stage">Stage {agentStage}/2: {agentStage === 1 ? 'Clinical Agent — Analyzing patient data' : 'Recommendation Agent — Generating actions'}</span>
                        <span className="hp-pipeline-eta"><div className="hp-spinner-inline" style={{ width: 14, height: 14, borderWidth: 2 }} /> Processing...</span>
                      </div>
                      <div className="hp-pipeline-cards">
                        <div className={`hp-pipeline-node${agentStage >= 1 ? ' active' : ''}${agentStage >= 2 ? ' done' : ''}`}>
                          <span className="hp-pipeline-name">Clinical Agent</span>
                          <span className="hp-pipeline-role">Risk Analysis</span>
                          <span className={`hp-pipeline-status${agentStage >= 2 ? ' done' : agentStage >= 1 ? ' analyzing' : ''}`}>
                            {agentStage >= 2 ? '✓ DONE' : agentStage >= 1 ? 'ANALYZING...' : 'WAITING'}
                          </span>
                        </div>
                        <div className="hp-pipeline-connector">
                          <div className={`hp-pipeline-line${agentStage >= 2 ? ' filled' : ''}`} />
                        </div>
                        <div className={`hp-pipeline-node${agentStage >= 2 ? ' active' : ''}${agentStage >= 3 ? ' done' : ''}`}>
                          <span className="hp-pipeline-name">Recommendation Agent</span>
                          <span className="hp-pipeline-role">Actions Generator</span>
                          <span className={`hp-pipeline-status${agentStage >= 3 ? ' done' : agentStage >= 2 ? ' analyzing' : ''}`}>
                            {agentStage >= 3 ? '✓ DONE' : agentStage >= 2 ? 'GENERATING...' : 'WAITING'}
                          </span>
                        </div>
                      </div>
                      <div className="hp-pipeline-progress">
                        <div className="hp-pipeline-bar" style={{ width: `${agentStage >= 3 ? 100 : agentStage >= 2 ? 65 : agentStage >= 1 ? 30 : 0}%` }} />
                      </div>
                      <span className="hp-pipeline-count">{agentStage >= 3 ? '2' : agentStage >= 2 ? '1' : '0'} / 2 STAGES COMPLETED</span>
                    </div>
                  )}
                  {!agentLoading && agentResults ? (
                    <div className="hp-agent-single">
                      {agentResults.clinical && (() => {
                        const items = [...(agentResults.clinical.findings || []), ...(agentResults.clinical.careGaps || []), ...(agentResults.clinical.progressionAlerts || [])];
                        return (
                        <div className="hp-agent-card" style={{ borderTopColor: '#DC2626' }}>
                          <div className="hp-agent-header">
                            <span className="hp-agent-icon">🏥</span>
                            <span className="hp-agent-label">Clinical Agent</span>
                            {agentResults.clinical.riskLevel && <span className={`hp-agent-badge hp-agent-badge--${agentResults.clinical.riskLevel.toLowerCase()}`}>{agentResults.clinical.riskLevel} Risk</span>}
                          </div>
                          {agentResults.clinical.riskReason && <p className="hp-agent-reason">{agentResults.clinical.riskReason}</p>}
                          <ul className="hp-agent-items">
                            {(items.length > 0 ? items : ['No significant findings']).map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>

                {(!agentLoading && (aiActions.length > 0 || approvedActions.length > 0)) && (
                  <div className="hp-detail-card">
                    <div className="hp-action-tabs">
                      <button className={`hp-action-tab${actionTab === 'recommended' ? ' active' : ''}`} onClick={() => setActionTab('recommended')}>
                        AI Recommended Actions {aiActions.length > 0 && <span className="hp-action-tab-count">{aiActions.length}</span>}
                      </button>
                      <button className={`hp-action-tab${actionTab === 'approved' ? ' active' : ''}`} onClick={() => setActionTab('approved')}>
                        Approved Actions {approvedActions.length > 0 && <span className="hp-action-tab-count hp-action-tab-count--green">{approvedActions.length}</span>}
                      </button>
                    </div>

                    {actionTab === 'recommended' && (
                      <>
                        {aiActions.length > 0 ? aiActions.map((action, i) => (
                          <label className="hp-action-item" key={i}>
                            <input type="checkbox" checked={selectedAct.includes(i)} onChange={() => setSelectedAct(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} />
                            <div className="hp-action-content">
                              <div className="hp-action-top">
                                <span className="hp-action-title">{action.title}</span>
                                <span className={`hp-action-priority ${(action.priority || '').includes('High') ? 'high' : (action.priority || '').includes('Medium') ? 'med' : 'low'}`}>{action.priority}</span>
                              </div>
                              <span className="hp-action-desc">{action.description}</span>
                              <span className="hp-action-meta">{action.timeframe}{action.rationale ? ` · ${action.rationale}` : ''}</span>
                            </div>
                          </label>
                        )) : <p className="hp-an-empty-text">No new recommendations. Run the agent analysis to generate actions.</p>}
                        {selectedAct.length > 0 && (
                          <button className="hp-approve-btn" onClick={handleApproveActions} disabled={actApproving}>
                            {actApproving ? 'Approving...' : `Approve Selected (${selectedAct.length})`}
                          </button>
                        )}
                      </>
                    )}

                    {actionTab === 'approved' && (
                      <>
                        {approvedActions.length > 0 ? approvedActions.map((a, i) => (
                          <div className="hp-action-item hp-action-approved" key={i}>
                            <div className="hp-action-content">
                              <div className="hp-action-top">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                                <span className="hp-action-title">{a.title}</span>
                                {a.priority && <span className={`hp-action-priority ${(a.priority || '').includes('High') ? 'high' : (a.priority || '').includes('Medium') ? 'med' : 'low'}`}>{a.priority}</span>}
                              </div>
                              {a.description && <span className="hp-action-desc">{a.description}</span>}
                              {a.timeframe && <span className="hp-action-meta">{a.timeframe}</span>}
                            </div>
                          </div>
                        )) : <p className="hp-an-empty-text">No approved actions yet</p>}
                      </>
                    )}
                  </div>
                )}

                {approvalToast && <div className="hp-approval-toast">{approvalToast}</div>}
              </div>
            ) : (
              <div className="hp-pp-empty"><p className="hp-pp-loading">Failed to load patient details</p></div>
            )}
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="hp-analytics">
          <div className="hp-an-kpi-row">
            <div className="hp-an-kpi">
              <span className="hp-an-kpi-label">Today's Schedule</span>
              {analyticsLoading ? <span className="hp-an-kpi-val"><div className="hp-spinner-inline" /></span> : <>
              <span className="hp-an-kpi-val">{todayAppts.length}</span>
              </>}
            </div>
            <div className="hp-an-kpi">
              <span className="hp-an-kpi-label">Yearly Visits</span>
              {analyticsLoading ? <span className="hp-an-kpi-val"><div className="hp-spinner-inline" /></span> : <>
              <span className="hp-an-kpi-val">{yearlyVisits.count}</span>
              <span className={`hp-an-kpi-change ${yearlyVisits.pctChange >= 0 ? 'up-green' : 'down-red'}`}>
                {yearlyVisits.pctChange >= 0 ? '↗' : '↘'} {yearlyVisits.pctChange >= 0 ? '+' : ''}{yearlyVisits.pctChange}% vs last year
              </span></>}
            </div>
            <div className="hp-an-kpi">
              <span className="hp-an-kpi-label">Avg LOS</span>
              {analyticsLoading ? <span className="hp-an-kpi-val"><div className="hp-spinner-inline" /></span> : <>
              <span className="hp-an-kpi-val">{avgLos.days} days</span>
              <span className={`hp-an-kpi-change ${avgLos.pctChange <= 0 ? 'up-green' : 'down-red'}`}>
                {avgLos.pctChange <= 0 ? '↘' : '↗'} {avgLos.pctChange > 0 ? '+' : ''}{avgLos.pctChange} days vs last month
              </span>
              </>}
            </div>
            <div className="hp-an-kpi">
              <span className="hp-an-kpi-label">Med Adherence</span>
              {analyticsLoading ? <span className="hp-an-kpi-val"><div className="hp-spinner-inline" /></span> : <>
              <span className="hp-an-kpi-val">{medAdherence.pct}%</span>
              </>}
            </div>
          </div>

          <div className="hp-an-card">
            <h3 className="hp-an-card-title">Today's Appointments</h3>
            <p className="hp-an-card-sub">Schedule for {todayFormatted}</p>
            {todayAppts.length > 0 ? (
              <div className="hp-an-appt-list">
                {todayAppts.map((a, i) => (
                  <div className="hp-an-appt-row" key={i}>
                    <div className="hp-an-appt-time-col">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      <span className="hp-an-appt-time">{a.time}</span>
                    </div>
                    <div className="hp-an-appt-info">
                      <span className="hp-an-appt-name">{a.name}</span>
                      <span className="hp-an-appt-type">{a.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p style={{ fontSize: 13, color: '#94A3B8', padding: '12px 0' }}>No appointments scheduled for today</p>}
          </div>

          <div className="hp-an-three-col">
            <div className="hp-an-col-card">
              <h3 className="hp-an-card-title">ER Visits</h3>
              <p className="hp-an-card-sub">Latest emergency patients</p>
              <div className="hp-an-col-list">
                {erVisits.length > 0 ? erVisits.map((e, i) => (
                  <div className="hp-an-er-card" key={i}>
                    <div className="hp-an-er-top">
                      <span className="hp-an-er-name">{e.name}</span>
                    </div>
                    <span className="hp-an-er-meta">Age {e.age}</span>
                    {e.diagnosis && <span className="hp-an-er-diag">{e.diagnosis}</span>}
                    <div className="hp-an-er-bottom">
                      <span className="hp-an-er-time">{e.date}</span>
                      <span className="hp-an-er-status">{e.status}</span>
                    </div>
                  </div>
                )) : <p className="hp-an-empty-text">No ER visits</p>}
              </div>
            </div>

            <div className="hp-an-col-card">
              <h3 className="hp-an-card-title">Recent Admissions</h3>
              <p className="hp-an-card-sub">Latest admissions per patient</p>
              <div className="hp-an-col-list">
                {recentAdmissions.length > 0 ? recentAdmissions.map((a, i) => (
                  <div className="hp-an-adm-card" key={i}>
                    <span className="hp-an-adm-name">{a.name}</span>
                    <span className="hp-an-adm-meta">Age {a.age}</span>
                    {a.diagnosis && <p className="hp-an-adm-line"><strong>Diagnosis:</strong> {a.diagnosis}</p>}
                    {a.department && <p className="hp-an-adm-line"><strong>Department:</strong> {a.department}</p>}
                    <span className="hp-an-adm-date">{a.date}</span>
                  </div>
                )) : <p className="hp-an-empty-text">No recent admissions</p>}
              </div>
            </div>

            <div className="hp-an-col-card">
              <h3 className="hp-an-card-title">Recent Discharges</h3>
              <p className="hp-an-card-sub">Latest discharges per patient</p>
              <div className="hp-an-col-list">
                {recentDischarges.length > 0 ? recentDischarges.map((d, i) => (
                  <div className="hp-an-adm-card" key={i}>
                    <span className="hp-an-adm-name">{d.name}</span>
                    <span className="hp-an-adm-meta">Age {d.age}</span>
                    {d.diagnosis && <p className="hp-an-adm-line"><strong>Diagnosis:</strong> {d.diagnosis}</p>}
                    <p className="hp-an-adm-line"><strong>LOS:</strong> {d.los}</p>
                    {d.disposition && <p className="hp-an-adm-line"><strong>Disposition:</strong> {d.disposition}</p>}
                    {d.followUp && <p className="hp-an-adm-line"><strong>Follow-up:</strong> {d.followUp}</p>}
                    <span className="hp-an-adm-date">{d.date}</span>
                  </div>
                )) : <p className="hp-an-empty-text">No recent discharges</p>}
              </div>
            </div>
          </div>

          <div className="hp-an-two-col">
            <div className="hp-an-col-card">
              <h3 className="hp-an-card-title">Care Gaps Overview</h3>
              <p className="hp-an-card-sub">Patients with missed medications or follow-ups</p>
              <div className="hp-an-col-list">
                {careGaps.length > 0 ? careGaps.map((g, i) => (
                  <div className="hp-an-gap-row" key={i}>
                    <div className="hp-an-gap-info">
                      <span className="hp-an-gap-name">{g.name}</span>
                      {g.issues.map((issue, j) => <span key={j} className="hp-an-gap-issue">{issue}</span>)}
                      {g.returned && <span className="hp-an-gap-returned">Patient returned after missed follow-up</span>}
                    </div>
                    <span className="hp-an-gap-count">{g.gapCount} gap{g.gapCount > 1 ? 's' : ''}</span>
                  </div>
                )) : <p className="hp-an-empty-text">No care gaps detected</p>}
              </div>
            </div>

            <div className="hp-an-col-card">
              <h3 className="hp-an-card-title">High-Risk Patients</h3>
              <p className="hp-an-card-sub">Patients requiring close monitoring</p>
              <div className="hp-an-col-list">
                {highRiskLoading ? (
                  <div className="hp-an-risk-loading">
                    <div className="hp-spinner" />
                    <span>Fetching high-risk patients...</span>
                  </div>
                ) : highRiskPatients.length > 0 ? highRiskPatients.map((p, i) => (
                  <div className="hp-an-risk-card" key={i}>
                    <div className="hp-an-risk-top">
                      <span className="hp-an-risk-name">{p.name}</span>
                    </div>
                    <span className="hp-an-risk-meta">Age {p.age}</span>
                    {p.condition && <span className="hp-an-risk-cond">{p.condition}</span>}
                    {p.lastVisit && <span className="hp-an-risk-visit">Last visit: {p.lastVisit}</span>}
                    <button className="hp-an-risk-review" onClick={() => { setTab('patients'); setSelectedPatient(p.id); }}>Review Chart →</button>
                  </div>
                )) : <p className="hp-an-empty-text">No high-risk patients detected</p>}
              </div>
            </div>
          </div>

          <div className="hp-an-two-col">
            <div className="hp-an-card">
              <h3 className="hp-an-card-title">Half-Yearly Visits Trend</h3>
              {yearlyTrend ? (
                <div className="hp-an-chart-wrap">
                  <Line
                    data={{
                      labels: yearlyTrend.labels,
                      datasets: [{
                        label: 'Visits',
                        data: yearlyTrend.data,
                        borderColor: '#14B8A6',
                        backgroundColor: 'rgba(20, 184, 166, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 5,
                        pointBackgroundColor: '#14B8A6',
                      }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                        y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 11 } } },
                      },
                    }}
                  />
                </div>
              ) : <p className="hp-an-empty-text">Loading trend data...</p>}
            </div>

            <div className="hp-an-card">
              <h3 className="hp-an-card-title">Patient Outcomes</h3>
              {patientOutcomes ? (
                <div className="hp-an-chart-wrap">
                  <Bar
                    data={{
                      labels: patientOutcomes.labels,
                      datasets: [
                        { label: 'Improved', data: patientOutcomes.improved, backgroundColor: '#22C55E', borderRadius: 3 },
                        { label: 'Stable', data: patientOutcomes.stable, backgroundColor: '#3B82F6', borderRadius: 3 },
                        { label: 'Declined', data: patientOutcomes.declined, backgroundColor: '#EF4444', borderRadius: 3 },
                      ],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                        y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 11 } } },
                      },
                    }}
                  />
                </div>
              ) : <p className="hp-an-empty-text">Loading outcomes data...</p>}
            </div>
          </div>

          <div className="hp-an-card">
            <h3 className="hp-an-card-title">HEDIS Quality Measures</h3>
            <p className="hp-an-card-sub">Healthcare Effectiveness Data and Information Set — patient quality scores</p>
            {hedisLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: '#64748B', fontSize: 13 }}>
                <div className="hp-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                Calculating HEDIS scores...
              </div>
            ) : hedisScores && hedisScores.measures.length > 0 ? (
              <div className="hp-hedis-grid">
                {hedisScores.measures.map(m => (
                  <div className={`hp-hedis-card${m.invertedMeasure ? ' hp-hedis-inverted' : ''}`} key={m.id}>
                    <div className="hp-hedis-header">
                      <span className="hp-hedis-domain">{m.domain}</span>
                      <span className={`hp-hedis-rate${m.rate === null ? '' : m.invertedMeasure ? (m.rate <= 10 ? ' good' : m.rate <= 25 ? ' fair' : ' poor') : (m.rate >= 80 ? ' good' : m.rate >= 60 ? ' fair' : ' poor')}`}>
                        {m.rate !== null ? `${m.rate}%` : 'N/A'}
                      </span>
                    </div>
                    <span className="hp-hedis-name">{m.name}</span>
                    <span className="hp-hedis-desc">{m.description}</span>
                    <div className="hp-hedis-bar-wrap">
                      <div className="hp-hedis-bar" style={{ width: `${m.rate || 0}%` }} />
                    </div>
                    <span className="hp-hedis-meta">{m.met} of {m.eligible} eligible patients</span>
                    {m.gapPatients.length > 0 && (
                      <details className="hp-hedis-gaps">
                        <summary>{m.gapPatients.length} gap{m.gapPatients.length > 1 ? 's' : ''}</summary>
                        <ul>{m.gapPatients.map((n, i) => <li key={i}>{n}</li>)}</ul>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="hp-an-empty-text">No eligible patients for HEDIS measures</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
