import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listWork, deleteWork } from './myWorkService';
import { useAuth } from './AuthContext';

const typeLabel = { playground: '💻 Code', quiz: '📝 Quiz', test: '🧪 Test' };
const typeColor = { playground: '#3b82f6', quiz: '#8b5cf6', test: '#10b981' };

export default function MyWorkPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    listWork().then(data => {
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [isAuthenticated]);

  const handleDelete = async (id) => {
    if (!window.confirm(
      "Delete this record? Your score and answer history will be permanently removed."
    )) return;

    await deleteWork(id);
    setItems(items.filter(i => i.id !== id));
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const filtered = filter === 'all' ? items : items.filter(i => i.work_type === filter);

  // Auth gate — shown before any fetch is made
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>📁 My Work</h1>
        <div style={{
          textAlign: 'center', padding: '60px 20px', borderRadius: 16,
          background: '#f8fafc', border: '1px dashed #cbd5e1', marginTop: 32
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            Login Required
          </h2>
          <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 15 }}>
            Register or log in to save and view your quiz results, test submissions, and playground code.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '10px 28px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 15
              }}
            >
              Login / Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>📁 My Work</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Your saved playground code, quiz results, and test submissions.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {['all', 'playground', 'quiz', 'test'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: filter === f ? '#1d4ed8' : '#e5e7eb',
            color: filter === f ? '#fff' : '#374151', fontWeight: 600
          }}>
            {f === 'all' ? '📋 All' : typeLabel[f]}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '60px 0' }}>
          No saved work yet. Complete a quiz, test, or save your playground code!
        </div>
      )}

      {filtered.map(item => {
        const passed = item.result_data?.score >= 60 || item.result_data?.passed === true;
        const hasPassed = (item.work_type === 'quiz' || item.work_type === 'test') && item.result_data?.score !== undefined;

        return (
          <div key={item.id} style={{
            background: hasPassed ? (passed ? '#f0fdf4' : '#fef2f2') : '#fff',
            borderRadius: 12, padding: '16px 20px',
            marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            borderLeft: `4px solid ${
              hasPassed
                ? (passed ? '#10b981' : '#ef4444')
                : typeColor[item.work_type]
            }`
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12, color: typeColor[item.work_type], fontWeight: 700, textTransform: 'uppercase' }}>
                {typeLabel[item.work_type]}
              </span>
              <h3 style={{ margin: '4px 0 6px', fontSize: 17 }}>{item.title}</h3>
              {item.topic_id && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>Topic: {item.topic_id}</span>
              )}

              {/* Score row */}
              {item.result_data?.score !== undefined && (
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  Score: <strong>{item.result_data.score}{item.work_type === 'quiz' ? '%' : '/100'}</strong>
                  {item.result_data.grade && (
                    <span style={{ marginLeft: 8, fontWeight: 700, color: '#1d4ed8' }}>({item.result_data.grade})</span>
                  )}
                  {item.result_data.passed !== undefined && (
                    <span style={{ marginLeft: 10, color: item.result_data.passed ? '#10b981' : '#ef4444' }}>
                      {item.result_data.passed ? '✅ Passed' : '❌ Failed'}
                    </span>
                  )}
                  {item.work_type === 'quiz' && item.result_data.correct !== undefined && (
                    <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>
                      ({item.result_data.correct}/{item.result_data.total_questions} correct)
                    </span>
                  )}
                </div>
              )}

              {/* Quiz topics summary */}
              {item.work_type === 'quiz' && item.result_data?.topics && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                  Topics: {item.result_data.topics.join(', ')}
                </div>
              )}

              {/* Test feedback preview */}
              {item.work_type === 'test' && item.result_data?.feedback && (
                <div style={{ marginTop: 6, fontSize: 13, color: '#374151', fontStyle: 'italic' }}>
                  "{item.result_data.feedback.slice(0, 100)}{item.result_data.feedback.length > 100 ? '...' : ''}"
                </div>
              )}

              {/* Playground code preview */}
              {item.work_type === 'playground' && item.content && (
                <pre style={{
                  marginTop: 10, background: '#f3f4f6', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, overflowX: 'auto', maxHeight: 100
                }}>{item.content}</pre>
              )}

              {/* Open in Playground button for playground items */}
              {item.work_type === 'playground' && (
                <button
                  onClick={() => navigate('/playground', { state: { restoredCode: item.content, title: item.title } })}
                  style={{
                    background: '#3b82f6', color: '#fff', border: 'none',
                    borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
                    fontSize: 12, marginTop: 10, display: 'block', width: '100%'
                  }}
                >
                  🚀 Open in Playground
                </button>
              )}

              {/* View Details toggle */}
              {(item.result_data?.review || item.result_data?.question || (item.work_type === 'test' && item.content)) && (
                <button onClick={() => toggleExpand(item.id)} style={{
                  marginTop: 10, background: 'none', border: '1px solid #d1d5db',
                  borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
                  fontSize: 12, color: '#374151'
                }}>
                  {expanded[item.id] ? '▲ Hide Details' : '▼ View Details'}
                </button>
              )}

              {/* Expanded: Quiz Q&A review */}
              {expanded[item.id] && item.work_type === 'quiz' && item.result_data?.review && (
                <div style={{ marginTop: 12 }}>
                  {item.result_data.review.map((r, idx) => (
                    <div key={idx} style={{
                      marginBottom: 10, padding: '10px 14px', borderRadius: 8,
                      background: r.is_correct ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${r.is_correct ? '#bbf7d0' : '#fecaca'}`,
                      fontSize: 13
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Q{idx + 1}: {r.question}</div>
                      <div>Your answer: <span style={{ color: r.is_correct ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{r.your_answer}</span></div>
                      {!r.is_correct && <div style={{ color: '#16a34a' }}>Correct: {r.correct_answer}</div>}
                      {r.explanation && <div style={{ marginTop: 4, color: '#6b7280', fontStyle: 'italic' }}>💡 {r.explanation}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Expanded: Test question + code */}
              {expanded[item.id] && item.work_type === 'test' && (
                <div style={{ marginTop: 12 }}>
                  {item.result_data?.question && (
                    <div style={{ marginBottom: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13, border: '1px solid #e2e8f0' }}>
                      <strong>📋 Question:</strong> {item.result_data.question.description}
                      {item.result_data.question.expected_output?.length > 0 && (
                        <pre style={{ marginTop: 6, background: '#f3f4f6', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                          Expected output:{'\n'}{item.result_data.question.expected_output.join('\n')}
                        </pre>
                      )}
                    </div>
                  )}
                  {item.result_data?.test_cases && (
                    <div style={{ fontSize: 13, marginBottom: 10 }}>
                      ✅ {item.result_data.test_cases.passed?.length || 0} passed &nbsp;
                      ❌ {item.result_data.test_cases.failed?.length || 0} failed
                    </div>
                  )}
                  {item.result_data?.suggestions?.length > 0 && (
                    <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 8, fontSize: 13, border: '1px solid #fde68a' }}>
                      <strong>🔧 Suggestions:</strong>
                      <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                        {item.result_data.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {item.content && (
                    <>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 10, marginBottom: 4 }}>Your submitted code:</div>
                      <pre style={{ background: '#1e1e1e', color: '#d4d4d4', borderRadius: 8, padding: '12px 14px', fontSize: 12, overflowX: 'auto', maxHeight: 200 }}>
                        {item.content}
                      </pre>
                    </>
                  )}
                  {/* Open test submission in playground */}
                  {item.content && (
                    <button
                      onClick={() => navigate('/playground', { state: { restoredCode: item.content, title: `Test: ${item.title}` } })}
                      style={{
                        marginTop: 10, background: '#10b981', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12
                      }}
                    >
                      💻 Open Code in Playground
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right', minWidth: 90, marginLeft: 16 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                {new Date(item.created_at).toLocaleDateString()}
              </div>
              <button onClick={() => handleDelete(item.id)} style={{
                background: 'none', border: '1px solid #fca5a5', color: '#ef4444',
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12
              }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      );
      })}
    </div>
  );
}
