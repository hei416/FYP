import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  createClassroom, getMyClassrooms,
  createSection, listSections, deleteSection, renameSection,
  uploadClassroomFileToSection, deleteClassroomFile, moveFileToSection,
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const { isTeacher, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [classes,     setClasses]     = useState([]);
  const [form,        setForm]        = useState({ name: '', description: '' });
  const [creating,    setCreating]    = useState(false);
  const [formError,   setFormError]   = useState('');
  const [copiedCode,  setCopiedCode]  = useState(null);

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

  function copyCode(e, code) {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading…</div>;

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: `1px solid ${colors.border}`, borderRadius: radii.sm,
    fontSize: font.sizeMd, color: colors.text,
    outline: 'none', boxSizing: 'border-box', background: colors.surface,
  };

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
          <div style={{ flex: '2 1 300px' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: font.sizeSm, color: colors.textSecondary }}>Description</label>
            <input style={inputStyle} placeholder="Optional description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" disabled={creating} style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap' }}>
            {creating ? 'Creating…' : '+ Create Classroom'}
          </button>
        </form>
        {formError && <p style={{ color: '#ef4444', marginTop: 10, fontSize: font.sizeSm }}>{formError}</p>}
      </div>

      {/* Classroom grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <h3 style={{ fontSize: font.sizeLg, color: colors.text, margin: 0 }}>🏛 Your Classrooms</h3>
          <span style={{ background: colors.primaryLight, color: colors.primary, borderRadius: radii.full, padding: '2px 10px', fontSize: font.sizeSm, fontWeight: font.weightBold }}>{classes.length}</span>
        </div>

        {classes.length === 0 ? (
          <div style={{ ...card.base, textAlign: 'center', padding: 48, color: colors.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏛</div>
            <div style={{ fontSize: font.sizeMd, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 6 }}>No classrooms yet</div>
            <div style={{ fontSize: font.sizeSm }}>Fill in the form above to create your first classroom.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
            {classes.map(cls => (
              <div key={cls.id}
                style={{
                  ...card.base, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = shadows.md; e.currentTarget.style.borderColor = colors.primaryBorder; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = card.base?.boxShadow || ''; e.currentTarget.style.borderColor = colors.border; }}
              >
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ margin: 0, color: colors.primary, fontSize: font.sizeLg, fontWeight: font.weightBold, lineHeight: 1.3 }}>{cls.name}</h4>
                    {cls.description && <p style={{ margin: '4px 0 0 0', fontSize: font.sizeSm, color: colors.textSecondary, lineHeight: 1.4 }}>{cls.description}</p>}
                  </div>
                  {/* Open classroom button */}
                  <button
                    onClick={() => navigate(`/teacher-classroom/${cls.id}`, { state: { name: cls.name, description: cls.description, class_code: cls.class_code } })}
                    style={{ ...btn.primary, ...btn.small, whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Open →
                  </button>
                </div>

                {/* Class code */}
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
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

