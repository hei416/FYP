import React, { useEffect, useState } from 'react';
import { listWork, deleteWork } from './myWorkService';

const typeLabel = { playground: '💻 Code', quiz: '📝 Quiz', test: '🧪 Test' };
const typeColor = { playground: '#3b82f6', quiz: '#8b5cf6', test: '#10b981' };

export default function MyWorkPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listWork().then(data => {
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id) => {
    await deleteWork(id);
    setItems(items.filter(i => i.id !== id));
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.work_type === filter);

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

      {filtered.map(item => (
        <div key={item.id} style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          borderLeft: `4px solid ${typeColor[item.work_type]}`
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
              {item.result_data?.score !== undefined && (
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  Score: <strong>{item.result_data.score}%</strong>
                  {item.result_data.passed !== undefined && (
                    <span style={{ marginLeft: 10, color: item.result_data.passed ? '#10b981' : '#ef4444' }}>
                      {item.result_data.passed ? '✅ Passed' : '❌ Failed'}
                    </span>
                  )}
                </div>
              )}
              {item.content && (
                <pre style={{
                  marginTop: 10, background: '#f3f4f6', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12, overflowX: 'auto', maxHeight: 120
                }}>{item.content}</pre>
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
      ))}
    </div>
  );
}
