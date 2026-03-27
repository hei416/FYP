import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { createClassroom, getMyClassrooms, getClassroomAnalytics } from './classroomService';
import { colors, radii, font, card, shadows, btn } from './theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const scoreColor = (score) => {
  if (score == null) return { bg: '#f3f4f6', fg: colors.textMuted };
  if (score >= 70) return { bg: '#dcfce7', fg: '#16a34a' };
  if (score >= 50) return { bg: '#fef9c3', fg: '#ca8a04' };
  return { bg: '#fee2e2', fg: '#dc2626' };
};

const rateColor = (rate) => {
  if (rate == null) return colors.textMuted;
  if (rate >= 60) return '#16a34a';
  if (rate >= 40) return '#ca8a04';
  return '#dc2626';
};

// Compute per-student pass rate (%) from passed / attempted, null if no attempts
const passRate = (passed, attempted) =>
  attempted > 0 ? Math.round((passed / attempted) * 100) : null;

// Traffic-light status derived from exercise pass rate, challenge pass rate, and weak topics
const studentStatus = (s) => {
  const exRate = passRate(s.quizzes_passed, s.quizzes_attempted);
  const chRate = passRate(s.tests_passed, s.tests_attempted);
  const hasActivity = s.quizzes_attempted > 0 || s.tests_attempted > 0;

  if (!hasActivity) return { dot: '⚪', label: 'No Activity', bg: '#f3f4f6', fg: colors.textMuted };

  const isAtRisk =
    (exRate !== null && exRate < 40) ||
    (chRate !== null && chRate < 40) ||
    (s.weak_topics.length >= 3);
  const needsAttention =
    (exRate !== null && exRate < 60) ||
    (chRate !== null && chRate < 60) ||
    (s.weak_topics.length >= 1);

  if (isAtRisk)        return { dot: '🔴', label: 'At Risk',          bg: '#fee2e2', fg: '#dc2626' };
  if (needsAttention)  return { dot: '🟡', label: 'Needs Attention',  bg: '#fef9c3', fg: '#ca8a04' };
  return                      { dot: '🟢', label: 'On Track',         bg: '#dcfce7', fg: '#16a34a' };
};

// ─── Components ──────────────────────────────────────────────────────────────
const ScoreBadge = ({ score }) => {
  if (score == null) return <span style={{ color: colors.textMuted }}>—</span>;
  const { bg, fg } = scoreColor(score);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: bg, color: fg }}>
      {score}%
    </span>
  );
};

// Shows "passed/attempted (rate%)" with colour-coded rate
const PassRateBadge = ({ passed, attempted, tooltip }) => {
  if (attempted === 0) return <span style={{ color: colors.textMuted }}>—</span>;
  const rate = passRate(passed, attempted);
  const color = rateColor(rate);
  return (
    <span title={tooltip} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 12, color: colors.textMuted }}>{passed}/{attempted}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{rate}%</span>
    </span>
  );
};

// ─── Class summary bar ────────────────────────────────────────────────────────
function ClassSummaryBar({ summary }) {
  if (!summary) return null;
  const stats = [
    {
      label: 'Class Avg Exercise Score',
      tooltip: "Mean score across all students' exercise sessions",
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
      label: 'Exercise Pass Rate',
      tooltip: '% of all exercise sessions (class-wide) that scored ≥70',
      value: summary.quiz_pass_rate != null ? `${summary.quiz_pass_rate}%` : '—',
      color: rateColor(summary.quiz_pass_rate),
    },
    {
      label: 'Challenge Pass Rate',
      tooltip: '% of all challenge sessions (class-wide) that scored ≥60',
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

      {/* Status breakdown mini-legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: font.sizeXs, color: colors.textMuted, flexWrap: 'wrap' }}>
        <span title="Exercise or challenge pass rate < 40%, or ≥3 weak topics">🔴 At Risk — pass rate &lt;40% or 3+ weak topics</span>
        <span title="Pass rate 40–59% or any weak topic">🟡 Needs Attention — pass rate 40–59% or weak topic</span>
        <span title="All pass rates ≥60% and no weak topics">🟢 On Track — all rates ≥60%, no weak topics</span>
      </div>

      {summary.most_common_weak_topics?.length > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: radii.md, padding: '12px 16px' }}>
          <span style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: '#c2410c' }}>⚠️ Class-wide weak topics: </span>
          {summary.most_common_weak_topics.map(t => (
            <span key={t} style={{ fontSize: font.sizeSm, color: '#9a3412', background: '#ffedd5', borderRadius: 9999, padding: '1px 8px', marginLeft: 4, display: 'inline-block' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Per-student topic breakdown (expanded row) ───────────────────────────────
function TopicBreakdown({ student }) {
  const exRate = passRate(student.quizzes_passed, student.quizzes_attempted);
  const chRate = passRate(student.tests_passed, student.tests_attempted);

  return (
    <div style={{ marginTop: 12 }}>
      {/* Mini stat row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>Exercise Pass Rate</div>
          <div style={{ fontSize: font.sizeMd, fontWeight: 700, color: rateColor(exRate) }}>
            {student.quizzes_attempted > 0 ? `${student.quizzes_passed}/${student.quizzes_attempted} (${exRate}%)` : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>Challenge Pass Rate</div>
          <div style={{ fontSize: font.sizeMd, fontWeight: 700, color: rateColor(chRate) }}>
            {student.tests_attempted > 0 ? `${student.tests_passed}/${student.tests_attempted} (${chRate}%)` : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>Avg Exercise Score</div>
          <div style={{ fontSize: font.sizeMd, fontWeight: 700 }}><ScoreBadge score={student.avg_quiz_score} /></div>
        </div>
      </div>

      {student.weak_topics.length > 0 && (
        <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: radii.sm, fontSize: font.sizeXs, color: '#c2410c' }}>
          ⚠️ Weak topics: <strong>{student.weak_topics.join(', ')}</strong>
        </div>
      )}

      {!student.topic_stats || student.topic_stats.length === 0 ? (
        <p style={{ color: colors.textMuted, fontSize: font.sizeSm, margin: '8px 0' }}>No exercise or challenge data yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeXs }}>
          <thead>
            <tr style={{ background: colors.background }}>
              {['Topic', 'Ex. Attempts', 'Ex. Avg', 'Ch. Attempts', 'Ch. Avg'].map(h => (
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
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
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

  // Virtual sort keys for computed pass rates
  function studentSortValue(s, key) {
    if (key === 'ex_pass_rate') return passRate(s.quizzes_passed, s.quizzes_attempted);
    if (key === 'ch_pass_rate') return passRate(s.tests_passed, s.tests_attempted);
    if (key === 'status') {
      const order = { 'At Risk': 0, 'Needs Attention': 1, 'On Track': 2, 'No Activity': 3 };
      return order[studentStatus(s).label] ?? 99;
    }
    return s[key];
  }

  function sortedStudents(students) {
    return [...students].sort((a, b) => {
      let av = studentSortValue(a, sortKey);
      let bv = studentSortValue(b, sortKey);
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
            <button onClick={() => { setSelectedClass(null); setAnalytics(null); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 20 }}>✕</button>
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
                      <SortTh label="Status"            sortKeyName="status" center tooltip="Traffic-light based on individual pass rates and weak topics" />
                      <SortTh label="Name"              sortKeyName="full_name" />
                      <SortTh label="Topics Done"       sortKeyName="completed_topics" center />
                      <SortTh label="Ex. Attempts"      sortKeyName="quizzes_attempted" center tooltip="Total exercise sessions attempted" />
                      <SortTh label="Ex. Pass Rate"     sortKeyName="ex_pass_rate" center tooltip="This student's exercise pass rate: sessions ≥70 / total attempted" />
                      <SortTh label="Avg Ex. Score"     sortKeyName="avg_quiz_score" center />
                      <SortTh label="Ch. Attempts"      sortKeyName="tests_attempted" center tooltip="Total coding challenge attempts" />
                      <SortTh label="Ch. Pass Rate"     sortKeyName="ch_pass_rate" center tooltip="This student's challenge pass rate: sessions ≥60 / total attempted" />
                      <SortTh label="AI Chats"          sortKeyName="ai_interactions" center />
                      <SortTh label="Last Active"       sortKeyName="last_active" center />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents(analytics.students).map(s => {
                      const isExpanded = expandedStudent === s.student_id;
                      const status = studentStatus(s);
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
                            {/* Traffic-light status */}
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <span title={status.label}
                                style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>
                                {status.dot} {status.label}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: font.weightSemibold }}>{s.full_name || '—'}</div>
                              <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{s.email}</div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{s.completed_topics}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{s.quizzes_attempted || '—'}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <PassRateBadge
                                passed={s.quizzes_passed}
                                attempted={s.quizzes_attempted}
                                tooltip={`${s.quizzes_passed} of ${s.quizzes_attempted} exercise sessions scored ≥70`}
                              />
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}><ScoreBadge score={s.avg_quiz_score} /></td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{s.tests_attempted || '—'}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <PassRateBadge
                                passed={s.tests_passed}
                                attempted={s.tests_attempted}
                                tooltip={`${s.tests_passed} of ${s.tests_attempted} challenges scored ≥60`}
                              />
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{s.ai_interactions}</td>
                            <td style={{ ...tdStyle, textAlign: 'center', color: colors.textMuted, fontSize: font.sizeXs }}>
                              {s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}
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
