import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { callFhirApi, buildUrl } from '../services/fhir';
import { FHIR_BASE } from '../config/constants';
import '../styles/caremanager.css';

function nameFromEmail(email) {
  if (!email) return '';
  const local = email.split('@')[0];
  return local.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

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

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!cmId) return;
    loadData();
  }, [cmId]);

  async function loadData() {
    setLoading(true);
    try {
      const orgRes = await callFhirApi(`${FHIR_BASE}/baseR4/Organization/by-care-manager?_id=${cmId}`);
      const orgList = (orgRes?.entry || []).map(e => {
        const r = e.resource;
        return {
          id: r.id,
          name: r.name || 'Unknown Organization',
          type: r.type?.[0]?.coding?.[0]?.display || '',
          city: r.address?.[0]?.city || '',
          state: r.address?.[0]?.state || '',
        };
      });
      const uniqueOrgs = orgList.filter((o, i, arr) => arr.findIndex(x => x.id === o.id) === i);
      setOrgs(uniqueOrgs);

      const eocRes = await callFhirApi(`${FHIR_BASE}/baseR4/EpisodeOfCare?care-manager=${cmId}&page=0&size=100`);
      const patientIds = new Set();
      (eocRes?.entry || []).forEach(e => {
        const patRef = e.resource?.patient?.reference?.replace('Patient/', '');
        if (patRef) patientIds.add(patRef);
      });

      const patientMap = {};
      await Promise.all([...patientIds].map(async pid => {
        try {
          const pt = await callFhirApi(buildUrl('/baseR4/Patient/find', { id: pid }));
          const res = pt?.resourceType === 'Patient' ? pt : pt?.entry?.[0]?.resource;
          if (!res) return;
          const given = res.name?.[0]?.given?.join(' ') || '';
          const family = res.name?.[0]?.family || '';
          const disease = (res.extension || []).find(x => x.url === 'disease')?.valueString || '';
          const birthDate = res.birthDate || '';
          const age = birthDate ? Math.floor((Date.now() - new Date(birthDate)) / 31557600000) : '';
          const orgRef = res.managingOrganization?.reference?.replace('Organization/', '') || '';
          patientMap[pid] = { id: pid, name: `${given} ${family}`.trim(), age, condition: disease, orgId: orgRef };
        } catch {}
      }));

      const grouped = {};
      for (const p of Object.values(patientMap)) {
        if (!p.orgId) continue;
        if (!grouped[p.orgId]) grouped[p.orgId] = [];
        grouped[p.orgId].push(p);
      }
      setOrgPatients(grouped);
    } catch {}
    setLoading(false);
  }

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOrgData = orgs.find(o => o.id === selectedOrg);
  const patients = selectedOrg ? (orgPatients[selectedOrg] || []) : [];

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
            <input type="text" placeholder="Search organizations..." value={search} onChange={e => setSearch(e.target.value)} className="cm-search-input" />
          </div>

          <div className="cm-org-list">
            {loading ? (
              <div className="cm-empty-state"><p className="cm-empty-sub">Loading organizations...</p></div>
            ) : filtered.length > 0 ? (
              filtered.map((org) => (
                <div
                  className={`cm-org-card${selectedOrg === org.id ? ' cm-org-active' : ''}`}
                  key={org.id}
                  onClick={() => setSelectedOrg(org.id)}
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
                    {(orgPatients[org.id] || []).length} patients
                  </div>
                </div>
              ))
            ) : (
              <div className="cm-empty-state"><p className="cm-empty-sub">No organizations found</p></div>
            )}
          </div>
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
              <div className="cm-patients-header">
                <h2 className="cm-patients-title">{selectedOrgData?.name || 'Organization'}</h2>
                <span className="cm-patients-count">{patients.length} Patients</span>
              </div>
              {patients.length === 0 ? (
                <div className="cm-empty-state">
                  <p className="cm-empty-sub">No patients found for this organization</p>
                </div>
              ) : (
                <div className="cm-patient-list">
                  {patients.map((p) => (
                    <div className="cm-patient-card" key={p.id}>
                      <div className="cm-patient-avatar">
                        {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="cm-patient-info">
                        <span className="cm-patient-name">{p.name}</span>
                        <span className="cm-patient-details">{p.age ? `Age ${p.age}` : ''}{p.condition ? ` · ${p.condition}` : ''}</span>
                      </div>
                      <div className="cm-patient-actions">
                        <button className="cm-action-btn cm-view-btn" onClick={() => navigate(`/patient-view?id=${p.id}`)}>View</button>
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
