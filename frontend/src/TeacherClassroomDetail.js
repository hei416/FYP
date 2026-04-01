import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getClassroomAnalytics } from './classroomService';
import { radii, font, card, shadows } from './theme';
import { btn, colors } from './theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const passRate = (passed, attempted) =>
  attempted > 0 ? Math.round((passed / attempted) * 100) : null;

const studentStatus = (s) => {
  const exRate = passRate(s.quizzes_passed, s.quizzes_attempted);
  const chRate = passRate(s.tests_passed, s.tests_attempted);
  const hasActivity = s.quizzes_attempted > 0 || s.tests_attempted > 0;
  if (!hasActivity) return { dot: '⚪', label: 'No Activity', bg: '#f3f4f6', fg: colors.textMuted };
  const isAtRisk = (exRate !== null && exRate < 40) || (chRate !== null && chRate < 40);
  const needsAttention =
    (exRate !== null && exRate < 60) ||
    (chRate !== null && chRate < 60) ||
    (s.weak_topics.length >= 3);
  if (isAtRisk)       return { dot: '🔴', label: 'At Risk',         bg: '#fee2e2', fg: '#dc2626' };
  if (needsAttention) return { dot: '🟡', label: 'Needs Attention', bg: '#fef9c3', fg: '#ca8a04' };
  return                    { dot: '🟢', label: 'On Track',        bg: '#dcfce7', fg: '#16a34a' };
};

// ─── Small display components ─────────────────────────────────────────────────
const ScoreBadge = ({ score }) => {
  if (score == null) return <span style={{ color: colors.textMuted }}>—</span>;
  const { bg, fg } = scoreColor(score);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: bg, color: fg }}>
      {score}%
    </span>
  );
};

const PassRateBadge = ({ passed, attempted, tooltip }) => {
  if (attempted === 0) return <span style={{ color: colors.textMuted }}>—</span>;
  const rate = passRate(passed, attempted);
  return (
    <span title={tooltip} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 12, color: colors.textMuted }}>{passed}/{attempted}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: rateColor(rate) }}>{rate}%</span>
    </span>
  );
};

function MiniBar({ value, color }) {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ marginTop: 8, background: colors.border, borderRadius: radii.full, height: 5, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: radii.full, transition: 'width 0.5s ease' }} />
    </div>
  );
}

// ─── Class summary bar ────────────────────────────────────────────────────────
function ClassSummaryBar({ summary }) {
  if (!summary) return null;
  const stats = [
    { icon: '📝', label: 'Class Avg Exercise Score',  tooltip: "Mean score across all students' exercise sessions", numericValue: summary.avg_exercise_score,  value: summary.avg_exercise_score  != null ? `${summary.avg_exercise_score}%`  : '—', color: scoreColor(summary.avg_exercise_score).fg },
    { icon: '💻', label: 'Class Avg Challenge Score', tooltip: 'Mean score across all coding challenge attempts',   numericValue: summary.avg_challenge_score, value: summary.avg_challenge_score != null ? `${summary.avg_challenge_score}%` : '—', color: scoreColor(summary.avg_challenge_score).fg },
    { icon: '✅', label: 'Exercise Pass Rate',         tooltip: '% of all exercise sessions that scored ≥70',       numericValue: summary.quiz_pass_rate,      value: summary.quiz_pass_rate      != null ? `${summary.quiz_pass_rate}%`      : '—', color: rateColor(summary.quiz_pass_rate) },
    { icon: '🏆', label: 'Challenge Pass Rate',        tooltip: '% of all challenge sessions that scored ≥60',      numericValue: summary.challenge_pass_rate, value: summary.challenge_pass_rate != null ? `${summary.challenge_pass_rate}%` : '—', color: rateColor(summary.challenge_pass_rate) },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} title={s.tooltip}
            style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: '14px 16px', cursor: 'help', boxShadow: shadows.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <div style={{ fontSize: font.sizeXs, color: colors.textMuted, lineHeight: 1.3 }}>{s.label}</div>
            </div>
            <div style={{ fontSize: font.sizeXl, fontWeight: font.weightBold, color: s.color }}>{s.value}</div>
            <MiniBar value={s.numericValue} color={s.color} />
          </div>
        ))}
      </div>

      {/* Status legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', background: colors.bg, borderRadius: radii.sm, padding: '8px 12px', border: `1px solid ${colors.border}` }}>
        {[
          { dot: '🔴', label: 'At Risk',          desc: 'pass rate <40%',                title: 'Exercise or challenge pass rate < 40%' },
          { dot: '🟡', label: 'Needs Attention',  desc: '40–59% or 3+ weak topics',      title: 'Pass rate 40–59% or 3+ weak topics' },
          { dot: '🟢', label: 'On Track',         desc: 'all rates ≥60%',                title: 'All pass rates ≥60% and fewer than 3 weak topics' },
          { dot: '⚪', label: 'No Activity',       desc: 'no attempts yet',               title: 'Student has not attempted any exercises or challenges' },
        ].map(item => (
          <span key={item.label} title={item.title}
            style={{ fontSize: font.sizeXs, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 3, marginRight: 4 }}>
            <span>{item.dot}</span>
            <span style={{ fontWeight: font.weightSemibold }}>{item.label}</span>
            <span style={{ color: colors.textMuted }}>— {item.desc}</span>
          </span>
        ))}
      </div>

      {summary.most_common_weak_topics?.length > 0 && (
        <div style={{ background: colors.warningLight, border: `1px solid ${colors.warningBorder}`, borderRadius: radii.md, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: colors.warning }}>⚠️ Class-wide weak topics:</span>
          {summary.most_common_weak_topics.map(t => (
            <span key={t} style={{ fontSize: font.sizeSm, color: '#92400e', background: '#fde68a', borderRadius: radii.full, padding: '2px 10px', fontWeight: font.weightMedium }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Per-student topic breakdown ──────────────────────────────────────────────
function TopicBreakdown({ student }) {
  const exRate = passRate(student.quizzes_passed, student.quizzes_attempted);
  const chRate = passRate(student.tests_passed, student.tests_attempted);
  return (
    <div style={{ marginTop: 12 }}>
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
            <tr style={{ background: colors.bg }}>
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TeacherClassroomDetail() {
  const { classroomId } = useParams();
  const { state } = useLocation();
  const { isTeacher, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const classroomName = state?.name || `Classroom #${classroomId}`;
  const classCode     = state?.class_code;

  const [analytics,        setAnalytics]        = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [expandedStudent,  setExpandedStudent]  = useState(null);
  const [sortKey,          setSortKey]          = useState('full_name');
  const [sortAsc,          setSortAsc]          = useState(true);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isTeacher)) navigate('/home');
  }, [authLoading, isAuthenticated, isTeacher, navigate]);

  useEffect(() => {
    if (!isTeacher) return;
    setAnalyticsLoading(true);
    getClassroomAnalytics(classroomId)
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setAnalyticsLoading(false));
  }, [classroomId, isTeacher]);

  function toggleSort(key) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

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
      if (av == null) av = sortAsc ? Infinity : -Infinity;
      if (bv == null) bv = sortAsc ? Infinity : -Infinity;
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
  }

  if (authLoading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading…</div>;

  const tdStyle = { padding: '10px 14px', fontSize: font.sizeSm, color: colors.text, borderBottom: `1px solid ${colors.border}` };

  const SortTh = ({ label, sortKeyName, center, tooltip }) => {
    const active = sortKey === sortKeyName;
    return (
      <th onClick={() => toggleSort(sortKeyName)} title={tooltip}
        style={{
          padding: '10px 14px', textAlign: center ? 'center' : 'left',
          fontSize: font.sizeSm, fontWeight: font.weightBold,
          color: active ? colors.primary : colors.textSecondary,
          borderBottom: `2px solid ${colors.border}`,
          background: colors.bg, whiteSpace: 'nowrap',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {label} {active ? (sortAsc ? '↑' : '↓') : <span style={{ opacity: 0.3 }}>↕</span>}
      </th>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: `2px solid ${colors.border}` }}>
        <button
          onClick={() => navigate('/teacher-dashboard')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: '6px 14px', cursor: 'pointer', fontSize: font.sizeSm, color: colors.textSecondary, fontWeight: font.weightMedium }}
        >
          ← Back to Dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: font.weightBold, color: colors.primary }}>
            📊 {classroomName}
          </h2>
          {classCode && (
            <code style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: '4px 12px', fontSize: font.sizeSm, fontWeight: font.weightBold, letterSpacing: 2, color: colors.text }}>
              {classCode}
            </code>
          )}
          {analytics && (
            <span style={{ fontSize: font.sizeSm, color: colors.textMuted }}>
              {analytics.total_students} student{analytics.total_students !== 1 ? 's' : ''} enrolled
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {analyticsLoading && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: colors.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: font.sizeMd }}>Loading student data…</div>
        </div>
      )}

      {!analyticsLoading && analytics && analytics.students.length === 0 && (
        <div style={{ ...card.base, textAlign: 'center', padding: '56px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👩‍🎓</div>
          <div style={{ fontSize: font.sizeLg, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 8 }}>No students yet</div>
          <div style={{ fontSize: font.sizeSm, color: colors.textMuted }}>
            Share the join code{' '}
            <strong style={{ color: colors.primary, letterSpacing: 2 }}>{classCode || classroomId}</strong>
            {' '}with your students.
          </div>
        </div>
      )}

      {!analyticsLoading && analytics && analytics.students.length > 0 && (
        <div style={{ ...card.base, padding: 28 }}>
          <ClassSummaryBar summary={analytics.class_summary} />

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeSm }}>
              <thead>
                <tr>
                  <th style={{ width: 32, padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg }} />
                  <SortTh label="Status"        sortKeyName="status"            center tooltip="Traffic-light based on individual pass rates and weak topics" />
                  <SortTh label="Name"          sortKeyName="full_name" />
                  <SortTh label="Topics Done"   sortKeyName="completed_topics"  center />
                  <SortTh label="Ex. Attempts"  sortKeyName="quizzes_attempted" center tooltip="Total exercise sessions attempted" />
                  <SortTh label="Ex. Pass Rate" sortKeyName="ex_pass_rate"      center tooltip="Sessions ≥70 / total attempted" />
                  <SortTh label="Avg Ex. Score" sortKeyName="avg_quiz_score"    center />
                  <SortTh label="Ch. Attempts"  sortKeyName="tests_attempted"   center tooltip="Total coding challenge attempts" />
                  <SortTh label="Ch. Pass Rate" sortKeyName="ch_pass_rate"      center tooltip="Sessions ≥60 / total attempted" />
                  <SortTh label="AI Chats"      sortKeyName="ai_interactions"   center />
                  <SortTh label="Last Active"   sortKeyName="last_active"       center />
                </tr>
              </thead>
              <tbody>
                {sortedStudents(analytics.students).map((s, idx) => {
                  const isExpanded = expandedStudent === s.student_id;
                  const status = studentStatus(s);
                  const rowBg = isExpanded ? colors.primaryLight : (idx % 2 === 0 ? colors.surface : colors.bg);
                  return (
                    <React.Fragment key={s.student_id}>
                      <tr
                        onClick={() => setExpandedStudent(isExpanded ? null : s.student_id)}
                        style={{ cursor: 'pointer', background: rowBg, transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = colors.primaryLight; }}
                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = rowBg; }}
                      >
                        <td style={{ ...tdStyle, textAlign: 'center', color: colors.primary, fontWeight: 700, fontSize: 16 }}>
                          {isExpanded ? '▾' : '▸'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span title={status.label} style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>
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
                          <PassRateBadge passed={s.quizzes_passed} attempted={s.quizzes_attempted} tooltip={`${s.quizzes_passed} of ${s.quizzes_attempted} exercise sessions scored ≥70`} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}><ScoreBadge score={s.avg_quiz_score} /></td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{s.tests_attempted || '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <PassRateBadge passed={s.tests_passed} attempted={s.tests_attempted} tooltip={`${s.tests_passed} of ${s.tests_attempted} challenges scored ≥60`} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{s.ai_interactions}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', color: colors.textMuted, fontSize: font.sizeXs }}>
                          {s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={11} style={{ padding: '12px 24px 20px 48px', background: colors.primaryLight, borderBottom: `2px solid ${colors.primaryBorder}` }}>
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
        </div>
      )}
    </div>
  );
}
