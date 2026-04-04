import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { colors, radii, font, card, shadows, btn } from './theme';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
// --- AdminClassroomFiles inline component ---
function AdminClassroomFiles({ classroomId, token }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef();

  const headers = { Authorization: `Bearer ${token}` };

  const refresh = () =>
    fetch(`/classrooms/${classroomId}/files`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setFiles)
      .catch(() => {});

  useEffect(() => { refresh(); }, [classroomId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    await fetch(`/classrooms/${classroomId}/files/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    await refresh();
    setUploading(false);
    fileInputRef.current.value = '';
  };

  const handleDelete = async (fileId, filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    await fetch(`/classrooms/${classroomId}/files/${fileId}`, { method: 'DELETE', headers });
    await refresh();
  };

  const handleDownload = (fileId, filename) => {
    const a = document.createElement('a');
    a.href = `/classrooms/${classroomId}/files/${fileId}/download`;
    a.download = filename;
    a.target = '_blank';
    a.click();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>📄 Classroom Documents</strong>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md"
          style={{ display: 'none' }} id={`upload-${classroomId}`} onChange={handleUpload} disabled={uploading} />
        <label htmlFor={`upload-${classroomId}`}
          style={{ padding: '4px 12px', background: colors.primary, color: '#fff', borderRadius: radii.sm, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
          {uploading ? 'Uploading...' : '+ Upload'}
        </label>
      </div>
      {files.length === 0 ? (
        <p style={{ fontSize: 12, color: colors.textMuted, margin: 0 }}>No files uploaded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: radii.sm }}>
              <span style={{ fontSize: 12, flex: 1 }}>{f.mime_type?.includes('pdf') ? '📄' : '📝'} {f.filename}</span>
              <span style={{ fontSize: 11, color: colors.textMuted }}>{f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ''}</span>
              <button onClick={() => handleDownload(f.id, f.filename)}
                style={{ padding: '2px 8px', fontSize: 11, border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', background: 'transparent' }}>↓</button>
              <button onClick={() => handleDelete(f.id, f.filename)}
                style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #ef4444', color: '#ef4444', borderRadius: radii.sm, cursor: 'pointer', background: 'transparent' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [tab, setTab] = useState('classrooms'); // 'classrooms' | 'users' | 'files'

  // --- Classrooms state ---
  const [classrooms, setClassrooms]             = useState([]);
  const [classroomsLoading, setClassroomsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm]       = useState(null); // classroom id to confirm
  const [deleteLoading, setDeleteLoading]       = useState(null); // classroom id being deleted
  // REMOVED expandedFilesId and file manager logic (now handled in classroom detail page)
  const [expandedStudentsId, setExpandedStudentsId] = useState(null); // classroom id for students panel
  const [classroomStudents, setClassroomStudents] = useState({}); // { [classroomId]: students[] from analytics }

  // --- Users state ---
  const [users, setUsers]           = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleEditing, setRoleEditing] = useState(null); // { userId, newRole }
  const [userSearch, setUserSearch] = useState('');
  const [userEditing, setUserEditing] = useState(null); // { id, full_name, email, newPassword: '' }
  const [userEditLoading, setUserEditLoading] = useState(false);
  const [userEditError, setUserEditError] = useState(null);
  const [userEditSuccess, setUserEditSuccess] = useState(false);
  // Load students for a classroom
  const loadClassroomStudents = useCallback(async (classroomId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/classrooms/${classroomId}/students`, { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        // data is now the full analytics object with data.students[]
        setClassroomStudents(prev => ({ ...prev, [classroomId]: data.students || [] }));
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!loading && (!isAuthenticated || !isAdmin)) navigate('/');
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
    try {
      setDeleteLoading(id);
      const res = await fetch(`${API_BASE}/admin/classrooms/${id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) {
        throw new Error('Failed to delete classroom');
      }
      setDeleteConfirm(null);
      loadClassrooms();
    } catch (err) {
      alert('Error: ' + (err.message || 'Failed to delete classroom'));
    } finally {
      setDeleteLoading(null);
    }
  }

  // Update user role
  async function updateRole(userId, newRole) {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert('Error: ' + (err.detail || 'Failed to update role'));
        return;
      }
      setRoleEditing(null);
      loadUsers();
    } catch (err) {
      alert('Error: ' + (err.message || 'Failed to update role'));
    }
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
        {tabBtn('files',      'Classroom Files', '📄')}
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
                  {classrooms.map(cls => [
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
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {/* View & Files (merged) */}
                          <button
                            onClick={() => navigate(`/classrooms/${cls.id}`)}
                            style={{ padding: '3px 10px', background: 'transparent', border: `1px solid ${colors.primary}`, color: colors.primary, borderRadius: radii.sm, cursor: 'pointer', fontSize: 12 }}
                            onMouseEnter={e => { e.currentTarget.style.background = colors.primary; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.primary; }}
                          >📄 View & Files</button>
                          {/* Toggle students panel */}
                          <button
                            onClick={() => {
                              const next = expandedStudentsId === cls.id ? null : cls.id;
                              setExpandedStudentsId(next);
                              if (next && !classroomStudents[cls.id]) loadClassroomStudents(cls.id);
                            }}
                            style={{ padding: '3px 10px', background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textSecondary, borderRadius: radii.sm, cursor: 'pointer', fontSize: 12 }}
                          >👥 Students</button>
                          {/* Delete */}
                          {deleteConfirm === cls.id ? (
                            <span style={{ display: 'inline-flex', gap: 4 }}>
                              <button onClick={() => deleteClassroom(cls.id)}
                                disabled={deleteLoading === cls.id}
                                style={{ padding: '3px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: radii.sm, cursor: deleteLoading === cls.id ? 'not-allowed' : 'pointer', fontSize: 12, opacity: deleteLoading === cls.id ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {deleteLoading === cls.id ? (
                                  <>
                                    <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                                    Deleting...
                                  </>
                                ) : 'Confirm'}
                              </button>
                              <button onClick={() => setDeleteConfirm(null)}
                                disabled={deleteLoading === cls.id}
                                style={{ padding: '3px 8px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: deleteLoading === cls.id ? 'not-allowed' : 'pointer', fontSize: 12, opacity: deleteLoading === cls.id ? 0.5 : 1 }}>Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteConfirm(cls.id)}
                              style={{ padding: '3px 10px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: radii.sm, cursor: 'pointer', fontSize: 12 }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                            >🗑 Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>,
                   
                    expandedStudentsId === cls.id && (
                    <tr key={cls.id + '-students'}>
                        <td colSpan={6} style={{ padding: '16px', background: '#f0fdf4', borderBottom: `1px solid ${colors.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <strong style={{ fontSize: 14 }}>👥 {cls.name} — Student Performance</strong>
                            <span style={{ fontSize: 12, color: colors.textMuted }}>
                            {classroomStudents[cls.id]?.length ?? 0} student(s)
                            </span>
                        </div>

                        {!classroomStudents[cls.id] ? (
                            <p style={{ fontSize: 12, color: colors.textMuted }}>Loading...</p>
                        ) : classroomStudents[cls.id].length === 0 ? (
                            <p style={{ fontSize: 12, color: colors.textMuted }}>No students enrolled yet.</p>
                        ) : (() => {
                            const students = classroomStudents[cls.id];

                            // Class summary stats
                            const withScores = students.filter(s => s.avg_quiz_score != null);
                            const classAvg = withScores.length
                            ? Math.round(withScores.reduce((sum, s) => sum + s.avg_quiz_score, 0) / withScores.length)
                            : null;
                            const totalAttempted = students.reduce((s, st) => s + (st.quizzes_attempted || 0), 0);
                            const totalPassed = students.reduce((s, st) => s + (st.quizzes_passed || 0), 0);
                            const classPassRate = totalAttempted > 0 ? Math.round(totalPassed / totalAttempted * 100) : null;
                            const atRisk = students.filter(s => {
                            const rate = s.quizzes_attempted > 0 ? s.quizzes_passed / s.quizzes_attempted * 100 : null;
                            return rate !== null && rate < 40;
                            }).length;

                            return (
                            <>
                                {/* Class summary bar */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
                                {[
                                    { label: 'Class Avg Score', value: classAvg != null ? `${classAvg}%` : '—', color: classAvg >= 70 ? '#16a34a' : classAvg >= 50 ? '#ca8a04' : '#dc2626' },
                                    { label: 'Exercise Pass Rate', value: classPassRate != null ? `${classPassRate}%` : '—', color: classPassRate >= 60 ? '#16a34a' : '#ca8a04' },
                                    { label: 'Students At Risk', value: atRisk, color: atRisk > 0 ? '#dc2626' : '#16a34a' },
                                    { label: 'Total Students', value: students.length, color: colors.primary },
                                ].map(stat => (
                                    <div key={stat.label} style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: radii.sm, padding: '10px 12px' }}>
                                    <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>{stat.label}</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                                    </div>
                                ))}
                                </div>

                                {/* Student table */}
                                <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                    <tr style={{ background: '#dcfce7' }}>
                                        {['Status', 'Student', 'Avg Score', 'Ex. Pass Rate', 'Ch. Pass Rate', 'Topics Done', 'AI Chats', 'Last Active'].map(h => (
                                        <th key={h} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#16a34a', textAlign: h === 'Student' ? 'left' : 'center', borderBottom: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {students.map(s => {
                                        const exRate = s.quizzes_attempted > 0 ? Math.round(s.quizzes_passed / s.quizzes_attempted * 100) : null;
                                        const chRate = s.tests_attempted > 0 ? Math.round(s.tests_passed / s.tests_attempted * 100) : null;
                                        const isAtRisk = (exRate !== null && exRate < 40) || (chRate !== null && chRate < 40);
                                        const needsAttention = (exRate !== null && exRate < 60) || (chRate !== null && chRate < 60);
                                        const status = isAtRisk ? { dot: '🔴', label: 'At Risk', color: '#dc2626' }
                                        : needsAttention ? { dot: '🟡', label: 'Needs Attention', color: '#ca8a04' }
                                        : (s.quizzes_attempted > 0 || s.tests_attempted > 0) ? { dot: '🟢', label: 'On Track', color: '#16a34a' }
                                        : { dot: '⚪', label: 'No Activity', color: '#9ca3af' };

                                        const tdS = { padding: '7px 12px', fontSize: 12, borderBottom: '1px solid #f0fdf4', textAlign: 'center' };

                                        return (
                                        <tr key={s.student_id}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={tdS}>
                                            <span title={status.label} style={{ fontSize: 11, fontWeight: 600, color: status.color }}>
                                                {status.dot} {status.label}
                                            </span>
                                            </td>
                                            <td style={{ ...tdS, textAlign: 'left' }}>
                                            <div style={{ fontWeight: 600 }}>{s.full_name || '—'}</div>
                                            <div style={{ fontSize: 11, color: colors.textMuted }}>{s.email}</div>
                                            </td>
                                            <td style={tdS}>
                                            {s.avg_quiz_score != null
                                                ? <span style={{ fontWeight: 700, color: s.avg_quiz_score >= 70 ? '#16a34a' : s.avg_quiz_score >= 50 ? '#ca8a04' : '#dc2626' }}>{s.avg_quiz_score}%</span>
                                                : <span style={{ color: '#9ca3af' }}>—</span>}
                                            </td>
                                            <td style={tdS}>
                                            {exRate != null
                                                ? <span style={{ fontWeight: 700, color: exRate >= 60 ? '#16a34a' : exRate >= 40 ? '#ca8a04' : '#dc2626' }}>
                                                    {s.quizzes_passed}/{s.quizzes_attempted} ({exRate}%)
                                                </span>
                                                : <span style={{ color: '#9ca3af' }}>—</span>}
                                            </td>
                                            <td style={tdS}>
                                            {chRate != null
                                                ? <span style={{ fontWeight: 700, color: chRate >= 60 ? '#16a34a' : chRate >= 40 ? '#ca8a04' : '#dc2626' }}>
                                                    {s.tests_passed}/{s.tests_attempted} ({chRate}%)
                                                </span>
                                                : <span style={{ color: '#9ca3af' }}>—</span>}
                                            </td>
                                            <td style={tdS}>{s.completed_topics ?? 0}</td>
                                            <td style={tdS}>{s.ai_interactions ?? '—'}</td>
                                            <td style={{ ...tdS, fontSize: 11, color: colors.textMuted }}>
                                            {s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                                </div>
                            </>
                            );
                        })()}
                        </td>
                    </tr>
                    )
                  ])}
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
                    <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
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
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => setUserEditing({ id: u.id, full_name: u.full_name || '', email: u.email, newPassword: '' })}
                          style={{ padding: '3px 12px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', fontSize: 12, color: colors.textSecondary }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = colors.primary; e.currentTarget.style.color = colors.primary; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textSecondary; }}
                        >✏️ Edit User</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* User Edit Modal */}
          {userEditing && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => !userEditLoading && setUserEditing(null)}>
              <div style={{ background: '#fff', borderRadius: radii.lg, padding: 28, width: 400, boxShadow: shadows.lg }}
                onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px', fontSize: font.sizeLg }}>Edit User</h3>
                
                {/* Success message */}
                {userEditSuccess && (
                  <div style={{ padding: '8px 12px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: radii.sm, marginBottom: 16, fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>✅</span>
                    <span>User saved successfully!</span>
                  </div>
                )}
                
                {/* Error message */}
                {userEditError && (
                  <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: radii.sm, marginBottom: 16, fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>❌</span>
                    <span>{userEditError}</span>
                  </div>
                )}
                
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, display: 'block', marginBottom: 4 }}>Full Name</label>
                <input value={userEditing.full_name} onChange={e => setUserEditing(p => ({ ...p, full_name: e.target.value }))}
                  disabled={userEditLoading}
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, marginBottom: 12, boxSizing: 'border-box', opacity: userEditLoading ? 0.6 : 1 }} />
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, display: 'block', marginBottom: 4 }}>Email</label>
                <input value={userEditing.email} onChange={e => setUserEditing(p => ({ ...p, email: e.target.value }))}
                  disabled={userEditLoading}
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, marginBottom: 12, boxSizing: 'border-box', opacity: userEditLoading ? 0.6 : 1 }} />
                <label style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, display: 'block', marginBottom: 4 }}>New Password <span style={{ fontWeight: 400 }}>(leave blank to keep current)</span></label>
                <input type="password" value={userEditing.newPassword} onChange={e => setUserEditing(p => ({ ...p, newPassword: e.target.value }))}
                  disabled={userEditLoading}
                  placeholder="Enter new password..."
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, marginBottom: 20, boxSizing: 'border-box', opacity: userEditLoading ? 0.6 : 1 }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => !userEditLoading && setUserEditing(null)}
                    disabled={userEditLoading}
                    style={{ padding: '8px 16px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: userEditLoading ? 'not-allowed' : 'pointer', background: 'transparent', fontSize: font.sizeSm, opacity: userEditLoading ? 0.5 : 1 }}>
                    Cancel
                  </button>
                  <button onClick={async () => {
                    setUserEditError(null);
                    setUserEditSuccess(false);
                    setUserEditLoading(true);
                    try {
                      const body = { full_name: userEditing.full_name, email: userEditing.email };
                      if (userEditing.newPassword) body.password = userEditing.newPassword;
                      const res = await fetch(`${API_BASE}/admin/users/${userEditing.id}`, {
                        method: 'PATCH', headers: authHeader(), body: JSON.stringify(body),
                      });
                      if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.detail || 'Failed to save user');
                      }
                      setUserEditSuccess(true);
                      setTimeout(() => {
                        setUserEditing(null);
                        setUserEditSuccess(false);
                        loadUsers();
                      }, 1200);
                    } catch (err) {
                      setUserEditError(err.message || 'Error saving user');
                    } finally {
                      setUserEditLoading(false);
                    }
                  }}
                    disabled={userEditLoading}
                    style={{ padding: '8px 16px', background: colors.primary, color: '#fff', border: 'none', borderRadius: radii.sm, cursor: userEditLoading ? 'not-allowed' : 'pointer', fontSize: font.sizeSm, fontWeight: 700, opacity: userEditLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {userEditLoading ? (
                      <>
                        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                        Saving...
                      </>
                    ) : 'Save Changes'}
                  </button>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            </div>
          )}
        </div>
      )}
          {/* Classroom Files Tab removed (now handled in classroom detail page) */}
    </div>
  );
}
