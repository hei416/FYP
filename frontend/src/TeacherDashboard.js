import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  createClassroom, getMyClassrooms, getOfficialClassrooms,
  createSection, listSections, deleteSection, renameSection,
  uploadClassroomFileToSection, deleteClassroomFile, moveFileToSection,
  getOfficialAggregateCourseProgress, getOfficialAggregateStudentWork,
  getOfficialClassroomList, getClassroomCourseProgress, getClassroomStudentWork,
  toggleClassroomPublic,
} from './classroomService';
import { radii, font, card, shadows } from './theme';
import { btn, colors } from './theme';
// Section-based document management — also used by TeacherClassroomDetail (imported from here)
export function ClassroomSections({ classroomId }) {
  const [sections, setSections] = useState([]);      // sections from API (id > 0)
  const [unsectioned, setUnsectioned] = useState([]); // files where section_id === null
  const [loading, setLoading] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [uploadState, setUploadState] = useState({}); // key → { file, uploading, error }
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [dragFileId, setDragFileId] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const dragCounter = React.useRef({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSections(classroomId);
      // id === 0 is the "unsectioned" virtual entry from backend
      setSections(data.filter(s => s.id !== 0));
      setUnsectioned(data.find(s => s.id === 0)?.files || []);
    } catch (e) {
      setSections([]); setUnsectioned([]);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreateSection(e) {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    setCreating(true);
    try {
      await createSection(classroomId, { name: newSectionName.trim() });
      setNewSectionName('');
      await load();
    } finally { setCreating(false); }
  }

  async function handleDeleteSection(sectionId) {
    if (!window.confirm('Delete this section? Files inside will become unsectioned.')) return;
    await deleteSection(classroomId, sectionId);
    await load();
  }

  async function handleRename(sectionId) {
    if (!renameValue.trim()) return;
    await renameSection(classroomId, sectionId, renameValue.trim());
    setRenamingId(null);
    await load();
  }

  async function handleUpload(sectionId) {
    const key = sectionId != null ? String(sectionId) : 'unsectioned';
    const file = uploadState[key]?.file;
    if (!file) return;
    setUploadState(s => ({ ...s, [key]: { ...s[key], uploading: true, error: '' } }));
    try {
      await uploadClassroomFileToSection(classroomId, file, sectionId || null);
      setUploadState(s => ({ ...s, [key]: { file: null, uploading: false, error: '' } }));
      await load();
    } catch (e) {
      setUploadState(s => ({ ...s, [key]: { ...s[key], uploading: false, error: 'Upload failed' } }));
    }
  }

  async function handleDeleteFile(fileId) {
    if (!window.confirm('Delete this file and its AI index?')) return;
    await deleteClassroomFile(classroomId, fileId);
    await load();
  }

  // ─── Drag-and-drop handlers ───────────────────────────────────────────────
  function onFileDragStart(e, fileId) {
    setDragFileId(fileId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onFileDragEnd() {
    setDragFileId(null);
    setDragOverKey(null);
    dragCounter.current = {};
  }

  function onZoneDragEnter(e, key) {
    e.preventDefault();
    dragCounter.current[key] = (dragCounter.current[key] || 0) + 1;
    setDragOverKey(key);
  }

  function onZoneDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onZoneDragLeave(e, key) {
    dragCounter.current[key] = (dragCounter.current[key] || 0) - 1;
    if (dragCounter.current[key] <= 0) {
      dragCounter.current[key] = 0;
      setDragOverKey(prev => prev === key ? null : prev);
    }
  }

  async function onZoneDrop(e, targetSectionId) {
    e.preventDefault();
    const key = targetSectionId != null ? String(targetSectionId) : 'unsectioned';
    dragCounter.current[key] = 0;
    setDragOverKey(null);
    if (dragFileId == null) return;
    try {
      await moveFileToSection(classroomId, dragFileId, targetSectionId);
    } catch (_) { /* ignore */ }
    setDragFileId(null);
    await load();
  }

  function renderSection(title, sectionId, files, isDeletable = true) {
    const key = sectionId != null ? String(sectionId) : 'unsectioned';
    const us = uploadState[key] || {};
    const isClosed = collapsed[key];
    const isRenaming = renamingId != null && renamingId === sectionId;
    const fileIcon = (mime) => mime?.includes('pdf') ? '📄' : mime?.includes('word') ? '📝' : '📋';
    const inputId = `file-input-${classroomId}-${key}`;

    const isDragOver = dragOverKey === key;

    return (
      <div key={key}
        style={{
          border: `1px solid ${isDragOver ? colors.primary : colors.border}`,
          borderRadius: radii.sm, marginBottom: 8, overflow: 'hidden',
          background: isDragOver ? colors.primaryLight : undefined,
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onDragEnter={e => onZoneDragEnter(e, key)}
        onDragOver={onZoneDragOver}
        onDragLeave={e => onZoneDragLeave(e, key)}
        onDrop={e => onZoneDrop(e, sectionId)}
      >
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: isDragOver ? colors.primaryLight : colors.bg, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}>
          <span style={{ fontSize: 10, color: colors.textMuted, width: 10 }}>{isClosed ? '▶' : '▼'}</span>
          {isRenaming ? (
            <form onSubmit={e => { e.preventDefault(); handleRename(sectionId); }}
              style={{ flex: 1, display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                style={{ flex: 1, padding: '3px 8px', border: `1px solid ${colors.primary}`, borderRadius: radii.sm, fontSize: font.sizeSm, outline: 'none' }} />
              <button type="submit" style={{ padding: '3px 10px', fontSize: 12, background: colors.primary, color: '#fff', border: 'none', borderRadius: radii.sm, cursor: 'pointer', fontWeight: 600 }}>✓</button>
              <button type="button" onClick={() => setRenamingId(null)}
                style={{ padding: '3px 8px', fontSize: 12, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer' }}>✕</button>
            </form>
          ) : (
            <>
              <span style={{ fontWeight: font.weightSemibold, flex: 1, fontSize: font.sizeSm, color: colors.text }}>{title}</span>
              <span style={{ fontSize: 11, color: colors.textMuted, background: colors.divider, borderRadius: radii.full, padding: '1px 7px' }}>
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
              {isDeletable && sectionId != null && (
                <>
                  <button onClick={e => { e.stopPropagation(); setRenamingId(sectionId); setRenameValue(title); }}
                    title="Rename section"
                    style={{ padding: '3px 7px', fontSize: 12, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', marginLeft: 4, color: colors.textSecondary }}>✏️</button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteSection(sectionId); }}
                    title="Delete section"
                    style={{ padding: '3px 7px', fontSize: 12, background: 'transparent', border: `1px solid ${colors.dangerBorder}`, borderRadius: radii.sm, cursor: 'pointer', color: colors.danger, marginLeft: 2 }}>🗑</button>
                </>
              )}
            </>
          )}
        </div>

        {!isClosed && (
          <div style={{ padding: '12px', background: colors.surface }}>
            {/* Styled file pick row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 8 }}>
              <input
                id={inputId}
                key={`${key}-${files.length}`}
                type="file" accept=".pdf,.txt,.docx"
                style={{ display: 'none' }}
                onChange={e => setUploadState(s => ({ ...s, [key]: { ...s[key], file: e.target.files[0] } }))}
                disabled={us.uploading}
              />
              <label htmlFor={inputId} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                border: `1.5px dashed ${us.file ? colors.primary : colors.border}`,
                borderRadius: radii.sm, padding: '7px 10px', cursor: 'pointer',
                background: us.file ? colors.primaryLight : colors.bg,
                transition: 'all 0.15s', minWidth: 0,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{us.file ? '📄' : '☁️'}</span>
                {us.file ? (
                  <span style={{ fontSize: font.sizeXs, color: colors.primary, fontWeight: font.weightSemibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {us.file.name}
                  </span>
                ) : (
                  <span style={{ fontSize: font.sizeXs, color: colors.textMuted }}>Click to choose a file…</span>
                )}
              </label>
              {us.file && !us.uploading && (
                <button
                  type="button"
                  onClick={() => setUploadState(s => ({ ...s, [key]: { ...s[key], file: null } }))}
                  style={{ padding: '0 10px', fontSize: 13, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, cursor: 'pointer', color: colors.textMuted, flexShrink: 0 }}
                >✕</button>
              )}
              <button onClick={() => handleUpload(sectionId)} disabled={us.uploading || !us.file}
                style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap', flexShrink: 0, opacity: (!us.file || us.uploading) ? 0.5 : 1 }}>
                {us.uploading ? '⏳' : '⬆ Upload'}
              </button>
            </div>
            {us.error && (
              <div style={{ color: colors.danger, fontSize: font.sizeXs, marginBottom: 8, padding: '5px 8px', background: colors.dangerLight, borderRadius: radii.sm, border: `1px solid ${colors.dangerBorder}` }}>
                {us.error}
              </div>
            )}
            {/* File list */}
            {files.length === 0 ? (
              <div style={{
                color: isDragOver ? colors.primary : colors.textMuted,
                fontSize: font.sizeXs, padding: '8px 2px', textAlign: 'center',
                borderRadius: radii.sm,
                border: isDragOver ? `1.5px dashed ${colors.primary}` : '1.5px dashed transparent',
                background: isDragOver ? colors.primaryLight : undefined,
                transition: 'all 0.15s',
              }}>
                {isDragOver && dragFileId ? '⬇ Drop to move here' : 'No files yet — upload one above.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {isDragOver && dragFileId && (
                  <div style={{ color: colors.primary, fontSize: font.sizeXs, textAlign: 'center', padding: '4px', background: colors.primaryLight, borderRadius: radii.sm, border: `1px dashed ${colors.primary}` }}>
                    ⬇ Drop to move here
                  </div>
                )}
                {files.map(f => (
                  <div key={f.id}
                    draggable={true}
                    onDragStart={e => onFileDragStart(e, f.id)}
                    onDragEnd={onFileDragEnd}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                      borderRadius: radii.sm, background: colors.bg, border: `1px solid ${colors.border}`,
                      opacity: dragFileId === f.id ? 0.4 : 1,
                      cursor: 'grab',
                      transition: 'opacity 0.15s',
                    }}>
                    <span title="Drag to move" style={{ fontSize: 12, color: colors.textMuted, flexShrink: 0, cursor: 'grab', lineHeight: 1 }}>⠿</span>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{fileIcon(f.mime_type)}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: font.sizeXs, fontWeight: font.weightMedium }}>{f.filename}</span>
                    <span style={{ color: colors.textMuted, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ''}
                    </span>
                    <button onClick={() => handleDeleteFile(f.id)} title="Delete file"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.danger, fontSize: 14, flexShrink: 0, padding: '0 2px', lineHeight: 1 }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const totalFiles = sections.reduce((n, s) => n + s.files.length, 0) + unsectioned.length;

  return (
    <div style={{ marginTop: 16 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: radii.sm,
          padding: '8px 12px', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: colors.text, display: 'flex', alignItems: 'center', gap: 6 }}>
          📁 Learning Sections
          <span style={{ background: totalFiles > 0 ? colors.primaryLight : colors.divider, color: totalFiles > 0 ? colors.primary : colors.textMuted, borderRadius: radii.full, padding: '1px 7px', fontSize: 11, fontWeight: font.weightBold }}>
            {sections.length} section{sections.length !== 1 ? 's' : ''} · {totalFiles} file{totalFiles !== 1 ? 's' : ''}
          </span>
        </span>
        <span style={{ color: colors.textMuted, fontSize: 11, fontWeight: 600 }}>{expanded ? '▲ Hide' : '▼ Manage'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 6, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radii.sm, padding: 12 }}>
          {/* Drag-in-progress banner */}
          {dragFileId != null && (
            <div style={{ marginBottom: 10, padding: '7px 12px', background: colors.primaryLight, border: `1px solid ${colors.primary}`, borderRadius: radii.sm, fontSize: font.sizeXs, color: colors.primary, fontWeight: font.weightSemibold }}>
              🖐 Dragging a file — drop it onto any section below to move it.
            </div>
          )}
          {/* Create section */}
          <form onSubmit={handleCreateSection} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input type="text" placeholder="New section name (e.g. Week 1, Introduction)…"
              value={newSectionName} onChange={e => setNewSectionName(e.target.value)} disabled={creating}
              style={{ flex: 1, padding: '6px 10px', border: `1px solid ${colors.border}`, borderRadius: radii.sm, fontSize: font.sizeSm }} />
            <button type="submit" disabled={creating || !newSectionName.trim()}
              style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap', opacity: !newSectionName.trim() ? 0.5 : 1 }}>
              {creating ? '…' : '+ Section'}
            </button>
          </form>

          {loading ? (
            <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>Loading…</div>
          ) : (
            <>
              {sections.map(s => renderSection(s.name, s.id, s.files))}
              {renderSection('📎 Unsectioned', null, unsectioned, false)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Course-progress helpers (used in the Official Classroom panel) ──────────
const _scoreColor = (s) => {
  if (s == null) return { bg: '#f3f4f6', fg: '#9ca3af' };
  if (s >= 70) return { bg: '#dcfce7', fg: '#16a34a' };
  if (s >= 50) return { bg: '#fef9c3', fg: '#ca8a04' };
  return { bg: '#fee2e2', fg: '#dc2626' };
};
const _rateColor = (r) => r == null ? '#9ca3af' : r >= 60 ? '#16a34a' : r >= 40 ? '#ca8a04' : '#dc2626';
const _passRate = (passed, attempted) => attempted > 0 ? Math.round((passed / attempted) * 100) : null;
const _studentStatus = (s) => {
  const exRate = _passRate(s.quizzes_passed, s.quizzes_attempted);
  const chRate = _passRate(s.tests_passed, s.tests_attempted);
  const hasActivity = s.quizzes_attempted > 0 || s.tests_attempted > 0;
  if (!hasActivity) return { dot: '⚪', label: 'No Activity', bg: '#f3f4f6', fg: '#9ca3af' };
  if ((exRate !== null && exRate < 40) || (chRate !== null && chRate < 40))
    return { dot: '🔴', label: 'At Risk', bg: '#fee2e2', fg: '#dc2626' };
  if ((exRate !== null && exRate < 60) || (chRate !== null && chRate < 60) || (s.weak_topics?.length >= 3))
    return { dot: '🟡', label: 'Needs Attention', bg: '#fef9c3', fg: '#ca8a04' };
  return { dot: '🟢', label: 'On Track', bg: '#dcfce7', fg: '#16a34a' };
};

function _ScoreBadge({ score }) {
  if (score == null) return <span style={{ color: '#9ca3af' }}>—</span>;
  const { bg, fg } = _scoreColor(score);
  return <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: bg, color: fg }}>{score}%</span>;
}

function _PassRateBadge({ passed, attempted, tooltip }) {
  if (attempted === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
  const rate = _passRate(passed, attempted);
  return (
    <span title={tooltip} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{passed}/{attempted}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: _rateColor(rate) }}>{rate}%</span>
    </span>
  );
}

function _MiniBar({ value, color }) {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ marginTop: 8, background: '#e5e7eb', borderRadius: 9999, height: 5, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9999, transition: 'width 0.5s ease' }} />
    </div>
  );
}

function _CourseSummaryBar({ summary }) {
  if (!summary) return null;
  const stats = [
    { icon: '🎯', label: 'Avg Completion',  val: summary.avg_completion_percentage, fmt: (v) => `${v}%`, color: _scoreColor(summary.avg_completion_percentage).fg },
    { icon: '📝', label: 'Avg Quiz Score',  val: summary.avg_quiz_score,            fmt: (v) => `${v}%`, color: _scoreColor(summary.avg_quiz_score).fg },
    { icon: '💻', label: 'Avg Test Score',  val: summary.avg_test_score,            fmt: (v) => `${v}%`, color: _scoreColor(summary.avg_test_score).fg },
    { icon: '✅', label: 'Quiz Pass Rate',  val: summary.quiz_pass_rate,            fmt: (v) => `${v}%`, color: _rateColor(summary.quiz_pass_rate) },
    { icon: '🏆', label: 'Test Pass Rate',  val: summary.test_pass_rate,            fmt: (v) => `${v}%`, color: _rateColor(summary.test_pass_rate) },
  ];
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radii.md, padding: '12px 14px', boxShadow: shadows.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{s.label}</div>
            </div>
            <div style={{ fontSize: font.sizeXl, fontWeight: font.weightBold, color: s.color }}>{s.val != null ? s.fmt(s.val) : '—'}</div>
            <_MiniBar value={s.val} color={s.color} />
          </div>
        ))}
      </div>
      {summary.most_common_weak_topics?.length > 0 && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: radii.md, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, color: '#ca8a04' }}>⚠️ Common weak topics:</span>
          {summary.most_common_weak_topics.map(t => (
            <span key={t} style={{ fontSize: font.sizeSm, color: '#92400e', background: '#fde68a', borderRadius: radii.full, padding: '2px 10px', fontWeight: font.weightMedium }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const { isTeacher, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [classes,     setClasses]     = useState([]);
  const [form,        setForm]        = useState({ name: '', description: '', category: '', enrolled_courses: ['basic'] });
  const [creating,    setCreating]    = useState(false);
  const [formError,   setFormError]   = useState('');
  const [copiedCode,  setCopiedCode]  = useState(null);
  const [togglingId,  setTogglingId]  = useState(null);
  const [categoryFilter,  setCategoryFilter]  = useState('all');
  const [classroomSearch, setClassroomSearch] = useState('');

  // Official Classroom aggregate panel state
  const [officialClassrooms,         setOfficialClassrooms]         = useState([]);
  const [officialClassroomsLoading,  setOfficialClassroomsLoading]  = useState(false);
  const [activeOfficialCourse,       setActiveOfficialCourse]       = useState(null); // null | 'basic' | 'enhanced'
  const [officialAggData,            setOfficialAggData]            = useState(null);
  const [officialAggLoading,         setOfficialAggLoading]         = useState(false);
  const [expandedOfficialStudent,    setExpandedOfficialStudent]    = useState(null);
  const [officialCourseSortKey,      setOfficialCourseSortKey]      = useState('full_name');
  const [officialCourseSortAsc,      setOfficialCourseSortAsc]      = useState(true);
  const [officialStudentWork,        setOfficialStudentWork]        = useState({});
  const [officialWorkLoading,        setOfficialWorkLoading]        = useState({});
  const [officialExpandedWork,       setOfficialExpandedWork]       = useState({});
  // Per-classroom view state
  const [officialViewMode,           setOfficialViewMode]           = useState('aggregate'); // 'aggregate' | 'by-classroom'
  const [classroomList,              setClassroomList]              = useState(null);
  const [classroomListLoading,       setClassroomListLoading]       = useState(false);
  const [expandedClassroom,          setExpandedClassroom]          = useState(null);
  const [classroomDetailData,        setClassroomDetailData]        = useState({});
  const [classroomDetailLoading,     setClassroomDetailLoading]     = useState({});
  const [classroomExpandedStudent,   setClassroomExpandedStudent]   = useState({});
  const [classroomStudentWork,       setClassroomStudentWork]       = useState({});
  const [classroomWorkLoading,       setClassroomWorkLoading]       = useState({});
  const [classroomExpandedWork,      setClassroomExpandedWork]      = useState({});

  // ── Enhanced Java Official Classroom panel state ──────────────────────────
  const [officialEnhAggData,         setOfficialEnhAggData]         = useState(null);
  const [officialEnhAggLoading,      setOfficialEnhAggLoading]      = useState(false);
  const [officialEnhExpandedStudent, setOfficialEnhExpandedStudent] = useState(null);
  const [officialEnhSortKey,         setOfficialEnhSortKey]         = useState('full_name');
  const [officialEnhSortAsc,         setOfficialEnhSortAsc]         = useState(true);
  const [officialEnhStudentWork,     setOfficialEnhStudentWork]     = useState({});
  const [officialEnhWorkLoading,     setOfficialEnhWorkLoading]     = useState({});
  const [officialEnhExpandedWork,    setOfficialEnhExpandedWork]    = useState({});
  const [officialEnhViewMode,        setOfficialEnhViewMode]        = useState('aggregate');
  const [enhClassroomList,           setEnhClassroomList]           = useState(null);
  const [enhClassroomListLoading,    setEnhClassroomListLoading]    = useState(false);
  const [enhExpandedClassroom,       setEnhExpandedClassroom]       = useState(null);
  const [enhClassroomDetailData,     setEnhClassroomDetailData]     = useState({});
  const [enhClassroomDetailLoading,  setEnhClassroomDetailLoading]  = useState({});
  const [enhClassroomExpandedStudent,setEnhClassroomExpandedStudent]= useState({});
  const [enhClassroomStudentWork,    setEnhClassroomStudentWork]    = useState({});
  const [enhClassroomWorkLoading,    setEnhClassroomWorkLoading]    = useState({});
  const [enhClassroomExpandedWork,   setEnhClassroomExpandedWork]   = useState({});

  // Derived panel booleans (kept for backward compat with panel content)
  const officialPanelOpen    = activeOfficialCourse === 'basic';
  const officialEnhPanelOpen = activeOfficialCourse === 'enhanced';

  // Official Classroom cards layout state
  const [officialCardsExpanded,      setOfficialCardsExpanded]       = useState(false);

  useEffect(() => {
    if (!loading && (!isAuthenticated || !isTeacher)) navigate('/home');
  }, [loading, isAuthenticated, isTeacher, navigate]);

  useEffect(() => { if (isTeacher) loadClasses(); }, [isTeacher]);

  async function loadClasses() {
    try { 
      setClasses(await getMyClassrooms()); 
      setOfficialClassroomsLoading(true);
      setOfficialClassrooms(await getOfficialClassrooms());
    } catch (e) { console.error(e); }
    finally { setOfficialClassroomsLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true); setFormError('');
    try { await createClassroom(form); setForm({ name: '', description: '', category: '', enrolled_courses: ['basic'] }); await loadClasses(); }
    catch (e) { setFormError(e.message); }
    finally { setCreating(false); }
  }

  function copyCode(e, code) {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function handleToggleOfficialPanel() {
    if (activeOfficialCourse !== 'basic') {
      setActiveOfficialCourse('basic');
      if (officialViewMode === 'aggregate' && !officialAggData && !officialAggLoading) {
        setOfficialAggLoading(true);
        try { setOfficialAggData(await getOfficialAggregateCourseProgress()); }
        catch (e) { console.error(e); }
        finally { setOfficialAggLoading(false); }
      }
    } else {
      setActiveOfficialCourse(null);
    }
  }

  async function toggleOfficialStudentRow(studentId) {
    if (expandedOfficialStudent === studentId) { setExpandedOfficialStudent(null); return; }
    setExpandedOfficialStudent(studentId);
    if (!officialStudentWork[studentId] && !officialWorkLoading[studentId]) {
      setOfficialWorkLoading(p => ({ ...p, [studentId]: true }));
      try {
        const data = await getOfficialAggregateStudentWork(studentId);
        setOfficialStudentWork(p => ({ ...p, [studentId]: data.items }));
      } catch (e) { console.error(e); }
      finally { setOfficialWorkLoading(p => ({ ...p, [studentId]: false })); }
    }
  }

  async function handleSwitchViewMode(mode) {
    setOfficialViewMode(mode);
    setActiveOfficialCourse('basic');
    if (mode === 'aggregate' && !officialAggData && !officialAggLoading) {
      setOfficialAggLoading(true);
      try { setOfficialAggData(await getOfficialAggregateCourseProgress()); }
      catch (e) { console.error(e); }
      finally { setOfficialAggLoading(false); }
    }
    if (mode === 'by-classroom' && !classroomList && !classroomListLoading) {
      setClassroomListLoading(true);
      try { setClassroomList(await getOfficialClassroomList()); }
      catch (e) { console.error(e); }
      finally { setClassroomListLoading(false); }
    }
  }

  async function toggleClassroomRow(classroomId) {
    if (expandedClassroom === classroomId) { setExpandedClassroom(null); return; }
    setExpandedClassroom(classroomId);
    if (!classroomDetailData[classroomId] && !classroomDetailLoading[classroomId]) {
      setClassroomDetailLoading(p => ({ ...p, [classroomId]: true }));
      try {
        const data = await getClassroomCourseProgress(classroomId);
        setClassroomDetailData(p => ({ ...p, [classroomId]: data }));
      } catch (e) { console.error(e); }
      finally { setClassroomDetailLoading(p => ({ ...p, [classroomId]: false })); }
    }
  }

  async function toggleClassroomStudentRow(classroomId, studentId) {
    setClassroomExpandedStudent(p => ({ ...p, [classroomId]: p[classroomId] === studentId ? null : studentId }));
    const key = `${classroomId}_${studentId}`;
    if (!classroomStudentWork[key] && !classroomWorkLoading[key]) {
      setClassroomWorkLoading(p => ({ ...p, [key]: true }));
      try {
        const data = await getClassroomStudentWork(classroomId, studentId);
        setClassroomStudentWork(p => ({ ...p, [key]: data.items }));
      } catch (e) { console.error(e); }
      finally { setClassroomWorkLoading(p => ({ ...p, [key]: false })); }
    }
  }

  function sortedOfficialStudents(students) {
    return [...students].sort((a, b) => {
      let av, bv;
      const k = officialCourseSortKey;
      if (k === 'status') { av = _studentStatus(a).label; bv = _studentStatus(b).label; }
      else if (k === 'quiz_pass_rate') { av = a.quizzes_attempted > 0 ? a.quizzes_passed / a.quizzes_attempted : -1; bv = b.quizzes_attempted > 0 ? b.quizzes_passed / b.quizzes_attempted : -1; }
      else if (k === 'test_pass_rate') { av = a.tests_attempted > 0 ? a.tests_passed / a.tests_attempted : -1; bv = b.tests_attempted > 0 ? b.tests_passed / b.tests_attempted : -1; }
      else if (k === 'weak_count') { av = a.weak_topics?.length; bv = b.weak_topics?.length; }
      else if (k === 'last_active') { av = a.last_active ? new Date(a.last_active).getTime() : 0; bv = b.last_active ? new Date(b.last_active).getTime() : 0; }
      else { av = a[k]; bv = b[k]; }
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return officialCourseSortAsc ? cmp : -cmp;
    });
  }

  function sortedEnhOfficialStudents(students) {
    return [...students].sort((a, b) => {
      let av, bv;
      const k = officialEnhSortKey;
      if (k === 'status') { av = _studentStatus(a).label; bv = _studentStatus(b).label; }
      else if (k === 'quiz_pass_rate') { av = a.quizzes_attempted > 0 ? a.quizzes_passed / a.quizzes_attempted : -1; bv = b.quizzes_attempted > 0 ? b.quizzes_passed / b.quizzes_attempted : -1; }
      else if (k === 'test_pass_rate') { av = a.tests_attempted > 0 ? a.tests_passed / a.tests_attempted : -1; bv = b.tests_attempted > 0 ? b.tests_passed / b.tests_attempted : -1; }
      else if (k === 'weak_count') { av = a.weak_topics?.length; bv = b.weak_topics?.length; }
      else if (k === 'last_active') { av = a.last_active ? new Date(a.last_active).getTime() : 0; bv = b.last_active ? new Date(b.last_active).getTime() : 0; }
      else { av = a[k]; bv = b[k]; }
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return officialEnhSortAsc ? cmp : -cmp;
    });
  }

  async function handleSwitchEnhViewMode(mode) {
    setOfficialEnhViewMode(mode);
    setActiveOfficialCourse('enhanced');
    if (mode === 'aggregate' && !officialEnhAggData && !officialEnhAggLoading) {
      setOfficialEnhAggLoading(true);
      try { setOfficialEnhAggData(await getOfficialAggregateCourseProgress('enhanced')); }
      catch (e) { console.error(e); }
      finally { setOfficialEnhAggLoading(false); }
    }
    if (mode === 'by-classroom' && !enhClassroomList && !enhClassroomListLoading) {
      setEnhClassroomListLoading(true);
      try { setEnhClassroomList(await getOfficialClassroomList()); }
      catch (e) { console.error(e); }
      finally { setEnhClassroomListLoading(false); }
    }
  }

  async function toggleEnhOfficialStudentRow(studentId) {
    if (officialEnhExpandedStudent === studentId) { setOfficialEnhExpandedStudent(null); return; }
    setOfficialEnhExpandedStudent(studentId);
    if (!officialEnhStudentWork[studentId] && !officialEnhWorkLoading[studentId]) {
      setOfficialEnhWorkLoading(p => ({ ...p, [studentId]: true }));
      try {
        const data = await getOfficialAggregateStudentWork(studentId);
        setOfficialEnhStudentWork(p => ({ ...p, [studentId]: data.items }));
      } catch (e) { console.error(e); }
      finally { setOfficialEnhWorkLoading(p => ({ ...p, [studentId]: false })); }
    }
  }

  async function toggleEnhClassroomRow(classroomId) {
    if (enhExpandedClassroom === classroomId) { setEnhExpandedClassroom(null); return; }
    setEnhExpandedClassroom(classroomId);
    if (!enhClassroomDetailData[classroomId] && !enhClassroomDetailLoading[classroomId]) {
      setEnhClassroomDetailLoading(p => ({ ...p, [classroomId]: true }));
      try {
        const data = await getClassroomCourseProgress(classroomId, 'enhanced');
        setEnhClassroomDetailData(p => ({ ...p, [classroomId]: data }));
      } catch (e) { console.error(e); }
      finally { setEnhClassroomDetailLoading(p => ({ ...p, [classroomId]: false })); }
    }
  }

  async function toggleEnhClassroomStudentRow(classroomId, studentId) {
    setEnhClassroomExpandedStudent(p => ({ ...p, [classroomId]: p[classroomId] === studentId ? null : studentId }));
    const key = `${classroomId}_${studentId}`;
    if (!enhClassroomStudentWork[key] && !enhClassroomWorkLoading[key]) {
      setEnhClassroomWorkLoading(p => ({ ...p, [key]: true }));
      try {
        const data = await getClassroomStudentWork(classroomId, studentId);
        setEnhClassroomStudentWork(p => ({ ...p, [key]: data.items }));
      } catch (e) { console.error(e); }
      finally { setEnhClassroomWorkLoading(p => ({ ...p, [key]: false })); }
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading…</div>;

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: `1px solid ${colors.border}`, borderRadius: radii.sm,
    fontSize: font.sizeMd, color: colors.text,
    outline: 'none', boxSizing: 'border-box', background: colors.surface,
  };

  const isOfficialCategory = (category) => {
    return (category || '').toLowerCase().includes('official');
  };

  const uniqueCategories = [...new Set(classes.map(c => c.category || 'Official Lessons'))].sort();
  const filteredClasses = classes.filter(cls => {
    if (categoryFilter !== 'all' && cls.category !== categoryFilter) return false;
    if (classroomSearch.trim()) {
      const term = classroomSearch.trim().toLowerCase();
      return (
        (cls.name || '').toLowerCase().includes(term) ||
        (cls.category || '').toLowerCase().includes(term) ||
        (cls.description || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  const OfficialSortTh = ({ label, sortKeyName, center = false }) => {
    const isActive = officialCourseSortKey === sortKeyName;
    return (
      <th onClick={() => { if (officialCourseSortKey === sortKeyName) setOfficialCourseSortAsc(!officialCourseSortAsc); else { setOfficialCourseSortKey(sortKeyName); setOfficialCourseSortAsc(true); } }}
        style={{ padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg, textAlign: center ? 'center' : 'left', color: isActive ? colors.primary : colors.textSecondary, fontWeight: isActive ? font.weightBold : font.weightSemibold, fontSize: font.sizeXs, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
        {label}<span style={{ marginLeft: 4, opacity: isActive ? 1 : 0.3 }}>{isActive ? (officialCourseSortAsc ? '↑' : '↓') : '↕'}</span>
      </th>
    );
  };

  const EnhancedSortTh = ({ label, sortKeyName, center = false }) => {
    const isActive = officialEnhSortKey === sortKeyName;
    return (
      <th onClick={() => { if (officialEnhSortKey === sortKeyName) setOfficialEnhSortAsc(!officialEnhSortAsc); else { setOfficialEnhSortKey(sortKeyName); setOfficialEnhSortAsc(true); } }}
        style={{ padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg, textAlign: center ? 'center' : 'left', color: isActive ? colors.primary : colors.textSecondary, fontWeight: isActive ? font.weightBold : font.weightSemibold, fontSize: font.sizeXs, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
        {label}<span style={{ marginLeft: 4, opacity: isActive ? 1 : 0.3 }}>{isActive ? (officialEnhSortAsc ? '↑' : '↓') : '↕'}</span>
      </th>
    );
  };

  const tdS = { padding: '10px 14px', borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle' };

  const renderClassroomCard = (cls, isOfficial = false) => (
    <div key={cls.id}
      style={{
        ...card.base, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = shadows.md; e.currentTarget.style.borderColor = colors.primaryBorder; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = card.base?.boxShadow || ''; e.currentTarget.style.borderColor = colors.border; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h4 style={{ margin: 0, color: colors.primary, fontSize: font.sizeLg, fontWeight: font.weightBold, lineHeight: 1.3 }}>{cls.name}</h4>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', borderRadius: radii.full, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
              {cls.category || 'Official Lessons'}
            </span>
            
          </div>
          {cls.description && <p style={{ margin: '4px 0 0 0', fontSize: font.sizeSm, color: colors.textSecondary, lineHeight: 1.4 }}>{cls.description}</p>}
        </div>
        <button
          onClick={() => navigate(`/teacher-classroom/${cls.id}`, {
            state: {
              name: cls.name,
              description: cls.description,
              class_code: cls.class_code,
              category: cls.category,
              initialTab: isOfficial ? 'official-lessons' : 'materials',
              initialOfficialView: isOfficial ? 'analysis' : undefined,
            }
          })}
          style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {isOfficial ? 'Open Analysis →' : 'Open →'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <code style={{
          background: colors.bg, border: `1px solid ${colors.border}`,
          borderRadius: radii.sm, padding: '5px 12px',
          fontSize: font.sizeSm, fontWeight: font.weightBold, letterSpacing: 3,
          color: colors.text, flex: 1, textAlign: 'center',
        }}>
          {cls.class_code}
        </code>
        <button onClick={e => copyCode(e, cls.class_code)}
          style={{
            padding: '5px 12px', fontSize: font.sizeSm, fontWeight: font.weightMedium,
            background: copiedCode === cls.class_code ? colors.successLight : 'transparent',
            border: `1px solid ${copiedCode === cls.class_code ? colors.successBorder : colors.border}`,
            borderRadius: radii.sm, cursor: 'pointer',
            color: copiedCode === cls.class_code ? colors.success : colors.textSecondary,
            transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}>
          {copiedCode === cls.class_code ? '✓ Copied' : '📋 Copy'}
        </button>
        <button
          disabled={togglingId === cls.id}
          onClick={async (e) => {
            e.stopPropagation();
            setTogglingId(cls.id);
            try {
              const updated = await toggleClassroomPublic(cls.id, !cls.is_public);
              setClasses(prev => prev.map(c => c.id === cls.id ? { ...c, is_public: updated.is_public } : c));
            } catch (err) {
              console.error(err);
            } finally {
              setTogglingId(null);
            }
          }}
          style={{
            padding: '5px 12px', fontSize: font.sizeSm, fontWeight: font.weightMedium,
            background: cls.is_public ? '#dcfce7' : 'transparent',
            border: `1px solid ${cls.is_public ? '#86efac' : colors.border}`,
            borderRadius: radii.sm, cursor: togglingId === cls.id ? 'not-allowed' : 'pointer',
            color: cls.is_public ? '#15803d' : colors.textSecondary,
            transition: 'all 0.2s', whiteSpace: 'nowrap', opacity: togglingId === cls.id ? 0.6 : 1,
          }}>
          {cls.is_public ? '🌐 Public' : '🔒 Private'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 32, paddingBottom: 20, borderBottom: `2px solid ${colors.border}` }}>
        <h2 style={{ fontSize: 28, fontWeight: font.weightBold, color: colors.primary, marginBottom: 4, marginTop: 0 }}>🏫 Teacher Dashboard</h2>
        <p style={{ color: colors.textMuted, marginBottom: 0, marginTop: 0, fontSize: font.sizeMd }}>Manage your classrooms and monitor student progress.</p>
      </div>

      {/* Create classroom */}
      <div style={{ ...card.base, marginBottom: 32, padding: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: font.sizeLg, color: colors.text }}>➕ Create a New Classroom</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: font.sizeSm, color: colors.textSecondary }}>Class Name *</label>
            <input style={inputStyle} placeholder="e.g. Java Intro 2026" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: font.sizeSm, color: colors.textSecondary }}>Category *</label>
            <input
              style={inputStyle}
              placeholder="e.g. Official Lessons, Revision, Advanced"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              required
            />
          </div>
          <div style={{ flex: '2 1 300px' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: font.sizeSm, color: colors.textSecondary }}>Description</label>
            <input style={inputStyle} placeholder="Optional description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: font.sizeSm, color: colors.textSecondary }}>Courses Enrolled</label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 6 }}>
              {[{ id: 'basic', label: '📗 Basic Java' }, { id: 'enhanced', label: '🚀 Enhanced Java' }].map(({ id, label }) => {
                const checked = form.enrolled_courses.includes(id);
                return (
                  <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: font.sizeSm, color: colors.textSecondary }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? form.enrolled_courses.filter(c => c !== id)
                          : [...form.enrolled_courses, id];
                        setForm({ ...form, enrolled_courses: next });
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
          <button type="submit" disabled={creating} style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap' }}>
            {creating ? 'Creating…' : '+ Create Classroom'}
          </button>
        </form>
        {formError && <p style={{ color: '#ef4444', marginTop: 10, fontSize: font.sizeSm }}>{formError}</p>}
      </div>

      {/* Official Classroom — Basic Java & Enhanced Java cards with toggle */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <h3 style={{ fontSize: font.sizeLg, color: colors.text, margin: 0 }}>🎓 Official Classroom</h3>
          <button
            onClick={() => setOfficialCardsExpanded(!officialCardsExpanded)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.md,
              background: colors.surface,
              color: colors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s ease',
            }}
            title={officialCardsExpanded ? 'Collapse to 2-column layout' : 'Expand to full width'}
          >
            {officialCardsExpanded ? '⤫ Collapse' : '⤢ Expand'}
          </button>
        </div>
        <p style={{ marginTop: 0, marginBottom: 14, color: colors.textMuted, fontSize: font.sizeSm }}>
          Core Java course analysis across all Official Lessons classrooms.
        </p>

        {/* Cards flex wrapper */}
        <div style={{
          display: 'flex',
          gap: 16,
          flexWrap: officialCardsExpanded ? 'wrap' : 'nowrap',
          alignItems: 'flex-start',
        }}>
          {/* Basic Java card */}
          <div style={{
            flex: officialCardsExpanded ? '1 1 100%' : '1 1 calc(50% - 8px)',
            minWidth: 0,
            ...card.base,
            padding: 20,
            borderTop: officialPanelOpen ? `3px solid ${colors.primary}` : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h4 style={{ margin: 0, color: colors.primary, fontSize: font.sizeLg, fontWeight: font.weightBold }}>📚 Basic Java</h4>
                  <span style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', borderRadius: radii.full, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>Official Lessons</span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: font.sizeSm, color: colors.textSecondary }}>
                  Aggregate course analysis · {officialClassrooms.length} classroom{officialClassrooms.length !== 1 ? 's' : ''}
                  {officialAggData ? ` · ${officialAggData.total_students} student${officialAggData.total_students !== 1 ? 's' : ''}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => handleSwitchViewMode('aggregate')}
                  style={{ ...btn.small, whiteSpace: 'nowrap', background: officialViewMode === 'aggregate' && officialPanelOpen ? colors.primary : 'transparent', color: officialViewMode === 'aggregate' && officialPanelOpen ? '#fff' : colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  👥 All Students
                </button>
                <button
                  onClick={() => handleSwitchViewMode('by-classroom')}
                  style={{ ...btn.small, whiteSpace: 'nowrap', background: officialViewMode === 'by-classroom' && officialPanelOpen ? colors.primary : 'transparent', color: officialViewMode === 'by-classroom' && officialPanelOpen ? '#fff' : colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  📋 By Classroom
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Java card */}
          <div style={{
            flex: officialCardsExpanded ? '1 1 100%' : '1 1 calc(50% - 8px)',
            minWidth: 0,
            ...card.base,
            padding: 20,
            borderTop: officialEnhPanelOpen ? '3px solid #059669' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h4 style={{ margin: 0, color: '#059669', fontSize: font.sizeLg, fontWeight: font.weightBold }}>🚀 Enhanced Java</h4>
                  <span style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', borderRadius: radii.full, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>Official Lessons</span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: font.sizeSm, color: colors.textSecondary }}>
                  Aggregate course analysis · {officialClassrooms.length} classroom{officialClassrooms.length !== 1 ? 's' : ''}
                  {officialEnhAggData ? ` · ${officialEnhAggData.total_students} student${officialEnhAggData.total_students !== 1 ? 's' : ''}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => handleSwitchEnhViewMode('aggregate')}
                  style={{ ...btn.small, whiteSpace: 'nowrap', background: officialEnhViewMode === 'aggregate' && officialEnhPanelOpen ? '#059669' : 'transparent', color: officialEnhViewMode === 'aggregate' && officialEnhPanelOpen ? '#fff' : '#059669', border: `1px solid #059669`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  👥 All Students
                </button>
                <button
                  onClick={() => handleSwitchEnhViewMode('by-classroom')}
                  style={{ ...btn.small, whiteSpace: 'nowrap', background: officialEnhViewMode === 'by-classroom' && officialEnhPanelOpen ? '#059669' : 'transparent', color: officialEnhViewMode === 'by-classroom' && officialEnhPanelOpen ? '#fff' : '#059669', border: `1px solid #059669`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  📋 By Classroom
                </button>
              </div>
            </div>
          </div>
        </div> {/* End cards flex wrapper */}

        {/* Unified course analysis panel */}
        {activeOfficialCourse && (
          <div style={{ ...card.base, padding: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: `3px solid ${activeOfficialCourse === 'basic' ? colors.primary : '#059669'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${colors.border}`, background: activeOfficialCourse === 'basic' ? colors.primaryLight : '#f0fdf4', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setActiveOfficialCourse('basic')} style={{ padding: '4px 14px', fontSize: 13, fontWeight: 700, borderRadius: 9999, cursor: 'pointer', border: `1.5px solid ${colors.primary}`, background: activeOfficialCourse === 'basic' ? colors.primary : 'transparent', color: activeOfficialCourse === 'basic' ? '#fff' : colors.primary }}>📚 Basic Java</button>
                <button onClick={() => setActiveOfficialCourse('enhanced')} style={{ padding: '4px 14px', fontSize: 13, fontWeight: 700, borderRadius: 9999, cursor: 'pointer', border: '1.5px solid #059669', background: activeOfficialCourse === 'enhanced' ? '#059669' : 'transparent', color: activeOfficialCourse === 'enhanced' ? '#fff' : '#059669' }}>🚀 Enhanced Java</button>
                <span style={{ color: colors.border, margin: '0 6px' }}>|</span>
                <button onClick={() => activeOfficialCourse === 'basic' ? handleSwitchViewMode('aggregate') : handleSwitchEnhViewMode('aggregate')} style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 9999, cursor: 'pointer', border: `1px solid ${activeOfficialCourse === 'basic' ? colors.primary : '#059669'}`, background: (activeOfficialCourse === 'basic' ? officialViewMode : officialEnhViewMode) === 'aggregate' ? (activeOfficialCourse === 'basic' ? colors.primaryLight : '#d1fae5') : 'transparent', color: activeOfficialCourse === 'basic' ? colors.primary : '#059669' }}>👥 All Students</button>
                <button onClick={() => activeOfficialCourse === 'basic' ? handleSwitchViewMode('by-classroom') : handleSwitchEnhViewMode('by-classroom')} style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 9999, cursor: 'pointer', border: `1px solid ${activeOfficialCourse === 'basic' ? colors.primary : '#059669'}`, background: (activeOfficialCourse === 'basic' ? officialViewMode : officialEnhViewMode) === 'by-classroom' ? (activeOfficialCourse === 'basic' ? colors.primaryLight : '#d1fae5') : 'transparent', color: activeOfficialCourse === 'basic' ? colors.primary : '#059669' }}>📋 By Classroom</button>
              </div>
              <button onClick={() => setActiveOfficialCourse(null)} style={{ ...btn.secondary, ...btn.small }}>✕ Close</button>
            </div>
            <div style={{ padding: 28 }}>
            {activeOfficialCourse === 'basic' ? (<>
            {officialViewMode === 'by-classroom' ? (
              /* ── By-Classroom view ── */
              classroomListLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textMuted }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                  <div>Loading classroom list…</div>
                </div>
              ) : !classroomList || classroomList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textMuted }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🏛</div>
                  <div style={{ fontWeight: font.weightSemibold, marginBottom: 6 }}>No official classrooms found</div>
                  <div style={{ fontSize: font.sizeSm }}>Create classrooms with an \"Official Lessons\" category to see them here.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeSm }}>
                    <thead>
                      <tr>
                        <th style={{ width: 32, padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg }} />
                        {['Classroom', 'Students', 'Avg Completion', 'Avg Quiz', 'Avg Test', 'Quiz Pass Rate', 'Test Pass Rate', 'Common Weak Topics'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg, textAlign: h === 'Classroom' ? 'left' : 'center', color: colors.textSecondary, fontWeight: font.weightSemibold, fontSize: font.sizeXs, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classroomList.map((cls, idx) => {
                        const isExp = expandedClassroom === cls.classroom_id;
                        const detail = classroomDetailData[cls.classroom_id];
                        const detailLoading = Boolean(classroomDetailLoading[cls.classroom_id]);
                        const rowBg = isExp ? colors.primaryLight : (idx % 2 === 0 ? colors.surface : colors.bg);
                        const s = cls.class_summary;
                        return (
                          <React.Fragment key={`clsc_${cls.classroom_id}`}>
                            <tr onClick={() => toggleClassroomRow(cls.classroom_id)}
                              style={{ cursor: 'pointer', background: rowBg }}
                              onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = colors.primaryLight; }}
                              onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = rowBg; }}>
                              <td style={{ ...tdS, textAlign: 'center', color: colors.primary, fontWeight: 700, fontSize: 16 }}>{isExp ? '▾' : '▸'}</td>
                              <td style={tdS}><span style={{ fontWeight: font.weightSemibold }}>{cls.classroom_name}</span></td>
                              <td style={{ ...tdS, textAlign: 'center' }}>{cls.total_students}</td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_completion_percentage} /></td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_quiz_score} /></td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_test_score} /></td>
                              <td style={{ ...tdS, textAlign: 'center', color: s.quiz_pass_rate != null ? _rateColor(s.quiz_pass_rate) : colors.textMuted, fontWeight: 600 }}>{s.quiz_pass_rate != null ? `${s.quiz_pass_rate}%` : '—'}</td>
                              <td style={{ ...tdS, textAlign: 'center', color: s.test_pass_rate != null ? _rateColor(s.test_pass_rate) : colors.textMuted, fontWeight: 600 }}>{s.test_pass_rate != null ? `${s.test_pass_rate}%` : '—'}</td>
                              <td style={{ ...tdS }}>
                                {s.most_common_weak_topics?.length > 0
                                  ? s.most_common_weak_topics.slice(0, 3).map(t => (
                                      <span key={t} style={{ display: 'inline-block', marginRight: 4, marginBottom: 2, fontSize: 11, background: '#fde68a', color: '#92400e', borderRadius: 9999, padding: '1px 7px' }}>{t}</span>
                                    ))
                                  : <span style={{ color: colors.textMuted }}>—</span>}
                              </td>
                            </tr>
                            {isExp && (
                              <tr>
                                <td colSpan={9} style={{ padding: '16px 24px 24px 48px', background: colors.primaryLight, borderBottom: `2px solid ${colors.primaryBorder}` }}>
                                  {detailLoading ? (
                                    <div style={{ color: colors.textMuted, padding: '20px 0' }}>⏳ Loading students…</div>
                                  ) : !detail || detail.students.length === 0 ? (
                                    <div style={{ color: colors.textMuted }}>No student data for this classroom yet.</div>
                                  ) : (
                                    <>
                                      <_CourseSummaryBar summary={detail.class_summary} />
                                      <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeSm }}>
                                          <thead>
                                            <tr>
                                              <th style={{ width: 32, padding: '8px 12px', borderBottom: `2px solid ${colors.border}`, background: colors.bg }} />
                                              {['Status', 'Name', 'Completion', 'Quiz Pass', 'Avg Quiz', 'Test Pass', 'Avg Test', 'Weak', 'Last Active'].map(h => (
                                                <th key={h} style={{ padding: '8px 12px', borderBottom: `2px solid ${colors.border}`, background: colors.bg, textAlign: h === 'Name' ? 'left' : 'center', color: colors.textSecondary, fontWeight: font.weightSemibold, fontSize: font.sizeXs, whiteSpace: 'nowrap' }}>{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {detail.students.map((stu, si) => {
                                              const stuExp = classroomExpandedStudent[cls.classroom_id] === stu.student_id;
                                              const stuStatus = _studentStatus(stu);
                                              const stuBg = stuExp ? '#e0e7ff' : (si % 2 === 0 ? colors.surface : colors.bg);
                                              const wkey = `${cls.classroom_id}_${stu.student_id}`;
                                              const stuWork = classroomStudentWork[wkey] || [];
                                              const stuWorkLoading = Boolean(classroomWorkLoading[wkey]);
                                              return (
                                                <React.Fragment key={`clsstu_${cls.classroom_id}_${stu.student_id}`}>
                                                  <tr onClick={() => toggleClassroomStudentRow(cls.classroom_id, stu.student_id)}
                                                    style={{ cursor: 'pointer', background: stuBg }}
                                                    onMouseEnter={e => { if (!stuExp) e.currentTarget.style.background = '#e0e7ff'; }}
                                                    onMouseLeave={e => { if (!stuExp) e.currentTarget.style.background = stuBg; }}>
                                                    <td style={{ ...tdS, textAlign: 'center', color: colors.primary, fontWeight: 700 }}>{stuExp ? '▾' : '▸'}</td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                                      <span title={stuStatus.label} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: stuStatus.bg, color: stuStatus.fg, whiteSpace: 'nowrap' }}>{stuStatus.dot} {stuStatus.label}</span>
                                                    </td>
                                                    <td style={tdS}>
                                                      <div style={{ fontWeight: font.weightSemibold }}>{stu.full_name || '—'}</div>
                                                      <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{stu.email}</div>
                                                    </td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={stu.completion_percentage} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_PassRateBadge passed={stu.quizzes_passed} attempted={stu.quizzes_attempted} tooltip={`${stu.quizzes_passed}/${stu.quizzes_attempted} quizzes ≥70`} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={stu.avg_quiz_score} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_PassRateBadge passed={stu.tests_passed} attempted={stu.tests_attempted} tooltip={`${stu.tests_passed}/${stu.tests_attempted} tests ≥60`} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={stu.avg_test_score} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}>{stu.weak_topics?.length || 0}</td>
                                                    <td style={{ ...tdS, textAlign: 'center', color: colors.textMuted, fontSize: font.sizeXs }}>{stu.last_active ? new Date(stu.last_active).toLocaleDateString() : '—'}</td>
                                                  </tr>
                                                  {stuExp && (
                                                    <tr>
                                                      <td colSpan={10} style={{ padding: '12px 20px 18px 44px', background: '#eef2ff', borderBottom: `2px solid ${colors.primaryBorder}` }}>
                                                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                                                          <div style={{ fontSize: font.sizeSm }}><strong>Subtopics Read:</strong> {stu.completed_topics}</div>
                                                          <div style={{ fontSize: font.sizeSm }}><strong>Weak Topics:</strong> {stu.weak_topics?.length ? stu.weak_topics.join(', ') : 'None'}</div>
                                                        </div>
                                                        {stu.topic_stats?.length > 0 && (
                                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeXs, marginBottom: 14 }}>
                                                            <thead>
                                                              <tr style={{ background: colors.bg }}>
                                                                {['Topic', 'Quiz Attempts', 'Quiz Avg', 'Quiz Pass', 'Test Attempts', 'Test Avg', 'Test Pass'].map(h => (
                                                                  <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Topic' ? 'left' : 'center', color: colors.textSecondary, fontWeight: font.weightSemibold, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                                                                ))}
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {stu.topic_stats.map(ts => (
                                                                <tr key={ts.topic} style={{ background: ts.is_weak ? '#fff7ed' : 'transparent' }}>
                                                                  <td style={{ padding: '5px 8px', borderBottom: `1px solid ${colors.border}` }}>{ts.is_weak && <span style={{ marginRight: 4 }}>⚠️</span>}{ts.topic}</td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.quiz_attempts || '—'}</td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><_ScoreBadge score={ts.quiz_avg_score} /></td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}>{ts.quiz_pass_rate != null ? `${ts.quiz_pass_rate}%` : '—'}</td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.test_attempts || '—'}</td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><_ScoreBadge score={ts.test_avg_score} /></td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}>{ts.test_pass_rate != null ? `${ts.test_pass_rate}%` : '—'}</td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        )}
                                                        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
                                                          <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, marginBottom: 8 }}>Student Work Details</div>
                                                          {stuWorkLoading && <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>Loading…</div>}
                                                          {!stuWorkLoading && stuWork.length === 0 && <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>No saved work yet.</div>}
                                                          {!stuWorkLoading && stuWork.map(item => {
                                                            const wexp = Boolean(classroomExpandedWork[item.id]);
                                                            const score = item.result_data?.score;
                                                            const hasDetails = (item.work_type === 'quiz' && item.result_data?.review?.length > 0) || (item.work_type === 'test' && (item.result_data?.question?.description || item.content));
                                                            return (
                                                              <div key={item.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, background: colors.surface, padding: '10px 12px', marginBottom: 8 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                                                  <div>
                                                                    <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold }}>{item.title}</div>
                                                                    <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{item.work_type.toUpperCase()} · {item.topic_id || 'No topic'} · {new Date(item.created_at).toLocaleDateString()}</div>
                                                                  </div>
                                                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    {score != null && <_ScoreBadge score={score} />}
                                                                    {hasDetails && (
                                                                      <button onClick={() => setClassroomExpandedWork(p => ({ ...p, [item.id]: !p[item.id] }))}
                                                                        style={{ ...btn.secondary, padding: '4px 10px', fontSize: 12 }}>{wexp ? 'Hide' : 'View Details'}</button>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                                {wexp && (
                                                                  <div style={{ marginTop: 10 }}>
                                                                    {item.work_type === 'quiz' && item.result_data?.review?.map((r, i) => (
                                                                      <div key={i} style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: r.is_correct ? '#f0fdf4' : '#fef2f2', border: `1px solid ${r.is_correct ? '#bbf7d0' : '#fecaca'}`, fontSize: 12 }}>
                                                                        <div style={{ fontWeight: 600, marginBottom: 3 }}>Q{i + 1}: {r.question}</div>
                                                                        <div>Your answer: <strong>{r.your_answer}</strong></div>
                                                                        {!r.is_correct && <div style={{ color: '#16a34a' }}>Correct: {r.correct_answer}</div>}
                                                                        {r.explanation && <div style={{ marginTop: 3, color: colors.textMuted }}>💡 {r.explanation}</div>}
                                                                      </div>
                                                                    ))}
                                                                    {item.work_type === 'test' && item.result_data?.question?.description && (
                                                                      <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, fontSize: 12 }}>
                                                                        <strong>Question:</strong> {item.result_data.question.description}
                                                                      </div>
                                                                    )}
                                                                    {item.work_type === 'test' && item.content && (
                                                                      <pre style={{ background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, padding: '10px 12px', fontSize: 12, overflowX: 'auto', maxHeight: 220 }}>{item.content}</pre>
                                                                    )}
                                                                  </div>
                                                                )}
                                                              </div>
                                                            );
                                                          })}
                                                        </div>
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
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* ── Aggregate (All Students) view ── */
              officialAggLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textMuted }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                  <div>Loading aggregate data…</div>
                </div>
              ) : !officialAggData || officialAggData.students.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textMuted }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>👩‍🎓</div>
                  <div style={{ fontWeight: font.weightSemibold, marginBottom: 6 }}>No student data yet</div>
                  <div style={{ fontSize: font.sizeSm }}>Share official classroom join codes with students to get started.</div>
                </div>
              ) : (
              <>
                <_CourseSummaryBar summary={officialAggData.class_summary} />
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeSm }}>
                    <thead>
                      <tr>
                        <th style={{ width: 32, padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg }} />
                        <OfficialSortTh label="Status"      sortKeyName="status"               center />
                        <OfficialSortTh label="Name"        sortKeyName="full_name" />
                        <OfficialSortTh label="Completion"  sortKeyName="completion_percentage" center />
                        <OfficialSortTh label="Quiz Pass"   sortKeyName="quiz_pass_rate"        center />
                        <OfficialSortTh label="Avg Quiz"    sortKeyName="avg_quiz_score"        center />
                        <OfficialSortTh label="Test Pass"   sortKeyName="test_pass_rate"        center />
                        <OfficialSortTh label="Avg Test"    sortKeyName="avg_test_score"        center />
                        <OfficialSortTh label="Weak Topics" sortKeyName="weak_count"            center />
                        <OfficialSortTh label="Last Active" sortKeyName="last_active"           center />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedOfficialStudents(officialAggData.students).map((s, idx) => {
                        const isExp = expandedOfficialStudent === s.student_id;
                        const status = _studentStatus(s);
                        const rowBg = isExp ? colors.primaryLight : (idx % 2 === 0 ? colors.surface : colors.bg);
                        const work = officialStudentWork[s.student_id] || [];
                        const workLoading = Boolean(officialWorkLoading[s.student_id]);
                        return (
                          <React.Fragment key={`off_${s.student_id}`}>
                            <tr onClick={() => toggleOfficialStudentRow(s.student_id)}
                              style={{ cursor: 'pointer', background: rowBg, transition: 'background 0.15s' }}
                              onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = colors.primaryLight; }}
                              onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = rowBg; }}>
                              <td style={{ ...tdS, textAlign: 'center', color: colors.primary, fontWeight: 700, fontSize: 16 }}>{isExp ? '▾' : '▸'}</td>
                              <td style={{ ...tdS, textAlign: 'center' }}>
                                <span title={status.label} style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>{status.dot} {status.label}</span>
                              </td>
                              <td style={tdS}>
                                <div style={{ fontWeight: font.weightSemibold }}>{s.full_name || '—'}</div>
                                <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{s.email}</div>
                              </td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.completion_percentage} /></td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_PassRateBadge passed={s.quizzes_passed} attempted={s.quizzes_attempted} tooltip={`${s.quizzes_passed}/${s.quizzes_attempted} quizzes ≥70`} /></td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_quiz_score} /></td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_PassRateBadge passed={s.tests_passed} attempted={s.tests_attempted} tooltip={`${s.tests_passed}/${s.tests_attempted} tests ≥60`} /></td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_test_score} /></td>
                              <td style={{ ...tdS, textAlign: 'center' }}>{s.weak_topics?.length || 0}</td>
                              <td style={{ ...tdS, textAlign: 'center', color: colors.textMuted, fontSize: font.sizeXs }}>{s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}</td>
                            </tr>
                            {isExp && (
                              <tr>
                                <td colSpan={10} style={{ padding: '12px 24px 20px 48px', background: colors.primaryLight, borderBottom: `2px solid ${colors.primaryBorder}` }}>
                                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 8 }}>
                                    <div style={{ fontSize: font.sizeSm }}><strong>Subtopics Read:</strong> {s.completed_topics}</div>
                                    <div style={{ fontSize: font.sizeSm }}><strong>Weak Topics:</strong> {s.weak_topics?.length ? s.weak_topics.join(', ') : 'None'}</div>
                                  </div>

                                  {s.topic_stats?.length > 0 && (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeXs, marginBottom: 14 }}>
                                      <thead>
                                        <tr style={{ background: colors.bg }}>
                                          {['Topic', 'Quiz Attempts', 'Quiz Avg', 'Quiz Pass', 'Test Attempts', 'Test Avg', 'Test Pass'].map(h => (
                                            <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Topic' ? 'left' : 'center', color: colors.textSecondary, fontWeight: font.weightSemibold, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {s.topic_stats.map(ts => (
                                          <tr key={ts.topic} style={{ background: ts.is_weak ? '#fff7ed' : 'transparent' }}>
                                            <td style={{ padding: '6px 10px', color: colors.text, borderBottom: `1px solid ${colors.border}` }}>{ts.is_weak && <span style={{ marginRight: 4 }}>⚠️</span>}{ts.topic}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.quiz_attempts || '—'}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><_ScoreBadge score={ts.quiz_avg_score} /></td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}>{ts.quiz_pass_rate != null ? `${ts.quiz_pass_rate}%` : '—'}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.test_attempts || '—'}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><_ScoreBadge score={ts.test_avg_score} /></td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}>{ts.test_pass_rate != null ? `${ts.test_pass_rate}%` : '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}

                                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
                                    <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, marginBottom: 8, color: colors.text }}>Student Work Details</div>
                                    {workLoading && <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>Loading…</div>}
                                    {!workLoading && work.length === 0 && <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>No saved work yet.</div>}
                                    {!workLoading && work.map(item => {
                                      const exp = Boolean(officialExpandedWork[item.id]);
                                      const score = item.result_data?.score;
                                      const hasDetails = (item.work_type === 'quiz' && item.result_data?.review?.length > 0) || (item.work_type === 'test' && (item.result_data?.question?.description || item.content));
                                      return (
                                        <div key={item.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, background: colors.surface, padding: '10px 12px', marginBottom: 8 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                            <div>
                                              <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold }}>{item.title}</div>
                                              <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{item.work_type.toUpperCase()} · {item.topic_id || 'No topic'} · {new Date(item.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              {score != null && <_ScoreBadge score={score} />}
                                              {hasDetails && (
                                                <button onClick={() => setOfficialExpandedWork(p => ({ ...p, [item.id]: !p[item.id] }))}
                                                  style={{ ...btn.secondary, padding: '4px 10px', fontSize: 12 }}>{exp ? 'Hide' : 'View Details'}</button>
                                              )}
                                            </div>
                                          </div>
                                          {exp && (
                                            <div style={{ marginTop: 10 }}>
                                              {item.work_type === 'quiz' && item.result_data?.review?.map((r, i) => (
                                                <div key={i} style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: r.is_correct ? '#f0fdf4' : '#fef2f2', border: `1px solid ${r.is_correct ? '#bbf7d0' : '#fecaca'}`, fontSize: 12 }}>
                                                  <div style={{ fontWeight: 600, marginBottom: 3 }}>Q{i + 1}: {r.question}</div>
                                                  <div>Your answer: <strong>{r.your_answer}</strong></div>
                                                  {!r.is_correct && <div style={{ color: '#16a34a' }}>Correct: {r.correct_answer}</div>}
                                                  {r.explanation && <div style={{ marginTop: 3, color: colors.textMuted }}>💡 {r.explanation}</div>}
                                                </div>
                                              ))}
                                              {item.work_type === 'test' && item.result_data?.question?.description && (
                                                <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, fontSize: 12 }}>
                                                  <strong>Question:</strong> {item.result_data.question.description}
                                                </div>
                                              )}
                                              {item.work_type === 'test' && item.content && (
                                                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, padding: '10px 12px', fontSize: 12, overflowX: 'auto', maxHeight: 220 }}>{item.content}</pre>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
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
            ))}
            </>) : (<>
            {officialEnhViewMode === 'by-classroom' ? (
              enhClassroomListLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textMuted }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                  <div>Loading classroom list…</div>
                </div>
              ) : !enhClassroomList || enhClassroomList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textMuted }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🏛</div>
                  <div style={{ fontWeight: font.weightSemibold, marginBottom: 6 }}>No official classrooms found</div>
                  <div style={{ fontSize: font.sizeSm }}>Create classrooms with an "Official Lessons" category to see them here.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeSm }}>
                    <thead>
                      <tr>
                        <th style={{ width: 32, padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg }} />
                        {['Classroom', 'Students', 'Avg Completion', 'Avg Quiz', 'Avg Test', 'Quiz Pass Rate', 'Test Pass Rate', 'Common Weak Topics'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg, textAlign: h === 'Classroom' ? 'left' : 'center', color: colors.textSecondary, fontWeight: font.weightSemibold, fontSize: font.sizeXs, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {enhClassroomList.map((cls, idx) => {
                        const isExp = enhExpandedClassroom === cls.classroom_id;
                        const detail = enhClassroomDetailData[cls.classroom_id];
                        const detailLoading = Boolean(enhClassroomDetailLoading[cls.classroom_id]);
                        const rowBg = isExp ? colors.primaryLight : (idx % 2 === 0 ? colors.surface : colors.bg);
                        const s = cls.class_summary;
                        return (
                          <React.Fragment key={`enhclsc_${cls.classroom_id}`}>
                            <tr onClick={() => toggleEnhClassroomRow(cls.classroom_id)}
                              style={{ cursor: 'pointer', background: rowBg }}
                              onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = colors.primaryLight; }}
                              onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = rowBg; }}>
                              <td style={{ ...tdS, textAlign: 'center', color: '#059669', fontWeight: 700, fontSize: 16 }}>{isExp ? '▾' : '▸'}</td>
                              <td style={tdS}><span style={{ fontWeight: font.weightSemibold }}>{cls.classroom_name}</span></td>
                              <td style={{ ...tdS, textAlign: 'center' }}>{cls.total_students}</td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_completion_percentage} /></td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_quiz_score} /></td>
                              <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_test_score} /></td>
                              <td style={{ ...tdS, textAlign: 'center', color: s.quiz_pass_rate != null ? _rateColor(s.quiz_pass_rate) : colors.textMuted, fontWeight: 600 }}>{s.quiz_pass_rate != null ? `${s.quiz_pass_rate}%` : '—'}</td>
                              <td style={{ ...tdS, textAlign: 'center', color: s.test_pass_rate != null ? _rateColor(s.test_pass_rate) : colors.textMuted, fontWeight: 600 }}>{s.test_pass_rate != null ? `${s.test_pass_rate}%` : '—'}</td>
                              <td style={{ ...tdS }}>
                                {s.most_common_weak_topics?.length > 0
                                  ? s.most_common_weak_topics.slice(0, 3).map(t => (
                                      <span key={t} style={{ display: 'inline-block', marginRight: 4, marginBottom: 2, fontSize: 11, background: '#fde68a', color: '#92400e', borderRadius: 9999, padding: '1px 7px' }}>{t}</span>
                                    ))
                                  : <span style={{ color: colors.textMuted }}>—</span>}
                              </td>
                            </tr>
                            {isExp && (
                              <tr>
                                <td colSpan={9} style={{ padding: '16px 24px 24px 48px', background: colors.primaryLight, borderBottom: `2px solid #6ee7b7` }}>
                                  {detailLoading ? (
                                    <div style={{ color: colors.textMuted, padding: '20px 0' }}>⏳ Loading students…</div>
                                  ) : !detail || detail.students.length === 0 ? (
                                    <div style={{ color: colors.textMuted }}>No student data for this classroom yet.</div>
                                  ) : (
                                    <>
                                      <_CourseSummaryBar summary={detail.class_summary} />
                                      <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeSm }}>
                                          <thead>
                                            <tr>
                                              <th style={{ width: 32, padding: '8px 12px', borderBottom: `2px solid ${colors.border}`, background: colors.bg }} />
                                              {['Status', 'Name', 'Completion', 'Quiz Pass', 'Avg Quiz', 'Test Pass', 'Avg Test', 'Weak', 'Last Active'].map(h => (
                                                <th key={h} style={{ padding: '8px 12px', borderBottom: `2px solid ${colors.border}`, background: colors.bg, textAlign: h === 'Name' ? 'left' : 'center', color: colors.textSecondary, fontWeight: font.weightSemibold, fontSize: font.sizeXs, whiteSpace: 'nowrap' }}>{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {detail.students.map((stu, si) => {
                                              const stuExp = enhClassroomExpandedStudent[cls.classroom_id] === stu.student_id;
                                              const stuStatus = _studentStatus(stu);
                                              const stuBg = stuExp ? '#d1fae5' : (si % 2 === 0 ? colors.surface : colors.bg);
                                              const wkey = `${cls.classroom_id}_${stu.student_id}`;
                                              const stuWork = enhClassroomStudentWork[wkey] || [];
                                              const stuWorkLoading = Boolean(enhClassroomWorkLoading[wkey]);
                                              return (
                                                <React.Fragment key={`enhclsstu_${cls.classroom_id}_${stu.student_id}`}>
                                                  <tr onClick={() => toggleEnhClassroomStudentRow(cls.classroom_id, stu.student_id)}
                                                    style={{ cursor: 'pointer', background: stuBg }}
                                                    onMouseEnter={e => { if (!stuExp) e.currentTarget.style.background = '#d1fae5'; }}
                                                    onMouseLeave={e => { if (!stuExp) e.currentTarget.style.background = stuBg; }}>
                                                    <td style={{ ...tdS, textAlign: 'center', color: '#059669', fontWeight: 700 }}>{stuExp ? '▾' : '▸'}</td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                                      <span title={stuStatus.label} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: stuStatus.bg, color: stuStatus.fg, whiteSpace: 'nowrap' }}>{stuStatus.dot} {stuStatus.label}</span>
                                                    </td>
                                                    <td style={tdS}>
                                                      <div style={{ fontWeight: font.weightSemibold }}>{stu.full_name || '—'}</div>
                                                      <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{stu.email}</div>
                                                    </td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={stu.completion_percentage} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_PassRateBadge passed={stu.quizzes_passed} attempted={stu.quizzes_attempted} tooltip={`${stu.quizzes_passed}/${stu.quizzes_attempted} quizzes ≥70`} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={stu.avg_quiz_score} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_PassRateBadge passed={stu.tests_passed} attempted={stu.tests_attempted} tooltip={`${stu.tests_passed}/${stu.tests_attempted} tests ≥60`} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={stu.avg_test_score} /></td>
                                                    <td style={{ ...tdS, textAlign: 'center' }}>{stu.weak_topics?.length || 0}</td>
                                                    <td style={{ ...tdS, textAlign: 'center', color: colors.textMuted, fontSize: font.sizeXs }}>{stu.last_active ? new Date(stu.last_active).toLocaleDateString() : '—'}</td>
                                                  </tr>
                                                  {stuExp && (
                                                    <tr>
                                                      <td colSpan={10} style={{ padding: '12px 20px 18px 44px', background: '#ecfdf5', borderBottom: `2px solid #6ee7b7` }}>
                                                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                                                          <div style={{ fontSize: font.sizeSm }}><strong>Subtopics Read:</strong> {stu.completed_topics}</div>
                                                          <div style={{ fontSize: font.sizeSm }}><strong>Weak Topics:</strong> {stu.weak_topics?.length ? stu.weak_topics.join(', ') : 'None'}</div>
                                                        </div>
                                                        {stu.topic_stats?.length > 0 && (
                                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeXs, marginBottom: 14 }}>
                                                            <thead>
                                                              <tr style={{ background: colors.bg }}>
                                                                {['Topic', 'Quiz Attempts', 'Quiz Avg', 'Quiz Pass', 'Test Attempts', 'Test Avg', 'Test Pass'].map(h => (
                                                                  <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Topic' ? 'left' : 'center', color: colors.textSecondary, fontWeight: font.weightSemibold, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                                                                ))}
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {stu.topic_stats.map(ts => (
                                                                <tr key={ts.topic} style={{ background: ts.is_weak ? '#fff7ed' : 'transparent' }}>
                                                                  <td style={{ padding: '5px 8px', borderBottom: `1px solid ${colors.border}` }}>{ts.is_weak && <span style={{ marginRight: 4 }}>⚠️</span>}{ts.topic}</td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.quiz_attempts || '—'}</td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><_ScoreBadge score={ts.quiz_avg_score} /></td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}>{ts.quiz_pass_rate != null ? `${ts.quiz_pass_rate}%` : '—'}</td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.test_attempts || '—'}</td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><_ScoreBadge score={ts.test_avg_score} /></td>
                                                                  <td style={{ padding: '5px 8px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}>{ts.test_pass_rate != null ? `${ts.test_pass_rate}%` : '—'}</td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        )}
                                                        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
                                                          <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, marginBottom: 8 }}>Student Work Details</div>
                                                          {stuWorkLoading && <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>Loading…</div>}
                                                          {!stuWorkLoading && stuWork.length === 0 && <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>No saved work yet.</div>}
                                                          {!stuWorkLoading && stuWork.map(item => {
                                                            const wexp = Boolean(enhClassroomExpandedWork[item.id]);
                                                            const score = item.result_data?.score;
                                                            const hasDetails = (item.work_type === 'quiz' && item.result_data?.review?.length > 0) || (item.work_type === 'test' && (item.result_data?.question?.description || item.content));
                                                            return (
                                                              <div key={item.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, background: colors.surface, padding: '10px 12px', marginBottom: 8 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                                                  <div>
                                                                    <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold }}>{item.title}</div>
                                                                    <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{item.work_type.toUpperCase()} · {item.topic_id || 'No topic'} · {new Date(item.created_at).toLocaleDateString()}</div>
                                                                  </div>
                                                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    {score != null && <_ScoreBadge score={score} />}
                                                                    {hasDetails && (
                                                                      <button onClick={() => setEnhClassroomExpandedWork(p => ({ ...p, [item.id]: !p[item.id] }))}
                                                                        style={{ ...btn.secondary, padding: '4px 10px', fontSize: 12 }}>{wexp ? 'Hide' : 'View Details'}</button>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            );
                                                          })}
                                                        </div>
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
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* ── Enhanced Java Aggregate view ── */
              officialEnhAggLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textMuted }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                  <div>Loading aggregate data…</div>
                </div>
              ) : !officialEnhAggData || officialEnhAggData.students.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textMuted }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>👩‍🎓</div>
                  <div style={{ fontWeight: font.weightSemibold, marginBottom: 6 }}>No student data yet</div>
                  <div style={{ fontSize: font.sizeSm }}>Share official classroom join codes with students to get started.</div>
                </div>
              ) : (
                <>
                  <_CourseSummaryBar summary={officialEnhAggData.class_summary} />
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeSm }}>
                      <thead>
                        <tr>
                          <th style={{ width: 32, padding: '10px 14px', borderBottom: `2px solid ${colors.border}`, background: colors.bg }} />
                          <EnhancedSortTh label="Status"      sortKeyName="status"               center />
                          <EnhancedSortTh label="Name"        sortKeyName="full_name" />
                          <EnhancedSortTh label="Completion"  sortKeyName="completion_percentage" center />
                          <EnhancedSortTh label="Quiz Pass"   sortKeyName="quiz_pass_rate"        center />
                          <EnhancedSortTh label="Avg Quiz"    sortKeyName="avg_quiz_score"        center />
                          <EnhancedSortTh label="Test Pass"   sortKeyName="test_pass_rate"        center />
                          <EnhancedSortTh label="Avg Test"    sortKeyName="avg_test_score"        center />
                          <EnhancedSortTh label="Weak Topics" sortKeyName="weak_count"            center />
                          <EnhancedSortTh label="Last Active" sortKeyName="last_active"           center />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedEnhOfficialStudents(officialEnhAggData.students).map((s, idx) => {
                          const isExp = officialEnhExpandedStudent === s.student_id;
                          const status = _studentStatus(s);
                          const rowBg = isExp ? '#d1fae5' : (idx % 2 === 0 ? colors.surface : colors.bg);
                          const work = officialEnhStudentWork[s.student_id] || [];
                          const workLoading = Boolean(officialEnhWorkLoading[s.student_id]);
                          return (
                            <React.Fragment key={`enhagg_${s.student_id}`}>
                              <tr onClick={() => toggleEnhOfficialStudentRow(s.student_id)}
                                style={{ cursor: 'pointer', background: rowBg, transition: 'background 0.15s' }}
                                onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = '#d1fae5'; }}
                                onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = rowBg; }}>
                                <td style={{ ...tdS, textAlign: 'center', color: '#059669', fontWeight: 700, fontSize: 16 }}>{isExp ? '▾' : '▸'}</td>
                                <td style={{ ...tdS, textAlign: 'center' }}>
                                  <span title={status.label} style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: status.bg, color: status.fg, whiteSpace: 'nowrap' }}>{status.dot} {status.label}</span>
                                </td>
                                <td style={tdS}>
                                  <div style={{ fontWeight: font.weightSemibold }}>{s.full_name || '—'}</div>
                                  <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{s.email}</div>
                                </td>
                                <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.completion_percentage} /></td>
                                <td style={{ ...tdS, textAlign: 'center' }}><_PassRateBadge passed={s.quizzes_passed} attempted={s.quizzes_attempted} tooltip={`${s.quizzes_passed}/${s.quizzes_attempted} quizzes ≥70`} /></td>
                                <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_quiz_score} /></td>
                                <td style={{ ...tdS, textAlign: 'center' }}><_PassRateBadge passed={s.tests_passed} attempted={s.tests_attempted} tooltip={`${s.tests_passed}/${s.tests_attempted} tests ≥60`} /></td>
                                <td style={{ ...tdS, textAlign: 'center' }}><_ScoreBadge score={s.avg_test_score} /></td>
                                <td style={{ ...tdS, textAlign: 'center' }}>{s.weak_topics?.length || 0}</td>
                                <td style={{ ...tdS, textAlign: 'center', color: colors.textMuted, fontSize: font.sizeXs }}>{s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}</td>
                              </tr>
                              {isExp && (
                                <tr>
                                  <td colSpan={10} style={{ padding: '12px 24px 20px 48px', background: '#d1fae5', borderBottom: `2px solid #6ee7b7` }}>
                                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 8 }}>
                                      <div style={{ fontSize: font.sizeSm }}><strong>Subtopics Read:</strong> {s.completed_topics}</div>
                                      <div style={{ fontSize: font.sizeSm }}><strong>Weak Topics:</strong> {s.weak_topics?.length ? s.weak_topics.join(', ') : 'None'}</div>
                                    </div>
                                    {s.topic_stats?.length > 0 && (
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: font.sizeXs, marginBottom: 14 }}>
                                        <thead>
                                          <tr style={{ background: colors.bg }}>
                                            {['Topic', 'Quiz Attempts', 'Quiz Avg', 'Quiz Pass', 'Test Attempts', 'Test Avg', 'Test Pass'].map(h => (
                                              <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Topic' ? 'left' : 'center', color: colors.textSecondary, fontWeight: font.weightSemibold, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {s.topic_stats.map(ts => (
                                            <tr key={ts.topic} style={{ background: ts.is_weak ? '#fff7ed' : 'transparent' }}>
                                              <td style={{ padding: '6px 10px', color: colors.text, borderBottom: `1px solid ${colors.border}` }}>{ts.is_weak && <span style={{ marginRight: 4 }}>⚠️</span>}{ts.topic}</td>
                                              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.quiz_attempts || '—'}</td>
                                              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><_ScoreBadge score={ts.quiz_avg_score} /></td>
                                              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}>{ts.quiz_pass_rate != null ? `${ts.quiz_pass_rate}%` : '—'}</td>
                                              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{ts.test_attempts || '—'}</td>
                                              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}><_ScoreBadge score={ts.test_avg_score} /></td>
                                              <td style={{ padding: '6px 10px', textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}>{ts.test_pass_rate != null ? `${ts.test_pass_rate}%` : '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                    <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
                                      <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold, marginBottom: 8, color: colors.text }}>Student Work Details</div>
                                      {workLoading && <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>Loading…</div>}
                                      {!workLoading && work.length === 0 && <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>No saved work yet.</div>}
                                      {!workLoading && work.map(item => {
                                        const exp = Boolean(officialEnhExpandedWork[item.id]);
                                        const score = item.result_data?.score;
                                        const hasDetails = (item.work_type === 'quiz' && item.result_data?.review?.length > 0) || (item.work_type === 'test' && (item.result_data?.question?.description || item.content));
                                        return (
                                          <div key={item.id} style={{ border: `1px solid ${colors.border}`, borderRadius: radii.md, background: colors.surface, padding: '10px 12px', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                              <div>
                                                <div style={{ fontSize: font.sizeSm, fontWeight: font.weightSemibold }}>{item.title}</div>
                                                <div style={{ fontSize: font.sizeXs, color: colors.textMuted }}>{item.work_type.toUpperCase()} · {item.topic_id || 'No topic'} · {new Date(item.created_at).toLocaleDateString()}</div>
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {score != null && <_ScoreBadge score={score} />}
                                                {hasDetails && (
                                                  <button onClick={() => setOfficialEnhExpandedWork(p => ({ ...p, [item.id]: !p[item.id] }))}
                                                    style={{ ...btn.secondary, padding: '4px 10px', fontSize: 12 }}>{exp ? 'Hide' : 'View Details'}</button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
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
              )
            )}
            </> )}
            </div> {/* End padding wrapper */}
          </div>
        )}
      </div>

      {/* Your Classrooms — flat grid of ALL classrooms */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <h3 style={{ fontSize: font.sizeLg, color: colors.text, margin: 0 }}>🏛 Your Classrooms</h3>
          <span style={{ background: colors.primaryLight, color: colors.primary, borderRadius: radii.full, padding: '2px 10px', fontSize: font.sizeSm, fontWeight: font.weightBold }}>
            {filteredClasses.length}{filteredClasses.length !== classes.length ? ` / ${classes.length}` : ''}
          </span>
        </div>

        {/* Search + category filter */}
        {classes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
            <input
              value={classroomSearch}
              onChange={e => setClassroomSearch(e.target.value)}
              placeholder="Search classrooms…"
              style={{ ...inputStyle, flex: '1 1 100%', padding: '7px 12px', fontSize: font.sizeSm }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: '100%' }}>
              {['all', ...uniqueCategories].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  style={{
                    padding: '5px 12px', fontSize: font.sizeXs, fontWeight: font.weightSemibold,
                    borderRadius: radii.full, cursor: 'pointer', whiteSpace: 'nowrap',
                    border: categoryFilter === cat ? `1.5px solid ${colors.primary}` : `1px solid ${colors.border}`,
                    background: categoryFilter === cat ? colors.primaryLight : colors.surface,
                    color: categoryFilter === cat ? colors.primary : colors.textSecondary,
                    transition: 'all 0.15s',
                  }}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {classes.length === 0 ? (
          <div style={{ ...card.base, textAlign: 'center', padding: 48, color: colors.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏛</div>
            <div style={{ fontSize: font.sizeMd, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 6 }}>No classrooms yet</div>
            <div style={{ fontSize: font.sizeSm }}>Create a classroom above to get started.</div>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div style={{ ...card.base, textAlign: 'center', padding: 32, color: colors.textMuted }}>
            <div style={{ fontSize: font.sizeMd, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 6 }}>No classrooms match your filter</div>
            <div style={{ fontSize: font.sizeSm }}>Try a different category or clear the search.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
            {filteredClasses.map(cls => renderClassroomCard(cls, isOfficialCategory(cls.category)))}
          </div>
        )}
      </div>
    </div>
  );
}

