import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { createClassroom, getMyClassrooms, getClassroomAnalytics } from './classroomService';
import { colors, radii, font, spacing, card, shadows, btn } from './theme';

export default function TeacherDashboard() {
  const { isTeacher, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    if (!loading && (!isAuthenticated || !isTeacher)) {
      navigate('/home');
    }
  }, [loading, isAuthenticated, isTeacher, navigate]);

  useEffect(() => {
    if (isTeacher) loadClasses();
  }, [isTeacher]);

  async function loadClasses() {
    try {
      const data = await getMyClassrooms();
      setClasses(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setFormError('');
    try {
      await createClassroom(form);
      setForm({ name: '', description: '' });
      await loadClasses();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSelectClass(cls) {
    setSelectedClass(cls);
    setAnalytics(null);
    setAnalyticsLoading(true);
    try {
      const data = await getClassroomAnalytics(cls.id);
      setAnalytics(data);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading...</div>;

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: `1px solid ${colors.border}`, borderRadius: radii.sm,
    fontSize: font.sizeMd, color: colors.text,
    outline: 'none', boxSizing: 'border-box',
    background: colors.surface,
  };

  const thStyle = {
    padding: '10px 14px', textAlign: 'left',
    fontSize: font.sizeSm, fontWeight: font.weightBold,
    color: colors.textSecondary, borderBottom: `2px solid ${colors.border}`,
    background: colors.background,
    whiteSpace: 'nowrap',
  };

  const tdStyle = {
    padding: '10px 14px', fontSize: font.sizeSm,
    color: colors.text, borderBottom: `1px solid ${colors.border}`,
  };

  // Column definitions — label + accessor
  const columns = [
    { header: 'Name',                   key: 'full_name',        render: (s) => s.full_name || '—' },
    { header: 'Email',                  key: 'email',            render: (s) => s.email },
    { header: 'Topics Completed',       key: 'completed_topics', render: (s) => s.completed_topics, center: true },
    { header: 'Quizzes Attempted',      key: 'quizzes_attempted', render: (s) => s.quizzes_attempted, center: true },
    {
      header: 'Avg Quiz Score',
      key: 'avg_quiz_score',
      center: true,
      render: (s) =>
        s.avg_quiz_score !== null && s.avg_quiz_score !== undefined ? (
          <span style={{
            padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
            background: s.avg_quiz_score >= 70 ? '#dcfce7' : s.avg_quiz_score >= 50 ? '#fef9c3' : '#fee2e2',
            color:      s.avg_quiz_score >= 70 ? '#16a34a' : s.avg_quiz_score >= 50 ? '#ca8a04' : '#dc2626',
          }}>{s.avg_quiz_score}%</span>
        ) : '—',
    },
    { header: 'Coding Challenges Attempted', key: 'tests_attempted', render: (s) => s.tests_attempted, center: true },
    {
      header: 'Coding Challenges Passed',
      key: 'tests_passed',
      center: true,
      render: (s) => (
        <span style={{
          padding: '2px 8px', borderRadius: 9999, fontSize: 12,
          background: s.tests_passed > 0 ? '#dcfce7' : '#f3f4f6',
          color:      s.tests_passed > 0 ? '#16a34a' : colors.textMuted,
        }}>{s.tests_passed}</span>
      ),
    },
    { header: 'AI Interactions', key: 'ai_interactions', render: (s) => s.ai_interactions, center: true },
    { header: 'Joined',         key: 'joined_at',       render: (s) => new Date(s.joined_at).toLocaleDateString(), muted: true },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: font.sizeXxl, fontWeight: font.weightBold, color: colors.primary, marginBottom: 4 }}>🏫 Teacher Dashboard</h2>
      <p style={{ color: colors.textMuted, marginBottom: 32, marginTop: 0 }}>Manage your classrooms and monitor student progress.</p>

      {/* Create classroom form */}
      <div style={{ ...card, marginBottom: 32, padding: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: font.sizeLg, color: colors.text }}>Create a New Classroom</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: font.sizeSm, color: colors.textSecondary }}>Class Name *</label>
            <input style={inputStyle} placeholder="e.g. Java Intro 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div style={{ flex: '2 1 300px' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: font.sizeSm, color: colors.textSecondary }}>Description</label>
            <input style={inputStyle} placeholder="Optional description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" disabled={creating} style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap' }}>
            {creating ? 'Creating...' : '+ Create Classroom'}
          </button>
        </form>
        {formError && <p style={{ color: colors.error || '#ef4444', marginTop: 10, fontSize: font.sizeSm }}>{formError}</p>}
      </div>

      {/* Classroom list */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: font.sizeLg, color: colors.text, marginBottom: 16 }}>Your Classrooms ({classes.length})</h3>
        {classes.length === 0 ? (
          <p style={{ color: colors.textMuted }}>No classrooms yet. Create one above!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {classes.map((cls) => (
              <div
                key={cls.id}
                onClick={() => handleSelectClass(cls)}
                style={{
                  ...card,
                  padding: 20,
                  cursor: 'pointer',
                  border: selectedClass?.id === cls.id ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  transition: 'all 0.2s',
                  background: selectedClass?.id === cls.id ? colors.primaryLight || '#eef2ff' : colors.surface,
                }}
                onMouseEnter={(e) => { if (selectedClass?.id !== cls.id) e.currentTarget.style.boxShadow = shadows.md; }}
                onMouseLeave={(e) => { if (selectedClass?.id !== cls.id) e.currentTarget.style.boxShadow = card.boxShadow; }}
              >
                <h4 style={{ margin: '0 0 8px 0', color: colors.primary }}>{cls.name}</h4>
                {cls.description && <p style={{ margin: '0 0 12px 0', fontSize: font.sizeSm, color: colors.textSecondary }}>{cls.description}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: '4px 10px', fontSize: font.sizeSm, fontWeight: font.weightBold, letterSpacing: 2 }}>
                    {cls.class_code}
                  </code>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCode(cls.class_code); }}
                    style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', color: colors.textSecondary }}
                  >
                    {copiedCode === cls.class_code ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analytics panel */}
      {selectedClass && (
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: font.sizeLg, color: colors.text }}>{selectedClass.name} — Student Progress</h3>
              {analytics && (
                <p style={{ margin: '4px 0 0 0', fontSize: font.sizeSm, color: colors.textMuted }}>
                  {analytics.total_students} student{analytics.total_students !== 1 ? 's' : ''} enrolled
                </p>
              )}
            </div>
            <button onClick={() => { setSelectedClass(null); setAnalytics(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 20 }}>✕</button>
          </div>

          {analyticsLoading && <p style={{ color: colors.textMuted }}>Loading student data...</p>}

          {analytics && analytics.students.length === 0 && (
            <p style={{ color: colors.textMuted }}>
              No students have joined this classroom yet. Share the join code: <strong>{selectedClass.class_code}</strong>
            </p>
          )}

          {analytics && analytics.students.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeSm }}>
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th key={col.key} style={{ ...thStyle, textAlign: col.center ? 'center' : 'left' }}>
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analytics.students.map((s) => (
                    <tr
                      key={s.student_id}
                      onMouseEnter={(e) => { e.currentTarget.style.background = colors.background; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                    >
                      {columns.map(col => (
                        <td
                          key={col.key}
                          style={{
                            ...tdStyle,
                            textAlign: col.center ? 'center' : 'left',
                            color: col.muted ? colors.textMuted : colors.text,
                          }}
                        >
                          {col.render(s)}
                        </td>
                      ))}
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
