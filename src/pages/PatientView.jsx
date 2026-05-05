import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { callFhirApi, buildUrl } from '../services/fhir';
import { callAI } from '../services/ai';
import { FHIR_BASE } from '../config/constants';
import { HEALTH_STATUS_PROMPT, CONDITIONS_PROMPT, TASKS_PROMPT, HEALTH_SUMMARY_PROMPT, APPT_SUMMARY_PROMPT, APPT_INSTRUCTIONS_PROMPT, AI_ACTIONS_PROMPT } from '../config/prompts';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import '../styles/patient.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const NOTIFICATIONS = [
  { text: 'Lab results are ready for review', time: '2 hours ago' },
  { text: 'New message from your care team', time: '5 hours ago' },
  { text: 'Upcoming appointment reminder', time: '1 day ago' },
];

function nameFromEmail(email) {
  if (!email) return '';
  const local = email.split('@')[0];
  return local.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

const OBS_PER_PAGE = 5;

const ALL_OBS_GROUPS = [
  { key: 'bp', label: 'BP', codes: ['8480-6', '8462-4'], colors: ['#EF4444', '#3B82F6'], targets: [120, 80], targetLabels: ['Systolic (120)', 'Diastolic (80)'] },
  { key: 'glucose', label: 'Glucose', codes: ['2345-7'], colors: ['#8B5CF6'], targets: [130], targetLabels: ['Target: 70-130 mg/dL'], fill: true },
  { key: 'heartrate', label: 'Heart Rate', codes: ['8867-4'], colors: ['#F59E0B'], targets: null, targetLabels: ['Normal: 60-100 bpm'] },
  { key: 'hba1c', label: 'HbA1c', codes: ['4548-4'], colors: ['#22C55E'], targets: [7.0], targetLabels: ['Target: < 7.0%'] },
  { key: 'creatinine', label: 'Creatinine', codes: ['2160-0'], colors: ['#EF4444'], targets: [1.3], targetLabels: ['Upper: 1.3 mg/dL'] },
  { key: 'ntprobnp', label: 'NT-proBNP', codes: ['33762-6'], colors: ['#EC4899'], targets: [125], targetLabels: ['Upper: 125 pg/mL'] },
  { key: 'potassium', label: 'Potassium', codes: ['2823-3'], colors: ['#F59E0B'], targets: null, targetLabels: ['Normal: 3.5-5.0 mEq/L'] },
  { key: 'ldl', label: 'LDL', codes: ['2090-9'], colors: ['#3B82F6'], targets: [100], targetLabels: ['Target: < 100 mg/dL'] },
  { key: 'cholesterol', label: 'Cholesterol', codes: ['2093-3'], colors: ['#6366F1'], targets: [200], targetLabels: ['Upper: 200 mg/dL'] },
  { key: 'triglycerides', label: 'Triglycerides', codes: ['1644-4'], colors: ['#F97316'], targets: [150], targetLabels: ['Upper: 150 mg/dL'] },
  { key: 'sodium', label: 'Sodium', codes: ['2951-2'], colors: ['#14B8A6'], targets: null, targetLabels: ['Normal: 136-145 mEq/L'] },
];

function parseObsForTrends(bundle) {
  if (!bundle?.entry?.length) return null;
  const byCode = {};
  for (const e of bundle.entry) {
    const r = e.resource;
    if (r.resourceType !== 'Observation') continue;
    const code = r.code?.coding?.[0]?.code || '';
    const display = r.code?.coding?.[0]?.display || '';
    const value = r.valueQuantity?.value ?? parseFloat(r.valueString);
    const unit = r.valueQuantity?.unit || r.valueQuantity?.code || '';
    const date = r.effectiveDateTime || r.issued || '';
    if (!code || isNaN(value)) continue;
    if (!byCode[code]) byCode[code] = { display, unit, points: [] };
    byCode[code].points.push({ date: new Date(date), value });
  }
  for (const c of Object.values(byCode)) c.points.sort((a, b) => a.date - b.date);
  return Object.keys(byCode).length ? byCode : null;
}

function getTrendTabs(obsData) {
  if (!obsData) return [];
  return ALL_OBS_GROUPS
    .map(g => ({ ...g, totalPoints: g.codes.reduce((sum, c) => sum + (obsData[c]?.points?.length || 0), 0) }))
    .filter(g => g.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

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
  const patientId = searchParams.get('id') || localStorage.getItem('p360_ref_id') || '';

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
  const [healthSummary, setHealthSummary] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [careTeam, setCareTeam] = useState([]);
  const [allObsData, setAllObsData] = useState(null);
  const [trendTab, setTrendTab] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState('all');
  const [upcomingAppts, setUpcomingAppts] = useState([]);
  const [lastPastAppt, setLastPastAppt] = useState(null);
  const [apptSummary, setApptSummary] = useState(null);
  const [apptInstructions, setApptInstructions] = useState([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [apptAiLoading, setApptAiLoading] = useState(true);
  const [apptPage, setApptPage] = useState(1);
  const [activeMeds, setActiveMeds] = useState([]);
  const [stoppedMeds, setStoppedMeds] = useState([]);
  const [medPage, setMedPage] = useState(1);
  const [aiActions, setAiActions] = useState([]);
  const [selectedActions, setSelectedActions] = useState([]);
  const [taskQueue, setTaskQueue] = useState([]);
  const [careTab, setCareTab] = useState('actions');
  const [taskFilter, setTaskFilter] = useState('pending');
  const [clinicNotes, setClinicNotes] = useState([]);
  const [notePage, setNotePage] = useState(1);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [docPage, setDocPage] = useState(1);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [lifestyleGoals, setLifestyleGoals] = useState(null);
  const lifestyleDateRef = useRef('');

  const GOAL_TARGETS = { steps: 10000, water: 10, exercise: 40 };
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
    fetchLifestyleGoals();
    const interval = setInterval(() => {
      const today = new Date().toISOString().split('T')[0];
      if (lifestyleDateRef.current && lifestyleDateRef.current !== today) {
        fetchLifestyleGoals();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [patientId]);

  async function fetchLifestyleGoals() {
    try {
      const res = await callFhirApi(buildUrl('/baseR4/care-plan/lifestyle-goals', { patientId }));
      const ext = res?.extension?.[0]?.extension || [];
      const goals = {};
      for (const e of ext) {
        if (e.url === 'dailySteps') {
          const subs = e.extension || [];
          goals.steps = (subs.find(s => s.url === 'achieved')?.valueInteger) ?? 0;
        } else if (e.url === 'waterIntake') {
          const subs = e.extension || [];
          goals.water = (subs.find(s => s.url === 'achieved')?.valueInteger) ?? 0;
        } else if (e.url === 'exerciseMinutes') {
          const subs = e.extension || [];
          goals.exercise = (subs.find(s => s.url === 'achieved')?.valueInteger) ?? 0;
        } else if (e.url === 'date') {
          goals.date = e.valueDate || '';
          lifestyleDateRef.current = goals.date;
        }
      }
      const stepsPct = Math.min((goals.steps / GOAL_TARGETS.steps) * 100, 100);
      const waterPct = Math.min((goals.water / GOAL_TARGETS.water) * 100, 100);
      const exercisePct = Math.min((goals.exercise / GOAL_TARGETS.exercise) * 100, 100);
      goals.weeklyPct = Math.round((stepsPct + waterPct + exercisePct) / 3);
      setLifestyleGoals(goals);
    } catch {}
  }

  async function loadData() {
    try {
      const [patientRes, condRes, medRes, obsRes, allergyRes, eocRes, apptRes] = await Promise.all([
        callFhirApi(buildUrl('/baseR4/Patient', { _id: patientId, page: 0, size: 1 })),
        callFhirApi(buildUrl('/baseR4/Condition', { patient: patientId, page: 0, size: 100 })),
        callFhirApi(buildUrl('/baseR4/MedicationRequest', { patient: patientId, page: 0, size: 100 })),
        callFhirApi(buildUrl('/baseR4/Observation/search', { patient: patientId, page: 0, size: 100 })),
        callFhirApi(buildUrl('/baseR4/AllergyIntolerance', { patient: patientId, page: 0, size: 100 })),
        callFhirApi(buildUrl('/baseR4/EpisodeOfCare', { patient: patientId, page: 0, size: 100 })),
        callFhirApi(buildUrl('/baseR4/Appointment', { patient: patientId, page: 0, size: 100 })),
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
          reason: r.reasonCode?.[0]?.coding?.[0]?.display || r.reasonCode?.[0]?.text || '',
          frequency: r.dosageInstruction?.[0]?.timing?.code?.text || r.dosageInstruction?.[0]?.timing?.repeat?.frequency ? `${r.dosageInstruction?.[0]?.timing?.repeat?.frequency}x daily` : '',
        };
      }).sort((a, b) => (b.authoredOn || '').localeCompare(a.authoredOn || ''));
      setLastMed(meds[0] || null);
      setActiveMeds(meds.filter(m => m.status === 'active'));
      setStoppedMeds(meds.filter(m => m.status === 'stopped' || m.status === 'cancelled'));

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

      const allergyEntries = allergyRes?.entry || [];
      setAllergies(allergyEntries.map(e => {
        const r = e.resource;
        return {
          name: r.code?.coding?.[0]?.display || 'Unknown',
          criticality: r.criticality || 'low',
          category: (r.category || [])[0] || '',
        };
      }));

      const trendData = parseObsForTrends(obsRes);
      setAllObsData(trendData);

      const team = [];
      const practIds = {};
      for (const e of (eocRes?.entry || [])) {
        const r = e.resource;
        const cm = r.careManager;
        if (!cm) continue;
        const name = cm.display || 'Care Manager';
        const program = r.type?.[0]?.coding?.[0]?.display || r.type?.[0]?.text || 'Care Program';
        const practId = cm.reference?.replace('Practitioner/', '') || '';
        if (!team.some(t => t.name === name)) {
          team.push({ name, initials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(), program, email: '', practId });
          if (practId) practIds[practId] = null;
        }
      }
      await Promise.all(Object.keys(practIds).map(async id => {
        try {
          const pr = await callFhirApi(`${FHIR_BASE}/baseR4/Practitioner?_id=${id}&page=0&size=1`);
          const email = pr?.entry?.[0]?.resource?.telecom?.find(t => t.system === 'email')?.value || '';
          practIds[id] = email;
        } catch {}
      }));
      team.forEach(m => { if (m.practId && practIds[m.practId]) m.email = practIds[m.practId]; });
      setCareTeam(team);

      const now = new Date();
      const apptEntries = apptRes?.entry || [];
      const practIdSet = new Set();
      const rawAppts = apptEntries.map(e => {
        const r = e.resource;
        const practRef = (r.participant || []).find(p => p.actor?.reference?.startsWith('Practitioner/'));
        const practId = practRef?.actor?.reference?.replace('Practitioner/', '') || '';
        if (practId) practIdSet.add(practId);
        return {
          id: r.id,
          description: r.description || '',
          serviceType: r.serviceType?.[0]?.text || '',
          reasonCode: r.reasonCode?.[0]?.text || '',
          start: r.start || '',
          end: r.end || '',
          status: r.status || '',
          location: (r.extension || []).find(x => x.url === 'Location')?.valueString || '',
          practId,
          practName: '',
        };
      });
      const practNameMap = {};
      await Promise.all([...practIdSet].map(async id => {
        try {
          const pr = await callFhirApi(`${FHIR_BASE}/baseR4/Practitioner?_id=${id}&page=0&size=1`);
          const res = pr?.entry?.[0]?.resource;
          const prefix = res?.name?.[0]?.prefix?.[0] || 'Dr.';
          const given = res?.name?.[0]?.given?.join(' ') || '';
          const family = res?.name?.[0]?.family || '';
          practNameMap[id] = `${prefix} ${given} ${family}`.replace(/\s+/g, ' ').trim();
        } catch {}
      }));
      rawAppts.forEach(a => { if (a.practId && practNameMap[a.practId]) a.practName = practNameMap[a.practId]; });

      const upcoming = rawAppts.filter(a => new Date(a.start) > now && a.status === 'booked').sort((a, b) => new Date(a.start) - new Date(b.start));
      setUpcomingAppts(upcoming);

      const past = rawAppts.filter(a => new Date(a.start) <= now).sort((a, b) => new Date(b.start) - new Date(a.start));
      setLastPastAppt(past[0] || null);

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

      const [statusResult, condResult, tasksResult, summaryResult] = await Promise.all([
        callAI(HEALTH_STATUS_PROMPT, patientContext).then(v => ({ status: 'fulfilled', value: v })).catch(() => ({ status: 'rejected' })),
        callAI(CONDITIONS_PROMPT, `Condition data: ${JSON.stringify(condData)}`).then(v => ({ status: 'fulfilled', value: v })).catch(() => ({ status: 'rejected' })),
        tasksPromise,
        callAI(HEALTH_SUMMARY_PROMPT, patientContext).then(v => ({ status: 'fulfilled', value: v })).catch(() => ({ status: 'rejected' })),
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

      if (summaryResult.status === 'fulfilled') {
        try {
          const parsed = JSON.parse(summaryResult.value);
          setHealthSummary(Array.isArray(parsed) ? parsed.slice(0, 1) : [parsed]);
        } catch {
          setHealthSummary([]);
        }
      }

      setAiLoading(false);

      if (past[0]?.description) {
        const apptContext = `Appointment: ${past[0].description}\nService: ${past[0].serviceType}\nReason: ${past[0].reasonCode}\nPatient conditions: ${condSummary}\nMedications: ${medSummary}`;
        const [sumRes, instrRes] = await Promise.allSettled([
          callAI(APPT_SUMMARY_PROMPT, apptContext),
          callAI(APPT_INSTRUCTIONS_PROMPT, apptContext),
        ]);
        if (sumRes.status === 'fulfilled') {
          try { setApptSummary(JSON.parse(sumRes.value).summary); } catch { setApptSummary(past[0].description); }
        } else { setApptSummary(past[0].description); }
        if (instrRes.status === 'fulfilled') {
          try { const p = JSON.parse(instrRes.value); setApptInstructions(Array.isArray(p) ? p.slice(0, 3) : []); } catch { setApptInstructions([]); }
        }
      }
      setApptAiLoading(false);

      // AI Recommended Actions
      try {
        const actRes = await callAI(AI_ACTIONS_PROMPT, patientContext);
        const parsed = JSON.parse(actRes);
        setAiActions(Array.isArray(parsed) ? parsed.slice(0, 4) : []);
      } catch { setAiActions([]); }
      setActionsLoading(false);

      // Task Queue
      try {
        const [pRes, ipRes, cRes] = await Promise.all([
          callFhirApi(buildUrl('/baseR4/portal/task-queue', { patientId, status: 'pending' })).catch(() => []),
          callFhirApi(buildUrl('/baseR4/portal/task-queue', { patientId, status: 'in-process' })).catch(() => []),
          callFhirApi(buildUrl('/baseR4/portal/task-queue', { patientId, status: 'completed' })).catch(() => []),
        ]);
        const mapTask = (arr, s) => (Array.isArray(arr) ? arr : []).map(t => ({
          id: t.actionId || t.id || '', title: t.action || t.title || '', priority: t.priority || '',
          status: s, description: t.description || '', notes: t.aiRationale || t.notes || '',
          dueDate: t.dueDate || '',
        }));
        setTaskQueue([...mapTask(pRes, 'pending'), ...mapTask(ipRes, 'inprocess'), ...mapTask(cRes, 'completed')]);
      } catch { setTaskQueue([]); }

      // All Documents (DocumentReference)
      try {
        const docsRes = await callFhirApi(buildUrl('/baseR4/DocumentReference', { patient: patientId, page: 0, size: 100 }));
        const allDocs = (docsRes?.entry || []).map(e => {
          const r = e.resource;
          return {
            id: r.id,
            title: r.content?.[0]?.attachment?.title || r.description || 'Untitled',
            description: r.description || '',
            author: r.author?.[0]?.display || 'Unknown',
            specialty: r.author?.[0]?.extension?.find(x => x.url === 'specialty')?.valueString || '',
            date: r.date || '',
            type: r.type?.coding?.[0]?.display || 'Document',
            typeCode: r.type?.coding?.[0]?.code || '',
            contentType: r.content?.[0]?.attachment?.contentType || 'text/plain',
            data: r.content?.[0]?.attachment?.data || '',
          };
        }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setDocuments(allDocs);
        setClinicNotes(allDocs.filter(d => d.typeCode === '11506-3').map(d => ({
          author: d.author, text: d.description, fullText: d.data ? atob(d.data) : '', date: d.date, type: 'Clinical',
        })));
      } catch { setDocuments([]); setClinicNotes([]); }

    } catch (err) {
      console.error('Error loading data:', err);
      setLoading(false);
      setAiLoading(false);
      setApptAiLoading(false);
    }
  }

  const role = localStorage.getItem('p360_role') || '';
  const canAct = role === 'CARE_MANAGER' || role === 'PROVIDER';

  async function handleApprove() {
    const selected = aiActions.filter((_, i) => selectedActions.includes(i));
    if (!selected.length) return;
    try {
      const body = selected.map(a => ({
        patientId, priority: a.priority, action: a.title,
        description: a.description, aiRationale: a.rationale,
        dueDate: new Date(Date.now() + (a.timeframe?.includes('24') ? 86400000 : a.timeframe?.includes('48') ? 172800000 : a.timeframe?.includes('week') ? 604800000 : 259200000)).toISOString().split('T')[0],
      }));
      await fetch(`${FHIR_BASE}/baseR4/portal/create-recommendations`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('p360_token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSelectedActions([]);
      refreshTaskQueue();
    } catch {}
  }

  async function refreshTaskQueue() {
    try {
      const [pRes, ipRes, cRes] = await Promise.all([
        callFhirApi(buildUrl('/baseR4/portal/task-queue', { patientId, status: 'pending' })).catch(() => []),
        callFhirApi(buildUrl('/baseR4/portal/task-queue', { patientId, status: 'in-process' })).catch(() => []),
        callFhirApi(buildUrl('/baseR4/portal/task-queue', { patientId, status: 'completed' })).catch(() => []),
      ]);
      const mt = (arr, s) => (Array.isArray(arr) ? arr : []).map(t => ({ id: t.actionId || t.id || '', title: t.action || t.title || '', priority: t.priority || '', status: s, description: t.description || '', notes: t.aiRationale || t.notes || '', dueDate: t.dueDate || '' }));
      setTaskQueue([...mt(pRes, 'pending'), ...mt(ipRes, 'inprocess'), ...mt(cRes, 'completed')]);
    } catch {}
  }

  async function updateTaskStatus(taskId, newStatus) {
    try {
      await fetch(`${FHIR_BASE}/baseR4/portal/update-task?actionId=${taskId}&status=${newStatus}`, {
        method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('p360_token')}`, 'Content-Type': 'application/json' },
      });
      refreshTaskQueue();
    } catch {}
  }

  const filteredTasks = taskQueue.filter(t => t.status === taskFilter);
  const taskCounts = { pending: taskQueue.filter(t => t.status === 'pending').length, inprocess: taskQueue.filter(t => t.status === 'inprocess').length, completed: taskQueue.filter(t => t.status === 'completed').length };
  const NOTES_PER_PAGE = 3;
  const paginatedNotes = clinicNotes.slice((notePage - 1) * NOTES_PER_PAGE, notePage * NOTES_PER_PAGE);
  const DOCS_PER_PAGE = 5;
  const paginatedDocs = documents.slice((docPage - 1) * DOCS_PER_PAGE, docPage * DOCS_PER_PAGE);

  function downloadDoc(doc) {
    const text = doc.data ? atob(doc.data) : doc.description;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^a-zA-Z0-9 -]/g, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
            <span className="pv-nav-user-name">{role === 'ADMIN' ? (localStorage.getItem('p360_user') || 'Admin') : nameFromEmail(localStorage.getItem('p360_email'))}</span>
            <span className="pv-nav-user-role">{role || 'PATIENT'}</span>
          </div>
          <div className="pv-profile-wrap" ref={profileRef}>
            <div className="pv-nav-avatar" onClick={() => setShowProfile(!showProfile)} style={{ cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            {showProfile && (
              <div className="pv-profile-dropdown">
                <div className="pv-profile-info">
                  <span className="pv-profile-name">{role === 'ADMIN' ? (localStorage.getItem('p360_user') || 'Admin') : nameFromEmail(localStorage.getItem('p360_email'))}</span>
                  <span className="pv-profile-email">{localStorage.getItem('p360_email') || ''}</span>
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
        <button className="pv-back" onClick={() => navigate('/')}>
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

        {/* ── My Health Summary (DYNAMIC) ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            My Health Summary
          </h2>

          {loading ? (
            <div className="pv-loading"><div className="pv-spinner"></div><span>Loading...</span></div>
          ) : (
            <>
              <h3 className="pv-section-label">Health Overview</h3>
              {aiLoading ? (
                <p className="pv-loading-text">Generating summary...</p>
              ) : healthSummary.length > 0 ? (
                healthSummary.map((s, i) => (
                  <div className="pv-condition-card" key={i}>
                    <p><strong>{s.condition}:</strong> {s.summary}</p>
                  </div>
                ))
              ) : (
                <p className="pv-empty-text">No summary available</p>
              )}

              <div className="pv-allergy-card">
                <h3 className="pv-allergy-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Allergies & Safety Info
                </h3>
                {allergies.length > 0 ? (
                  allergies.map((a, i) => (
                    <p className="pv-allergy-item" key={i}>• {a.name} — {a.criticality}</p>
                  ))
                ) : (
                  <p className="pv-allergy-item">No known allergies</p>
                )}
              </div>

              <h3 className="pv-section-label">My Care Team</h3>
              <div className="pv-care-team">
                {careTeam.length > 0 ? (
                  careTeam.map((m, i) => (
                    <div className="pv-team-card" key={i}>
                      <div className="pv-team-avatar">{m.initials}</div>
                      <div className="pv-team-info">
                        <span className="pv-team-name">{m.name}</span>
                        <span className="pv-team-program">{m.program}</span>
                      </div>
                      {m.email && (
                        <a href={`mailto:${m.email}`} className="pv-team-email" title={m.email}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="pv-empty-text">No care coordinators found</p>
                )}
              </div>

              <h3 className="pv-section-label">Test Results Trend</h3>
              {(() => {
                const tabs = getTrendTabs(allObsData);
                if (!tabs.length) return <p className="pv-empty-text">No trend data available</p>;
                const activeKey = trendTab || tabs[0]?.key;
                const cfg = tabs.find(t => t.key === activeKey) || tabs[0];
                const datasets = [];
                const allDates = new Set();
                cfg.codes.forEach((code, idx) => {
                  const obs = allObsData[code];
                  if (!obs) return;
                  obs.points.forEach(p => allDates.add(p.date.toISOString().slice(0, 10)));
                  datasets.push({
                    label: obs.display,
                    data: obs.points.map(p => ({ x: p.date.toISOString().slice(0, 10), y: p.value })),
                    borderColor: cfg.colors[idx % cfg.colors.length],
                    backgroundColor: cfg.fill ? cfg.colors[idx % cfg.colors.length] + '20' : 'transparent',
                    fill: !!cfg.fill, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2,
                  });
                });
                if (!datasets.length || !allDates.size) return <p className="pv-empty-text">No data for selected period</p>;
                const labels = [...allDates].sort();
                datasets.forEach(ds => { ds.data = labels.map(lbl => { const pt = ds.data.find(d => d.x === lbl); return pt ? pt.y : null; }); });
                if (cfg.targets) cfg.targets.forEach((t, idx) => { if (t != null) datasets.push({ label: `Target (${t})`, data: labels.map(() => t), borderColor: cfg.colors[idx % cfg.colors.length] || '#94A3B8', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, fill: false }); });
                const options = {
                  responsive: false, interaction: { mode: 'index', intersect: false }, spanGaps: true,
                  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 10 } } }, tooltip: { backgroundColor: '#fff', titleColor: '#1E293B', bodyColor: '#475569', borderColor: '#E2E8F0', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { title: (items) => { const d = new Date(labels[items[0].dataIndex]); return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${String(d.getFullYear()).slice(-2)}`; }, label: ctx => ctx.raw == null ? null : ctx.raw } } },
                  scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 6, callback: (_, i) => { const d = new Date(labels[i]); return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${String(d.getFullYear()).slice(-2)}`; } } }, y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 } }, beginAtZero: true } },
                };
                return (
                  <>
                    <div className="pv-trend-tabs">
                      {tabs.map(tab => (
                        <button key={tab.key} className={`pv-trend-tab${(activeKey) === tab.key ? ' active' : ''}`} onClick={() => setTrendTab(tab.key)}>{tab.label}</button>
                      ))}
                    </div>
                    <div className="pv-chart-scroll"><div className="pv-chart-inner"><Line data={{ labels, datasets }} options={options} width={480} height={200} /></div></div>
                    {cfg.targetLabels && <div className="pv-trend-legend">{cfg.targetLabels.map((l, i) => <span key={i} className="pv-trend-legend-item">{l}</span>)}</div>}
                  </>
                );
              })()}
            </>
          )}
        </div>

        {/* ── Appointments & Visits (DYNAMIC) ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Appointments & Visits
          </h2>

          {loading ? (
            <div className="pv-loading"><div className="pv-spinner"></div><span>Loading...</span></div>
          ) : (
            <>
              <h3 className="pv-section-label">Upcoming Appointments</h3>
              {upcomingAppts.length > 0 ? (
                <>
                  <div className="pv-appt-list">
                  {upcomingAppts.slice((apptPage - 1) * 3, apptPage * 3).map((a, i) => {
                    const globalIdx = (apptPage - 1) * 3 + i;
                    return (
                      <div className={`pv-appt-card${globalIdx === 0 ? ' pv-appt-upcoming' : ''}`} key={a.id}>
                        <div className="pv-appt-info">
                          <span className="pv-appt-doc">{a.practName || a.serviceType}</span>
                          <span className="pv-appt-type">{a.description || a.reasonCode}</span>
                        </div>
                        <span className={`pv-appt-date${globalIdx === 0 ? ' blue' : ''}`}>{formatDateTime(a.start)}</span>
                      </div>
                    );
                  })}
                  </div>
                  {upcomingAppts.length > 3 && (
                    <div className="pv-obs-pagination">
                      <button className="pv-obs-page-btn" disabled={apptPage <= 1} onClick={() => setApptPage(apptPage - 1)}>Prev</button>
                      {Array.from({ length: Math.ceil(upcomingAppts.length / 3) }, (_, i) => (
                        <button key={i} className={`pv-obs-page-btn${apptPage === i + 1 ? ' pv-obs-page-active' : ''}`} onClick={() => setApptPage(i + 1)}>{i + 1}</button>
                      ))}
                      <button className="pv-obs-page-btn" disabled={apptPage >= Math.ceil(upcomingAppts.length / 3)} onClick={() => setApptPage(apptPage + 1)}>Next</button>
                    </div>
                  )}
                </>
              ) : (
                <p className="pv-empty-text">No upcoming appointments</p>
              )}

              <button className="pv-televisit-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                Start Tele-Visit
              </button>

              <h3 className="pv-section-label">Past Appointments</h3>
              {lastPastAppt ? (
                <>
                  <div className="pv-appt-card">
                    <div className="pv-appt-info">
                      <span className="pv-appt-doc">{lastPastAppt.practName || lastPastAppt.serviceType}</span>
                      <span className="pv-appt-type">{lastPastAppt.description || lastPastAppt.reasonCode}</span>
                    </div>
                    <span className="pv-appt-date">{formatDateTime(lastPastAppt.start)}</span>
                  </div>
                  <a href="#" className="pv-view-summary" onClick={(e) => { e.preventDefault(); setShowSummaryModal(true); }}>View Summary</a>
                </>
              ) : (
                <p className="pv-empty-text">No past appointments</p>
              )}

              <h3 className="pv-section-label">AI Recommended Instructions</h3>
              {apptAiLoading ? (
                <p className="pv-loading-text">Generating instructions...</p>
              ) : apptInstructions.length > 0 ? (
                <div className="pv-followup-card">
                  {apptInstructions.map((inst, i) => <p key={i}>• {inst}</p>)}
                </div>
              ) : (
                <p className="pv-empty-text">No instructions available</p>
              )}

              <h3 className="pv-section-label">Authorizations</h3>
              <div className="pv-auth-row">
                <span>HbA1c Lab Panel</span>
                <span className="pv-pill pv-pill-green">Approved</span>
              </div>
              <div className="pv-auth-row" style={{ marginTop: '6px' }}>
                <span>Diabetic Retinopathy Screening</span>
                <span className="pv-pill pv-pill-green">Approved</span>
              </div>
            </>
          )}
        </div>

        {showSummaryModal && (
          <div className="pv-modal-overlay" onClick={() => setShowSummaryModal(false)}>
            <div className="pv-modal" onClick={e => e.stopPropagation()}>
              <div className="pv-modal-header">
                <h3>Visit Summary</h3>
                <button className="pv-modal-close" onClick={() => setShowSummaryModal(false)}>×</button>
              </div>
              <div className="pv-modal-body">
                {lastPastAppt && (
                  <div className="pv-modal-appt-info">
                    <p><strong>{lastPastAppt.practName}</strong> — {lastPastAppt.serviceType}</p>
                    <p className="pv-modal-date">{formatDateTime(lastPastAppt.start)}</p>
                  </div>
                )}
                <div className="pv-condition-card" style={{ marginTop: '12px' }}>
                  <p>{apptSummary || lastPastAppt?.description || 'No summary available'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Row (unchanged) ── */}
      <div className="pv-grid pv-grid-bottom">

        {/* ── My Medications (DYNAMIC) ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3"/></svg>
            My Medications
          </h2>

          {loading ? (
            <div className="pv-loading"><div className="pv-spinner"></div><span>Loading...</span></div>
          ) : activeMeds.length > 0 ? (
            <>
              <div className="pv-meds-list">
                {activeMeds.slice((medPage - 1) * 2, medPage * 2).map((m, i) => (
                  <div className="pv-med-card" key={i}>
                    <div className="pv-med-header">
                      <span className="pv-med-name">{m.name}</span>
                      <span className="pv-pill pv-pill-green">Active</span>
                    </div>
                    {m.reason && <p className="pv-med-detail"><strong>Purpose:</strong> {m.reason}</p>}
                    {m.dosage && <p className="pv-med-detail"><strong>Dose:</strong> {m.dosage}</p>}
                    {m.authoredOn && (
                      <p className="pv-med-reminder">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        Prescribed: {formatDateTime(m.authoredOn)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {activeMeds.length > 2 && (
                <div className="pv-obs-pagination">
                  <button className="pv-obs-page-btn" disabled={medPage <= 1} onClick={() => setMedPage(medPage - 1)}>Prev</button>
                  {Array.from({ length: Math.ceil(activeMeds.length / 2) }, (_, i) => (
                    <button key={i} className={`pv-obs-page-btn${medPage === i + 1 ? ' pv-obs-page-active' : ''}`} onClick={() => setMedPage(i + 1)}>{i + 1}</button>
                  ))}
                  <button className="pv-obs-page-btn" disabled={medPage >= Math.ceil(activeMeds.length / 2)} onClick={() => setMedPage(medPage + 1)}>Next</button>
                </div>
              )}
            </>
          ) : (
            <p className="pv-empty-text">No active medications</p>
          )}

          {stoppedMeds.length > 0 && (
            <div className="pv-missed-alert">
              <div className="pv-missed-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Missed Medications
              </div>
              {stoppedMeds.map((m, i) => (
                <p key={i}>• {m.name}</p>
              ))}
              <a href="#" className="pv-mark-taken" onClick={e => e.preventDefault()}>Mark as taken</a>
            </div>
          )}

          <button className="pv-refill-btn">Request Refill</button>
        </div>

        {/* ── My Care Plan & Tasks (DYNAMIC) ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
            My Care Plan & Tasks
          </h2>

          {/* AI Actions / Task Queue tabs */}
          <div className="pv-care-tabs">
            <button className={`pv-care-tab${careTab === 'actions' ? ' active' : ''}`} onClick={() => setCareTab('actions')}>AI Actions</button>
            <button className={`pv-care-tab${careTab === 'queue' ? ' active' : ''}`} onClick={() => setCareTab('queue')}>Task Queue</button>
          </div>

          <div className="pv-care-scroll">
            {careTab === 'actions' && (
              <div className="pv-actions-content">
                {actionsLoading ? (
                  <div className="pv-loading"><div className="pv-spinner"></div><span>Generating AI recommendations...</span></div>
                ) : aiActions.length > 0 ? (
                  <>
                    {aiActions.map((a, i) => (
                      <div className="pv-action-card" key={i}>
                        <div className="pv-action-top">
                          {canAct && <input type="checkbox" checked={selectedActions.includes(i)} onChange={() => setSelectedActions(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} />}
                          <span className="pv-action-title">{a.title}</span>
                          <span className={`pv-pill pv-pri-${a.priority?.includes('High') ? 'high' : a.priority?.includes('Medium') ? 'med' : 'low'}`}>{a.priority}</span>
                        </div>
                        <p className="pv-action-desc">{a.description}</p>
                        <p className="pv-action-meta">{a.timeframe} · {a.rationale}</p>
                      </div>
                    ))}
                    {canAct && selectedActions.length > 0 && (
                      <button className="pv-approve-btn" onClick={handleApprove}>Approve Selected ({selectedActions.length})</button>
                    )}
                  </>
                ) : (
                  <p className="pv-empty-text">No AI actions available</p>
                )}
              </div>
            )}

            {careTab === 'queue' && (
              <div className="pv-queue-content">
                <div className="pv-queue-filters">
                  {[['pending', 'Pending'], ['inprocess', 'In Process'], ['completed', 'Completed']].map(([k, l]) => (
                    <button key={k} className={`pv-queue-filter${taskFilter === k ? ' active' : ''}`} onClick={() => setTaskFilter(k)}>
                      {l} ({taskCounts[k] || 0})
                    </button>
                  ))}
                </div>
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((t, i) => (
                    <div className="pv-task-card" key={i}>
                      <div className="pv-task-top">
                        <span className="pv-task-title">{t.title}</span>
                        <span className={`pv-pill pv-pri-${t.priority?.includes('High') ? 'high' : t.priority?.includes('Medium') ? 'med' : 'low'}`}>{t.priority}</span>
                      </div>
                      <p className="pv-action-desc">{t.description}</p>
                      {t.dueDate && <p className="pv-action-meta">Due: {t.dueDate}</p>}
                      {canAct && t.status === 'pending' && (
                        <div className="pv-task-btns">
                          <button className="pv-task-start" onClick={() => updateTaskStatus(t.id, 'in-process')}>Start</button>
                          <button className="pv-task-done" onClick={() => updateTaskStatus(t.id, 'completed')}>Complete</button>
                        </div>
                      )}
                      {canAct && t.status === 'inprocess' && (
                        <button className="pv-task-done" onClick={() => updateTaskStatus(t.id, 'completed')}>Complete</button>
                      )}
                      {t.status === 'completed' && <span className="pv-task-completed-label">✓ Completed</span>}
                    </div>
                  ))
                ) : (
                  <p className="pv-empty-text">No {taskFilter} tasks</p>
                )}
              </div>
            )}
          </div>

          {/* Clinical Notes */}
          <h3 className="pv-section-label" style={{ marginTop: '16px' }}>Clinical Notes</h3>
          {clinicNotes.length > 0 ? (
            <>
              {paginatedNotes.map((n, i) => (
                <div className="pv-note-card" key={i}>
                  <div className="pv-note-top">
                    <span className="pv-note-author">{n.author}</span>
                    <span className="pv-note-date">{formatDateTime(n.date)}</span>
                  </div>
                  <p className="pv-note-text">{n.text || n.fullText}</p>
                </div>
              ))}
              {clinicNotes.length > NOTES_PER_PAGE && (
                <div className="pv-obs-pagination">
                  <button className="pv-obs-page-btn" disabled={notePage <= 1} onClick={() => setNotePage(notePage - 1)}>Prev</button>
                  {Array.from({ length: Math.ceil(clinicNotes.length / NOTES_PER_PAGE) }, (_, i) => (
                    <button key={i} className={`pv-obs-page-btn${notePage === i + 1 ? ' pv-obs-page-active' : ''}`} onClick={() => setNotePage(i + 1)}>{i + 1}</button>
                  ))}
                  <button className="pv-obs-page-btn" disabled={notePage >= Math.ceil(clinicNotes.length / NOTES_PER_PAGE)} onClick={() => setNotePage(notePage + 1)}>Next</button>
                </div>
              )}
            </>
          ) : (
            <p className="pv-empty-text">No clinical notes</p>
          )}

          {/* Lifestyle Goals */}
          <h3 className="pv-section-label" style={{ marginTop: '16px' }}>Lifestyle Goals</h3>
          {lifestyleGoals ? (
            <>
              <div className="pv-goal-row">
                <span className="pv-goal-label">Daily Steps</span>
                <span className="pv-goal-value">{lifestyleGoals.steps?.toLocaleString()} / {GOAL_TARGETS.steps.toLocaleString()}</span>
              </div>
              <div className="pv-progress-bar">
                <div className="pv-progress-fill green" style={{ width: `${Math.min((lifestyleGoals.steps / GOAL_TARGETS.steps) * 100, 100)}%` }}></div>
              </div>
              <div className="pv-goal-row">
                <span className="pv-goal-label">Water Intake ({GOAL_TARGETS.water} glasses)</span>
                <span className="pv-goal-value">{lifestyleGoals.water} / {GOAL_TARGETS.water}</span>
              </div>
              <div className="pv-progress-bar">
                <div className="pv-progress-fill blue" style={{ width: `${Math.min((lifestyleGoals.water / GOAL_TARGETS.water) * 100, 100)}%` }}></div>
              </div>
              <div className="pv-goal-row">
                <span className="pv-goal-label">Exercise ({GOAL_TARGETS.exercise} min)</span>
                <span className="pv-goal-value">{lifestyleGoals.exercise} / {GOAL_TARGETS.exercise} min</span>
              </div>
              <div className="pv-progress-bar">
                <div className="pv-progress-fill red" style={{ width: `${Math.min((lifestyleGoals.exercise / GOAL_TARGETS.exercise) * 100, 100)}%` }}></div>
              </div>
              <div className="pv-weekly-ring">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                  <circle cx="40" cy="40" r="32" fill="none" stroke={lifestyleGoals.weeklyPct >= 70 ? '#22C55E' : lifestyleGoals.weeklyPct >= 40 ? '#F59E0B' : '#EF4444'} strokeWidth="6"
                    strokeDasharray={`${(lifestyleGoals.weeklyPct / 100) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                    strokeLinecap="round" transform="rotate(-90 40 40)" />
                </svg>
                <div className="pv-ring-text">
                  <span className="pv-ring-pct">{lifestyleGoals.weeklyPct}%</span>
                  <span className="pv-ring-label">Overall</span>
                </div>
              </div>
            </>
          ) : (
            <p className="pv-loading-text">Loading lifestyle data...</p>
          )}
        </div>

        {/* ── Documents ── */}
        <div className="pv-card">
          <h2 className="pv-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            Documents
          </h2>

          {loading ? (
            <div className="pv-loading"><div className="pv-spinner"></div><span>Loading...</span></div>
          ) : documents.length > 0 ? (
            <>
              {paginatedDocs.map((doc, i) => (
                <div className="pv-doc-row" key={doc.id || i}>
                  <div className="pv-doc-icon" style={{ color: doc.typeCode === '34108-1' ? '#F59E0B' : '#3B82F6' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  </div>
                  <div className="pv-doc-text">
                    <span className="pv-doc-title">{doc.description}</span>
                    <span className="pv-doc-sub">{doc.author}{doc.specialty ? ` · ${doc.specialty}` : ''} · {formatDateTime(doc.date)}</span>
                  </div>
                  <div className="pv-doc-actions">
                    <a href="#" className="pv-doc-view" onClick={e => { e.preventDefault(); setViewingDoc(doc); }}>View</a>
                    <a href="#" className="pv-doc-download" onClick={e => { e.preventDefault(); downloadDoc(doc); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                  </div>
                </div>
              ))}
              {documents.length > DOCS_PER_PAGE && (
                <div className="pv-obs-pagination">
                  <button className="pv-obs-page-btn" disabled={docPage <= 1} onClick={() => setDocPage(docPage - 1)}>Prev</button>
                  {Array.from({ length: Math.ceil(documents.length / DOCS_PER_PAGE) }, (_, i) => (
                    <button key={i} className={`pv-obs-page-btn${docPage === i + 1 ? ' pv-obs-page-active' : ''}`} onClick={() => setDocPage(i + 1)}>{i + 1}</button>
                  ))}
                  <button className="pv-obs-page-btn" disabled={docPage >= Math.ceil(documents.length / DOCS_PER_PAGE)} onClick={() => setDocPage(docPage + 1)}>Next</button>
                </div>
              )}
            </>
          ) : (
            <p className="pv-empty-text">No documents found</p>
          )}

          <button className="pv-upload-btn">Upload Document</button>

          {viewingDoc && (
            <div className="pv-modal-overlay" onClick={() => setViewingDoc(null)}>
              <div className="pv-modal" onClick={e => e.stopPropagation()}>
                <div className="pv-modal-header">
                  <h3>Document</h3>
                  <button className="pv-modal-close" onClick={() => setViewingDoc(null)}>×</button>
                </div>
                <div className="pv-modal-body">
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '4px' }}>{viewingDoc.description}</p>
                  <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>{viewingDoc.author}{viewingDoc.specialty ? ` · ${viewingDoc.specialty}` : ''} · {formatDateTime(viewingDoc.date)}</p>
                  <div className="pv-condition-card">
                    <p>{viewingDoc.data ? atob(viewingDoc.data) : viewingDoc.description}</p>
                  </div>
                  <button className="pv-doc-download-btn" onClick={() => downloadDoc(viewingDoc)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
