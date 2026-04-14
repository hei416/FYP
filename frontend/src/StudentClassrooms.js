import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { joinClassroom, getEnrolledClassrooms } from './classroomService';
import { getCourseProgress } from './progressService';
import { colors, radii, font, spacing, card, btn, shadows } from './theme';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';


// ── Mirrors teacher's scoreColor / rateColor helpers exactly ─────────────────
function scoreColor(s) {
  if (s == null) return { bg: '#f3f4f6', fg: '#9ca3af' };
  if (s >= 70)  return { bg: '#dcfce7', fg: '#16a34a' };
  if (s >= 50)  return { bg: '#fef9c3', fg: '#ca8a04' };
  return         { bg: '#fee2e2', fg: '#dc2626' };
}
function rateColor(r) {
  if (r == null) return '#9ca3af';
  if (r >= 60)  return '#16a34a';
  if (r >= 40)  return '#ca8a04';
  return '#dc2626';
}

function ScoreBadge({ score }) {
  if (score == null) return <span style={{ color: '#9ca3af' }}>—</span>;
  const { bg, fg } = scoreColor(score);
  return (
    <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: bg, color: fg }}>
      {score}%
    </span>
  );
}

function MiniBar({ value, color: c }) {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ marginTop: 6, background: '#e5e7eb', borderRadius: 9999, height: 5, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 9999, transition: 'width 0.5s ease' }} />
    </div>
  );
}

// ── Mirrors teacher's CourseSummaryBar exactly ────────────────────────────────
function MyProgressSummaryBar({ summary, weakTopics, isLoading }) {
  if (isLoading) {
    return (
      <div style={{ ...card, padding: 24, marginBottom: 32, textAlign: 'center', color: colors.textMuted }}>
        Loading your progress...
      </div>
    );
  }
  if (!summary) return null;

  const stats = [
    {
      icon: '🎯', label: 'Avg Completion',
      val: summary.avg_completion_percentage,
      fmt: v => `${v}%`,
      color: scoreColor(summary.avg_completion_percentage).fg,
    },
    {
      icon: '📝', label: 'Avg Quiz Score',
      val: summary.avg_quiz_score,
      fmt: v => `${v}%`,
      color: scoreColor(summary.avg_quiz_score).fg,
    },
    {
      icon: '💻', label: 'Avg Test Score',
      val: summary.avg_test_score,
      fmt: v => `${v}%`,
      color: scoreColor(summary.avg_test_score).fg,
    },
    {
      icon: '✅', label: 'Quiz Pass Rate',
      val: summary.quiz_pass_rate,
      fmt: v => `${v}%`,
      color: rateColor(summary.quiz_pass_rate),
    },
    {
      icon: '🏆', label: 'Test Pass Rate',
      val: summary.test_pass_rate,
      fmt: v => `${v}%`,
      color: rateColor(summary.test_pass_rate),
    },
    {
      icon: '🔥', label: 'AI Interactions',
      val: summary.ai_interactions ?? null,
      fmt: v => String(v),
      color: colors.primary,
    },
  ];

  // Merge: backend weak_topics (from /progress/weak-topics) + summary.most_common_weak_topics
  const weakFromSummary = (summary.most_common_weak_topics || []).map(t =>
    typeof t === 'string' ? { topic: t, avg_score: null } : t
  );
  const mergedWeak = weakTopics.length > 0 ? weakTopics : weakFromSummary;

  return (
    <div style={{ ...card, padding: 24, marginBottom: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: font.sizeLg, color: colors.text }}>📊 My Learning Progress</h3>
        {summary.total_students != null && (
          <span style={{ fontSize: font.sizeSm, color: colors.textMuted }}>
            {summary.total_students} student{summary.total_students !== 1 ? 's' : ''} enrolled
          </span>
        )}
      </div>

      {/* Stats grid — matches teacher CourseSummaryBar layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.md,
            padding: '12px 14px',
            boxShadow: shadows.sm,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{s.label}</div>
            </div>
            <div style={{ fontSize: font.sizeXl, fontWeight: font.weightBold, color: s.color }}>
              {s.val != null ? s.fmt(s.val) : '—'}
            </div>
            <MiniBar value={s.val} color={s.color} />
          </div>
        ))}
      </div>

      {/* Weak topics — same style as teacher's CourseSummaryBar weak topics row */}
      {mergedWeak.length > 0 && (
        <div style={{
          background: '#fefce8',
          border: '1px solid #fde68a',
          borderRadius: radii.md,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: '#ca8a04' }}>
            ⚠️ Weak topics:
          </span>
          {mergedWeak.map(wt => (
            <span
              key={wt.topic}
              style={{ fontSize: font.sizeSm, color: '#92400e', background: '#fde68a', borderRadius: 9999, padding: '2px 10px', fontWeight: font.weightMedium }}
            >
              {wt.topic}{wt.avg_score != null ? ` (${wt.avg_score}%)` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StudentClassrooms() {
  const { isStudent, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [classCode, setClassCode] = useState('');
  const [classes, setClasses] = useState([]);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [chatHovered, setChatHovered] = useState(false);

  // ── One aggregated summary across all enrolled courses ────────────────────
  const [aggregateSummary, setAggregateSummary] = useState(null);
  const [weakTopics, setWeakTopics] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  useEffect(() => {
    if (!loading && (!isAuthenticated || !isStudent)) navigate('/');
  }, [loading, isAuthenticated, isStudent, navigate]);

  useEffect(() => {
    if (isAuthenticated && isStudent) loadClasses();
  }, [isAuthenticated, isStudent]);

  async function loadClasses() {
    try {
      const data = await getEnrolledClassrooms();
      setClasses(data);
      await loadAggregateProgress(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadAggregateProgress(classrooms) {
    if (!isAuthenticated || !classrooms.length) return;
    setLoadingProgress(true);
    try {
      // Deduplicate: only fetch each unique course_id ONCE
      const seenCourses = new Set();
      const uniqueCourses = classrooms
        .map(cls => (cls.enrolled_courses && cls.enrolled_courses[0]) || 'basic')
        .filter(courseId => {
          if (seenCourses.has(courseId)) return false;
          seenCourses.add(courseId);
          return true;
        });

      const results = await Promise.all(
        uniqueCourses.map(courseId => getCourseProgress(courseId).catch(() => null))
      );
      const valid = results.filter(Boolean);
      if (valid.length === 0) { setAggregateSummary(null); return; }

      const avg = arr => arr.length
        ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
        : null;

      // Read completion from localStorage (the only reliable source)
      const localCompletion = (() => {
        try {
          const roadmap = JSON.parse(localStorage.getItem('java-roadmap-completed') || '[]');
          return Math.round((roadmap.length / 78) * 100);
        } catch { return null; }
      })();

      // Aggregate scores across all unique courses
      const quizScores = valid.map(p => p.avg_quiz_score).filter(v => v != null);
      const testScores = valid.map(p => p.avg_test_score).filter(v => v != null);

      // Sum attempts and passes across courses (already correctly computed in getCourseProgress)
      const totalQuizAttempts = valid.reduce((s, p) => s + (p.quizzes_attempted || 0), 0);
      const totalQuizPassed   = valid.reduce((s, p) => s + (p.quizzes_passed   || 0), 0);
      const totalTestAttempts = valid.reduce((s, p) => s + (p.tests_attempted  || 0), 0);
      const totalTestPassed   = valid.reduce((s, p) => s + (p.tests_passed     || 0), 0);

      // Take max for ai_interactions — same user, same counter across course calls
      const aiInteractions = Math.max(...valid.map(p => p.ai_interactions || 0));

      const allWeakTopics = valid.flatMap(p => p.weak_topics || []);
      const uniqueWeak = [...new Map(allWeakTopics.map(t =>
        [typeof t === 'string' ? t : t.topic, t]
      )).values()].slice(0, 6);

      setAggregateSummary({
        avg_completion_percentage: localCompletion,
        avg_quiz_score:  avg(quizScores),
        avg_test_score:  avg(testScores),
        quiz_pass_rate:  totalQuizAttempts > 0
          ? Math.min(100, Math.round((totalQuizPassed / totalQuizAttempts) * 100)) : null,
        test_pass_rate:  totalTestAttempts > 0
          ? Math.min(100, Math.round((totalTestPassed / totalTestAttempts) * 100)) : null,
        most_common_weak_topics: uniqueWeak,
        ai_interactions: aiInteractions,
      });

      // Fetch annotated weak topics for the summary bar
      const token = localStorage.getItem('authToken') || '';
      if (token) {
        fetch(`${API_BASE}/progress/weak-topics`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.ok ? r.json() : { weak_topics: [] })
          .then(data => setWeakTopics(data.weak_topics || []))
          .catch(() => setWeakTopics([]));
      }
    } catch (e) {
      console.error('Failed to load aggregate progress:', e);
    } finally {
      setLoadingProgress(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!classCode.trim()) return;
    setJoining(true); setJoinError(''); setJoinSuccess('');
    try {
      const result = await joinClassroom(classCode.trim().toUpperCase());
      setJoinSuccess(`✓ Joined "${result.classroom_name}" successfully!`);
      setClassCode('');
      await loadClasses();
    } catch (e) {
      setJoinError(e.message);
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading...</div>;

  const filteredClasses = classes.filter(c =>
    (c.name + ' ' + (c.description || '')).toLowerCase().includes(classSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: font.sizeXxl, fontWeight: font.weightBold, color: colors.primary, marginBottom: 4 }}>
        🎓 My Classrooms
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 24, marginTop: 0 }}>
        Enter a class code from your teacher to join a classroom.
      </p>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        <button onClick={() => navigate('/my-work')} style={{ flex: 1, ...btn.primary, padding: '12px 16px', fontSize: font.sizeSm, fontWeight: font.weightMedium }}>
          📋 My Work
        </button>
        
        <button
          onClick={() => navigate('/chat-history')}
          style={{
            flex: 1,
            ...btn.secondary,
            padding: '12px 16px',
            fontSize: font.sizeSm,
            fontWeight: font.weightMedium,
            backgroundColor: chatHovered ? colors.primary : colors.background,
            border: `2px solid ${colors.primary}`,
            color: chatHovered ? '#fff' : colors.primary,
            cursor: 'pointer',
            borderRadius: radii.md,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={() => setChatHovered(true)}
          onMouseLeave={() => setChatHovered(false)}
        >
          💬 Chat History
        </button>
      </div>

      {/* Single aggregated progress card above classroom list */}
      <MyProgressSummaryBar
        summary={aggregateSummary}
        weakTopics={weakTopics}
        isLoading={loadingProgress}
      />

      {/* Join form */}
      <div style={{ ...card, padding: 24, marginBottom: 32 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: font.sizeLg }}>Join a Classroom</h3>
        <form onSubmit={handleJoin} style={{ display: 'flex', gap: 12 }}>
          <input
            value={classCode}
            onChange={e => setClassCode(e.target.value.toUpperCase())}
            placeholder="Enter class code (e.g. JAVA1A2B)"
            maxLength={10}
            style={{ flex: 1, padding: '10px 14px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeMd, letterSpacing: 2, fontWeight: 600, outline: 'none', textTransform: 'uppercase' }}
          />
          <button type="submit" disabled={joining || !classCode.trim()} style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap' }}>
            {joining ? 'Joining...' : 'Join'}
          </button>
        </form>
        {joinError   && <p style={{ color: colors.error || '#ef4444', marginTop: 10, fontSize: font.sizeSm }}>{joinError}</p>}
        {joinSuccess && <p style={{ color: '#16a34a', marginTop: 10, fontSize: font.sizeSm }}>{joinSuccess}</p>}
      </div>

      {/* Classroom list */}
      <h3 style={{ fontSize: font.sizeLg, color: colors.text, marginBottom: 12 }}>
        Enrolled Classrooms ({classes.length})
      </h3>
      <input
        value={classSearch}
        onChange={e => setClassSearch(e.target.value)}
        placeholder="Search classrooms..."
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 14px', marginBottom: 16, border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeMd, outline: 'none' }}
      />

      {filteredClasses.length === 0 ? (
        <div style={{ ...card, padding: 32, textAlign: 'center', color: colors.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <p>You haven't joined any classrooms yet.</p>
          <p style={{ fontSize: font.sizeSm }}>Ask your teacher for the class code and enter it above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredClasses.map(cls => (
            <div
              key={cls.id}
              onClick={() => navigate(`/classrooms/${cls.id}`)}
              style={{ ...card, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = card.boxShadow || '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: colors.primary }}>{cls.name}</h4>
                {cls.description && <p style={{ margin: 0, fontSize: font.sizeSm, color: colors.textSecondary }}>{cls.description}</p>}
              </div>
              <code style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: '4px 10px', fontSize: font.sizeSm, fontWeight: font.weightBold, letterSpacing: 2, color: colors.primary }}>
                {cls.class_code}
              </code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
