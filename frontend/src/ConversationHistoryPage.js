import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import TextareaAutosize from 'react-textarea-autosize';
import { colors, radii, font, spacing, btn, shadows, transition } from './theme';
import { useAuth } from './AuthContext';
import PdfPageViewer from './components/PdfPageViewer';
import NLIStatusBadge from './components/NLIStatusBadge';

const getToken = () => localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || "";
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseTs(ts) {
    if (!ts) return new Date(0);
    if (typeof ts === 'number') return new Date(ts);
    const s = String(ts);
    return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
}

function formatDate(ts) {
    if (!ts) return '';
    const d = parseTs(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-HK', { month: 'short', day: 'numeric' });
}

function cleanSnippet(text) {
    if (!text) return '';
    text = text.replace(/Try it Yourself\s*[»›]?/gi, '');
    text = text.replace(/Try it\s+\w+\s*[»›]?/gi, '');
    return text.replace(/\n+/g, ' ').trim();
}

const CollapseIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="6" x2="3" y2="3" /><polyline points="3 6 3 3 6 3" />
        <line x1="10" y1="6" x2="13" y2="3" /><polyline points="13 6 13 3 10 3" />
        <line x1="6" y1="10" x2="3" y2="13" /><polyline points="3 10 3 13 6 13" />
        <line x1="10" y1="10" x2="13" y2="13" /><polyline points="13 10 13 13 10 13" />
    </svg>
);

export default function ConversationHistoryPage() {
    const navigate = useNavigate();
    const { isAuthenticated, token, loading, user } = useAuth();
    const tokenRef = useRef(token);
    useEffect(() => { tokenRef.current = token; }, [token]);
    const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenRef.current}`
    });

    useEffect(() => {
        if (!loading && !isAuthenticated) navigate('/login');
    }, [loading, isAuthenticated, navigate]);

    const [sessions, setSessions] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [sessionsLoaded, setSessionsLoaded] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [expandedChunk, setExpandedChunk] = useState(null);
    const [chunkContext, setChunkContext] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [contextError, setContextError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [selectedSources, setSelectedSources] = useState({ general: true });
    const [enrolledClassrooms, setEnrolledClassrooms] = useState([]);
    const messagesEndRef = useRef(null);

    const toggleSource = (key) =>
        setSelectedSources(prev => ({ ...prev, [key]: !prev[key] }));

    // Fetch enrolled classrooms
    useEffect(() => {
        if (!isAuthenticated || !token) return;
        fetch(`${API_BASE}/classrooms/enrolled`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.ok ? r.json() : [])
            .then(d => setEnrolledClassrooms(Array.isArray(d) ? d : []))
            .catch(() => {});
    }, [isAuthenticated, token]);

    // Load session list
    const loadSessions = useCallback(async () => {
        const t = tokenRef.current;
        if (!t) return;
        try {
            const res = await fetch(`${API_BASE}/conversation/sessions`, {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }
            });
            if (!res.ok) return;
            const dbSessions = await res.json();
            const shaped = dbSessions.map(s => ({
                id: s.conversation_id,
                title: s.first_message,
                createdAt: s.last_message_at,
                turnCount: s.turn_count,
                messages: null,
            }));
            setSessions(shaped);
            if (shaped.length > 0) setActiveId(shaped[0].id);
        } catch (e) {
            console.error('Failed to load sessions', e);
        } finally {
            setSessionsLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && token) loadSessions();
    }, [isAuthenticated, token, loadSessions]);

    // Lazy-load messages when session is selected
    useEffect(() => {
        if (!activeId || !token) return;
        const session = sessions.find(s => s.id === activeId);
        if (!session || session.messages !== null) return;
        (async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/conversation/history/${activeId}`,
                    { headers: getAuthHeaders() }   // also fix authHeaders → getAuthHeaders()
                );
                if (!res.ok) return;
                const turns = await res.json();
                const messages = turns.flatMap(t => [
                    { role: 'user', content: t.user_message },
                    {
                        role: 'assistant',
                        content: t.assistant_response,
                        pdf_matches: t.pdf_matches || [],
                        debug_log: t.response_time_sec
                            ? { response_time_sec: t.response_time_sec }
                            : null,
                    },
                ]);
                setSessions(prev =>
                    prev.map(s => s.id === activeId ? { ...s, messages } : s)
                );
            } catch (e) {
                console.error('Failed to load messages', e);
            }
        })();
    }, [activeId, token]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [sessions, activeId, chatLoading]);

    const activeSession = sessions.find(s => s.id === activeId) || null;
    const messages = activeSession?.messages || [];

    const createNewSession = () => {
        const ns = {
            id: generateId(),
            title: 'New conversation',
            createdAt: new Date().toISOString(),
            turnCount: 0,
            messages: [],
        };
        setSessions(prev => [ns, ...prev]);
        setActiveId(ns.id);
        setUserInput('');
    };

   const deleteSession = async (id, e) => {
        e.stopPropagation();

        // Check if this is a local-only session (never persisted to DB)
        // Local IDs are generated by generateId() — they are short alphanumeric
        // DB conversation_ids are UUIDs (contain hyphens) or longer strings
        const session = sessions.find(s => s.id === id);
        const isLocalOnly = session && session.messages !== null 
            && (session.messages?.length === 0) 
            && !id.includes('-');  // UUIDs have hyphens, local IDs don't

        if (!isLocalOnly) {
            // Has a DB record — call the backend
            try {
                const res = await fetch(`${API_BASE}/conversation/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                if (!res.ok) {
                    console.error(`Delete failed: HTTP ${res.status}`, await res.text());
                    // Still remove from UI even if 404 (already gone from DB)
                    if (res.status !== 404) return;
                }
            } catch (err) {
                console.error('Delete error:', err);
                return;
            }
        }

        // Remove from UI state
        setSessions(prev => {
            const remaining = prev.filter(s => s.id !== id);
            if (activeId === id) {
                setActiveId(remaining.length > 0 ? remaining[0].id : null);
            }
            return remaining;
        });
    };
    const fetchChunkContext = async (sourceFile, chunkContent) => {
        setLoadingContext(true);
        setContextError(null);
        try {
            const res = await fetch(`${API_BASE}/api/get-chunk-context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_file: sourceFile, chunk_content: chunkContent }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setChunkContext(await res.json());
        } catch (e) {
            console.error(e);
            setContextError(e.message);
        }
        setLoadingContext(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        let currentId = activeId;
        if (!currentId) {
            const ns = {
                id: generateId(),
                title: userInput.trim().slice(0, 80),
                createdAt: new Date().toISOString(),
                turnCount: 0,
                messages: [],
            };
            setSessions(prev => [ns, ...prev]);
            setActiveId(ns.id);
            currentId = ns.id;
        }

        const userMsg = { role: 'user', content: userInput };
        const currentMsgs = sessions.find(s => s.id === currentId)?.messages || [];

        setSessions(prev => prev.map(s => s.id === currentId
            ? {
                ...s,
                messages: [...currentMsgs, userMsg],
                title: currentMsgs.length === 0 ? userInput.trim().slice(0, 80) : s.title,
            }
            : s
        ));

        const questionText = userInput;
        setUserInput('');
        setChatLoading(true);

        try {
            const useGeneral = selectedSources['general'] !== false;
            const classroomIds = Object.entries(selectedSources)
                .filter(([k, v]) => k !== 'general' && v)
                .map(([k]) => Number(k));

            let aiMsg;

            if (classroomIds.length > 0) {
                const res = await fetch(`${API_BASE}/ask-multi`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
                    body: JSON.stringify({
                        question: questionText,
                        classroom_ids: classroomIds,
                        include_general: useGeneral,
                    }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                const data = await res.json();
                aiMsg = {
                    role: 'assistant',
                    content: data.answer + (data.sources_count > 0
                        ? `\n\n*✓ Based on ${data.sources_count} classroom source(s)*`
                        : ''),
                    pdf_matches: data.debug_log?.pdf_matches || [],
                    debug_log: data.debug_log || null,
                    query_id: data.query_id || null,   // ← NLI badge key
                };
            } else {
                const res = await fetch(`${API_BASE}/ragAI`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_input: questionText,
                        history: [],
                        user_id: user?.id || null,
                        conversation_id: currentId,
                    }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                const data = await res.json();
                aiMsg = {
                    role: 'assistant',
                    content: data.final_answer || 'No response.',
                    pdf_matches: data.debug_log?.pdf_matches || data.pdf_matches || [],
                    debug_log: data.debug_log || null,
                    query_id: data.query_id || null,   // ← NLI badge key
                };
            }

            setSessions(prev => prev.map(s =>
                s.id === currentId
                    ? { ...s, messages: [...(s.messages || []), aiMsg] }
                    : s
            ));
        } catch (err) {
            setSessions(prev => prev.map(s => s.id === currentId
                ? {
                    ...s,
                    messages: [...(s.messages || []), {
                        role: 'assistant',
                        content: `❌ Error: ${err.message}`,
                    }]
                }
                : s
            ));
        }
        setChatLoading(false);
    };

    // ── Mirrors AI.js headerIconBtn ───────────────────────────────────────────
    const headerIconBtn = (onClick, title, children, extraStyle = {}) => (
        <button
            onClick={onClick}
            title={title}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 11px',
                background: extraStyle.background || 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: radii.sm,
                color: colors.surface,
                fontSize: font.sizeSm,
                fontWeight: font.weightSemibold,
                cursor: 'pointer',
                transition,
                ...extraStyle,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = extraStyle.background || 'rgba(255,255,255,0.15)'; }}
        >
            {children}
        </button>
    );

    // ── Mirrors AI.js renderAIMessage ─────────────────────────────────────────
    const renderAIMessage = (msg, msgIndex) => (
        <div>
            <div style={{ marginBottom: 10 }}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>

            {/* Response time */}
            {msg.debug_log?.response_time_sec != null && (
                <div style={{
                    fontSize: font.sizeSm, color: colors.textMuted, marginTop: 4,
                    padding: '6px 10px', backgroundColor: colors.divider,
                    borderRadius: radii.sm,
                }}>
                    ⚡ {msg.debug_log.response_time_sec}s
                </div>
            )}

            {/* ── NLI badge — only present when query_id was captured at send-time ── */}
            {msg.query_id && (
                <NLIStatusBadge queryId={msg.query_id} apiBase={API_BASE} />
            )}

            {/* Sources */}
            {msg.pdf_matches && msg.pdf_matches.length > 0 && (
                <div style={{
                    marginTop: spacing.lg,
                    paddingTop: spacing.lg,
                    borderTop: `1px solid ${colors.border}`,
                }}>
                    <div style={{
                        fontSize: font.sizeMd, fontWeight: font.weightBold,
                        color: colors.textSecondary, marginBottom: spacing.sm,
                    }}>
                        📚 Sources ({msg.pdf_matches.length}):
                    </div>
                    {msg.pdf_matches.map((m, i) => {
                        const chunkKey = `${msgIndex}-${i}`;
                        const isExpanded = expandedChunk === chunkKey;
                        const hasContext = chunkContext && expandedChunk === chunkKey;
                        const isPDF = m.iframeUrl &&
                            (m.file.toLowerCase().endsWith('.pdf') || m.file.includes('material'));
                        return (
                            <div key={i} style={{ marginBottom: 10 }}>
                                <button
                                    style={{
                                        backgroundColor: isExpanded ? colors.success : colors.primary,
                                        color: colors.surface,
                                        padding: '10px 14px',
                                        borderRadius: radii.md,
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: font.sizeSm,
                                        fontWeight: font.weightSemibold,
                                        width: '100%',
                                        textAlign: 'left',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition,
                                    }}
                                    onClick={() => {
                                        if (isExpanded) { setExpandedChunk(null); setChunkContext(null); }
                                        else { setChunkContext(null); setExpandedChunk(chunkKey); }
                                    }}
                                >
                                    <span>
                                        {isExpanded ? '📖' : '📄'}{' '}
                                        {m.file.replace('.txt', '').split('/').pop()}
                                        {m.page && m.page > 1 ? ` (Page ${m.page})` : ''}
                                    </span>
                                    <span style={{ fontSize: font.sizeXs, opacity: 0.9 }}>
                                        {isExpanded ? '▼ Collapse' : '► Expand'}
                                    </span>
                                </button>

                                {isExpanded && isPDF && (
                                    <div style={{ marginTop: 8, borderRadius: radii.md, overflow: 'hidden', border: `2px solid ${colors.border}` }}>
                                        <PdfPageViewer
                                            url={(() => {
                                                const t = getToken();
                                                const base = m.iframeUrl.split('#')[0];
                                                const sep = base.includes('?') ? '&' : '?';
                                                return t ? `${base}${sep}token=${t}` : m.iframeUrl;
                                            })()}
                                            initialPage={m.page || 1}
                                            height={450}
                                        />
                                    </div>
                                )}

                                {isExpanded && !isPDF && (
                                    <div style={{
                                        marginTop: 8, padding: spacing.lg,
                                        backgroundColor: colors.warningLight,
                                        borderRadius: radii.md,
                                        border: `2px solid ${colors.warningBorder}`,
                                        fontSize: font.sizeMd, lineHeight: 1.8,
                                        whiteSpace: 'pre-wrap', maxHeight: 400,
                                        overflowY: 'auto', fontFamily: 'Georgia, serif',
                                    }}>
                                        <div style={{
                                            fontSize: 14, color: '#92400e', marginBottom: 12,
                                            fontWeight: 'bold', fontFamily: 'system-ui',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}>
                                            <span>📄 Retrieved Paragraph:</span>
                                            <button
                                                style={{
                                                    backgroundColor: '#3b82f6', color: 'white',
                                                    border: 'none', padding: '6px 12px',
                                                    borderRadius: 5, fontSize: 13,
                                                    cursor: loadingContext ? 'not-allowed' : 'pointer',
                                                    fontWeight: 600, opacity: loadingContext ? 0.7 : 1,
                                                }}
                                                onClick={() => {
                                                    if (hasContext) { setChunkContext(null); setContextError(null); }
                                                    else fetchChunkContext(m.file, m.snippet);
                                                }}
                                                disabled={loadingContext}
                                            >
                                                {loadingContext ? '⏳ Loading...' : hasContext ? 'Hide Context' : '🔍 Show Context'}
                                            </button>
                                        </div>
                                        {contextError && (
                                            <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>
                                                ❌ {contextError}
                                            </div>
                                        )}
                                        {cleanSnippet(m.display_snippet || m.snippet)}
                                    </div>
                                )}

                                {isExpanded && hasContext && (
                                    <div style={{
                                        marginTop: 8, padding: spacing.lg,
                                        backgroundColor: colors.primaryLight,
                                        borderRadius: radii.md,
                                        border: `2px solid ${colors.primaryBorder}`,
                                        maxHeight: 500, overflowY: 'auto',
                                    }}>
                                        <div style={{
                                            fontSize: font.sizeSm, color: colors.primary,
                                            marginBottom: spacing.md, fontWeight: font.weightBold,
                                        }}>
                                            📚 Full Context ({chunkContext.chunks.length} chunks):
                                        </div>
                                        {chunkContext.chunks.map((chunk, idx) => {
                                            const isTarget = idx === chunkContext.target_index;
                                            return (
                                                <div key={idx} style={{
                                                    padding: 14, marginBottom: 10,
                                                    backgroundColor: isTarget ? '#fef3c7' : '#ffffff',
                                                    border: isTarget ? '3px solid #f59e0b' : '1px solid #e5e7eb',
                                                    borderRadius: 6, fontSize: 13, lineHeight: 1.8,
                                                    whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif',
                                                    position: 'relative',
                                                }}>
                                                    {isTarget && (
                                                        <div style={{
                                                            position: 'absolute', top: -10, left: 10,
                                                            backgroundColor: '#f59e0b', color: 'white',
                                                            padding: '3px 10px', borderRadius: 4,
                                                            fontSize: 10, fontWeight: 'bold', fontFamily: 'system-ui',
                                                        }}>⭐ RETRIEVED</div>
                                                    )}
                                                    <div style={{
                                                        fontSize: 13, color: '#6b7280', marginBottom: 6,
                                                        fontFamily: 'system-ui', fontStyle: 'italic',
                                                    }}>
                                                        {isTarget ? '→ Used in answer' : idx < chunkContext.target_index ? '↑ Previous' : '↓ Next'}
                                                    </div>
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

    // ── Full message renderer ─────────────────────────────────────────────────
    const renderMessage = (msg, msgIndex) => {
        if (msg.role === 'user') {
            return (
                <div key={msgIndex} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
                    <div style={{
                        maxWidth: '70%', padding: '12px 16px',
                        background: colors.primary, color: colors.surface,
                        borderRadius: '18px 18px 4px 18px',
                        fontSize: font.sizeMd, lineHeight: 1.6, boxShadow: shadows.sm,
                    }}>
                        {msg.content}
                    </div>
                </div>
            );
        }
        return (
            <div key={msgIndex} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 32, gap: 12 }}>
                {/* ☕ Avatar */}
                <div style={{
                    width: 32, height: 32, borderRadius: radii.full,
                    background: colors.accent, color: colors.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0, marginTop: 2,
                }}>☕</div>

                {/* Bubble */}
                <div style={{ flex: 1, maxWidth: '85%' }}>
                    <div style={{
                        padding: '16px 20px', background: colors.surface,
                        borderRadius: '4px 18px 18px 18px',
                        boxShadow: shadows.sm, fontSize: font.sizeMd, lineHeight: 1.8,
                        border: `1px solid ${colors.divider}`,
                    }}>
                        {renderAIMessage(msg, msgIndex)}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: colors.textMuted }}>
            Loading...
        </div>
    );
    if (!isAuthenticated) return null;

    // ── Layout — mirrors AI.js full-page structure ────────────────────────────
    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: colors.bg, overflow: 'hidden' }}>

            {/* ── Sidebar ── */}
            <div style={{
                width: sidebarOpen ? 280 : 0,
                minWidth: sidebarOpen ? 280 : 0,
                overflow: 'hidden',
                transition: 'width 0.25s ease, min-width 0.25s ease',
                background: '#E0F2FE',
                borderRight: `2px solid ${colors.primaryBorder}`,
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Sidebar header */}
                <div style={{
                    padding: '20px 16px 12px',
                    borderBottom: `2px solid ${colors.primaryBorder}`,
                    background: '#FFFFFF',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontWeight: font.weightBold, fontSize: font.sizeMd, color: colors.primary }}>
                            💬 Conversations
                        </span>
                    </div>
                    <button
                        onClick={createNewSession}
                        style={{
                            width: '100%', padding: '11px 12px',
                            background: colors.primary, color: '#FFFFFF',
                            border: 'none', borderRadius: radii.md,
                            cursor: 'pointer', fontSize: font.sizeSm,
                            fontWeight: font.weightSemibold,
                            display: 'flex', alignItems: 'center', gap: 6,
                            justifyContent: 'center', boxShadow: shadows.sm, transition,
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" />
                        </svg>
                        New Chat
                    </button>
                </div>

                {/* Session list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {!sessionsLoaded && (
                        <div style={{ padding: 16, color: colors.textMuted, fontSize: font.sizeXs, textAlign: 'center' }}>
                            Loading...
                        </div>
                    )}
                    {sessionsLoaded && sessions.length === 0 && (
                        <div style={{ padding: 16, color: colors.textMuted, fontSize: font.sizeXs, textAlign: 'center' }}>
                            No conversations yet
                        </div>
                    )}
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => setActiveId(session.id)}
                            style={{
                                padding: '11px 12px', borderRadius: radii.md,
                                cursor: 'pointer', marginBottom: 6,
                                background: activeId === session.id ? '#FFFFFF' : '#F0F9FF',
                                border: activeId === session.id
                                    ? `2px solid ${colors.primary}`
                                    : `1px solid ${colors.primaryBorder}`,
                                display: 'flex', alignItems: 'flex-start',
                                justifyContent: 'space-between', gap: 8,
                                transition,
                                boxShadow: activeId === session.id ? shadows.sm : 'none',
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: font.sizeSm, fontWeight: font.weightSemibold,
                                    color: activeId === session.id ? colors.primary : colors.text,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    marginBottom: 3,
                                }}>
                                    {activeId === session.id ? '→ ' : ''}{session.title || 'Untitled'}
                                </div>
                                <div style={{ fontSize: '11px', color: colors.textMuted }}>
                                    {formatDate(session.createdAt)} · {session.turnCount ?? Math.floor((session.messages?.length ?? 0) / 2)} msgs
                                </div>
                            </div>
                            <button
                                onClick={(e) => deleteSession(session.id, e)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: colors.textMuted, fontSize: '13px',
                                    padding: '0 2px', opacity: 0.5, flexShrink: 0,
                                }}
                                title="Delete"
                            >✕</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Main area ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header — accent bar, mirrors AI.js */}
                <div style={{
                    height: 56,
                    background: colors.accent,
                    borderRadius: 0,
                    display: 'flex', alignItems: 'center',
                    padding: '0 16px', gap: 10, flexShrink: 0,
                }}>
                    {/* Sidebar toggle */}
                    {headerIconBtn(
                        () => setSidebarOpen(v => !v),
                        sidebarOpen ? 'Hide sidebar' : 'Show sidebar',
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="2" y="2" width="12" height="12" rx="1" />
                            <line x1="6" y1="2" x2="6" y2="14" />
                        </svg>
                    )}

                    {/* Title */}
                    <span style={{
                        fontWeight: font.weightSemibold, fontSize: font.sizeMd,
                        color: colors.surface, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        ☕ {activeSession ? activeSession.title : 'AI Java Tutor'}
                    </span>

                    {/* Collapse / back button */}
                    {headerIconBtn(
                        () => navigate(-1),
                        'Go back',
                        <><CollapseIcon /><span>Collapse</span></>,
                        { background: 'rgba(220,38,38,0.55)', border: '1px solid rgba(220,38,38,0.7)' }
                    )}
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px 10%' }}>
                    {/* Empty state */}
                    {!activeSession && (
                        <div style={{ textAlign: 'center', marginTop: '15%', color: colors.textMuted }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>☕</div>
                            <div style={{ fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.text, marginBottom: 8 }}>
                                AI Java Tutor
                            </div>
                            <div style={{ fontSize: font.sizeMd, color: colors.textSecondary, marginBottom: 20 }}>
                                Start a new conversation or select one from the sidebar
                            </div>
                            {/* Suggestion chips — mirrors AI.js */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                                {['What is polymorphism?', 'Explain try-catch', 'ArrayList vs LinkedList'].map(q => (
                                    <button
                                        key={q}
                                        onClick={() => {
                                            // Create session inline without relying on state timing
                                            const ns = {
                                                id: generateId(),
                                                title: q.slice(0, 80),
                                                createdAt: new Date().toISOString(),
                                                turnCount: 0,
                                                messages: [],
                                            };
                                            setSessions(prev => [ns, ...prev]);
                                            setActiveId(ns.id);
                                            setUserInput(q);   // set together in same event tick
                                        }}
                                        style={{
                                            padding: '8px 16px',
                                            background: colors.primaryLight,
                                            border: `1px solid ${colors.primaryBorder}`,
                                            borderRadius: radii.full,
                                            color: colors.primary,
                                            fontSize: font.sizeSm,
                                            cursor: 'pointer',
                                            fontWeight: font.weightMedium,
                                            transition,
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = colors.primary; e.currentTarget.style.color = colors.surface; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = colors.primaryLight; e.currentTarget.style.color = colors.primary; }}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading messages indicator */}
                    {activeSession && activeSession.messages === null && (
                        <div style={{ textAlign: 'center', marginTop: '20%', color: colors.textMuted }}>
                            Loading messages...
                        </div>
                    )}

                    {/* Message list */}
                    {messages.map((msg, idx) => renderMessage(msg, idx))}

                    {/* Typing indicator */}
                    {chatLoading && (
                        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: radii.full,
                                background: colors.accent, color: colors.surface,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                            }}>☕</div>
                            <div style={{
                                padding: '14px 18px', background: colors.surface,
                                borderRadius: '4px 18px 18px 18px',
                                boxShadow: shadows.sm, border: `1px solid ${colors.divider}`,
                            }}>
                                <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                                    {[0, 1, 2].map(i => (
                                        <span key={i} style={{
                                            width: 7, height: 7, borderRadius: '50%',
                                            background: colors.textMuted, display: 'inline-block',
                                            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                                        }} />
                                    ))}
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input footer */}
                <div style={{
                    padding: '14px 10%',
                    background: colors.surface,
                    borderTop: `1px solid ${colors.divider}`,
                }}>
                    {/* Knowledge source chips */}
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: 5, fontWeight: 600 }}>
                            📚 Knowledge Sources:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            <button
                                type="button"
                                onClick={() => toggleSource('general')}
                                style={{
                                    padding: '3px 10px', borderRadius: radii.full,
                                    border: `1px solid ${selectedSources['general'] ? colors.primary : colors.border}`,
                                    background: selectedSources['general'] ? colors.primary : 'transparent',
                                    color: selectedSources['general'] ? colors.surface : colors.textMuted,
                                    fontSize: '11px', cursor: 'pointer', fontWeight: 600, transition,
                                }}
                            >
                                {selectedSources['general'] ? '✓' : '+'} General Java KB
                            </button>
                            {enrolledClassrooms.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggleSource(String(c.id))}
                                    style={{
                                        padding: '3px 10px', borderRadius: radii.full,
                                        border: `1px solid ${selectedSources[String(c.id)] ? colors.accent : colors.border}`,
                                        background: selectedSources[String(c.id)] ? colors.accent : 'transparent',
                                        color: selectedSources[String(c.id)] ? colors.surface : colors.textMuted,
                                        fontSize: '11px', cursor: 'pointer', fontWeight: 600, transition,
                                    }}
                                >
                                    {selectedSources[String(c.id)] ? '✓' : '+'} {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Textarea form */}
                    <form
                        onSubmit={handleSubmit}
                        style={{
                            display: 'flex', gap: 10, alignItems: 'flex-end',
                            background: colors.bg,
                            border: `1.5px solid ${colors.border}`,
                            borderRadius: radii.lg,
                            padding: '10px 14px',
                            boxShadow: shadows.sm,
                        }}
                    >
                        <TextareaAutosize
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            placeholder="Ask anything about Java..."
                            minRows={1}
                            maxRows={6}
                            style={{
                                flex: 1, border: 'none', outline: 'none',
                                background: 'transparent', resize: 'none',
                                fontSize: font.sizeMd, fontFamily: font.family,
                                color: colors.text, lineHeight: 1.6,
                            }}
                        />
                        <button
                            type="submit"
                            disabled={chatLoading || !userInput.trim()}
                            style={{
                                ...btn.accent, ...btn.small,
                                opacity: (!chatLoading && userInput.trim()) ? 1 : 0.45,
                                cursor: (!chatLoading && userInput.trim()) ? 'pointer' : 'not-allowed',
                            }}
                        >
                            {chatLoading ? '⏳' : 'Send'}
                        </button>
                    </form>
                    <div style={{ textAlign: 'center', marginTop: 6, fontSize: '11px', color: colors.textMuted }}>
                        Enter to send · Shift+Enter for new line
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}