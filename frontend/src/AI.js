import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { useNavigate } from "react-router-dom";
import { colors, radii, font, spacing, btn, shadows, transition } from './theme';

const STORAGE_KEY = 'codetutor_chat_history';
const SESSION_KEY = 'codetutor_active_session';

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(ts) {
    const d = new Date(ts);
    const diff = Date.now() - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-HK', { month: 'short', day: 'numeric' });
}

export default function AI({ showChat, setShowChat }) {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    const navigate = useNavigate();

    // All saved sessions
    const [sessions, setSessions] = useState(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
    });
    // Active session id (null = new unsaved chat)
    const [activeId, setActiveId] = useState(null);

    const [history, setHistory] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [expandedChunk, setExpandedChunk] = useState(null);
    const [chunkContext, setChunkContext] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const messagesEndRef = useRef(null);

    // Persist sessions
    useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }, [sessions]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

    const toggleChat = () => setShowChat(v => !v);

    const startNewChat = () => {
        setActiveId(null);
        setHistory([]);
        setShowHistoryPanel(false);
    };

    const loadSession = (session) => {
        setActiveId(session.id);
        setHistory(session.messages);
        setShowHistoryPanel(false);
    };

    const deleteSession = (id, e) => {
        e.stopPropagation();
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeId === id) { setActiveId(null); setHistory([]); }
    };

    const saveCurrentSession = (msgs, inputText) => {
        if (msgs.length === 0) return null;
        if (activeId) {
            setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: msgs } : s));
            return activeId;
        } else {
            const newId = generateId();
            const title = msgs.find(m => m.role === 'user')?.content?.slice(0, 50) || 'Chat';
            const session = { id: newId, title, createdAt: Date.now(), messages: msgs };
            setSessions(prev => [session, ...prev]);
            setActiveId(newId);
            return newId;
        }
    };

    const handleEnlarge = () => {
        const savedId = saveCurrentSession(history, userInput);
        if (savedId) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: savedId }));
        setShowChat(false);
        navigate('/history');
    };

    const fetchChunkContext = async (sourceFile, chunkContent) => {
        setLoadingContext(true);
        try {
            const res = await fetch(`${API_BASE}/api/get-chunk-context`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_file: sourceFile, chunk_content: chunkContent }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setChunkContext(await res.json());
        } catch (e) { console.error('Error fetching context:', e); }
        setLoadingContext(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        const userMessage = { role: 'user', content: userInput };
        const newHistory = [...history, userMessage];
        setHistory(newHistory);
        setUserInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/ragAI`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_input: userInput, history: newHistory }),
            });
            const data = await res.json();
            const aiMsg = {
                role: 'assistant',
                content: data.final_answer || 'No response.',
                pdf_matches: data.debug_log?.pdf_matches || [],
                debug_log: data.debug_log,
            };
            const finalHistory = [...newHistory, aiMsg];
            setHistory(finalHistory);
            saveCurrentSession(finalHistory, '');
        } catch (err) {
            const errHistory = [...newHistory, { role: 'assistant', content: 'Error: ' + err.message }];
            setHistory(errHistory);
        }
        setLoading(false);
    };

    const renderAIMessage = (msg, msgIndex) => (
        <div>
            <div style={{ marginBottom: 10 }}><ReactMarkdown>{msg.content}</ReactMarkdown></div>
            {msg.debug_log && (
                <div style={{ fontSize: font.sizeSm, color: colors.textMuted, marginTop: spacing.sm, padding: '8px 10px', backgroundColor: colors.divider, borderRadius: radii.sm }}>
                    ⚡ {msg.debug_log.response_time_sec}s
                </div>
            )}
            {msg.pdf_matches && msg.pdf_matches.length > 0 && (
                <div style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTop: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: font.sizeMd, fontWeight: font.weightBold, color: colors.textSecondary, marginBottom: spacing.sm }}>📚 Sources ({msg.pdf_matches.length}):</div>
                    {msg.pdf_matches.map((m, i) => {
                        const chunkKey = `${msgIndex}-${i}`;
                        const isExpanded = expandedChunk === chunkKey;
                        const hasContext = chunkContext && expandedChunk === chunkKey;
                        return (
                            <div key={i} style={{ marginBottom: 10 }}>
                                <button
                                    style={{ backgroundColor: isExpanded ? colors.success : colors.primary, color: colors.surface, padding: '12px 16px', borderRadius: radii.md, border: 'none', cursor: 'pointer', fontSize: font.sizeMd, fontWeight: font.weightSemibold, width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition }}
                                    onClick={() => { if (isExpanded) { setExpandedChunk(null); setChunkContext(null); } else { setExpandedChunk(chunkKey); } }}
                                >
                                    <span>{isExpanded ? '📖' : '📄'} {m.file.replace('.txt', '').split('/').pop()}</span>
                                    <span style={{ fontSize: font.sizeSm, opacity: 0.9 }}>{isExpanded ? '▼ Collapse' : '▶ Expand'}</span>
                                </button>
                                {isExpanded && (
                                    <div style={{ marginTop: spacing.sm, padding: spacing.lg, backgroundColor: colors.warningLight, borderRadius: radii.md, border: `2px solid ${colors.warningBorder}`, fontSize: font.sizeMd, lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto', fontFamily: 'Georgia, serif' }}>
                                        <div style={{ fontSize: 14, color: '#92400e', marginBottom: 12, fontWeight: 'bold', fontFamily: 'system-ui', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>📄 Retrieved Paragraph:</span>
                                            <button style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 5, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                                                onClick={() => { if (hasContext) setChunkContext(null); else fetchChunkContext(m.file, m.snippet); }}
                                                disabled={loadingContext}
                                            >{loadingContext ? '⏳ Loading...' : hasContext ? 'Hide Context' : '🔍 Show Context'}</button>
                                        </div>
                                        {m.snippet}
                                    </div>
                                )}
                                {isExpanded && hasContext && (
                                    <div style={{ marginTop: spacing.sm, padding: spacing.lg, backgroundColor: colors.primaryLight, borderRadius: radii.md, border: `2px solid ${colors.primaryBorder}`, maxHeight: 500, overflowY: 'auto' }}>
                                        <div style={{ fontSize: font.sizeSm, color: colors.primary, marginBottom: spacing.md, fontWeight: font.weightBold }}>📚 Full Context ({chunkContext.chunks.length} chunks):</div>
                                        {chunkContext.chunks.map((chunk, idx) => {
                                            const isTarget = idx === chunkContext.target_index;
                                            return (
                                                <div key={idx} style={{ padding: 14, marginBottom: 10, backgroundColor: isTarget ? '#fef3c7' : '#ffffff', border: isTarget ? '3px solid #f59e0b' : '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', position: 'relative' }}>
                                                    {isTarget && <div style={{ position: 'absolute', top: -10, left: 10, backgroundColor: '#f59e0b', color: 'white', padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 'bold', fontFamily: 'system-ui' }}>⭐ RETRIEVED</div>}
                                                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6, fontFamily: 'system-ui', fontStyle: 'italic' }}>{isTarget ? '→ Used in answer' : idx < chunkContext.target_index ? '↑ Previous' : '↓ Next'}</div>
                                                    {chunk}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <>
            {showChat && (
                <div style={{ position: 'fixed', top: 64, right: 20, width: 800, height: '75vh', backgroundColor: colors.surface, boxShadow: shadows.lg, borderRadius: radii.lg, zIndex: 10000, display: 'flex', flexDirection: 'column' }}>

                    {/* Header */}
                    <div style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.accent, borderRadius: `${radii.lg}px ${radii.lg}px 0 0`, color: colors.surface }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                                onClick={() => setShowHistoryPanel(v => !v)}
                                title={showHistoryPanel ? 'Hide history' : 'Show history'}
                                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: colors.surface, borderRadius: radii.sm, padding: '5px 10px', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}
                            >
                                🕘
                            </button>
                            <h3 style={{ margin: 0, fontSize: font.sizeLg, fontWeight: font.weightSemibold }}>
                                ☕ {activeId ? (sessions.find(s => s.id === activeId)?.title || 'AI Java Tutor') : 'AI Java Tutor'}
                            </h3>
                        </div>
                        <div style={{ display: 'flex', gap: spacing.sm }}>
                            <button onClick={handleEnlarge} style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: radii.sm, border: 'none', backgroundColor: colors.surface, color: colors.accent, fontWeight: font.weightSemibold }} title="Open full history page">
                                ⬆ Enlarge
                            </button>
                            <button onClick={toggleChat} style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: radii.sm, border: 'none', backgroundColor: colors.danger, color: colors.surface, fontWeight: font.weightSemibold }}>
                                ✕ Close
                            </button>
                        </div>
                    </div>

                    {/* Body: history panel + messages side by side */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                        {/* History sidebar panel */}
                        {showHistoryPanel && (
                            <div style={{ width: 220, borderRight: `1px solid ${colors.divider}`, background: colors.bg, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                                <div style={{ padding: '10px 10px 6px', borderBottom: `1px solid ${colors.divider}` }}>
                                    <button
                                        onClick={startNewChat}
                                        style={{ width: '100%', padding: '7px 10px', background: colors.primary, color: colors.surface, border: 'none', borderRadius: radii.md, cursor: 'pointer', fontSize: font.sizeXs, fontWeight: font.weightSemibold }}
                                    >
                                        ✏️ New Chat
                                    </button>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
                                    {sessions.length === 0 && (
                                        <div style={{ padding: 12, color: colors.textMuted, fontSize: '11px', textAlign: 'center' }}>No history yet</div>
                                    )}
                                    {sessions.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => loadSession(s)}
                                            style={{
                                                padding: '8px 10px', borderRadius: radii.sm, cursor: 'pointer', marginBottom: 2,
                                                background: activeId === s.id ? colors.primaryLight : 'transparent',
                                                border: activeId === s.id ? `1px solid ${colors.primaryBorder}` : '1px solid transparent',
                                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, transition
                                            }}
                                        >
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '11px', fontWeight: font.weightSemibold, color: activeId === s.id ? colors.primary : colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {s.title || 'Untitled'}
                                                </div>
                                                <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: 1 }}>
                                                    {formatDate(s.createdAt)} · {s.messages.length} msgs
                                                </div>
                                            </div>
                                            <button onClick={(e) => deleteSession(s.id, e)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: '12px', padding: '0 2px', opacity: 0.6, flexShrink: 0 }}
                                                title="Delete"
                                            >🗑</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        <div style={{ flex: 1, padding: spacing.lg, overflowY: 'auto', backgroundColor: colors.bg }}>
                            {history.length === 0 && (
                                <div style={{ textAlign: 'center', marginTop: '25%', color: colors.textMuted }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>☕</div>
                                    <div style={{ fontSize: font.sizeMd, color: colors.textSecondary }}>Ask me anything about Java!</div>
                                    <div style={{ fontSize: font.sizeXs, color: colors.textMuted, marginTop: 4 }}>🕘 Press the clock icon to browse history</div>
                                </div>
                            )}
                            {history.map((msg, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: spacing.lg }}>
                                    <div style={{ padding: spacing.lg, borderRadius: radii.md, backgroundColor: msg.role === 'user' ? colors.primary : colors.surface, color: msg.role === 'user' ? colors.surface : colors.text, boxShadow: shadows.sm, maxWidth: '90%', wordBreak: 'break-word' }}>
                                        {msg.role === 'assistant' ? renderAIMessage(msg, idx) : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} style={{ padding: spacing.lg, borderTop: `2px solid ${colors.border}`, backgroundColor: colors.surface, borderRadius: `0 0 ${radii.lg}px ${radii.lg}px` }}>
                        <TextareaAutosize value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="Ask anything about Java..." minRows={2} maxRows={6}
                            style={{ width: '100%', padding: spacing.sm, marginBottom: spacing.sm, borderRadius: radii.sm, border: `2px solid ${colors.border}`, fontSize: font.sizeMd, fontFamily: font.family }}
                        />
                        <button type="submit" disabled={loading} style={loading ? btn.disabled : btn.accent}>
                            {loading ? '⏳ Thinking...' : '📤 Send'}
                        </button>
                    </form>
                </div>
            )}

            {/* Floating button */}
            <button data-tour="ai-button"
                style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, backgroundColor: colors.accent, color: colors.surface, borderRadius: radii.full, width: 72, height: 72, border: 'none', cursor: 'pointer', fontWeight: font.weightBold, fontSize: font.sizeMd, boxShadow: shadows.lg, transition }}
                onClick={toggleChat}
            >
                ☕ Ask AI
            </button>
        </>
    );
}
