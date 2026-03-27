import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { colors, radii, font, card, shadows, btn } from './theme';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

function authHeader() {
  const token = localStorage.getItem('authToken');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const ROLE_COLORS = {
  admin:   { bg: '#ede9fe', fg: '#7c3aed' },
  teacher: { bg: '#dbeafe', fg: '#1d4ed8' },
  student: { bg: '#dcfce7', fg: '#16a34a' },
};

const RoleBadge = ({ role }) => {
  const { bg, fg } = ROLE_COLORS[role] || { bg: '#f3f4f6', fg: '#6b7280' };
  return (
    <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>
      {role}
    </span>
  );
};

export default function AdminDashboard() {
  const { isAdmin, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('classrooms'); // 'classrooms' | 'users'

  // --- Classrooms state ---
  const [classrooms, setClassrooms]             = useState([]);
  const [classroomsLoading, setClassroomsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm]       = useState(null); // classroom id to confirm

  // --- Users state ---
  const [users, setUsers]           = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleEditing, setRoleEditing] = useState(null); // { userId, newRole }
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (!loading && (!isAuthenticated || !isAdmin)) navigate('/home');
  }, [loading, isAuthenticated, isAdmin, navigate]);

  // Load classrooms
  const loadClassrooms = useCallback(async () => {
    setClassroomsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/classrooms`, { headers: authHeader() });
      if (res.ok) setClassrooms(await res.json());
    } finally {
      setClassroomsLoading(false);
    }
  }, []);

  // Load users
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, { headers: authHeader() });
      if (res.ok) setUsers(await res.json());
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) { loadClassrooms(); loadUsers(); } }, [isAdmin, loadClassrooms, loadUsers]);

  // Delete classroom
  async function deleteClassroom(id) {
    await fetch(`${API_BASE}/admin/classrooms/${id}`, { method: 'DELETE', headers: authHeader() });
    setDeleteConfirm(null);
    loadClassrooms();
  }

  // Update user role
  async function updateRole(userId, newRole) {
    await fetch(`${API_BASE}/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: authHeader(),
      body: JSON.stringify({ role: newRole }),
    });
    setRoleEditing(null);
    loadUsers();
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading...</div>;

  const tdStyle = { padding: '10px 14px', fontSize: font.sizeSm, color: colors.text, borderBottom: `1px solid ${colors.border}` };
  const thStyle = { padding: '10px 14px', fontSize: font.sizeSm, fontWeight: font.weightBold, color: colors.textSecondary, borderBottom: `2px solid ${colors.border}`, background: colors.background, textAlign: 'left', whiteSpace: 'nowrap' };

  const tabBtn = (key, label, icon) => (
    <button
      onClick={() => setTab(key)}
      style={{
        padding: '10px 24px', borderRadius: radii.sm, border: 'none', cursor: 'pointer',
        fontWeight: tab === key ? 700 : 400,
        background: tab === key ? colors.primary : 'transparent',
        color: tab === key ? '#fff' : colors.textSecondary,
        fontSize: font.sizeMd, transition: 'all 0.15s',
      }}
    >{icon} {label}</button>
  );

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: font.sizeXxl, fontWeight: font.weightBold, color: colors.primary, marginBottom: 4 }}>🛡️ Admin Panel</h2>
      <p style={{ color: colors.textMuted, marginBottom: 24, marginTop: 0 }}>Manage all classrooms and user accounts.</p>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total Classrooms', value: classrooms.length, color: colors.primary },
          { label: 'Total Users',      value: users.length,      color: '#16a34a' },
          { label: 'Teachers',         value: users.filter(u => u.role === 'teacher').length, color: '#1d4ed8' },
          { label: 'Students',         value: users.filter(u => u.role === 'student').length, color: '#ca8a04' },
          { label: 'Admins',           value: users.filter(u => u.role === 'admin').length,   color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: '14px 16px' }}>
            <div style={{ fontSize: font.sizeXs, color: colors.textMuted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: font.sizeXl, fontWeight: font.weightBold, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: colors.background, borderRadius: radii.md, padding: 4, width: 'fit-content', border: `1px solid ${colors.border}` }}>
        {tabBtn('classrooms', 'All Classrooms', '🏫')}
        {tabBtn('users',      'User Accounts',  '👥')}
      </div>

      {/* ── CLASSROOMS TAB ── */}
      {tab === 'classrooms' && (
        <div style={{ ...card, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: font.sizeLg }}>All Classrooms ({classrooms.length})</h3>
          {classroomsLoading ? (
            <p style={{ color: colors.textMuted }}>Loading...</p>
          ) : classrooms.length === 0 ? (
            <p style={{ color: colors.textMuted }}>No classrooms yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Classroom</th>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Teacher</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Students</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Created</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classrooms.map(cls => (
                    <tr key={cls.id}
                      onMouseEnter={e => e.currentTarget.style.background = colors.background}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: font.weightSemibold }}>{cls.name}</div>
                        {cls.description && <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{cls.description}</div>}
                      </td>
                      <td style={tdStyle}>
                        <code style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
                          {cls.class_code}
                        </code>
                      </td>
                      <td style={tdStyle}>
                        <div>{cls.teacher_name || '—'}</div>
                        <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{cls.teacher_email}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{cls.student_count}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontSize: font.sizeXs, color: colors.textMuted }}>
                        {new Date(cls.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {deleteConfirm === cls.id ? (
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button onClick={() => deleteClassroom(cls.id)}
                              style={{ padding: '3px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: radii.sm, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Confirm</button>
                            <button onClick={() => setDeleteConfirm(null)}
                              style={{ padding: '3px 10px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeleteConfirm(cls.id)}
                            style={{ padding: '3px 12px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: radii.sm, cursor: 'pointer', fontSize: 12 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                          >🗑 Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: font.sizeLg }}>User Accounts ({filteredUsers.length})</h3>
            <input
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              style={{ padding: '8px 14px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, width: 240, outline: 'none' }}
            />
          </div>
          {usersLoading ? (
            <p style={{ color: colors.textMuted }}>Loading...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Name / Email</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Role</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Joined</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Change Role</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}
                      onMouseEnter={e => e.currentTarget.style.background = colors.background}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: font.weightSemibold }}>{u.full_name || '(no name)'}</div>
                        <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{u.email}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><RoleBadge role={u.role} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontSize: font.sizeXs, color: colors.textMuted }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {roleEditing?.userId === u.id ? (
                          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <select
                              value={roleEditing.newRole}
                              onChange={e => setRoleEditing({ userId: u.id, newRole: e.target.value })}
                              style={{ padding: '4px 8px', borderRadius: radii.sm, border: `1px solid ${colors.border}`, fontSize: font.sizeSm }}
                            >
                              <option value="student">student</option>
                              <option value="teacher">teacher</option>
                              <option value="admin">admin</option>
                            </select>
                            <button onClick={() => updateRole(u.id, roleEditing.newRole)}
                              style={{ padding: '3px 10px', background: colors.primary, color: '#fff', border: 'none', borderRadius: radii.sm, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Save</button>
                            <button onClick={() => setRoleEditing(null)}
                              style={{ padding: '3px 10px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', fontSize: 12 }}>✕</button>
                          </span>
                        ) : (
                          <button onClick={() => setRoleEditing({ userId: u.id, newRole: u.role })}
                            style={{ padding: '3px 12px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', fontSize: 12, color: colors.textSecondary }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = colors.primary; e.currentTarget.style.color = colors.primary; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textSecondary; }}
                          >✏️ Edit Role</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
