import { useState, useEffect } from 'react';
import { USERS_URL } from '../config/constants';
import '../styles/admin.css';

const ROLE_OPTIONS = ['PATIENT', 'PROVIDER', 'CARE_MANAGER'];

function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${localStorage.getItem('p360_token')}`,
    'Content-Type': 'application/json'
  };
}

export default function AdminPanel({ isOpen, onClose }) {
  const [tab, setTab] = useState('users');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const [form, setForm] = useState({ email: '', password: '', role: 'PATIENT', patientRefId: '', practitionerRefId: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  useEffect(() => {
    if (isOpen && tab === 'users') fetchUsers();
  }, [isOpen, tab]);

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch(USERS_URL, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {}
    setUsersLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormLoading(true);
    setFormMsg('');
    try {
      const res = await fetch(USERS_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      if (res.ok || res.status === 201) {
        setFormMsg('User created successfully');
        setForm({ email: '', password: '', role: 'PATIENT', patientRefId: '', practitionerRefId: '' });
        fetchUsers();
      } else {
        const err = await res.text();
        setFormMsg(`Failed: ${err}`);
      }
    } catch (err) {
      setFormMsg(`Error: ${err.message}`);
    }
    setFormLoading(false);
  }

  async function handleViewUser(userId) {
    setDetailLoading(true);
    setDeleteConfirm(false);
    try {
      const res = await fetch(`${USERS_URL}/${userId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data);
      }
    } catch {}
    setDetailLoading(false);
  }

  async function handleDelete(userId) {
    setActionMsg('');
    try {
      const res = await fetch(`${USERS_URL}/${userId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok || res.status === 204) {
        setActionMsg('User deactivated');
        setSelectedUser(null);
        fetchUsers();
      } else {
        setActionMsg('Failed to deactivate');
      }
    } catch {
      setActionMsg('Error deactivating user');
    }
    setDeleteConfirm(false);
  }

  const activeUsers = users.filter(u => u.isActive && u.role !== 'ADMIN');
  const filteredUsers = roleFilter === 'ALL' ? activeUsers : activeUsers.filter(u => u.role === roleFilter);

  if (!isOpen) return null;

  return (
    <div className="ap-overlay" onClick={onClose}>
      <div className="ap-panel" onClick={e => e.stopPropagation()}>
        <div className="ap-header">
          <h2 className="ap-title">User Management</h2>
          <button className="ap-close" onClick={onClose}>×</button>
        </div>

        <div className="ap-tabs">
          <button className={`ap-tab${tab === 'users' ? ' active' : ''}`} onClick={() => { setTab('users'); setSelectedUser(null); }}>All Users</button>
          <button className={`ap-tab${tab === 'create' ? ' active' : ''}`} onClick={() => setTab('create')}>Onboard User</button>
        </div>

        {tab === 'users' && !selectedUser && (
          <>
            <div className="ap-role-filters">
              {['ALL', ...ROLE_OPTIONS].map(r => (
                <button key={r} className={`ap-role-btn${roleFilter === r ? ' active' : ''}`} onClick={() => setRoleFilter(r)}>
                  {r === 'CARE_MANAGER' ? 'Care Mgr' : r.charAt(0) + r.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {actionMsg && <div className="ap-msg ap-msg-green">{actionMsg}</div>}

            {usersLoading ? (
              <div className="ap-loading">Loading users...</div>
            ) : filteredUsers.length > 0 ? (
              <div className="ap-user-list">
                {filteredUsers.map(u => (
                  <div className="ap-user-card" key={u.id}>
                    <div className="ap-user-avatar">{(u.email || '?')[0].toUpperCase()}</div>
                    <div className="ap-user-info">
                      <span className="ap-user-email">{u.email}</span>
                      <span className="ap-user-meta">
                        <span className={`ap-role-pill ap-role-${u.role?.toLowerCase()}`}>{u.role}</span>
                        <span className={`ap-status-dot ${u.isActive ? 'active' : 'inactive'}`}></span>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <button className="ap-view-btn" onClick={() => handleViewUser(u.id)}>View</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ap-empty">No users found</div>
            )}
          </>
        )}

        {tab === 'users' && selectedUser && (
          <div className="ap-detail">
            {detailLoading ? (
              <div className="ap-loading">Loading...</div>
            ) : (
              <>
                <button className="ap-back-btn" onClick={() => setSelectedUser(null)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                  Back to list
                </button>
                <div className="ap-detail-card">
                  <div className="ap-detail-row"><span className="ap-detail-label">Email</span><span>{selectedUser.email}</span></div>
                  <div className="ap-detail-row"><span className="ap-detail-label">Role</span><span className={`ap-role-pill ap-role-${selectedUser.role?.toLowerCase()}`}>{selectedUser.role}</span></div>
                  <div className="ap-detail-row"><span className="ap-detail-label">Status</span><span>{selectedUser.isActive ? 'Active' : 'Inactive'}</span></div>
                  <div className="ap-detail-row"><span className="ap-detail-label">User ID</span><span className="ap-detail-id">{selectedUser.id}</span></div>
                  {selectedUser.patientRefId && <div className="ap-detail-row"><span className="ap-detail-label">Patient Ref ID</span><span className="ap-detail-id">{selectedUser.patientRefId}</span></div>}
                  {selectedUser.practitionerRefId && <div className="ap-detail-row"><span className="ap-detail-label">Practitioner/Manager Ref ID</span><span className="ap-detail-id">{selectedUser.practitionerRefId}</span></div>}
                  {selectedUser.createdAt && <div className="ap-detail-row"><span className="ap-detail-label">Created</span><span>{new Date(selectedUser.createdAt).toLocaleString()}</span></div>}
                  {selectedUser.lastLoginAt && <div className="ap-detail-row"><span className="ap-detail-label">Last Login</span><span>{new Date(selectedUser.lastLoginAt).toLocaleString()}</span></div>}
                </div>

                {actionMsg && <div className="ap-msg ap-msg-green">{actionMsg}</div>}

                {!deleteConfirm ? (
                  <button className="ap-delete-btn" onClick={() => setDeleteConfirm(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Deactivate User
                  </button>
                ) : (
                  <div className="ap-confirm">
                    <p>Are you sure you want to deactivate this user?</p>
                    <div className="ap-confirm-btns">
                      <button className="ap-confirm-yes" onClick={() => handleDelete(selectedUser.id)}>Yes, Deactivate</button>
                      <button className="ap-confirm-no" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'create' && (
          <form className="ap-form" onSubmit={handleCreate}>
            <div className="ap-field">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
            </div>
            <div className="ap-field">
              <label>Password</label>
              <input type="text" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Enter password" />
            </div>
            <div className="ap-field">
              <label>Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="ap-field">
              <label>Patient Ref ID</label>
              <input type="text" value={form.patientRefId} onChange={e => setForm({ ...form, patientRefId: e.target.value })} placeholder="UUID (for PATIENT role)" disabled={form.role !== 'PATIENT'} className={form.role !== 'PATIENT' ? 'ap-disabled' : ''} />
            </div>
            <div className="ap-field">
              <label>Practitioner/Manager Ref ID</label>
              <input type="text" value={form.practitionerRefId} onChange={e => setForm({ ...form, practitionerRefId: e.target.value })} placeholder="UUID (for PROVIDER/CARE_MANAGER)" disabled={form.role === 'PATIENT'} className={form.role === 'PATIENT' ? 'ap-disabled' : ''} />
            </div>

            {formMsg && <div className={`ap-msg ${formMsg.startsWith('User created') ? 'ap-msg-green' : 'ap-msg-red'}`}>{formMsg}</div>}

            <button type="submit" className="ap-submit" disabled={formLoading}>
              {formLoading ? 'Creating...' : 'Create User'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
