import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { downloadClassroomFile, askClassroom, listSections, listClassroomQuizzes } from './classroomService';

const getToken = () => localStorage.getItem("authToken") || sessionStorage.getItem("authToken");

// Helper function to generate unique IDs
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function StudentClassroomDetail() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('materials'); // 'materials' | 'sections'
  const [filesError, setFilesError] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewerFile, setViewerFile] = useState(null); // For inline viewer
  const [token, setToken] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [classroomConversationId, setClassroomConversationId] = useState(null);
  // Sections tab state
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  // Quizzes tab state
  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);    // quiz being taken
  const [quizCurrentQ, setQuizCurrentQ] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});    // questionId → selectedIndex
  const [quizChecked, setQuizChecked] = useState({});    // questionId → true/false
  const [quizDone, setQuizDone] = useState(false);

  useEffect(() => {
    // Reset conversation ID when classroom changes
    setClassroomConversationId(null);
    console.log(`🔄 Reset conversation ID for new classroom: ${classroomId}`);
  }, [classroomId]);

  // Refresh sections when classroom changes
  useEffect(() => {
    if (!classroomId) return;
    setSectionsLoading(true);
    setFilesError(null);
    listSections(classroomId)
      .then(data => setSections(data))
      .catch((err) => {
        setSections([]);
        setFilesError(err.message || 'Failed to load sections');
      })
      .finally(() => setSectionsLoading(false));
  }, [classroomId]);

  // Load published quizzes
  useEffect(() => {
    if (!classroomId) return;
    setQuizzesLoading(true);
    listClassroomQuizzes(classroomId)
      .then(data => setQuizzes(data))
      .catch(() => setQuizzes([]))
      .finally(() => setQuizzesLoading(false));
  }, [classroomId]);

  // Get token on mount
  useEffect(() => {
    const t = getToken();
    console.log(`🔑 [StudentClassroomDetail] Token loaded: ${t ? `length=${t.length}` : 'null'}`);
    if (t) {
      setToken(t);
    }
  }, []);

  // Load text file content for viewer
  useEffect(() => {
    if (!viewerFile || !token) return;
    if (!(viewerFile.mime_type?.includes('text') || viewerFile.mime_type?.includes('markdown'))) return;
    
    setTextContent(null); // Reset while loading
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    console.log(`📄 Loading text file: ${viewerFile.filename}`);
    fetch(`${API_BASE}/classrooms/${classroomId}/files/${viewerFile.id}/view`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((content) => {
        setTextContent(content);
        console.log(`✅ Text file loaded (${content.length} chars)`);
      })
      .catch((err) => {
        console.error('❌ Error loading text file:', err);
        setTextContent(`Error loading file: ${err.message}`);
      });
  }, [viewerFile, classroomId, token]);

  // Load PDF/other files as blob for iframe
  useEffect(() => {
    if (!viewerFile || !token) {
      if (viewerFile && !token) {
        console.log(`⏭️ [PDF] Skipping - token not available yet`);
      }
      return;
    }
    if (!viewerFile.mime_type?.includes('pdf')) return;
    
    setPdfBlobUrl(null); // Reset while loading
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    console.log(`📄 [PDF] Loading: ${viewerFile.filename} (token=${token?.length} chars)`);
    fetch(`${API_BASE}/classrooms/${classroomId}/files/${viewerFile.id}/view`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        console.log(`✅ [PDF] Blob loaded (${blob.size} bytes)`);
        const url = URL.createObjectURL(blob);
        console.log(`📍 [PDF] Blob URL: ${url.substring(0, 30)}...`);
        setPdfBlobUrl(url);
      })
      .catch((err) => {
        console.error('❌ [PDF] Error:', err);
        setPdfBlobUrl(`data:text/html,<p style="color: red; padding: 20px;">Failed to load PDF: ${err.message}<br/>Try downloading instead.</p>`);
      });
  }, [viewerFile, classroomId, token]);

  // Cleanup blob URL when modal closes
  useEffect(() => {
    return () => {
      if (pdfBlobUrl && pdfBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // Load source PDF from RAG results
  const [sourceBlob, setSourceBlob] = useState(null);
  useEffect(() => {
    if (!answer?.sources?.[selectedSourceIndex] || !token) {
      setSourceBlob(null);
      return;
    }
    
    const source = answer.sources[selectedSourceIndex];
    if (source.mime_type?.includes('pdf')) {
      const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
      console.log(`📄 Loading source PDF: ${source.filename}`);
      fetch(`${API_BASE}/classrooms/${classroomId}/files/${source.file_id}/view`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        })
        .then((blob) => {
          console.log(`✅ Source PDF loaded (${blob.size} bytes)`);
          const url = URL.createObjectURL(blob);
          setSourceBlob(url);
        })
        .catch((err) => {
          console.error('❌ Error loading source PDF:', err);
          setSourceBlob(null);
        });
    } else {
      setSourceBlob(null);
    }
  }, [answer?.sources, selectedSourceIndex, token, classroomId]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    
    const userQuestion = question;
    setQuestion(''); // Clear input immediately
    
    try {
      const result = await askClassroom(classroomId, userQuestion);
      setAnswer(result);
      
      // Save to conversation history with "classroom" context_type
      const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
      
      // ✅ FIXED: Reuse conversation_id if it exists, create new one only on first message
      const conversationId = classroomConversationId || 
        `classroom_${classroomId}_${generateId()}`;
      
      // Store for future messages in this classroom view
      if (!classroomConversationId) {
        setClassroomConversationId(conversationId);
        console.log(`📌 Created new classroom conversation: ${conversationId}`);
      } else {
        console.log(`♻️ Reusing existing conversation: ${conversationId}`);
      }
      
      await fetch(`${API_BASE}/conversation/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_message: userQuestion,
          assistant_response: result.answer,
          context_type: 'classroom',
        }),
      });
      
      console.log(`✅ Saved classroom conversation (${conversationId}) to history`);
    } catch (err) {
      setAnswer({ answer: 'Error: ' + err.message, has_context: false, sources_count: 0 });
      console.error('❌ Error in handleAsk:', err);
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
          style={styles.tab(tab === 'sections')}
          onClick={() => setTab('sections')}
        >
          📚 Sections
        </button>
        <button
          style={styles.tab(tab === 'quizzes')}
          onClick={() => setTab('quizzes')}
        >
          📝 Quizzes
        </button>
      </div>

      {tab === 'materials' && (
        <div>
          {filesError && (
            <div style={{ padding: '12px 16px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#991B1B' }}>
              ❌ Error loading materials: {filesError}
            </div>
          )}
          {sectionsLoading ? (
            <p style={styles.empty}>Loading materials…</p>
          ) : sections.length === 0 || sections.every((s) => (s.files || []).length === 0) ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <p>No materials uploaded yet.</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Your teacher will upload documents here for you to study.</p>
            </div>
          ) : (
            sections.flatMap((s) => s.files || []).map((f) => (
              <div key={f.id} style={styles.fileCard}>
                <span style={{ fontSize: 22 }}>{getFileIcon(f.mime_type)}</span>
                <span style={styles.fileName}>{f.filename}</span>
                <span style={styles.fileDate}>
                  {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ''}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{...styles.downloadBtn, background: '#16A34A'}}
                    onClick={() => setViewerFile(f)}
                    title="View file in browser"
                  >
                    👁️ View
                  </button>
                  <button
                    style={styles.downloadBtn}
                    onClick={() => downloadClassroomFile(classroomId, f.id, f.filename)}
                    title="Download file"
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>
            ))
          )}
        
        {/* File Viewer - Shows below file list */}
        {viewerFile && (
          <div style={{ marginTop: 24, padding: 16, background: '#F3F4F6', borderRadius: 8, border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                📄 {viewerFile.filename}
              </h3>
              <button
                onClick={() => {
                  setViewerFile(null);
                  setPdfBlobUrl(null);
                  setTextContent(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#6B7280',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{
              width: '100%',
              height: 600,
              border: '1px solid #D1D5DB',
              borderRadius: 8,
              background: '#fff',
              overflow: 'auto',
            }}>
              {viewerFile.mime_type?.includes('pdf') ? (
                <iframe
                  key={pdfBlobUrl}
                  src={pdfBlobUrl || 'about:blank'}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: 8,
                  }}
                  title={viewerFile.filename}
                />
              ) : viewerFile.mime_type?.includes('text') || viewerFile.mime_type?.includes('markdown') ? (
                <textarea
                  readOnly
                  value={textContent || 'Loading...'}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: 8,
                    padding: 12,
                    fontFamily: 'monospace',
                    fontSize: 13,
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#6B7280',
                }}>
                  <p>Preview not available for this file type.</p>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      )}

      {/* Ask AI tab and panel removed */}

      {tab === 'sections' && (
        <div>
          {sectionsLoading ? (
            <p style={styles.empty}>Loading sections…</p>
          ) : sections.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <p>No sections yet.</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Your teacher will organise materials into sections here.</p>
            </div>
          ) : (
            sections.map((section) => {
              const key = String(section.id);
              const isOpen = !collapsedSections[key];
              return (
                <div key={key} style={{ border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                  {/* Section header */}
                  <button
                    onClick={() => setCollapsedSections(c => ({ ...c, [key]: !c[key] }))}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', background: '#F9FAFB', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#6B7280' }}>{isOpen ? '▼' : '▶'}</span>
                    <span style={{ fontWeight: 600, fontSize: 15, flex: 1, color: '#1F2937' }}>
                      {section.id === 0 ? '📎 Unsectioned' : `📂 ${section.name}`}
                    </span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {section.files.length} file{section.files.length !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '8px 12px 12px 12px' }}>
                      {section.files.length === 0 ? (
                        <p style={{ color: '#9CA3AF', fontSize: 13, margin: '8px 4px' }}>No files in this section yet.</p>
                      ) : (
                        section.files.map((f) => (
                          <div key={f.id} style={styles.fileCard}>
                            <span style={{ fontSize: 22 }}>{getFileIcon(f.mime_type)}</span>
                            <span style={styles.fileName}>{f.filename}</span>
                            <span style={styles.fileDate}>
                              {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ''}
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                style={{ ...styles.downloadBtn, background: '#16A34A' }}
                                onClick={() => setViewerFile(f)}
                                title="View file in browser"
                              >
                                👁️ View
                              </button>
                              <button
                                style={styles.downloadBtn}
                                onClick={() => downloadClassroomFile(classroomId, f.id, f.filename)}
                                title="Download file"
                              >
                                ⬇️ Download
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Inline viewer shared with Materials tab */}
          {viewerFile && tab === 'sections' && (
            <div style={{ marginTop: 24, padding: 16, background: '#F3F4F6', borderRadius: 8, border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📄 {viewerFile.filename}</h3>
                <button
                  onClick={() => { setViewerFile(null); setPdfBlobUrl(null); setTextContent(null); }}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}
                >✕</button>
              </div>
              <div style={{ width: '100%', height: 600, border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', overflow: 'auto' }}>
                {viewerFile.mime_type?.includes('pdf') ? (
                  <iframe key={pdfBlobUrl} src={pdfBlobUrl || 'about:blank'}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
                    title={viewerFile.filename} />
                ) : viewerFile.mime_type?.includes('text') || viewerFile.mime_type?.includes('markdown') ? (
                  <textarea readOnly value={textContent || 'Loading...'}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B7280' }}>
                    <p>Preview not available for this file type.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Quizzes tab ──────────────────────────────────────────────────── */}
      {tab === 'quizzes' && (
        <div>
          {quizzesLoading ? (
            <p style={styles.empty}>Loading quizzes…</p>
          ) : !activeQuiz ? (
            /* Quiz list */
            quizzes.length === 0 ? (
              <div style={styles.empty}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                <p>No quizzes published yet.</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>Your teacher will publish quizzes here for you to attempt.</p>
              </div>
            ) : (
              quizzes.map(quiz => (
                <div key={quiz.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 10, background: '#FAFAFA',
                }}>
                  <span style={{ fontSize: 26 }}>📝</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#1F2937' }}>{quiz.title}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveQuiz(quiz);
                      setQuizCurrentQ(0);
                      setQuizAnswers({});
                      setQuizChecked({});
                      setQuizDone(false);
                    }}
                    style={styles.downloadBtn}
                  >
                    Start Quiz →
                  </button>
                </div>
              ))
            )
          ) : quizDone ? (
            /* Results screen */
            (() => {
              const questions = activeQuiz.questions;
              const correct = questions.filter(q => quizAnswers[q.id] === q.correct_index).length;
              const pct = Math.round((correct / questions.length) * 100);
              return (
                <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 56, marginBottom: 8 }}>
                    {pct >= 80 ? '🏆' : pct >= 60 ? '😊' : '📚'}
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#1F2937' }}>
                    {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Well done!' : 'Keep practising!'}
                  </h3>
                  <p style={{ fontSize: 16, color: '#6B7280', marginBottom: 20 }}>
                    You scored <strong style={{ color: pct >= 70 ? '#16a34a' : '#dc2626' }}>{correct}/{questions.length} ({pct}%)</strong>
                  </p>
                  {/* Review */}
                  {questions.map((q, i) => {
                    const selected = quizAnswers[q.id];
                    const isCorrect = selected === q.correct_index;
                    return (
                      <div key={q.id} style={{
                        textAlign: 'left', padding: '12px 14px', marginBottom: 10,
                        border: `1px solid ${isCorrect ? '#bbf7d0' : '#fecaca'}`,
                        borderRadius: 8, background: isCorrect ? '#f0fdf4' : '#fff1f2',
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Q{i + 1}: {q.question}</div>
                        <div style={{ fontSize: 12, color: isCorrect ? '#16a34a' : '#dc2626', marginBottom: 4 }}>
                          {isCorrect ? '✓ Correct' : `✗ Your answer: ${selected != null ? q.options[selected] : '(not answered)'}`}
                        </div>
                        {!isCorrect && (
                          <div style={{ fontSize: 12, color: '#16a34a' }}>Correct: {q.options[q.correct_index]}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>💡 {q.explanation}</div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setActiveQuiz(null)}
                    style={{ ...styles.downloadBtn, marginTop: 12 }}
                  >← Back to Quizzes</button>
                </div>
              );
            })()
          ) : (
            /* Quiz player — one question at a time */
            (() => {
              const questions = activeQuiz.questions;
              const q = questions[quizCurrentQ];
              const selectedIdx = quizAnswers[q.id];
              const checked = quizChecked[q.id];
              const isCorrect = checked && selectedIdx === q.correct_index;
              return (
                <div style={{ maxWidth: 560, margin: '0 auto', padding: '12px 0' }}>
                  {/* Progress */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 13, color: '#6B7280' }}>
                      Question {quizCurrentQ + 1} of {questions.length}
                    </span>
                    <button
                      onClick={() => setActiveQuiz(null)}
                      style={{ background: 'none', border: 'none', fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }}
                    >✕ Exit</button>
                  </div>
                  <div style={{ height: 4, background: '#E5E7EB', borderRadius: 99, marginBottom: 20 }}>
                    <div style={{ width: `${((quizCurrentQ + 1) / questions.length) * 100}%`, height: '100%', background: '#2563EB', borderRadius: 99, transition: 'width 0.3s' }} />
                  </div>

                  <div style={{ fontWeight: 600, fontSize: 16, color: '#1F2937', marginBottom: 16, lineHeight: 1.5 }}>
                    {q.question}
                  </div>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {q.options.map((opt, optIdx) => {
                      let bg = '#F9FAFB', border = '1px solid #E5E7EB', color = '#1F2937';
                      if (checked) {
                        if (optIdx === q.correct_index) { bg = '#f0fdf4'; border = '1px solid #86efac'; color = '#166534'; }
                        else if (optIdx === selectedIdx) { bg = '#fff1f2'; border = '1px solid #fca5a5'; color = '#991b1b'; }
                      } else if (optIdx === selectedIdx) {
                        bg = '#eff6ff'; border = '1px solid #93c5fd'; color = '#1d4ed8';
                      }
                      return (
                        <button
                          key={optIdx}
                          disabled={checked}
                          onClick={() => !checked && setQuizAnswers(a => ({ ...a, [q.id]: optIdx }))}
                          style={{
                            padding: '12px 16px', background: bg, border, borderRadius: 8,
                            cursor: checked ? 'default' : 'pointer', textAlign: 'left',
                            fontSize: 14, color, fontWeight: optIdx === selectedIdx ? 600 : 400,
                            transition: 'all 0.15s',
                          }}
                        >
                          <span style={{ fontWeight: 700, marginRight: 8 }}>{String.fromCharCode(65 + optIdx)}.</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation (after checking) */}
                  {checked && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                      background: isCorrect ? '#f0fdf4' : '#fff7ed',
                      border: `1px solid ${isCorrect ? '#bbf7d0' : '#fed7aa'}`,
                    }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: isCorrect ? '#16a34a' : '#ea580c' }}>
                        {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                      </span>
                      <p style={{ fontSize: 13, color: '#374151', margin: '6px 0 0', lineHeight: 1.5 }}>
                        💡 {q.explanation}
                      </p>
                    </div>
                  )}

                  {/* Check / Next buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {!checked ? (
                      <button
                        disabled={selectedIdx == null}
                        onClick={() => setQuizChecked(c => ({ ...c, [q.id]: true }))}
                        style={{
                          ...styles.downloadBtn,
                          opacity: selectedIdx == null ? 0.5 : 1,
                          cursor: selectedIdx == null ? 'not-allowed' : 'pointer',
                        }}
                      >Check Answer</button>
                    ) : quizCurrentQ < questions.length - 1 ? (
                      <button
                        onClick={() => setQuizCurrentQ(i => i + 1)}
                        style={styles.downloadBtn}
                      >Next →</button>
                    ) : (
                      <button
                        onClick={() => setQuizDone(true)}
                        style={{ ...styles.downloadBtn, background: '#16a34a' }}
                      >Finish Quiz 🏆</button>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

    </div>
  );
}
