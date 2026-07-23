import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import '../styles/healthplan.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

export default function HealthPlanView({ onLogout }) {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);
  const userName = localStorage.getItem('p360_user') || 'Admin';
  const userEmail = localStorage.getItem('p360_email') || '';

  const riskPieData = {
    labels: ['High Risk', 'Rising Risk', 'Low Risk'],
    datasets: [{
      data: [2456, 4912, 17199],
      backgroundColor: ['#EF4444', '#F59E0B', '#22C55E'],
      borderWidth: 0,
    }],
  };
  const riskPieOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const predictiveData = {
    labels: months,
    datasets: [
      { label: 'High Risk', data: [8.5, 8.7, 8.4, 8.6, 8.3, 8.5], borderColor: '#EF4444', backgroundColor: 'transparent', pointRadius: 5, pointBackgroundColor: '#EF4444', tension: 0.3 },
      { label: 'Rising Risk', data: [5.8, 5.9, 6.0, 5.7, 5.8, 6.1], borderColor: '#3B82F6', backgroundColor: 'transparent', pointRadius: 5, pointBackgroundColor: '#3B82F6', tension: 0.3 },
      { label: 'Low Risk', data: [5.2, 5.3, 5.1, 5.4, 5.2, 5.3], borderColor: '#22C55E', backgroundColor: 'transparent', pointRadius: 5, pointBackgroundColor: '#22C55E', tension: 0.3 },
    ],
  };
  const predictiveOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { min: 0, max: 10, ticks: { stepSize: 2 } } },
  };

  const utilizationData = {
    labels: months,
    datasets: [
      { label: 'Outpatient', data: [510, 565, 520, 534, 480, 545], backgroundColor: '#3B82F6' },
      { label: 'ER', data: [85, 130, 95, 142, 110, 90], backgroundColor: '#F59E0B' },
      { label: 'Inpatient', data: [60, 75, 80, 87, 70, 55], backgroundColor: '#EF4444' },
    ],
  };
  const utilizationOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } } },
    scales: { y: { beginAtZero: true, max: 600, ticks: { stepSize: 150 } } },
  };

  const costTrendData = {
    labels: months,
    datasets: [{
      label: 'Cost',
      data: [295000, 310000, 320000, 289000, 305000, 298000],
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
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, max: 320000, ticks: { stepSize: 80000, callback: v => v.toLocaleString() } } },
  };

  const preventiveItems = [
    { name: 'Mammography', pct: 78, target: 75, status: 'On Target' },
    { name: 'Colorectal Screening', pct: 72, target: 70, status: 'On Target' },
    { name: 'Flu Vaccination', pct: 85, target: 80, status: 'On Target' },
    { name: 'Diabetes Screening', pct: 88, target: 85, status: 'On Target' },
    { name: 'Depression Screening', pct: 65, target: 70, status: 'Below Target' },
  ];

  const chronicItems = [
    { name: 'Diabetes (HbA1c <8%)', pct: 82, target: 80, status: 'Controlled' },
    { name: 'Hypertension (<140/90)', pct: 78, target: 75, status: 'Controlled' },
    { name: 'Asthma Control', pct: 85, target: 80, status: 'Controlled' },
    { name: 'COPD Exacerbations', pct: 72, target: 75, status: 'Needs Focus' },
    { name: 'CHF Symptoms', pct: 68, target: 70, status: 'Needs Focus' },
  ];

  const sdohItems = [
    { name: 'Food Insecurity', count: 1234, pct: 25 },
    { name: 'Housing Instability', count: 987, pct: 20 },
    { name: 'Transportation Barriers', count: 1456, pct: 30 },
    { name: 'Social Isolation', count: 2345, pct: 48 },
  ];

  const hedisGaps = [
    { name: 'HbA1c Testing', pct: 84, compliant: 1045, gap: 200 },
    { name: 'Eye Exams (Diabetes)', pct: 72, compliant: 892, gap: 353 },
    { name: 'Blood Pressure Control', pct: 79, compliant: 1678, gap: 456 },
    { name: 'Statin Therapy', pct: 79, compliant: 1234, gap: 321 },
  ];

  const providers = [
    { name: 'Dr. Anderson', patients: 245, quality: 92, cost: '$8,500', satisfaction: 4.8, perf: 'good' },
    { name: 'Dr. Chen', patients: 198, quality: 95, cost: '$7,800', satisfaction: 4.9, perf: 'good' },
    { name: 'Dr. Roberts', patients: 312, quality: 88, cost: '$9,200', satisfaction: 4.6, perf: 'fair' },
    { name: 'Dr. Wilson', patients: 156, quality: 94, cost: '$7,500', satisfaction: 4.7, perf: 'good' },
    { name: 'Dr. Martinez', patients: 223, quality: 90, cost: '$8,800', satisfaction: 4.8, perf: 'good' },
  ];

  const topConditions = [
    { name: 'Diabetes', members: '1,245', cost: '$2.8M' },
    { name: 'Hypertension', members: '2,134', cost: '$1.9M' },
    { name: 'COPD', members: '876', cost: '$3.2M' },
    { name: 'CHF', members: '543', cost: '$4.1M' },
    { name: 'Asthma', members: '1,567', cost: '$1.2M' },
  ];

  const chronicClusters = [
    { name: 'Diabetes + HTN', members: 856, cost: '$12,500' },
    { name: 'COPD + CHF', members: 412, cost: '$18,200' },
    { name: 'Multiple Chronic', members: 623, cost: '$15,800' },
    { name: 'Single Condition', members: 3245, cost: '$6,200' },
  ];

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

        {/* KPI ROW 1 */}
        <div className="hpv-kpi-row">
          <div className="hpv-kpi">
            <div className="hpv-kpi-top"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span className="hpv-kpi-label">Total Members</span></div>
            <span className="hpv-kpi-val">24,567</span>
            <span className="hpv-kpi-change up">↗ +3.2% from last month</span>
          </div>
          <div className="hpv-kpi">
            <div className="hpv-kpi-top"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span className="hpv-kpi-label">High-Risk Members</span></div>
            <span className="hpv-kpi-val" style={{ color: '#EF4444' }}>2,456</span>
            <span className="hpv-kpi-sub">10% of population</span>
          </div>
          <div className="hpv-kpi">
            <div className="hpv-kpi-top"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg><span className="hpv-kpi-label">Rising-Risk Members</span></div>
            <span className="hpv-kpi-val" style={{ color: '#F59E0B' }}>4,912</span>
            <span className="hpv-kpi-sub">20% of population</span>
          </div>
          <div className="hpv-kpi">
            <div className="hpv-kpi-top"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span className="hpv-kpi-label">PMPM Cost</span></div>
            <span className="hpv-kpi-val">$113</span>
            <span className="hpv-kpi-change down">↘ -8.5% vs last month</span>
          </div>
        </div>

        {/* KPI ROW 2 */}
        <div className="hpv-kpi-row">
          <div className="hpv-kpi">
            <span className="hpv-kpi-label">Readmission Rate</span>
            <span className="hpv-kpi-val">8.2%</span>
            <span className="hpv-kpi-change down">↘ Below benchmark</span>
          </div>
          <div className="hpv-kpi">
            <span className="hpv-kpi-label">ED Utilization Rate</span>
            <span className="hpv-kpi-val">142 / 1000</span>
            <span className="hpv-kpi-change down">↘ 5% reduction</span>
          </div>
          <div className="hpv-kpi">
            <span className="hpv-kpi-label">HEDIS Score</span>
            <span className="hpv-kpi-val">78%</span>
            <span className="hpv-kpi-change up">↗ +2% this quarter</span>
          </div>
          <div className="hpv-kpi">
            <span className="hpv-kpi-label">Care Gaps</span>
            <span className="hpv-kpi-val" style={{ color: '#F59E0B' }}>1,330</span>
            <span className="hpv-kpi-change down">↘ -12% reduction</span>
          </div>
        </div>

        {/* 3-COL: Pie + Line + Clusters */}
        <div className="hpv-three-col">
          <div className="hpv-card">
            <h3 className="hpv-card-title">Risk Tiers Distribution</h3>
            <div className="hpv-pie-wrap"><Pie data={riskPieData} options={riskPieOpts} /></div>
            <div className="hpv-pie-legend">
              <div className="hpv-pie-item"><span className="hpv-pie-dot" style={{ background: '#EF4444' }} />High Risk<span className="hpv-pie-count">2,456</span></div>
              <div className="hpv-pie-item"><span className="hpv-pie-dot" style={{ background: '#F59E0B' }} />Rising Risk<span className="hpv-pie-count">4,912</span></div>
              <div className="hpv-pie-item"><span className="hpv-pie-dot" style={{ background: '#22C55E' }} />Low Risk<span className="hpv-pie-count">17,199</span></div>
            </div>
          </div>
          <div className="hpv-card">
            <h3 className="hpv-card-title">Predictive Risk Scores</h3>
            <div className="hpv-chart-wrap"><Line data={predictiveData} options={predictiveOpts} /></div>
          </div>
          <div className="hpv-card">
            <h3 className="hpv-card-title">Chronic Condition Clusters</h3>
            <div className="hpv-cluster-list">
              {chronicClusters.map((c, i) => (
                <div className="hpv-cluster-row" key={i}>
                  <div><span className="hpv-cluster-name">{c.name}</span><span className="hpv-cluster-cost">Avg Cost: {c.cost}</span></div>
                  <span className="hpv-cluster-members">{c.members} members</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2-COL: Preventive + Chronic */}
        <div className="hpv-two-col">
          <div className="hpv-card">
            <h3 className="hpv-card-title">Preventive Risk Assessment</h3>
            {preventiveItems.map((item, i) => (
              <div className="hpv-measure-row" key={i}>
                <div className="hpv-measure-top">
                  <span className="hpv-measure-name">{item.name}</span>
                  <span className={`hpv-measure-badge ${item.status === 'On Target' ? 'on-target' : 'below'}`}>{item.status}</span>
                </div>
                <div className="hpv-measure-bar-wrap">
                  <div className="hpv-measure-bar" style={{ width: `${item.pct}%`, background: item.status === 'On Target' ? '#22C55E' : '#F59E0B' }} />
                </div>
                <span className="hpv-measure-pct">{item.pct}% / {item.target}%</span>
              </div>
            ))}
          </div>
          <div className="hpv-card">
            <h3 className="hpv-card-title">Chronic Condition Control</h3>
            {chronicItems.map((item, i) => (
              <div className="hpv-measure-row" key={i}>
                <div className="hpv-measure-top">
                  <span className="hpv-measure-name">{item.name}</span>
                  <span className={`hpv-measure-badge ${item.status === 'Controlled' ? 'on-target' : 'needs-focus'}`}>{item.status}</span>
                </div>
                <div className="hpv-measure-bar-wrap">
                  <div className="hpv-measure-bar" style={{ width: `${item.pct}%`, background: item.status === 'Controlled' ? '#22C55E' : '#EF4444' }} />
                </div>
                <span className="hpv-measure-pct">{item.pct}% / {item.target}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2-COL: SDOH + HEDIS */}
        <div className="hpv-two-col">
          <div className="hpv-card">
            <h3 className="hpv-card-title">SDOH Risk Indicators</h3>
            <p className="hpv-card-sub">Social determinants of health affecting members</p>
            {sdohItems.map((item, i) => (
              <div className="hpv-sdoh-row" key={i}>
                <span className="hpv-sdoh-name">{item.name}</span>
                <div className="hpv-sdoh-bar-wrap">
                  <div className="hpv-sdoh-bar" style={{ width: `${item.pct}%` }} />
                </div>
                <span className="hpv-sdoh-count">{item.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="hpv-card">
            <h3 className="hpv-card-title">HEDIS / Care Gaps Summary</h3>
            {hedisGaps.map((item, i) => (
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
          </div>
        </div>

        {/* PROVIDER SCORECARD */}
        <div className="hpv-card hpv-full">
          <h3 className="hpv-card-title">Provider Scorecard</h3>
          <p className="hpv-card-sub">Performance metrics by provider</p>
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
                  <td><div className="hpv-perf-bar-wrap"><div className={`hpv-perf-bar ${pr.perf}`} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* UTILIZATION & COST ANALYTICS */}
        <div className="hpv-section-header">
          <h2 className="hpv-section-title">Utilization & Cost Analytics</h2>
        </div>

        <div className="hpv-kpi-row">
          <div className="hpv-kpi">
            <div className="hpv-kpi-top"><span className="hpv-kpi-label">Total Members</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <span className="hpv-kpi-val">24,567</span>
            <span className="hpv-kpi-change up">↗ +3.2% from last month</span>
          </div>
          <div className="hpv-kpi">
            <div className="hpv-kpi-top"><span className="hpv-kpi-label">Monthly Cost</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
            <span className="hpv-kpi-val">$2.78M</span>
            <span className="hpv-kpi-change down">↘ -5.8% from last month</span>
          </div>
          <div className="hpv-kpi">
            <div className="hpv-kpi-top"><span className="hpv-kpi-label">Avg PMPM</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
            <span className="hpv-kpi-val">$113</span>
            <span className="hpv-kpi-change down">↘ -8.5% from last month</span>
          </div>
          <div className="hpv-kpi">
            <div className="hpv-kpi-top"><span className="hpv-kpi-label">High Risk Members</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
            <span className="hpv-kpi-val">2,134</span>
            <span className="hpv-kpi-change up-red">↗ +1.2% from last month</span>
          </div>
        </div>

        <div className="hpv-two-col">
          <div className="hpv-card">
            <h3 className="hpv-card-title">Utilization Trends</h3>
            <div className="hpv-chart-wrap hpv-chart-tall"><Bar data={utilizationData} options={utilizationOpts} /></div>
          </div>
          <div className="hpv-card">
            <h3 className="hpv-card-title">Cost Trend</h3>
            <div className="hpv-chart-wrap hpv-chart-tall"><Line data={costTrendData} options={costTrendOpts} /></div>
          </div>
        </div>

        {/* TOP CONDITIONS BY COST */}
        <div className="hpv-card hpv-full">
          <h3 className="hpv-card-title">Top Conditions by Cost</h3>
          {topConditions.map((c, i) => (
            <div className="hpv-condition-row" key={i}>
              <div>
                <span className="hpv-condition-name">{c.name}</span>
                <span className="hpv-condition-members">{c.members} members affected</span>
              </div>
              <div className="hpv-condition-cost">
                <span className="hpv-condition-amount">{c.cost}</span>
                <span className="hpv-condition-label">Total cost</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
