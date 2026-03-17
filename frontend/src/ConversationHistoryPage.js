import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import TextareaAutosize from 'react-textarea-autosize';
import { colors, radii, font, spacing, btn, shadows, transition } from './theme';

const STORAGE_KEY = 'codetutor_chat_history';
const SESSION_KEY = 'codetutor_active_session';

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-HK', { month: 'short', day: 'numeric' });
}

export default function ConversationHistoryPage() {
    const navigate = useNavigate();
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

    // Load all saved sessions
    const [sessions, setSessions] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch { return []; }
    });

    // Active session id
    const [activeId, setActiveId] = useState(() => {
        // Check if AI.js passed a session via sessionStorage
        const fromChat = sessionStorage.getItem(SESSION_KEY);
        if (fromChat) {
            const parsed = JSON.parse(fromChat);
            sessionStorage.removeItem(SESSION_KEY);
            return parsed.id;
        }
        if (sessions.length > 0) return sessions[0].id;
        return null;
    });

    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [expandedChunk, setExpandedChunk] = useState(null);
    const [chunkContext, setChunkContext] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const messagesEndRef = useRef(null);

    const activeSession = sessions.find(s => s.id === activeId) || null;
    const messages = activeSession ? activeSession.messages : [];

    // Persist sessions to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }, [sessions]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const createNewSession = () => {
        const newSession = {
            id: generateId(),
            title: 'New conversation',
            createdAt: Date.now(),
            messages: []
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveId(newSession.id);
        setUserInput('');
    };

    const deleteSession = (id, e) => {
        e.stopPropagation();
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeId === id) {
            const remaining = sessions.filter(s => s.id !== id);
            setActiveId(remaining.length > 0 ? remaining[0].id : null);
        }
    };

    const updateSession = (id, updater) => {
        setSessions(prev => prev.map(s => s.id === id ? updater(s) : s));
    };

    const fetchChunkContext = async (sourceFile, chunkContent) => {
        setLoadingContext(true);
        try {
            const res = await fetch(`${API_BASE}/api/get-chunk-context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_file: sourceFile, chunk_content: chunkContent }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setChunkContext(await res.json());
        } catch (e) {
            console.error('Error fetching context:', e);
        }
        setLoadingContext(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        // If no session, create one automatically
        let currentId = activeId;
        let currentSessions = sessions;
        if (!currentId) {
            const newSession = {
                id: generateId(),
                title: userInput.trim().slice(0, 50),
                createdAt: Date.now(),
                messages: []
            };
            currentSessions = [newSession, ...sessions];
            setSessions(currentSessions);
            setActiveId(newSession.id);
            currentId = newSession.id;
        }

        const userMsg = { role: 'user', content: userInput };
        const currentMessages = (currentSessions.find(s => s.id === currentId)?.messages) || [];
        const updatedMessages = [...currentMessages, userMsg];

        // Optimistically add user message
        setSessions(prev => prev.map(s => s.id === currentId
            ? { ...s, messages: updatedMessages, title: s.messages.length === 0 ? userInput.trim().slice(0, 50) : s.title }
            : s
        ));
        setUserInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/ragAI`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_input: userInput, history: updatedMessages }),
            });
            const data = await res.json();
            const aiMsg = {
                role: 'assistant',
                content: data.final_answer || 'No response.',
                pdf_matches: data.debug_log?.pdf_matches || [],
                debug_log: data.debug_log,
            };
            setSessions(prev => prev.map(s => s.id === currentId
                ? { ...s, messages: [...s.messages, aiMsg] }
                : s
            ));
        } catch (err) {
            setSessions(prev => prev.map(s => s.id === currentId
                ? { ...s, messages: [...s.messages, { role: 'assistant', content: 'Error: ' + err.message }] }
                : s
            ));
        }
        setLoading(false);
    };

    const renderMessage = (msg, msgIndex) => {
        if (msg.role === 'user') {
            return (
                <div key={msgIndex} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
                    <div style={{
                        maxWidth: '70%', padding: '12px 16px',
                        background: colors.primary, color: colors.surface,
                        borderRadius: '18px 18px 4px 18px',
                        fontSize: font.sizeMd, lineHeight: 1.6,
                        boxShadow: shadows.sm
                    }}>
                        {msg.content}
                    </div>
                </div>
            );
        }

        return (
            <div key={msgIndex} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 32, gap: 12 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: radii.full,
                    background: colors.accent, color: colors.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', flexShrink: 0, marginTop: 2
                }}>☕</div>
                <div style={{ flex: 1, maxWidth: '85%' }}>
                    <div style={{
                        padding: '16px 20px',
                        background: colors.surface,
                        borderRadius: '4px 18px 18px 18px',
                        boxShadow: shadows.sm,
                        fontSize: font.sizeMd, lineHeight: 1.8,
                        border: `1px solid ${colors.divider}`
                    }}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {/* Response time */}
                    {msg.debug_log && (
                        <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: 6, paddingLeft: 4 }}>
                            ⚡ {msg.debug_log.response_time_sec}s
                        </div>
                    )}

                    {/* Sources */}
                    {msg.pdf_matches && msg.pdf_matches.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: font.sizeXs, fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 6, paddingLeft: 4 }}>
                                📚 Sources ({msg.pdf_matches.length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {msg.pdf_matches.map((m, i) => {
                                    const key = `${msgIndex}-${i}`;
                                    const isOpen = expandedChunk === key;
                                    return (
                                        <div key={i} style={{ width: '100%' }}>
                                            <button
                                                onClick={() => { setExpandedChunk(isOpen ? null : key); setChunkContext(null); }}
                                                style={{
                                                    padding: '6px 12px', border: `1px solid ${colors.primaryBorder}`,
                                                    borderRadius: radii.xl, background: isOpen ? colors.primary : colors.primaryLight,
                                                    color: isOpen ? colors.surface : colors.primary,
                                                    cursor: 'pointer', fontSize: font.sizeXs, fontWeight: font.weightSemibold
                                                }}
                                            >
                                                {isOpen ? '📖' : '📄'} {m.file.replace('.txt', '').split('/').pop()} {isOpen ? '▼' : '▶'}
                                            </button>
                                            {isOpen && (
                                                <div style={{
                                                    marginTop: 8, padding: 16,
                                                    background: colors.warningLight,
                                                    border: `2px solid ${colors.warningBorder}`,
                                                    borderRadius: radii.md,
                                                    fontSize: font.sizeSm, lineHeight: 1.8,
                                                    whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif',
                                                    maxHeight: 300, overflowY: 'auto'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                                        <span style={{ fontWeight: 700, fontFamily: 'system-ui', color: '#92400e', fontSize: 13 }}>📄 Retrieved Paragraph</span>
                                                        <button
                                                            onClick={() => chunkContext ? setChunkContext(null) : fetchChunkContext(m.file, m.snippet)}
                                                            disabled={loadingContext}
                                                            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}
                                                        >
                                                            {loadingContext ? '⏳' : chunkContext ? 'Hide Context' : '🔍 Context'}
                                                        </button>
                                                    </div>
                                                    {m.snippet}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: colors.bg, overflow: 'hidden' }}>

            {/* ── Sidebar ── */}
            <div style={{
                width: sidebarOpen ? 280 : 0,
                minWidth: sidebarOpen ? 280 : 0,
                overflow: 'hidden',
                transition: 'width 0.25s ease, min-width 0.25s ease',
                background: colors.surface,
                borderRight: `1px solid ${colors.divider}`,
                display: 'flex', flexDirection: 'column'
            }}>
                {/* Sidebar Header */}
                <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${colors.divider}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontWeight: font.weightBold, fontSize: font.sizeMd, color: colors.text }}>Conversations</span>
                    </div>
                    <button
                        onClick={createNewSession}
                        style={{
                            width: '100%', padding: '9px 12px',
                            background: colors.primary, color: colors.surface,
                            border: 'none', borderRadius: radii.md,
                            cursor: 'pointer', fontSize: font.sizeSm,
                            fontWeight: font.weightSemibold, display: 'flex',
                            alignItems: 'center', gap: 6, justifyContent: 'center'
                        }}
                    >
                        ✏️ New Chat
                    </button>
                </div>

                {/* Session list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
                    {sessions.length === 0 && (
                        <div style={{ padding: 16, color: colors.textMuted, fontSize: font.sizeXs, textAlign: 'center' }}>No conversations yet</div>
                    )}
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => setActiveId(session.id)}
                            style={{
                                padding: '10px 12px', borderRadius: radii.md,
                                cursor: 'pointer', marginBottom: 2,
                                background: activeId === session.id ? colors.primaryLight : 'transparent',
                                border: activeId === session.id ? `1px solid ${colors.primaryBorder}` : '1px solid transparent',
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
                                transition
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: font.sizeSm, fontWeight: font.weightSemibold,
                                    color: activeId === session.id ? colors.primary : colors.text,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }}>
                                    {session.title || 'Untitled'}
                                </div>
                                <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: 2 }}>
                                    {formatDate(session.createdAt)} · {session.messages.length} msgs
                                </div>
                            </div>
                            <button
                                onClick={(e) => deleteSession(session.id, e)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: colors.textMuted, fontSize: '14px', padding: '0 2px',
                                    flexShrink: 0, opacity: 0.6,
                                }}
                                title="Delete"
                            >🗑</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Main chat area ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Top bar */}
                <div style={{
                    height: 56, borderBottom: `1px solid ${colors.divider}`,
                    background: colors.surface, display: 'flex',
                    alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0
                }}>
                    {/* Toggle sidebar */}
                    <button
                        onClick={() => setSidebarOpen(v => !v)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '18px', color: colors.textSecondary, padding: '4px 6px',
                            borderRadius: radii.sm
                        }}
                        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                    >
                        ☰
                    </button>

                    <span style={{ fontWeight: font.weightBold, fontSize: font.sizeMd, color: colors.text, flex: 1 }}>
                        {activeSession ? activeSession.title : '☕ AI Java Tutor'}
                    </span>

                    {/* Back to chat panel */}
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            padding: '7px 14px',
                            background: colors.primaryLight,
                            color: colors.primary,
                            border: `1px solid ${colors.primaryBorder}`,
                            borderRadius: radii.md,
                            cursor: 'pointer',
                            fontSize: font.sizeSm,
                            fontWeight: font.weightSemibold,
                            display: 'flex', alignItems: 'center', gap: 6
                        }}
                    >
                        ⬇ Shrink
                    </button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px 10%' }}>
                    {!activeSession && (
                        <div style={{ textAlign: 'center', marginTop: '15%', color: colors.textMuted }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>☕</div>
                            <div style={{ fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.text, marginBottom: 8 }}>AI Java Tutor</div>
                            <div style={{ fontSize: font.sizeMd, color: colors.textSecondary }}>Start a new conversation or select one from the sidebar</div>
                        </div>
                    )}
                    {messages.map((msg, idx) => renderMessage(msg, idx))}
                    {loading && (
                        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                            <div style={{ width: 32, height: 32, borderRadius: radii.full, background: colors.accent, color: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>☕</div>
                            <div style={{ padding: '14px 18px', background: colors.surface, borderRadius: '4px 18px 18px 18px', boxShadow: shadows.sm, border: `1px solid ${colors.divider}` }}>
                                <span style={{ display: 'inline-flex', gap: 4 }}>
                                    {[0, 1, 2].map(i => (
                                        <span key={i} style={{
                                            width: 6, height: 6, borderRadius: '50%',
                                            background: colors.textMuted,
                                            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`
                                        }} />
                                    ))}
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '16px 10%', background: colors.surface, borderTop: `1px solid ${colors.divider}` }}>
                    <form onSubmit={handleSubmit} style={{
                        display: 'flex', gap: 10, alignItems: 'flex-end',
                        background: colors.bg, border: `2px solid ${colors.border}`,
                        borderRadius: radii.lg, padding: '10px 14px',
                        boxShadow: shadows.sm,
                        transition: 'border-color 0.2s'
                    }}
                        onFocus={(e) => { if (e.currentTarget === e.target.closest('form')) e.currentTarget.style.borderColor = colors.primary; }}
                    >
                        <TextareaAutosize
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                            placeholder="Ask anything about Java..."
                            minRows={1}
                            maxRows={6}
                            style={{
                                flex: 1, border: 'none', outline: 'none',
                                background: 'transparent', resize: 'none',
                                fontSize: font.sizeMd, fontFamily: font.family,
                                color: colors.text, lineHeight: 1.6
                            }}
                        />
                        <button
                            type="submit"
                            disabled={loading || !userInput.trim()}
                            style={{
                                padding: '8px 16px', flexShrink: 0,
                                background: (!loading && userInput.trim()) ? colors.accent : colors.divider,
                                color: (!loading && userInput.trim()) ? colors.surface : colors.textMuted,
                                border: 'none', borderRadius: radii.md,
                                cursor: (!loading && userInput.trim()) ? 'pointer' : 'not-allowed',
                                fontWeight: font.weightSemibold, fontSize: font.sizeSm, transition
                            }}
                        >
                            {loading ? '⏳' : '↑ Send'}
                        </button>
                    </form>
                    <div style={{ textAlign: 'center', marginTop: 8, fontSize: '11px', color: colors.textMuted }}>Enter to send · Shift+Enter for new line</div>
                </div>
            </div>
        </div>
    );
}
