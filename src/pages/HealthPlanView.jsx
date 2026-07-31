import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { callFhirApi, buildUrl } from '../services/fhir';
import { FHIR_BASE } from '../config/constants';
import { calculateHedisScores } from '../services/hedis';
import '../styles/healthplan.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

function formatCost(val) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${Math.round(val).toLocaleString()}`;
}

export default function HealthPlanView({ onLogout }) {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);
  const userName = localStorage.getItem('p360_user') || 'Admin';
  const userEmail = localStorage.getItem('p360_email') || '';

  const [apiData, setApiData] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [totalMembers, setTotalMembers] = useState(0);
  const [pmpmCost, setPmpmCost] = useState(0);
  const [dynClusters, setDynClusters] = useState([]);
  const [dynProviders, setDynProviders] = useState([]);
  const [dynConditions, setDynConditions] = useState([]);
  const [dynCostTrend, setDynCostTrend] = useState(null);
  const [riskCounts, setRiskCounts] = useState({ high: 0, rising: 0, low: 0 });
  const [riskScoresByMonth, setRiskScoresByMonth] = useState(null);
  const [dynUtilization, setDynUtilization] = useState(null);
  const [utilLoading, setUtilLoading] = useState(false);
  const [utilProgress, setUtilProgress] = useState({ done: 0, total: 0 });
  const [hedisScore, setHedisScore] = useState(null);
  const [hedisCareGaps, setHedisCareGaps] = useState(null);
  const [hedisMeasures, setHedisMeasures] = useState([]);
  const [hedisLoading, setHedisLoading] = useState(false);
  const [hedisProgress, setHedisProgress] = useState({ done: 0, total: 0 });
  const [clusterPage, setClusterPage] = useState(1);
  const [conditionPage, setConditionPage] = useState(1);
  const [hedisPage, setHedisPage] = useState(1);
  const ITEMS_PER_PAGE = 4;
  const apiEntriesRef = useRef([]);
  const hsPatientIdsRef = useRef([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await callFhirApi(`${FHIR_BASE}/baseR4/CostAndSatisfaction?page=0&size=1000`);
        const entries = (res?.entry || []).map(e => {
          const ext = e.resource?.extension || [];
          const get = (url) => ext.find(x => x.url === url);
          return {
            providerId: get('provider-id')?.valueString || '',
            patientId: get('patient-id')?.valueString || '',
            doctorName: get('doctor-name')?.valueString || '',
            patientName: get('patient-name')?.valueString || '',
            patientAge: get('patient-age')?.valueInteger || 0,
            disease: get('disease')?.valueString || '',
            averageCost: get('average-cost')?.valueDecimal || 0,
            satisfaction: get('satisfaction-rating')?.valueDecimal || 0,
            qualityScore: get('quality-score')?.valueDecimal || 0,
            ratingDateTime: get('rating-date-time')?.valueString || '',
          };
        }).filter(e => e.patientId);
        setApiData(entries);
        apiEntriesRef.current = entries;

        // 1) PMPM Cost
        if (entries.length) {
          const totalCost = entries.reduce((s, e) => s + e.averageCost, 0);
          setPmpmCost(Math.round(totalCost / entries.length));
        }

        // 2) Chronic Condition Clusters — pair diseases alphabetically
        const diseaseMap = {};
        for (const e of entries) {
          const d = e.disease.trim();
          if (!d) continue;
          if (!diseaseMap[d]) diseaseMap[d] = { costs: [], members: new Set() };
          diseaseMap[d].costs.push(e.averageCost);
          diseaseMap[d].members.add(e.patientId);
        }
        const diseaseNames = Object.keys(diseaseMap).sort();
        const clusters = [];
        for (let i = 0; i < diseaseNames.length; i += 2) {
          if (i + 1 < diseaseNames.length) {
            const d1 = diseaseNames[i], d2 = diseaseNames[i + 1];
            const allCosts = [...diseaseMap[d1].costs, ...diseaseMap[d2].costs];
            const allMembers = new Set([...diseaseMap[d1].members, ...diseaseMap[d2].members]);
            const avgCost = allCosts.reduce((s, c) => s + c, 0) / allCosts.length;
            clusters.push({ name: `${d1} + ${d2}`, members: allMembers.size, cost: formatCost(avgCost) });
          } else {
            const d1 = diseaseNames[i];
            const avgCost = diseaseMap[d1].costs.reduce((s, c) => s + c, 0) / diseaseMap[d1].costs.length;
            clusters.push({ name: d1, members: diseaseMap[d1].members.size, cost: formatCost(avgCost) });
          }
        }
        clusters.sort((a, b) => b.members - a.members);
        setDynClusters(clusters);

        // 3) Provider Scorecard
        const providerMap = {};
        for (const e of entries) {
          const name = e.doctorName.trim();
          if (!name) continue;
          if (!providerMap[name]) providerMap[name] = { patients: new Set(), costs: [], ratings: [], qualityScores: [] };
          providerMap[name].patients.add(e.patientId);
          providerMap[name].costs.push(e.averageCost);
          providerMap[name].ratings.push(e.satisfaction);
          if (e.qualityScore > 0) providerMap[name].qualityScores.push(e.qualityScore);
        }
        const provArr = Object.entries(providerMap).map(([name, data]) => {
          const avgCost = data.costs.reduce((s, c) => s + c, 0) / data.costs.length;
          const avgSat = data.ratings.reduce((s, r) => s + r, 0) / data.ratings.length;
          const quality = data.qualityScores.length > 0 ? Math.round(data.qualityScores.reduce((s, q) => s + q, 0) / data.qualityScores.length) : 0;
          return { name, patients: data.patients.size, quality, cost: formatCost(avgCost), satisfaction: +avgSat.toFixed(1), perf: quality >= 90 ? 'good' : quality >= 80 ? 'med' : 'fair' };
        }).sort((a, b) => b.patients - a.patients);
        setDynProviders(provArr);

        // 5) Top Conditions by Cost
        const condMap = {};
        for (const e of entries) {
          const d = e.disease.trim();
          if (!d) continue;
          if (!condMap[d]) condMap[d] = { patients: new Set(), costs: [] };
          condMap[d].patients.add(e.patientId);
          condMap[d].costs.push(e.averageCost);
        }
        const condArr = Object.entries(condMap).map(([name, data]) => {
          const avgCost = data.costs.reduce((s, c) => s + c, 0) / data.costs.length;
          return { name, members: data.patients.size, cost: avgCost, costDisplay: formatCost(avgCost) };
        }).sort((a, b) => b.cost - a.cost);
        setDynConditions(condArr);

        // 6) Cost Trend — group by month from ratingDateTime
        const monthCosts = {};
        for (const e of entries) {
          if (!e.ratingDateTime || !e.averageCost) continue;
          const d = new Date(e.ratingDateTime);
          if (isNaN(d.getTime())) continue;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthCosts[key]) monthCosts[key] = [];
          monthCosts[key].push(e.averageCost);
        }
        const sortedMonths = Object.keys(monthCosts).sort();
        if (sortedMonths.length > 0) {
          const labels = sortedMonths.map(k => {
            const [y, m] = k.split('-');
            return new Date(+y, +m - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
          });
          const data = sortedMonths.map(k => {
            const costs = monthCosts[k];
            return Math.round(costs.reduce((s, c) => s + c, 0) / costs.length);
          });
          setDynCostTrend({ labels, data });
        }
      } catch (err) {
        console.error('[HealthPlan] CostAndSatisfaction API error:', err);
      }
      // Fetch health statuses for risk tiers
      try {
        const hsRes = await callFhirApi(`${FHIR_BASE}/baseR4/Patient/health-status?page=0&size=50`);
        setTotalMembers(hsRes?.total || 0);
        const hsEntries = (hsRes?.entry || []).map(e => {
          const ext = e.resource?.extension || [];
          const get = (url) => ext.find(x => x.url === url);
          return {
            patientId: get('patient-id')?.valueString || '',
            patientName: get('patient-name')?.valueString || '',
            healthStatus: get('health-status')?.valueString || '',
            dateTime: get('date-and-time')?.valueDateTime || '',
          };
        }).filter(e => e.patientId && e.healthStatus);

        // Deduplicate — latest per patient
        const latestByPatient = {};
        for (const h of hsEntries) {
          const existing = latestByPatient[h.patientId];
          if (!existing || new Date(h.dateTime) > new Date(existing.dateTime)) {
            latestByPatient[h.patientId] = h;
          }
        }
        const unique = Object.values(latestByPatient);
        hsPatientIdsRef.current = unique.map(h => h.patientId);

        // Categorize
        let high = 0, rising = 0, low = 0;
        for (const h of unique) {
          const s = h.healthStatus.toLowerCase();
          if (s === 'high' || s === 'critical' || s === 'poor') high++;
          else if (s === 'low' || s === 'fair' || s === 'good') low++;
          else rising++;
        }
        setRiskCounts({ high, rising, low });

        // Predictive Risk Scores by month from dateTime
        const monthMap = {};
        for (const h of hsEntries) {
          if (!h.dateTime) continue;
          const d = new Date(h.dateTime);
          if (isNaN(d.getTime())) continue;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthMap[key]) monthMap[key] = { high: [], rising: [], low: [] };
          const s = h.healthStatus.toLowerCase();
          if (s === 'high' || s === 'critical' || s === 'poor') monthMap[key].high.push(1);
          else if (s === 'low' || s === 'fair' || s === 'good') monthMap[key].low.push(1);
          else monthMap[key].rising.push(1);
        }
        const sortedMs = Object.keys(monthMap).sort();
        if (sortedMs.length > 0) {
          setRiskScoresByMonth({
            labels: sortedMs.map(k => { const [y, m] = k.split('-'); return new Date(+y, +m - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' }); }),
            high: sortedMs.map(k => monthMap[k].high.length),
            rising: sortedMs.map(k => monthMap[k].rising.length),
            low: sortedMs.map(k => monthMap[k].low.length),
          });
        }
      } catch (err) {
        console.error('[HealthPlan] health-status API error:', err);
      }

      setApiLoading(false);

      // Run HEDIS + Utilization in PARALLEL
      const hedisTask = (async () => {
        const cached = sessionStorage.getItem('p360_hedis_cache');
        if (cached) {
          try { const parsed = JSON.parse(cached); setHedisScore(parsed.hedisScore); setHedisCareGaps(parsed.careGaps); setHedisMeasures(parsed.measures); return; } catch {}
        }
        const allEntries = apiEntriesRef.current;
        const uniquePatientIds = [...new Set(allEntries.map(e => e.patientId))];
        if (!uniquePatientIds.length) return;
        setHedisLoading(true);
        setHedisProgress({ done: 0, total: uniquePatientIds.length });
        try {
          const result = await calculateHedisScores(uniquePatientIds, callFhirApi, buildUrl, FHIR_BASE, (done, total) => setHedisProgress({ done, total }));
          const measures = result.measures || [];
          const ratesWithValues = measures.filter(m => m.rate !== null && !m.invertedMeasure);
          const avgScore = ratesWithValues.length > 0 ? Math.round(ratesWithValues.reduce((s, m) => s + m.rate, 0) / ratesWithValues.length) : 0;
          const totalGaps = measures.filter(m => !m.invertedMeasure).reduce((s, m) => s + (m.eligible - m.met), 0);
          const summaryMeasures = measures.filter(m => !m.invertedMeasure && m.eligible > 0).map(m => ({ name: m.name, pct: m.rate, compliant: m.met, gap: m.eligible - m.met }));
          setHedisScore(avgScore); setHedisCareGaps(totalGaps); setHedisMeasures(summaryMeasures);
          try { sessionStorage.setItem('p360_hedis_cache', JSON.stringify({ hedisScore: avgScore, careGaps: totalGaps, measures: summaryMeasures })); } catch {}
        } catch (err) { console.error('[HealthPlan] HEDIS error:', err); }
        setHedisLoading(false);
      })();

      const utilTask = (async () => {
        const utilCached = sessionStorage.getItem('p360_util_cache');
        if (utilCached) { try { setDynUtilization(JSON.parse(utilCached)); return; } catch {} }
        const pids = hsPatientIdsRef.current;
        if (!pids.length) return;
        setUtilLoading(true);
        setUtilProgress({ done: 0, total: pids.length });
        try {
          const monthUtil = {};
          for (let i = 0; i < pids.length; i++) {
            try {
              const encRes = await callFhirApi(buildUrl('/baseR4/Encounter', { patient: pids[i], page: 0, size: 200 }));
              const encs = (encRes?.entry || []).map(e => e.resource).filter(Boolean);
              for (const enc of encs) {
                const start = enc.period?.start;
                if (!start) continue;
                const d = new Date(start);
                if (isNaN(d.getTime())) continue;
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!monthUtil[key]) monthUtil[key] = { outpatient: 0, er: 0, inpatient: 0 };
                const cls = (enc.class?.code || '').toUpperCase();
                if (cls === 'AMB') monthUtil[key].outpatient++;
                else if (cls === 'EMER') monthUtil[key].er++;
                else if (cls === 'IMP' || cls === 'INP') monthUtil[key].inpatient++;
              }
            } catch {}
            setUtilProgress({ done: i + 1, total: pids.length });
          }
          const sortedKeys = Object.keys(monthUtil).sort();
          if (sortedKeys.length > 0) {
            const utilData = {
              labels: sortedKeys.map(k => { const [y, m] = k.split('-'); return new Date(+y, +m - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' }); }),
              outpatient: sortedKeys.map(k => monthUtil[k].outpatient),
              er: sortedKeys.map(k => monthUtil[k].er),
              inpatient: sortedKeys.map(k => monthUtil[k].inpatient),
            };
            setDynUtilization(utilData);
            try { sessionStorage.setItem('p360_util_cache', JSON.stringify(utilData)); } catch {}
          }
        } catch (err) { console.error('[HealthPlan] Utilization error:', err); }
        setUtilLoading(false);
      })();

      await Promise.all([hedisTask, utilTask]);
    })();
  }, []);

  const riskPieData = {
    labels: ['High Risk', 'Rising Risk', 'Low Risk'],
    datasets: [{
      data: [riskCounts.high, riskCounts.rising, riskCounts.low],
      backgroundColor: ['#EF4444', '#F59E0B', '#22C55E'],
      borderWidth: 0,
    }],
  };
  const riskPieOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const predLabels = riskScoresByMonth?.labels || months;
  const predHigh = riskScoresByMonth?.high || [8, 9, 8, 9, 8, 9];
  const predRising = riskScoresByMonth?.rising || [6, 6, 6, 6, 6, 6];
  const predLow = riskScoresByMonth?.low || [5, 5, 5, 5, 5, 5];
  const predictiveData = {
    labels: predLabels,
    datasets: [
      { label: 'High Risk', data: predHigh, borderColor: '#EF4444', backgroundColor: 'transparent', pointRadius: 5, pointBackgroundColor: '#EF4444', tension: 0.3 },
      { label: 'Rising Risk', data: predRising, borderColor: '#F59E0B', backgroundColor: 'transparent', pointRadius: 5, pointBackgroundColor: '#F59E0B', tension: 0.3 },
      { label: 'Low Risk', data: predLow, borderColor: '#22C55E', backgroundColor: 'transparent', pointRadius: 5, pointBackgroundColor: '#22C55E', tension: 0.3 },
    ],
  };
  const predictiveOpts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#fff', titleColor: '#1E293B', bodyColor: '#64748B',
        borderColor: '#E2E8F0', borderWidth: 1, cornerRadius: 8, padding: 12,
        titleFont: { size: 13, weight: '700' }, bodyFont: { size: 12 },
        usePointStyle: true,
        callbacks: {
          labelTextColor: (ctx) => ctx.dataset.borderColor,
          label: (ctx) => `${ctx.dataset.label} : ${ctx.parsed.y}`,
        },
      },
    },
    scales: { y: { min: 0, max: 10, ticks: { stepSize: 2 } } },
  };

  const utilLabels = dynUtilization?.labels || months;
  const utilizationData = {
    labels: utilLabels,
    datasets: [
      { label: 'Outpatient', data: dynUtilization?.outpatient || [510, 565, 520, 534, 480, 545], backgroundColor: '#3B82F6' },
      { label: 'ER', data: dynUtilization?.er || [85, 130, 95, 142, 110, 90], backgroundColor: '#F59E0B' },
      { label: 'Inpatient', data: dynUtilization?.inpatient || [60, 75, 80, 87, 70, 55], backgroundColor: '#EF4444' },
    ],
  };
  const utilizationOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } } },
    scales: { y: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } } },
  };

  const costTrendLabels = dynCostTrend?.labels || months;
  const costTrendValues = dynCostTrend?.data || [295000, 310000, 320000, 289000, 305000, 298000];
  const costMax = Math.ceil(Math.max(...costTrendValues) * 1.15);
  const costTrendData = {
    labels: costTrendLabels,
    datasets: [{
      label: 'Cost',
      data: costTrendValues,
      borderColor: '#22C55E',
      backgroundColor: 'transparent',
      pointRadius: 6,
      pointBackgroundColor: '#22C55E',
      tension: 0.3,
      borderWidth: 2,
    }],
  };
  const costTrendOpts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#fff', titleColor: '#1E293B', bodyColor: '#16A34A',
        borderColor: '#E2E8F0', borderWidth: 1, cornerRadius: 8, padding: 12,
        titleFont: { size: 13, weight: '700' }, bodyFont: { size: 12 },
        callbacks: { label: (ctx) => `cost : ${formatCost(ctx.parsed.y)}` },
      },
    },
    scales: { y: { beginAtZero: true, max: costMax, ticks: { callback: v => v.toLocaleString() } } },
  };

  const hedisGaps = hedisMeasures;

  const providers = dynProviders;
  const topConditions = dynConditions;
  const chronicClusters = dynClusters;

  return (
    <div className="hp-page">
      <nav className="hp-nav">
        <div className="hp-nav-left">
          <img src="/images/Rsystems_Logo_White.png" alt="R Systems" className="hp-nav-logo" />
          <span className="hp-nav-title">Patient 360 Portal</span>
        </div>
        <div className="hp-nav-right">
          <div className="hp-nav-bell">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="hp-nav-badge">5</span>
          </div>
          <div className="hp-nav-user">
            <span className="hp-nav-user-name">{userName}</span>
            <span className="hp-nav-user-role">HEALTH PLAN</span>
          </div>
          <div className="hpv-profile-wrap" ref={profileRef}>
            <div className="hp-nav-avatar" onClick={() => setShowProfile(!showProfile)} style={{ cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            {showProfile && (
              <div className="hpv-profile-dropdown">
                <div className="hpv-profile-info"><span className="hpv-profile-name">{userName}</span><span className="hpv-profile-email">{userEmail}</span></div>
                <div className="hpv-profile-signout" onClick={onLogout}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Sign Out</div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="hpv-subheader">
        <h1 className="hpv-title">Health Plan Executive Dashboard</h1>
        <button className="hpv-back" onClick={() => navigate('/')}>← Back to Home</button>
      </div>

      <div className="hpv-content">

        {/* KPIs (left 2-col grid) + Chronic Condition Clusters (right) */}
        <div className="hpv-kpi-cluster-row">
          <div className="hpv-kpi-grid-left">
            <div className="hpv-kpi">
              <div className="hpv-kpi-top"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span className="hpv-kpi-label">Total Members</span></div>
              <span className="hpv-kpi-val">{apiLoading ? '...' : totalMembers.toLocaleString()}</span>
            </div>
            <div className="hpv-kpi">
              <div className="hpv-kpi-top"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span className="hpv-kpi-label">High-Risk Members</span></div>
              <span className="hpv-kpi-val" style={{ color: '#EF4444' }}>{riskCounts.high.toLocaleString()}</span>
            <span className="hpv-kpi-sub">{totalMembers > 0 ? Math.round((riskCounts.high / (riskCounts.high + riskCounts.rising + riskCounts.low || 1)) * 100) : 0}% of population</span>
            </div>
            <div className="hpv-kpi">
              <div className="hpv-kpi-top"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg><span className="hpv-kpi-label">Rising-Risk Members</span></div>
              <span className="hpv-kpi-val" style={{ color: '#F59E0B' }}>{riskCounts.rising.toLocaleString()}</span>
            <span className="hpv-kpi-sub">{totalMembers > 0 ? Math.round((riskCounts.rising / (riskCounts.high + riskCounts.rising + riskCounts.low || 1)) * 100) : 0}% of population</span>
            </div>
            <div className="hpv-kpi">
              <div className="hpv-kpi-top"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span className="hpv-kpi-label">Average PMPM Cost</span></div>
              <span className="hpv-kpi-val">{apiLoading ? '...' : `$${pmpmCost.toLocaleString()}`}</span>
            </div>
            <div className="hpv-kpi">
              <span className="hpv-kpi-label">HEDIS Score</span>
              {hedisScore !== null ? <span className="hpv-kpi-val">{hedisScore}%</span> : hedisLoading ? <span className="hpv-kpi-val"><span className="hpv-spinner" /><span className="hpv-kpi-loading-pct">{hedisProgress.total > 0 ? Math.round((hedisProgress.done / hedisProgress.total) * 100) : 0}%</span></span> : <span className="hpv-kpi-val">—</span>}
            </div>
            <div className="hpv-kpi">
              <span className="hpv-kpi-label">Care Gaps</span>
              {hedisCareGaps !== null ? <span className="hpv-kpi-val" style={{ color: '#F59E0B' }}>{hedisCareGaps.toLocaleString()}</span> : hedisLoading ? <span className="hpv-kpi-val"><span className="hpv-spinner" /><span className="hpv-kpi-loading-pct">{hedisProgress.total > 0 ? Math.round((hedisProgress.done / hedisProgress.total) * 100) : 0}%</span></span> : <span className="hpv-kpi-val">—</span>}
            </div>
          </div>
          <div className="hpv-card">
            <h3 className="hpv-card-title">Chronic Condition Clusters</h3>
            <div className="hpv-cluster-list">
              {apiLoading ? <p style={{ color: '#94A3B8', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading...</p> : chronicClusters.length === 0 ? <p style={{ color: '#94A3B8', fontSize: 13 }}>No data</p> : chronicClusters.slice((clusterPage - 1) * ITEMS_PER_PAGE, clusterPage * ITEMS_PER_PAGE).map((c, i) => (
                <div className="hpv-cluster-row" key={i}>
                  <div><span className="hpv-cluster-name">{c.name}</span><span className="hpv-cluster-cost">Avg Cost: {c.cost}</span></div>
                  <span className="hpv-cluster-members">{c.members} members</span>
                </div>
              ))}
            </div>
            {chronicClusters.length > ITEMS_PER_PAGE && (
              <div className="hpv-pagination">
                <button className="hpv-page-btn" disabled={clusterPage <= 1} onClick={() => setClusterPage(clusterPage - 1)}>Prev</button>
                <span className="hpv-page-info">{clusterPage} / {Math.ceil(chronicClusters.length / ITEMS_PER_PAGE)}</span>
                <button className="hpv-page-btn" disabled={clusterPage >= Math.ceil(chronicClusters.length / ITEMS_PER_PAGE)} onClick={() => setClusterPage(clusterPage + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>

        {/* ROW: Risk Tiers + Predictive Risk Scores */}
        <div className="hpv-two-col">
          <div className="hpv-card">
            <h3 className="hpv-card-title">Risk Tiers Distribution</h3>
            <div className="hpv-pie-wrap"><Pie data={riskPieData} options={riskPieOpts} /></div>
            <div className="hpv-pie-legend">
              <div className="hpv-pie-item"><span className="hpv-pie-dot" style={{ background: '#EF4444' }} />High Risk<span className="hpv-pie-count">{riskCounts.high.toLocaleString()}</span></div>
              <div className="hpv-pie-item"><span className="hpv-pie-dot" style={{ background: '#F59E0B' }} />Rising Risk<span className="hpv-pie-count">{riskCounts.rising.toLocaleString()}</span></div>
              <div className="hpv-pie-item"><span className="hpv-pie-dot" style={{ background: '#22C55E' }} />Low Risk<span className="hpv-pie-count">{riskCounts.low.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="hpv-card">
            <h3 className="hpv-card-title">Predictive Risk Scores</h3>
            <div className="hpv-chart-wrap"><Line data={predictiveData} options={predictiveOpts} /></div>
          </div>
        </div>

        {/* ROW: HEDIS + Top Conditions */}
        <div className="hpv-two-col">
          <div className="hpv-card">
            <h3 className="hpv-card-title">HEDIS / Care Gaps Summary</h3>
            {hedisLoading ? (
              <div className="hpv-hedis-loading">
                <span className="hpv-spinner" />
                <span>Calculating HEDIS measures... {hedisProgress.total > 0 ? Math.round((hedisProgress.done / hedisProgress.total) * 100) : 0}%</span>
              </div>
            ) : hedisGaps.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No HEDIS data available</p>
            ) : (<>
              {hedisGaps.slice((hedisPage - 1) * ITEMS_PER_PAGE, hedisPage * ITEMS_PER_PAGE).map((item, i) => (
              <div className="hpv-hedis-row" key={i}>
                <div className="hpv-hedis-left">
                  <span className="hpv-hedis-name">{item.name}</span>
                  <div className="hpv-hedis-counts">
                    <span className="hpv-hedis-compliant">Compliant: {item.compliant.toLocaleString()}</span>
                    <span className="hpv-hedis-gap">Gap: {item.gap}</span>
                  </div>
                </div>
                <span className="hpv-hedis-pct">{item.pct}%</span>
              </div>
              ))}
              {hedisGaps.length > ITEMS_PER_PAGE && (
                <div className="hpv-pagination">
                  <button className="hpv-page-btn" disabled={hedisPage <= 1} onClick={() => setHedisPage(hedisPage - 1)}>Prev</button>
                  <span className="hpv-page-info">{hedisPage} / {Math.ceil(hedisGaps.length / ITEMS_PER_PAGE)}</span>
                  <button className="hpv-page-btn" disabled={hedisPage >= Math.ceil(hedisGaps.length / ITEMS_PER_PAGE)} onClick={() => setHedisPage(hedisPage + 1)}>Next</button>
                </div>
              )}
            </>)}
          </div>
          <div className="hpv-card">
            <h3 className="hpv-card-title">Top Conditions by Cost</h3>
            {apiLoading ? <p style={{ color: '#94A3B8', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading...</p> : topConditions.length === 0 ? <p style={{ color: '#94A3B8', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No data</p> : topConditions.slice((conditionPage - 1) * ITEMS_PER_PAGE, conditionPage * ITEMS_PER_PAGE).map((c, i) => (
              <div className="hpv-condition-row" key={i}>
                <div>
                  <span className="hpv-condition-name">{c.name}</span>
                  <span className="hpv-condition-members">{c.members} members affected</span>
                </div>
                <div className="hpv-condition-cost">
                  <span className="hpv-condition-amount">{c.costDisplay}</span>
                  <span className="hpv-condition-label">Avg cost</span>
                </div>
              </div>
            ))}
            {topConditions.length > ITEMS_PER_PAGE && (
              <div className="hpv-pagination">
                <button className="hpv-page-btn" disabled={conditionPage <= 1} onClick={() => setConditionPage(conditionPage - 1)}>Prev</button>
                <span className="hpv-page-info">{conditionPage} / {Math.ceil(topConditions.length / ITEMS_PER_PAGE)}</span>
                <button className="hpv-page-btn" disabled={conditionPage >= Math.ceil(topConditions.length / ITEMS_PER_PAGE)} onClick={() => setConditionPage(conditionPage + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>

        {/* PROVIDER SCORECARD */}
        <div className="hpv-card hpv-full">
          <h3 className="hpv-card-title">Provider Scorecard</h3>
          <p className="hpv-card-sub">Performance metrics by provider</p>
          {apiLoading ? <p style={{ color: '#94A3B8', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading provider data...</p> : providers.length === 0 ? <p style={{ color: '#94A3B8', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No provider data available</p> : (
          <table className="hpv-table">
            <thead>
              <tr>
                <th>PROVIDER</th><th>PATIENTS</th><th>QUALITY SCORE</th><th>AVG COST PMPM</th><th>SATISFACTION</th><th>PERFORMANCE</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((pr, i) => (
                <tr key={i}>
                  <td className="hpv-table-name">{pr.name}</td>
                  <td>{pr.patients}</td>
                  <td><span className={`hpv-quality-pill ${pr.quality >= 92 ? 'high' : pr.quality >= 90 ? 'med' : 'low'}`}>{pr.quality}%</span></td>
                  <td>{pr.cost}</td>
                  <td>{pr.satisfaction} <span className="hpv-star">★</span></td>
                  <td><div className="hpv-perf-bar-wrap"><div className={`hpv-perf-bar ${pr.perf}`} style={{ width: `${pr.quality}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* UTILIZATION & COST ANALYTICS */}
        <div className="hpv-section-header">
          <h2 className="hpv-section-title">Utilization & Cost Analytics</h2>
        </div>

        <div className="hpv-two-col">
          <div className="hpv-card">
            <h3 className="hpv-card-title">Utilization Trends</h3>
            {utilLoading ? (
              <div className="hpv-hedis-loading" style={{ height: 280 }}>
                <span className="hpv-spinner" />
                <span>Loading utilization data... {utilProgress.total > 0 ? Math.round((utilProgress.done / utilProgress.total) * 100) : 0}%</span>
              </div>
            ) : (
              <div className="hpv-chart-wrap hpv-chart-tall"><Bar data={utilizationData} options={utilizationOpts} /></div>
            )}
          </div>
          <div className="hpv-card">
            <h3 className="hpv-card-title">Cost Trend</h3>
            <div className="hpv-chart-wrap hpv-chart-tall"><Line data={costTrendData} options={costTrendOpts} /></div>
          </div>
        </div>

      </div>
    </div>
  );
}
