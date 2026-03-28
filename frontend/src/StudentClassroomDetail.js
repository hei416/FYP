import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listClassroomFiles, downloadClassroomFile, askClassroom } from './classroomService';

export default function StudentClassroomDetail() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('materials'); // 'materials' | 'ask'
  const [files, setFiles] = useState([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(true);

  useEffect(() => {
    setFilesLoading(true);
    listClassroomFiles(classroomId)
      .then(setFiles)
      .catch(console.error)
      .finally(() => setFilesLoading(false));
  }, [classroomId]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const result = await askClassroom(classroomId, question);
      setAnswer(result);
    } catch (err) {
      setAnswer({ answer: 'Error: ' + err.message, has_context: false, sources_count: 0 });
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      maxWidth: 800,
      margin: '0 auto',
      padding: '24px 16px',
      fontFamily: 'inherit',
    },
    backBtn: {
      background: 'none',
      border: 'none',
      color: '#6B7280',
      cursor: 'pointer',
      fontSize: 14,
      marginBottom: 16,
      padding: '4px 0',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    tabs: {
      display: 'flex',
      gap: 8,
      marginBottom: 24,
      borderBottom: '1px solid #E5E7EB',
    },
    tab: (active) => ({
      padding: '10px 20px',
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      fontWeight: active ? 600 : 400,
      color: active ? '#2563EB' : '#6B7280',
      borderBottom: active ? '2px solid #2563EB' : '2px solid transparent',
      marginBottom: -1,
      fontSize: 15,
      transition: 'color 0.15s',
    }),
    fileCard: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      border: '1px solid #E5E7EB',
      borderRadius: 8,
      marginBottom: 8,
      background: '#FAFAFA',
    },
    fileName: { flex: 1, fontWeight: 500, fontSize: 14, wordBreak: 'break-all' },
    fileDate: { color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' },
    downloadBtn: {
      padding: '6px 14px',
      background: '#2563EB',
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 13,
      whiteSpace: 'nowrap',
    },
    empty: { textAlign: 'center', color: '#9CA3AF', padding: '40px 0', fontSize: 15 },
    form: { display: 'flex', flexDirection: 'column', gap: 12 },
    textarea: {
      width: '100%',
      padding: 12,
      border: '1px solid #D1D5DB',
      borderRadius: 8,
      fontSize: 14,
      resize: 'vertical',
      fontFamily: 'inherit',
      outline: 'none',
    },
    askBtn: {
      alignSelf: 'flex-end',
      padding: '10px 24px',
      background: '#2563EB',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 15,
      opacity: loading ? 0.7 : 1,
    },
    answerCard: {
      marginTop: 16,
      padding: 16,
      background: '#F0F9FF',
      border: '1px solid #BAE6FD',
      borderRadius: 8,
    },
    answerText: { fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#1E293B' },
    contextNote: { display: 'block', marginTop: 10, fontSize: 12, color: '#0369A1' },
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('pdf')) return '\uD83D\uDCC4';
    if (mimeType?.includes('word') || mimeType?.includes('docx')) return '\uD83D\uDCDD';
    return '\uD83D\uDCCB';
  };

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/my-classrooms')}>
        ← Back to My Classrooms
      </button>

      <div style={styles.tabs}>
        <button
          style={styles.tab(tab === 'materials')}
          onClick={() => setTab('materials')}
        >
          📄 Materials
        </button>
        <button
          style={styles.tab(tab === 'ask')}
          onClick={() => setTab('ask')}
        >
          💬 Ask AI
        </button>
      </div>

      {tab === 'materials' && (
        <div>
          {filesLoading ? (
            <p style={styles.empty}>Loading materials…</p>
          ) : files.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <p>No materials uploaded yet.</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Your teacher will upload documents here for you to study.</p>
            </div>
          ) : (
            files.map((f) => (
              <div key={f.id} style={styles.fileCard}>
                <span style={{ fontSize: 22 }}>{getFileIcon(f.mime_type)}</span>
                <span style={styles.fileName}>{f.filename}</span>
                <span style={styles.fileDate}>
                  {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ''}
                </span>
                <button
                  style={styles.downloadBtn}
                  onClick={() => downloadClassroomFile(classroomId, f.id, f.filename)}
                >
                  Download
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'ask' && (
        <div>
          {files.length === 0 && !filesLoading && (
            <div style={{ padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#92400E' }}>
              ⚠️ No documents uploaded yet — the AI will answer from general Java knowledge.
            </div>
          )}
          <form onSubmit={handleAsk} style={styles.form}>
            <textarea
              style={styles.textarea}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about the classroom materials or Java programming…"
              rows={4}
            />
            <button type="submit" disabled={loading} style={styles.askBtn}>
              {loading ? 'Thinking…' : 'Ask AI'}
            </button>
          </form>

          {answer && (
            <div style={styles.answerCard}>
              <p style={styles.answerText}>{answer.answer}</p>
              {answer.has_context && (
                <small style={styles.contextNote}>
                  ✓ Answer based on {answer.sources_count} classroom document excerpt(s)
                </small>
              )}
              {!answer.has_context && answer.answer && !answer.answer.startsWith('Error') && (
                <small style={{ ...styles.contextNote, color: '#6B7280' }}>
                  ℹ️ Answered from general Java knowledge (no matching documents found)
                </small>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
