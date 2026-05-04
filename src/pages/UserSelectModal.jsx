import { useState, useEffect } from 'react';
import { USERS_URL } from '../config/constants';
import '../styles/admin.css';

const ROLE_LABEL = {
  PATIENT: 'Select a Patient',
  PROVIDER: 'Select a Provider',
  CARE_MANAGER: 'Select a Care Manager',
};

export default function UserSelectModal({ role, onSelect, onClose }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(USERS_URL, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('p360_token')}`,
            'Content-Type': 'application/json'
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUsers((Array.isArray(data) ? data : []).filter(u => u.role === role && u.isActive));
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [role]);

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.patientRefId || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="usm-overlay" onClick={onClose}>
      <div className="usm-modal" onClick={e => e.stopPropagation()}>
        <div className="usm-header">
          <h3>{ROLE_LABEL[role] || 'Select User'}</h3>
          <button className="usm-close" onClick={onClose}>×</button>
        </div>
        <div className="usm-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search by email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="usm-list">
          {loading ? (
            <div className="usm-loading">Loading...</div>
          ) : filtered.length > 0 ? (
            filtered.map(u => (
              <div className="usm-item" key={u.id} onClick={() => onSelect(u)}>
                <div className="usm-avatar">{(u.email || '?')[0].toUpperCase()}</div>
                <div className="usm-info">
                  <span className="usm-email">{u.email}</span>
                  <span className="usm-ref">{u.patientRefId || u.practitionerRefId || ''}</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            ))
          ) : (
            <div className="usm-empty">No {role.toLowerCase().replace('_', ' ')}s found</div>
          )}
        </div>
      </div>
    </div>
  );
}
