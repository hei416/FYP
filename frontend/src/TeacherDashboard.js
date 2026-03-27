import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { createClassroom, getMyClassrooms, getClassroomAnalytics } from './classroomService';
import { colors, radii, font, spacing, card, shadows, btn } from './theme';

const scoreColor = (score) => {
  if (score === null || score === undefined) return { bg: '#f3f4f6', fg: colors.textMuted };
  if (score >= 70) return { bg: '#dcfce7', fg: '#16a34a' };
  if (score >= 50) return { bg: '#fef9c3', fg: '#ca8a04' };
  return { bg: '#fee2e2', fg: '#dc2626' };
};

const rateColor = (rate) => {
  if (rate === null || rate === undefined) return colors.textMuted;
  if (rate >= 60) return '#16a34a';
  if (rate >= 40) return '#ca8a04';
  return '#dc2626';
};

const ScoreBadge = ({ score }) => {
  if (score === null || score === undefined) return <span style={{ color: colors.textMuted }}>—</span>;
  const { bg, fg } = scoreColor(score);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: bg, color: fg }}>
      {score}%
    </span>
  );
};

function ClassSummaryBar({ summary }) {
  if (!summary) return null;
  const stats = [
    {
      label: 'Class Avg Exercise Score',
      tooltip: "Mean average score across all students' exercise sessions",
      value: summary.avg_exercise_score != null ? `${summary.avg_exercise_score}%` : '—',
      color: scoreColor(summary.avg_exercise_score).fg,
    },
    {
      label: 'Class Avg Challenge Score',
      tooltip: 'Mean score across all coding challenge attempts',
      value: summary.avg_challenge_score != null ? `${summary.avg_challenge_score}%` : '—',
      color: scoreColor(summary.avg_challenge_score).fg,
    },
    {
      label: 'Exercise Session Pass Rate',
      tooltip: '% of individual exercise sessions that scored ≥70 (across all students)',
      value: summary.quiz_pass_rate != null ? `${summary.quiz_pass_rate}%` : '—',
      color: rateColor(summary.quiz_pass_rate),
    },
    {
      label: 'Challenge Pass Rate',
      tooltip: '% of individual challenge sessions that scored ≥60 (across all students)',
      value: summary.challenge_pass_rate != null ? `${summary.challenge_pass_rate}%` : '—',
      color: rateColor(summary.challenge_pass_rate),
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} title={s.tooltip}
            style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: '14px 16px', cursor: 'help' }}>
            <div style={{ fontSize: font.sizeXs, color: colors.textMuted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: font.sizeXl, fontWeight: font.weightBold, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      {summary.most_common_weak_topics?.length > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: radii.md, padding: '12px 16px' }}>
          <span style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: '#c2410c' }}>⚠️ Class-wide weak topics: </span>
          {summary.most_common_weak_topics.map(t => (
            <span key={t} style={{ fontSize: font.sizeSm, color: '#9a3412', background: '#ffedd5', borderRadius: 9999, padding: '1px 8px', marginLeft: 4, marginBottom: 2, display: 'inline-block' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TopicBreakdown({ student }) {
  if (!student.topic_stats || student.topic_stats.length === 0) {
    return <p style={{ color: colors.textMuted, fontSize: font.sizeSm, margin: '8px 0' }}>No exercise or challenge data yet.</p>;
  }
  return (
    <div style={{ marginTop: 12 }}>
      {student.weak_topics.length > 0 && (
        <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: radii.sm, fontSize: font.sizeXs, color: '#c2410c' }}>
          ⚠️ Weak topics: <strong>{student.weak_topics.join(', ')}</strong>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeXs }}>
        <thead>
          <tr style={{ background: colors.background }}>
            {['Topic', 'Exercise Attempts', 'Exercise Avg', 'Challenge Attempts', 'Challenge Avg'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Topic' ? 'left' : 'center', color: colors.textSecondary, fontWeight: font.weightSemibold, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {student.topic_stats.map(ts => (
            <tr key={ts.topic} style={{ background: ts.is_weak ? '#fff7ed' : 'transparent' }}>
              <td style={{ padding: '6px 10px', color: colors.text, borderBottom: `1px solid ${colors.border}` }}>
                {ts.is_weak && <span style={{ marginRight: 4 }}>⚠️</span>}{ts.topic}
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.exercise_attempts || '—'}</td>
              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><ScoreBadge score={ts.exercise_avg_score} /></td>
              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.challenge_attempts || '—'}</td>
              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><ScoreBadge score={ts.challenge_avg_score} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TeacherDashboard() {
  const { isTeacher, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses]                   = useState([]);
  const [selectedClass, setSelectedClass]       = useState(null);
  const [analytics, setAnalytics]               = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [form, setForm]                         = useState({ name: '', description: '' });
  const [creating, setCreating]                 = useState(false);
  const [formError, setFormError]               = useState('');
  const [copiedCode, setCopiedCode]             = useState(null);
  const [expandedStudent, setExpandedStudent]   = useState(null);
  const [sortKey, setSortKey]                   = useState('full_name');
  const [sortAsc, setSortAsc]                   = useState(true);

  useEffect(() => {
    if (!loading && (!isAuthenticated || !isTeacher)) navigate('/home');
  }, [loading, isAuthenticated, isTeacher, navigate]);

  useEffect(() => { if (isTeacher) loadClasses(); }, [isTeacher]);

  async function loadClasses() {
    try { setClasses(await getMyClassrooms()); } catch (e) { console.error(e); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true); setFormError('');
    try { await createClassroom(form); setForm({ name: '', description: '' }); await loadClasses(); }
    catch (e) { setFormError(e.message); }
    finally { setCreating(false); }
  }

  async function handleSelectClass(cls) {
    setSelectedClass(cls); setAnalytics(null); setExpandedStudent(null);
    setAnalyticsLoading(true);
    try { setAnalytics(await getClassroomAnalytics(cls.id)); }
    catch (e) { console.error(e); }
    finally { setAnalyticsLoading(false); }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function toggleSort(key) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  function sortedStudents(students) {
    return [...students].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === null || av === undefined) av = sortAsc ? Infinity : -Infinity;
      if (bv === null || bv === undefined) bv = sortAsc ? Infinity : -Infinity;
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading...</div>;

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: `1px solid ${colors.border}`, borderRadius: radii.sm,
    fontSize: font.sizeMd, color: colors.text,
    outline: 'none', boxSizing: 'border-box', background: colors.surface,
  };

  const SortTh = ({ label, sortKeyName, center, tooltip }) => {
    const active = sortKey === sortKeyName;
    return (
      <th onClick={() => toggleSort(sortKeyName)} title={tooltip}
        style={{
          padding: '10px 14px', textAlign: center ? 'center' : 'left',
          fontSize: font.sizeSm, fontWeight: font.weightBold,
          color: active ? colors.primary : colors.textSecondary,
          borderBottom: `2px solid ${colors.border}`,
          background: colors.background, whiteSpace: 'nowrap',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {label} {active ? (sortAsc ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
      </th>
    );
  };

  const tdStyle = { padding: '10px 14px', fontSize: font.sizeSm, color: colors.text, borderBottom: `1px solid ${colors.border}` };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: font.sizeXxl, fontWeight: font.weightBold, color: colors.primary, marginBottom: 4 }}>🏫 Teacher Dashboard</h2>
      <p style={{ color: colors.textMuted, marginBottom: 32, marginTop: 0 }}>Manage your classrooms and monitor student progress.</p>

      {/* Create classroom */}
      <div style={{ ...card, marginBottom: 32, padding: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: font.sizeLg, color: colors.text }}>Create a New Classroom</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: font.sizeSm, color: colors.textSecondary }}>Class Name *</label>
            <input style={inputStyle} placeholder="e.g. Java Intro 2026" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div style={{ flex: '2 1 300px' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: font.sizeSm, color: colors.textSecondary }}>Description</label>
            <input style={inputStyle} placeholder="Optional description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" disabled={creating} style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap' }}>
            {creating ? 'Creating...' : '+ Create Classroom'}
          </button>
        </form>
        {formError && <p style={{ color: '#ef4444', marginTop: 10, fontSize: font.sizeSm }}>{formError}</p>}
      </div>

      {/* Classroom list */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: font.sizeLg, color: colors.text, marginBottom: 16 }}>Your Classrooms ({classes.length})</h3>
        {classes.length === 0 ? (
          <p style={{ color: colors.textMuted }}>No classrooms yet. Create one above!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {classes.map(cls => (
              <div key={cls.id} onClick={() => handleSelectClass(cls)}
                style={{ ...card, padding: 20, cursor: 'pointer', transition: 'all 0.2s',
                  border: selectedClass?.id === cls.id ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  background: selectedClass?.id === cls.id ? (colors.primaryLight || '#eef2ff') : colors.surface,
                }}
                onMouseEnter={e => { if (selectedClass?.id !== cls.id) e.currentTarget.style.boxShadow = shadows.md; }}
                onMouseLeave={e => { if (selectedClass?.id !== cls.id) e.currentTarget.style.boxShadow = card.boxShadow; }}
              >
                <h4 style={{ margin: '0 0 8px 0', color: colors.primary }}>{cls.name}</h4>
                {cls.description && <p style={{ margin: '0 0 12px 0', fontSize: font.sizeSm, color: colors.textSecondary }}>{cls.description}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: '4px 10px', fontSize: font.sizeSm, fontWeight: font.weightBold, letterSpacing: 2 }}>
                    {cls.class_code}
                  </code>
                  <button onClick={e => { e.stopPropagation(); copyCode(cls.class_code); }}
                    style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', color: colors.textSecondary }}>
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
              {analytics && <p style={{ margin: '4px 0 0 0', fontSize: font.sizeSm, color: colors.textMuted }}>{analytics.total_students} student{analytics.total_students !== 1 ? 's' : ''} enrolled</p>}
            </div>
            <button onClick={() => { setSelectedClass(null); setAnalytics(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 20 }}>✕</button>
          </div>

          {analyticsLoading && <p style={{ color: colors.textMuted }}>Loading student data...</p>}

          {analytics && analytics.students.length === 0 && (
            <p style={{ color: colors.textMuted }}>No students have joined yet. Share the join code: <strong>{selectedClass.class_code}</strong></p>
          )}

          {analytics && analytics.students.length > 0 && (
            <>
              <ClassSummaryBar summary={analytics.class_summary} />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeSm }}>
                  <thead>
                    <tr>
                      <th style={{ width: 32, padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.background }} />
                      <SortTh label="Name"               sortKeyName="full_name" />
                      <SortTh label="Topics Completed"   sortKeyName="completed_topics" center />
                      <SortTh label="Exercises"          sortKeyName="quizzes_attempted" center tooltip="Total exercise sessions attempted" />
                      <SortTh label="Ex. Passed"         sortKeyName="quizzes_passed" center tooltip="Exercise sessions scoring ≥70" />
                      <SortTh label="Avg Exercise Score" sortKeyName="avg_quiz_score" center />
                      <SortTh label="Challenges"         sortKeyName="tests_attempted" center tooltip="Total coding challenge attempts" />
                      <SortTh label="Ch. Passed"         sortKeyName="tests_passed" center tooltip="Challenges scoring ≥60" />
                      <SortTh label="AI Interactions"    sortKeyName="ai_interactions" center />
                      <SortTh label="Last Active"        sortKeyName="last_active" center />
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: font.sizeSm, fontWeight: font.weightBold, color: colors.textSecondary, borderBottom: `2px solid ${colors.border}`, background: colors.background, whiteSpace: 'nowrap' }}>Weak Topics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents(analytics.students).map(s => {
                      const isExpanded = expandedStudent === s.student_id;
                      return (
                        <React.Fragment key={s.student_id}>
                          <tr
                            onClick={() => setExpandedStudent(isExpanded ? null : s.student_id)}
                            style={{ cursor: 'pointer', background: isExpanded ? (colors.primaryLight || '#eef2ff') : 'transparent' }}
                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = colors.background; }}
                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ ...tdStyle, textAlign: 'center', color: colors.primary, fontWeight: 700, fontSize: 16 }}>
                              {isExpanded ? '▾' : '▸'}
                            </td>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: font.weightSemibold }}>{s.full_name || '—'}</div>
                              <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{s.email}</div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{s.completed_topics}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{s.quizzes_attempted}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 12,
                                background: s.quizzes_passed > 0 ? '#dcfce7' : '#f3f4f6',
                                color: s.quizzes_passed > 0 ? '#16a34a' : colors.textMuted }}>
                                {s.quizzes_passed}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}><ScoreBadge score={s.avg_quiz_score} /></td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{s.tests_attempted}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 12,
                                background: s.tests_passed > 0 ? '#dcfce7' : '#f3f4f6',
                                color: s.tests_passed > 0 ? '#16a34a' : colors.textMuted }}>
                                {s.tests_passed}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{s.ai_interactions}</td>
                            <td style={{ ...tdStyle, textAlign: 'center', color: colors.textMuted, fontSize: font.sizeXs }}>
                              {s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              {s.weak_topics.length > 0 ? (
                                <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, background: '#fff7ed', color: '#c2410c', fontWeight: 600 }}>
                                  ⚠️ {s.weak_topics.length} topic{s.weak_topics.length !== 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span style={{ color: '#16a34a', fontSize: 12 }}>✓ On track</span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={11} style={{ padding: '0 16px 16px 48px', background: colors.primaryLight || '#eef2ff', borderBottom: `1px solid ${colors.border}` }}>
                                <TopicBreakdown student={s} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
