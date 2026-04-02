import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  getClassroomAnalytics,
  getClassroomMaterialsWithProgress,
  getClassroomQuizzesWithProgress,
  getClassroomStudentWork,
  generateClassroomQuiz,
  saveClassroomQuiz,
  listClassroomQuizzes,
  updateClassroomQuiz,
  deleteClassroomQuiz,
  listSections,
  listClassroomFiles,
  updateClassroomCategory,
} from './classroomService';
import { ClassroomSections } from './TeacherDashboard';
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

function CourseSummaryBar({ summary }) {
  if (!summary) return null;

  const stats = [
    {
      icon: '🎯',
      label: 'Avg Completion',
      numericValue: summary.avg_completion_percentage,
      value: summary.avg_completion_percentage != null ? `${summary.avg_completion_percentage}%` : '—',
      color: scoreColor(summary.avg_completion_percentage).fg,
    },
    {
      icon: '📝',
      label: 'Avg Quiz Score',
      numericValue: summary.avg_quiz_score,
      value: summary.avg_quiz_score != null ? `${summary.avg_quiz_score}%` : '—',
      color: scoreColor(summary.avg_quiz_score).fg,
    },
    {
      icon: '💻',
      label: 'Avg Test Score',
      numericValue: summary.avg_test_score,
      value: summary.avg_test_score != null ? `${summary.avg_test_score}%` : '—',
      color: scoreColor(summary.avg_test_score).fg,
    },
    {
      icon: '✅',
      label: 'Quiz Pass Rate',
      numericValue: summary.quiz_pass_rate,
      value: summary.quiz_pass_rate != null ? `${summary.quiz_pass_rate}%` : '—',
      color: rateColor(summary.quiz_pass_rate),
    },
    {
      icon: '🏆',
      label: 'Test Pass Rate',
      numericValue: summary.test_pass_rate,
      value: summary.test_pass_rate != null ? `${summary.test_pass_rate}%` : '—',
      color: rateColor(summary.test_pass_rate),
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: '14px 16px', boxShadow: shadows.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{s.label}</div>
            </div>
            <div style={{ fontSize: font.sizeXl, fontWeight: font.weightBold, color: s.color }}>{s.value}</div>
            <MiniBar value={s.numericValue} color={s.color} />
          </div>
        ))}
      </div>

      {summary.most_common_weak_topics?.length > 0 && (
        <div style={{ background: colors.warningLight, border: `1px solid ${colors.warningBorder}`, borderRadius: radii.md, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: colors.warning }}>⚠️ Common weak topics:</span>
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

// ─── Classroom Quiz Manager ───────────────────────────────────────────────────
function ClassroomQuizManager({ classroomId }) {
  const [sections, setSections] = useState([]);
  const [allFiles, setAllFiles] = useState([]);   // all classroom files for file picker
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Generate form
  const [showGenForm, setShowGenForm] = useState(false);
  const [genTitle, setGenTitle] = useState('');
  const [genPrompt, setGenPrompt] = useState('Java programming concepts, OOP principles (classes, inheritance, polymorphism, encapsulation, abstraction), data structures, exception handling, and algorithms');
  const [genNumQ, setGenNumQ] = useState(5);
  const [genSectionId, setGenSectionId] = useState('');
  const [genFileIds, setGenFileIds] = useState([]);   // selected file IDs for context
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const DEFAULT_PROMPT = 'Java programming concepts, OOP principles (classes, inheritance, polymorphism, encapsulation, abstraction), data structures, exception handling, and algorithms';

  // Draft preview / editor
  const [draftQuestions, setDraftQuestions] = useState(null); // generated but unsaved
  const [editingQuizId, setEditingQuizId] = useState(null);   // null=new, number=existing
  const [editTitle, setEditTitle] = useState('');
  const [editQuestions, setEditQuestions] = useState([]);
  const [editSectionId, setEditSectionId] = useState('');
  const [saving, setSaving] = useState(false);

  // Collapsed sections
  const [collapsedSections, setCollapsedSections] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [quizData, secData, fileData] = await Promise.all([
        listClassroomQuizzes(classroomId),
        listSections(classroomId),
        listClassroomFiles(classroomId),
      ]);
      setQuizzes(quizData);
      setSections(secData.filter(s => s.id !== 0)); // exclude virtual "Unsectioned"
      setAllFiles(fileData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [classroomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    if (!genPrompt.trim()) { setGenError('Please enter a topic or prompt.'); return; }
    if (!genTitle.trim()) { setGenError('Please enter a quiz title.'); return; }
    setGenerating(true);
    setGenError(null);
    try {
      const res = await generateClassroomQuiz(classroomId, {
        topic_prompt: genPrompt.trim(),
        num_questions: genNumQ,
        section_id: genSectionId !== '' ? Number(genSectionId) : null,
        file_ids: genFileIds.length > 0 ? genFileIds : null,
      });
      setDraftQuestions(res.questions);
      setEditQuestions(res.questions.map(q => ({ ...q })));
      setEditTitle(genTitle.trim());
      setEditSectionId(genSectionId);
      setEditingQuizId(null); // new quiz
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleEditExisting = (quiz) => {
    setEditingQuizId(quiz.id);
    setEditTitle(quiz.title);
    setEditQuestions(JSON.parse(JSON.stringify(quiz.questions))); // deep copy
    setEditSectionId(quiz.section_id != null ? String(quiz.section_id) : '');
    setDraftQuestions(quiz.questions);
    setShowGenForm(false);
  };

  const handleSaveQuiz = async (publishStatus) => {
    setSaving(true);
    try {
      const payload = {
        title: editTitle,
        topic_prompt: genPrompt.trim() || null,
        questions: editQuestions,
        section_id: editSectionId !== '' ? Number(editSectionId) : null,
        status: publishStatus,
      };
      if (editingQuizId != null) {
        await updateClassroomQuiz(classroomId, editingQuizId, payload);
      } else {
        await saveClassroomQuiz(classroomId, payload);
      }
      setDraftQuestions(null);
      setEditQuestions([]);
      setEditTitle('');
      setGenPrompt('Java programming concepts, OOP principles (classes, inheritance, polymorphism, encapsulation, abstraction), data structures, exception handling, and algorithms');
      setGenTitle('');
      setGenSectionId('');
      setGenFileIds([]);
      setEditingQuizId(null);
      setShowGenForm(false);
      await load();
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (quiz) => {
    const newStatus = quiz.status === 'published' ? 'draft' : 'published';
    try {
      await updateClassroomQuiz(classroomId, quiz.id, { status: newStatus });
      await load();
    } catch (e) {
      alert('Failed to update status: ' + e.message);
    }
  };

  const handleDelete = async (quiz) => {
    if (!window.confirm(`Delete quiz "${quiz.title}"? This cannot be undone.`)) return;
    try {
      await deleteClassroomQuiz(classroomId, quiz.id);
      await load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const updateQField = (idx, field, value) => {
    setEditQuestions(qs => qs.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx, optIdx, value) => {
    setEditQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[optIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const deleteQuestion = (idx) => {
    setEditQuestions(qs => qs.filter((_, i) => i !== idx));
  };

  const addQuestion = () => {
    setEditQuestions(qs => [...qs, {
      id: `cq_${Date.now()}`,
      question: '',
      options: ['', '', '', ''],
      correct_index: 0,
      explanation: '',
    }]);
  };

  // Group quizzes by section
  const quizzesBySection = {};
  const unsectionedQuizzes = [];
  quizzes.forEach(q => {
    if (q.section_id != null) {
      (quizzesBySection[q.section_id] = quizzesBySection[q.section_id] || []).push(q);
    } else {
      unsectionedQuizzes.push(q);
    }
  });

  const renderQuizCard = (quiz) => (
    <div key={quiz.id} style={{
      border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: '14px 16px',
      marginBottom: 10, background: colors.surface, display: 'flex', alignItems: 'flex-start',
      gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: font.weightSemibold, fontSize: font.sizeSm, color: colors.text }}>
            📝 {quiz.title}
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
            background: quiz.status === 'published' ? '#dcfce7' : '#f3f4f6',
            color: quiz.status === 'published' ? '#16a34a' : colors.textMuted,
          }}>
            {quiz.status === 'published' ? '✓ Published' : 'Draft'}
          </span>
        </div>
        <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>
          {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
          {quiz.topic_prompt && <span> · <em>{quiz.topic_prompt.slice(0, 60)}{quiz.topic_prompt.length > 60 ? '…' : ''}</em></span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => handleEditExisting(quiz)} style={{
          padding: '5px 12px', fontSize: 12, border: `1px solid ${colors.border}`,
          borderRadius: radii.sm, cursor: 'pointer', background: colors.bg, color: colors.text,
        }}>✏️ Edit</button>
        <button onClick={() => handleTogglePublish(quiz)} style={{
          padding: '5px 12px', fontSize: 12, border: 'none', borderRadius: radii.sm, cursor: 'pointer',
          background: quiz.status === 'published' ? '#fef9c3' : '#dcfce7',
          color: quiz.status === 'published' ? '#ca8a04' : '#16a34a',
        }}>
          {quiz.status === 'published' ? '↩ Unpublish' : '📤 Publish'}
        </button>
        <button onClick={() => handleDelete(quiz)} style={{
          padding: '5px 12px', fontSize: 12, border: 'none', borderRadius: radii.sm, cursor: 'pointer',
          background: '#fee2e2', color: '#dc2626',
        }}>🗑️ Delete</button>
      </div>
    </div>
  );

  const renderSectionGroup = (title, sectionKey, quizList) => {
    const isOpen = !collapsedSections[sectionKey];
    return (
      <div key={sectionKey} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, marginBottom: 12, overflow: 'hidden' }}>
        <button
          onClick={() => setCollapsedSections(c => ({ ...c, [sectionKey]: !c[sectionKey] }))}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', background: colors.bg, border: 'none',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 12, color: colors.textMuted }}>{isOpen ? '▼' : '▶'}</span>
          <span style={{ fontWeight: font.weightSemibold, fontSize: font.sizeSm, flex: 1, color: colors.text }}>{title}</span>
          <span style={{ fontSize: font.sizeXs, color: colors.textMuted }}>
            {quizList.length} quiz{quizList.length !== 1 ? 'zes' : ''}
          </span>
        </button>
        {isOpen && (
          <div style={{ padding: '8px 12px 12px' }}>
            {quizList.length === 0
              ? <p style={{ color: colors.textMuted, fontSize: font.sizeSm, margin: '8px 4px' }}>No quizzes in this section.</p>
              : quizList.map(renderQuizCard)
            }
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading quizzes…</div>;
  if (error) return <div style={{ padding: 20, color: '#dc2626' }}>Error: {error}</div>;

  return (
    <div>
      {/* Header + generate button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.text }}>
          Classroom Quizzes
        </h3>
        {!draftQuestions && (
          <button
            onClick={() => { setShowGenForm(v => !v); setGenError(null); }}
            style={{
              padding: '8px 18px', background: colors.primary, color: '#fff',
              border: 'none', borderRadius: radii.sm, cursor: 'pointer',
              fontSize: font.sizeSm, fontWeight: font.weightSemibold,
            }}
          >
            ✨ Generate New Quiz
          </button>
        )}
      </div>

      {/* Generate form */}
      {showGenForm && !draftQuestions && (
        <div style={{
          ...card.base, padding: 20, marginBottom: 24,
          border: `1px solid ${colors.primary}`, background: '#f0f7ff',
        }}>
          <h4 style={{ margin: '0 0 16px', fontSize: font.sizeSm, fontWeight: font.weightBold, color: colors.primary }}>
            ✨ Generate Quiz from Classroom Documents
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: font.sizeXs, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 4 }}>
                Quiz Title *
              </label>
              <input
                value={genTitle}
                onChange={e => setGenTitle(e.target.value)}
                placeholder="e.g. Week 3 Quiz"
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: font.sizeXs, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 4 }}>
                Number of Questions
              </label>
              <input
                type="number" min={1} max={20}
                value={genNumQ}
                onChange={e => setGenNumQ(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: font.sizeXs, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 4 }}>
              Topic / Prompt * <span style={{ fontWeight: 400, color: colors.textMuted }}>(what should the quiz cover?)</span>
            </label>
            <textarea
              value={genPrompt}
              onChange={e => setGenPrompt(e.target.value)}
              placeholder="e.g. Java inheritance and polymorphism, OOP design patterns, Exception handling..."
              rows={2}
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: font.sizeXs, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 4 }}>
              Section (optional)
            </label>
            <select
              value={genSectionId}
              onChange={e => setGenSectionId(e.target.value)}
              style={{ padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, minWidth: 200 }}
            >
              <option value="">— No section —</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* File picker */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <label style={{ fontSize: font.sizeXs, fontWeight: font.weightSemibold, color: colors.textSecondary }}>
                Source Files (optional)
              </label>
              <span style={{ fontSize: font.sizeXs, color: colors.textMuted }}>
                — leave all unchecked to search all documents
              </span>
              {allFiles.length > 0 && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setGenFileIds(allFiles.map(f => f.id))}
                    style={{ fontSize: 11, padding: '2px 8px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', background: colors.bg, color: colors.textSecondary }}
                  >Select All</button>
                  <button
                    type="button"
                    onClick={() => setGenFileIds([])}
                    style={{ fontSize: 11, padding: '2px 8px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', background: colors.bg, color: colors.textSecondary }}
                  >Clear</button>
                </div>
              )}
            </div>
            <div style={{
              maxHeight: 160, overflowY: 'auto',
              border: `1px solid ${colors.border}`, borderRadius: radii.sm,
              background: colors.bg, padding: '6px 8px',
            }}>
              {allFiles.length === 0 ? (
                <div style={{ padding: '10px 8px', fontSize: font.sizeXs, color: colors.textMuted, fontStyle: 'italic' }}>
                  No files uploaded to this classroom yet. Upload files in the Learning Materials tab first.
                </div>
              ) : allFiles.map(f => {
                const checked = genFileIds.includes(f.id);
                return (
                  <label key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 6px', borderRadius: radii.sm, cursor: 'pointer',
                    background: checked ? '#eff6ff' : 'transparent',
                    marginBottom: 2,
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setGenFileIds(ids =>
                        ids.includes(f.id) ? ids.filter(id => id !== f.id) : [...ids, f.id]
                      )}
                      style={{ accentColor: colors.primary, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: font.sizeXs, color: checked ? colors.primary : colors.text, fontWeight: checked ? font.weightSemibold : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📄 {f.filename}
                    </span>
                  </label>
                );
              })}
            </div>
            {genFileIds.length > 0 && (
              <div style={{ marginTop: 5, fontSize: font.sizeXs, color: colors.primary, fontWeight: font.weightSemibold }}>
                ✓ Using {genFileIds.length} of {allFiles.length} file{allFiles.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {genError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: radii.sm, fontSize: font.sizeSm, color: '#dc2626' }}>
              ❌ {genError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                padding: '9px 20px', background: generating ? '#93c5fd' : colors.primary,
                color: '#fff', border: 'none', borderRadius: radii.sm, cursor: generating ? 'not-allowed' : 'pointer',
                fontSize: font.sizeSm, fontWeight: font.weightSemibold,
              }}
            >
              {generating ? '⏳ Generating…' : '✨ Generate Questions'}
            </button>
            <button
              onClick={() => setShowGenForm(false)}
              style={{ padding: '9px 16px', background: 'transparent', color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', fontSize: font.sizeSm }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit / Preview panel (for both new draft and editing existing) */}
      {draftQuestions && (
        <div style={{ ...card.base, padding: 20, marginBottom: 28, border: `2px solid ${colors.primary}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: font.sizeSm, fontWeight: font.weightBold, color: colors.primary }}>
              {editingQuizId != null ? '✏️ Edit Quiz' : '🔍 Preview & Edit Generated Questions'}
            </h4>
            <button
              onClick={() => { setDraftQuestions(null); setEditQuestions([]); setEditingQuizId(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: colors.textMuted }}
            >✕</button>
          </div>

          {/* Title & section row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: font.sizeXs, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 4 }}>Quiz Title *</label>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: font.sizeXs, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 4 }}>Section</label>
              <select
                value={editSectionId}
                onChange={e => setEditSectionId(e.target.value)}
                style={{ padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm }}
              >
                <option value="">— None —</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Questions */}
          {editQuestions.map((q, qIdx) => (
            <div key={q.id || qIdx} style={{
              border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: '14px 16px',
              marginBottom: 12, background: colors.bg, position: 'relative',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: font.sizeXs, fontWeight: font.weightBold, color: colors.textMuted }}>Q{qIdx + 1}</span>
                <button
                  onClick={() => deleteQuestion(qIdx)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#dc2626' }}
                  title="Delete this question"
                >🗑️</button>
              </div>

              {/* Question text */}
              <textarea
                value={q.question}
                onChange={e => updateQField(qIdx, 'question', e.target.value)}
                placeholder="Question text…"
                rows={2}
                style={{ width: '100%', padding: '7px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm, resize: 'vertical', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }}
              />

              {/* Options */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                {q.options.map((opt, optIdx) => (
                  <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="radio"
                      name={`correct_${qIdx}`}
                      checked={q.correct_index === optIdx}
                      onChange={() => updateQField(qIdx, 'correct_index', optIdx)}
                      title="Mark as correct answer"
                    />
                    <input
                      value={opt}
                      onChange={e => updateOption(qIdx, optIdx, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                      style={{
                        flex: 1, padding: '6px 8px', border: `1px solid ${q.correct_index === optIdx ? '#16a34a' : colors.border}`,
                        borderRadius: radii.sm, fontSize: font.sizeSm,
                        background: q.correct_index === optIdx ? '#f0fdf4' : 'transparent',
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Explanation */}
              <input
                value={q.explanation}
                onChange={e => updateQField(qIdx, 'explanation', e.target.value)}
                placeholder="Explanation (shown to students after answering)…"
                style={{ width: '100%', padding: '6px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeXs, color: colors.textSecondary, boxSizing: 'border-box' }}
              />
            </div>
          ))}

          {/* Add question button */}
          <button
            onClick={addQuestion}
            style={{
              width: '100%', padding: '10px', marginBottom: 16,
              border: `1px dashed ${colors.border}`, borderRadius: radii.md,
              background: 'transparent', cursor: 'pointer', fontSize: font.sizeSm, color: colors.textMuted,
            }}
          >
            + Add Question
          </button>

          {/* Save actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => handleSaveQuiz('draft')}
              disabled={saving}
              style={{
                padding: '9px 20px', background: '#f3f4f6', color: colors.text,
                border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: font.sizeSm, fontWeight: font.weightSemibold,
              }}
            >
              {saving ? '…' : '💾 Save Draft'}
            </button>
            <button
              onClick={() => handleSaveQuiz('published')}
              disabled={saving}
              style={{
                padding: '9px 20px', background: saving ? '#86efac' : '#16a34a', color: '#fff',
                border: 'none', borderRadius: radii.sm, cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: font.sizeSm, fontWeight: font.weightSemibold,
              }}
            >
              {saving ? '…' : '📤 Publish to Students'}
            </button>
          </div>
        </div>
      )}

      {/* Quiz list by section */}
      {quizzes.length === 0 && !showGenForm && !draftQuestions ? (
        <div style={{ ...card.base, textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: font.sizeLg, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 8 }}>
            No quizzes yet
          </div>
          <div style={{ fontSize: font.sizeSm, color: colors.textMuted }}>
            Generate a quiz from your uploaded classroom documents and publish it for students.
          </div>
        </div>
      ) : (
        <>
          {sections.map(sec => {
            const secQuizzes = quizzesBySection[sec.id] || [];
            return renderSectionGroup(`📂 ${sec.name}`, String(sec.id), secQuizzes);
          })}
          {unsectionedQuizzes.length > 0 && renderSectionGroup('📎 Unsectioned', '__unsectioned', unsectionedQuizzes)}
        </>
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
  const [classroomCategory, setClassroomCategory] = useState(state?.category || 'Official Lessons');
  const [editingCategory,   setEditingCategory]   = useState(false);
  const [categoryInput,     setCategoryInput]     = useState(state?.category || 'Official Lessons');
  const [categoryLoading,   setCategoryLoading]   = useState(false);
  const [categoryError,     setCategoryError]     = useState('');

  const [analytics,        setAnalytics]        = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [expandedStudent,  setExpandedStudent]  = useState(null);
  const [sortKey,          setSortKey]          = useState('full_name');
  const [sortAsc,          setSortAsc]          = useState(true);
  const [materialsData,    setMaterialsData]    = useState(null);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [quizzesData,      setQuizzesData]      = useState(null);
  const [quizzesLoading,   setQuizzesLoading]   = useState(true);
  const [studentWorkById,  setStudentWorkById]  = useState({});
  const [studentWorkLoading, setStudentWorkLoading] = useState({});
  const [expandedWorkItem, setExpandedWorkItem] = useState({});
  const [activeTab,        setActiveTab]        = useState(state?.initialTab || 'materials');
  const [classroomView,    setClassroomView]    = useState(state?.initialClassroomView || 'materials');

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

  useEffect(() => {
    if (!isTeacher) return;
    setMaterialsLoading(true);
    getClassroomMaterialsWithProgress(classroomId)
      .then(setMaterialsData)
      .catch(console.error)
      .finally(() => setMaterialsLoading(false));
  }, [classroomId, isTeacher]);

  useEffect(() => {
    if (!isTeacher) return;
    setQuizzesLoading(true);
    getClassroomQuizzesWithProgress(classroomId)
      .then(setQuizzesData)
      .catch(console.error)
      .finally(() => setQuizzesLoading(false));
  }, [classroomId, isTeacher]);

  async function handleSaveCategory() {
    const trimmed = categoryInput.trim();
    if (!trimmed) { setCategoryError('Category cannot be empty'); return; }
    setCategoryLoading(true);
    setCategoryError('');
    try {
      const updated = await updateClassroomCategory(classroomId, trimmed);
      setClassroomCategory(updated.category);
      setEditingCategory(false);
    } catch (e) {
      setCategoryError(e.message || 'Failed to update category');
    } finally {
      setCategoryLoading(false);
    }
  }

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

  const hasWorkDetails = (item) => {
    return Boolean(item?.result_data?.review || item?.result_data?.question || item?.content);
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
            🏫 {classroomName}
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
          {/* Category badge / inline editor */}
          {editingCategory ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <input
                value={categoryInput}
                onChange={e => setCategoryInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveCategory();
                  if (e.key === 'Escape') { setEditingCategory(false); setCategoryError(''); setCategoryInput(classroomCategory); }
                }}
                style={{ padding: '4px 8px', fontSize: font.sizeSm, border: `1px solid ${categoryError ? '#ef4444' : colors.border}`, borderRadius: radii.sm, outline: 'none', width: 160 }}
                autoFocus
                maxLength={100}
              />
              <button onClick={handleSaveCategory} disabled={categoryLoading}
                style={{ ...btn.primary, padding: '4px 10px', fontSize: font.sizeXs, whiteSpace: 'nowrap' }}>
                {categoryLoading ? '…' : 'Save'}
              </button>
              <button onClick={() => { setEditingCategory(false); setCategoryError(''); setCategoryInput(classroomCategory); }}
                style={{ ...btn.secondary, padding: '4px 10px', fontSize: font.sizeXs, whiteSpace: 'nowrap' }}>
                Cancel
              </button>
              {categoryError && <span style={{ color: '#ef4444', fontSize: font.sizeXs }}>{categoryError}</span>}
            </div>
          ) : (
            <button
              onClick={() => { setEditingCategory(true); setCategoryInput(classroomCategory); }}
              style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', borderRadius: radii.full, padding: '2px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Click to edit category"
            >
              {classroomCategory} ✏️
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `2px solid ${colors.border}`, marginBottom: 24 }}>
        {[
          { key: 'materials', label: '📁 Learning Materials' },
          { key: 'quizzes',   label: '📝 Quizzes & Tests' },
          { key: 'official-lessons', label: '📊 Classroom Analysis' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 24px',
              fontSize: font.sizeSm, fontWeight: font.weightSemibold,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: activeTab === tab.key ? colors.primary : colors.textMuted,
              borderBottom: activeTab === tab.key ? `2px solid ${colors.primary}` : '2px solid transparent',
              marginBottom: -2,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Materials tab */}
      {activeTab === 'materials' && (
        <ClassroomSections classroomId={classroomId} />
      )}

      {/* Quizzes & Tests tab */}
      {activeTab === 'quizzes' && (
        <ClassroomQuizManager classroomId={classroomId} />
      )}

      {/* Official Lessons category header */}
      {activeTab === 'official-lessons' && (
        <div style={{ ...card.base, padding: 18, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.text }}>Classroom Analysis</div>
              <div style={{ fontSize: font.sizeSm, color: colors.textMuted }}>
                <strong>{classroomName}</strong> ({classCode || classroomId}) · Category: <strong>{classroomCategory}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setClassroomView('materials')}
                style={{
                  padding: '8px 12px',
                  borderRadius: radii.sm,
                  border: classroomView === 'materials' ? `1px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  background: classroomView === 'materials' ? colors.primaryLight : colors.surface,
                  color: classroomView === 'materials' ? colors.primary : colors.textSecondary,
                  fontSize: font.sizeSm,
                  fontWeight: font.weightSemibold,
                  cursor: 'pointer',
                }}
              >
                📚 Materials
              </button>
              <button
                onClick={() => setClassroomView('quizzes')}
                style={{
                  padding: '8px 12px',
                  borderRadius: radii.sm,
                  border: classroomView === 'quizzes' ? `1px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  background: classroomView === 'quizzes' ? colors.primaryLight : colors.surface,
                  color: classroomView === 'quizzes' ? colors.primary : colors.textSecondary,
                  fontSize: font.sizeSm,
                  fontWeight: font.weightSemibold,
                  cursor: 'pointer',
                }}
              >
                📝 Quizzes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Materials View */}
      {activeTab === 'official-lessons' && classroomView === 'materials' && materialsLoading && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: colors.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: font.sizeMd }}>Loading materials…</div>
        </div>
      )}

      {activeTab === 'official-lessons' && classroomView === 'materials' && !materialsLoading && (!materialsData || materialsData.length === 0) && (
        <div style={{ ...card.base, textAlign: 'center', padding: '56px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
          <div style={{ fontSize: font.sizeLg, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 8 }}>No materials uploaded yet</div>
          <div style={{ fontSize: font.sizeSm, color: colors.textMuted }}>Upload materials in the Learning Materials tab</div>
        </div>
      )}

      {activeTab === 'official-lessons' && classroomView === 'materials' && !materialsLoading && materialsData && materialsData.length > 0 && (
        <div>
          {materialsData.map((material, idx) => (
            <div key={material.file_id} style={{ ...card.base, padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: font.sizeMd, fontWeight: font.weightBold, color: colors.text }}>{material.filename}</div>
                  <div style={{ fontSize: font.sizeSm, color: colors.textMuted, marginTop: 4 }}>
                    Uploaded {new Date(material.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.primary }}>
                    {material.read_count}/{material.total_students}
                  </div>
                  <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{material.read_percentage}% read</div>
                </div>
              </div>

              <div style={{ background: colors.bg, borderRadius: radii.sm, padding: 12, fontSize: font.sizeXs }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                  {material.student_progress.map(sp => (
                    <div key={sp.student_id} style={{ padding: '8px 10px', background: colors.surface, borderRadius: radii.sm, border: `1px solid ${sp.marked_read ? '#bbf7d0' : colors.border}` }}>
                      <div style={{ fontWeight: 600, fontSize: font.sizeXs }}>{sp.student_name}</div>
                      <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{sp.student_email}</div>
                      <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: sp.marked_read ? '#16a34a' : colors.textMuted }}>
                        {sp.marked_read ? '✓ Read' : '○ Not read'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quizzes View */}
      {activeTab === 'official-lessons' && classroomView === 'quizzes' && quizzesLoading && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: colors.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: font.sizeMd }}>Loading quizzes…</div>
        </div>
      )}

      {activeTab === 'official-lessons' && classroomView === 'quizzes' && !quizzesLoading && (!quizzesData || quizzesData.length === 0) && (
        <div style={{ ...card.base, textAlign: 'center', padding: '56px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <div style={{ fontSize: font.sizeLg, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 8 }}>No quizzes created yet</div>
          <div style={{ fontSize: font.sizeSm, color: colors.textMuted }}>Create quizzes in the Quizzes & Tests tab</div>
        </div>
      )}

      {activeTab === 'official-lessons' && classroomView === 'quizzes' && !quizzesLoading && quizzesData && quizzesData.length > 0 && (
        <div>
          {quizzesData.map((quiz, idx) => (
            <div key={quiz.quiz_id} style={{ ...card.base, padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: font.sizeMd, fontWeight: font.weightBold, color: colors.text }}>{quiz.title}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, background: quiz.status === 'published' ? '#dcfce7' : '#f3f4f6', color: quiz.status === 'published' ? '#16a34a' : colors.textMuted, borderRadius: radii.full, padding: '2px 8px' }}>
                      {quiz.status}
                    </span>
                  </div>
                  <div style={{ fontSize: font.sizeSm, color: colors.textMuted }}>
                    Created {new Date(quiz.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.primary }}>
                    {quiz.attempt_count}/{quiz.total_students}
                  </div>
                  <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{quiz.attempt_percentage}% attempted</div>
                </div>
              </div>

              <div style={{ background: colors.bg, borderRadius: radii.sm, padding: 12, fontSize: font.sizeXs }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                  {quiz.student_progress.map(sp => (
                    <div key={sp.student_id} style={{ padding: '8px 10px', background: colors.surface, borderRadius: radii.sm, border: `1px solid ${sp.attempted ? '#bbf7d0' : colors.border}` }}>
                      <div style={{ fontWeight: 600, fontSize: font.sizeXs }}>{sp.student_name}</div>
                      <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{sp.student_email}</div>
                      <div style={{ marginTop: 4 }}>
                        {sp.attempted ? (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ Attempted ({sp.attempt_count}x)</div>
                            {sp.best_score != null && (
                              <div style={{ marginTop: 2 }}>
                                <ScoreBadge score={sp.best_score} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted }}>○ Not attempted</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics tab - kept for reference */}
      {activeTab === 'official-lessons' && classroomView === 'analytics' && analyticsLoading && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: colors.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: font.sizeMd }}>Loading student data…</div>
        </div>
      )}

      {activeTab === 'official-lessons' && classroomView === 'analytics' && !analyticsLoading && analytics && analytics.students.length === 0 && (
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

      {activeTab === 'official-lessons' && classroomView === 'analytics' && !analyticsLoading && analytics && analytics.students.length > 0 && (
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
