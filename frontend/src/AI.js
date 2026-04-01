import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { useNavigate } from "react-router-dom";
import { colors, radii, font, spacing, btn, shadows, transition } from './theme';
import { useAuth } from './AuthContext';


// Add getToken helper for fetching classrooms
const getToken = () => localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || "";

const STORAGE_KEY = 'codetutor_chat_history';
const SESSIONS_KEY = 'codetutor_active_sessions';
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

function cleanSnippet(text) {
    if (!text) return '';
    text = text.replace(/Try it Yourself\s*[»›]?/gi, '');
    text = text.replace(/Try it\s+\w+\s*[»›]?/gi, '');
    text = text.replace(/\b(Try it Yourself|Try it Now|Run Example|Edit & Run|Exercise|Quiz Yourself)\s*[»›]?/gi, '');
    return text.replace(/\n+/g, ' ').trim();
}

const ExpandIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="5 3 3 3 3 5" /><polyline points="11 3 13 3 13 5" />
        <polyline points="5 13 3 13 3 11" /><polyline points="11 13 13 13 13 11" />
        <line x1="3" y1="3" x2="6" y2="6" /><line x1="13" y1="3" x2="10" y2="6" />
        <line x1="3" y1="13" x2="6" y2="10" /><line x1="13" y1="13" x2="10" y2="10" />
    </svg>
);

export default function AI({ showChat, setShowChat, externalInputRef }) {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    const navigate = useNavigate();
    const { user } = useAuth();

    const [sessions, setSessions] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [history, setHistory] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [expandedChunk, setExpandedChunk] = useState(null);
    const [chunkContext, setChunkContext] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const messagesEndRef = useRef(null);
    const activeIdRef = useRef(null);
    // Stable conversation_id for this chat session — reset on new chat
    const conversationIdRef = useRef(generateId());

    // Expose setUserInput and submitQuery via externalInputRef
    useEffect(() => {
        if (externalInputRef) {
            externalInputRef.current = { setUserInput, setShowChat, submitQuery };
        }
    }, [externalInputRef, setShowChat, submitQuery]);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
        }
    }, [sessions]);

    // Fetch and Sync logic depending on auth state
    useEffect(() => {
        const token = getToken();
        if (token) {
            // User is logged in: Sync local sessions, then fetch from DB
            const syncAndFetch = async () => {
                let localSessions = [];
                try { localSessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch (e) { localSessions = []; }
                
                if (localSessions.length > 0) {
                    for (const session of localSessions) {
                        if (!session.messages || session.messages.length === 0) continue;
                        
                        let currentQuery = '';
                        for (let i = 0; i < session.messages.length; i++) {
                            const msg = session.messages[i];
                            if (msg.role === 'user') {
                                currentQuery = msg.content;
                            } else if (msg.role === 'assistant' && currentQuery) {
                                try {
                                    await fetch(`${API_BASE}/conversation/save`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({
                                            conversation_id: session.conversationId || session.id,
                                            user_message: currentQuery,
                                            assistant_response: msg.content,
                                            context_type: 'general'
                                        }),
                                    });
                                } catch (e) { console.warn('Failed to sync message:', e); }
                                currentQuery = '';
                            }
                        }
                    }
                    localStorage.removeItem(SESSIONS_KEY);
                    localStorage.removeItem(STORAGE_KEY);
                }

                // Fetch sessions from DB
                try {
                    const res = await fetch(`${API_BASE}/conversation/sessions`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const mappedSessions = data.map(s => ({
                            id: s.conversation_id, // in local it's arbitrary id, here we just use conversation_id
                            title: s.first_message,
                            createdAt: new Date(s.last_message_at).getTime(),
                            conversationId: s.conversation_id,
                            turnCount: s.turn_count,
                            isDb: true
                        }));
                        setSessions(mappedSessions);
                    }
                } catch (e) { console.error('Failed to load DB sessions:', e); }
            };
            syncAndFetch();
        } else {
            // Not logged in: load from localStorage
            try {
                const localSessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
                setSessions(localSessions.length ? localSessions : JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
            } catch (e) {
                setSessions([]);
            }
        }
    }, [user, API_BASE]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

    useEffect(() => {
        const handleCloseTour = () => setShowChat(false);
        window.addEventListener('close-ai-chat', handleCloseTour);
        return () => window.removeEventListener('close-ai-chat', handleCloseTour);
    }, [setShowChat]);

    const toggleChat = () => setShowChat(v => !v);
    const startNewChat = () => {
        setActiveId(null);
        setHistory([]);
        setShowHistoryPanel(false);
        conversationIdRef.current = generateId();
    };
    const loadSession = async (session) => {
        const token = getToken();
        if (token && session.isDb) {
            setLoading(true);
            setActiveId(session.id);
            try {
                const res = await fetch(`${API_BASE}/conversation/history/${session.conversationId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const turns = await res.json();
                    const newHistory = [];
                    turns.forEach(t => {
                        newHistory.push({ role: 'user', content: t.user_message });
                        newHistory.push({ role: 'assistant', content: t.assistant_response, pdf_matches: t.pdf_matches, debug_log: t.pdf_matches ? { pdf_matches: t.pdf_matches } : undefined });
                    });
                    setHistory(newHistory);
                    conversationIdRef.current = session.conversationId;
                }
            } catch (e) {
                console.error("Failed to load session history from DB", e);
            } finally {
                setLoading(false);
                setShowHistoryPanel(false);
            }
        } else {
            setActiveId(session.id);
            setHistory(session.messages || []);
            setShowHistoryPanel(false);
            conversationIdRef.current = session.conversationId || generateId();
        }
    };

    const deleteSession = async (id, e) => {
        e.stopPropagation();
        const token = getToken();
        if (token) {
            try {
                const session = sessions.find(s => s.id === id);
                if (session && session.conversationId) {
                    await fetch(`${API_BASE}/conversation/session/${session.conversationId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                }
            } catch (err) { console.error("Failed to delete session", err); }
        }
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeId === id) { setActiveId(null); setHistory([]); conversationIdRef.current = generateId(); }
    };

    const saveCurrentSession = (msgs, convId) => {
        if (!msgs || msgs.length === 0) return;
        const activeId = activeIdRef.current;
        const token = getToken();
        const title = msgs.find(m => m.role === 'user')?.content?.slice(0, 50) || 'New Chat';

        if (token) {
            setSessions(prev => {
                const existing = prev.find(s => s.id === (activeId || convId));
                if (existing) {
                    return prev.map(s => s.id === (activeId || convId) ? { ...existing, updatedAt: Date.now(), messages: msgs } : s);
                } else {
                    activeIdRef.current = convId;
                    return [{ id: convId, title, createdAt: Date.now(), messages: msgs, conversationId: convId, isDb: true }, ...prev];
                }
            });
            return convId;
        }
        
        let sessionsList = [];
        try { sessionsList = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch (e) { sessionsList = []; }
        const existing = sessionsList.find(s => s.id === activeId);

        if (existing) {
            const updated = { ...existing, messages: msgs, conversationId: convId, updatedAt: Date.now() };
            const newSessions = sessionsList.map(s => s.id === activeId ? updated : s);
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(newSessions));
            setSessions(newSessions);
            return activeId;
        } else {
            const newId = generateId();
            const session = { id: newId, title, createdAt: Date.now(), messages: msgs, conversationId: convId };
            const newSessions = [session, ...sessionsList];
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(newSessions));
            activeIdRef.current = newId;
            setSessions(newSessions);
            return newId;
        }
    };

    const handleEnlarge = () => {
        const savedId = saveCurrentSession(history);
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
                await submitQuery(userInput);
        };

    // Extracted submit logic for programmatic use
    const submitQuery = useCallback(async (questionText) => {
                if (!questionText.trim()) return;
                const userMessage = { role: 'user', content: questionText };
                const newHistory = [...history, userMessage];
                setHistory(newHistory);
                setUserInput('');
                setLoading(true);

                try {
                    const useGeneral = selectedSources['general'] !== false; // default true
                    const classroomIds = Object.entries(selectedSources)
                        .filter(([k, v]) => k !== 'general' && v)
                        .map(([k]) => Number(k));

                    let finalAnswer = '';
                    let totalSources = 0;
                    let pdfMatches = [];

                    if (classroomIds.length > 0) {
                        // Call multi-classroom RAG endpoint
                        const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
                        const res = await fetch(`${API_BASE}/classrooms/ask-multi`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${getToken()}`,
                            },
                            body: JSON.stringify({
                                question: questionText,
                                classroom_ids: classroomIds,
                                include_general: useGeneral,
                                user_id: user?.id || null,
                                conversation_id: conversationIdRef.current,
                            }),
                        });
                        if (!res.ok) {
                            const text = await res.text();
                            console.error(`❌ [ASK-MULTI] HTTP ${res.status}: ${text.substring(0, 200)}`);
                            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                        }
                        const data = await res.json();
                        if (data.conversation_id) conversationIdRef.current = data.conversation_id;
                        finalAnswer = data.answer;
                        totalSources = data.sources_count || 0;
                        pdfMatches = data.debug_log?.pdf_matches || [];
                        console.log('[DEBUG] pdf_matches from response:', JSON.stringify(pdfMatches, null, 2));
                    } else {
                        // General RAG only
                        const res = await fetch(`${API_BASE}/ragAI`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_input: questionText,
                                history: [],
                                user_id: user?.id || null,
                                conversation_id: conversationIdRef.current,
                            }),
                        });
                        const data = await res.json();
                        if (data.conversation_id) conversationIdRef.current = data.conversation_id;
                        finalAnswer = data.final_answer || 'No response.';
                        const aiMsg = { role: 'assistant', content: finalAnswer, pdf_matches: data.debug_log?.pdf_matches || [], debug_log: data.debug_log };
                        const finalHistory = [...newHistory, aiMsg];
                        setHistory(finalHistory);
                        saveCurrentSession(finalHistory, conversationIdRef.current);
                        setLoading(false);
                        return;
                    }

                    const sourceBadge = totalSources > 0
                        ? `\n\n*✓ Based on ${totalSources} source(s)*`
                        : '';
                    const aiMsg = { role: 'assistant', content: finalAnswer + sourceBadge, pdf_matches: pdfMatches, debug_log: { pdf_matches: pdfMatches } };
                    const finalHistory = [...newHistory, aiMsg];
                    setHistory(finalHistory);
                    saveCurrentSession(finalHistory, conversationIdRef.current);
                } catch (err) {
                    setHistory([...newHistory, { role: 'assistant', content: 'Error: ' + err.message }]);
                }
                setLoading(false);
        }, [history, selectedSources, user, API_BASE, saveCurrentSession]);

    const renderAIMessage = (msg, msgIndex) => (
        <div>
            <div style={{ marginBottom: 10 }}><ReactMarkdown>{msg.content}</ReactMarkdown></div>
            {msg.debug_log && (
                <div style={{ fontSize: font.sizeSm, color: colors.textMuted, marginTop: spacing.sm, padding: '8px 10px', backgroundColor: colors.divider, borderRadius: radii.sm }}>
                    ⚡ {msg.debug_log.response_time_sec}s
                </div>
            )}
            {console.log(`📊 [AI] Message ${msgIndex}:`, { 
                content: msg.content?.substring(0, 50), 
                pdf_matches_count: msg.pdf_matches?.length,
                pdf_matches: msg.pdf_matches,
                debug_log: msg.debug_log 
            })}
            {msg.pdf_matches && msg.pdf_matches.length > 0 && (
                <div style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTop: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: font.sizeMd, fontWeight: font.weightBold, color: colors.textSecondary, marginBottom: spacing.sm }}>📚 Sources ({msg.pdf_matches.length}):</div>
                    {msg.pdf_matches.map((m, i) => {
                        const chunkKey = `${msgIndex}-${i}`;
                        const isExpanded = expandedChunk === chunkKey;
                        const hasContext = chunkContext && expandedChunk === chunkKey;
                        const isPDF = m.iframeUrl && (m.file.toLowerCase().endsWith('.pdf') || m.file.includes('material'));
                        return (
                            <div key={i} style={{ marginBottom: 10 }}>
                                <button style={{ backgroundColor: isExpanded ? colors.success : colors.primary, color: colors.surface, padding: '12px 16px', borderRadius: radii.md, border: 'none', cursor: 'pointer', fontSize: font.sizeMd, fontWeight: font.weightSemibold, width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition }}
                                    onClick={() => { if (isExpanded) { setExpandedChunk(null); setChunkContext(null); } else { setChunkContext(null); setExpandedChunk(chunkKey); } }}
                                >
                                    <span>{isExpanded ? '📖' : '📄'} {m.file.replace('.txt', '').split('/').pop()} {m.page && m.page > 1 ? `(Page ${m.page})` : ''}</span>
                                    <span style={{ fontSize: font.sizeSm, opacity: 0.9 }}>{isExpanded ? '▼ Collapse' : '► Expand'}</span>
                                </button>
                                {isExpanded && (
                                    <>
                                        {isPDF && (
                                            <div style={{ marginTop: spacing.sm, padding: spacing.lg, backgroundColor: '#f3f4f6', borderRadius: radii.md, border: `2px solid ${colors.border}` }}>
                                                <div style={{ fontSize: 14, color: '#374151', marginBottom: 12, fontWeight: 'bold', fontFamily: 'system-ui' }}>
                                                    📕 PDF Viewer: {m.file} {m.page && m.page > 1 ? `(Page ${m.page})` : ''}
                                                </div>
                                                <iframe
                                                    src={(() => {
                                                        // Insert token before hash fragment
                                                        const url = m.iframeUrl;
                                                        const token = getToken();
                                                        const hashIndex = url.indexOf('#');
                                                        let finalUrl;
                                                        if (hashIndex > -1) {
                                                            const base = url.substring(0, hashIndex);
                                                            const hash = url.substring(hashIndex);
                                                            finalUrl = `${base}?token=${token}${hash}`;
                                                        } else {
                                                            finalUrl = `${url}?token=${token}`;
                                                        }
                                                        console.log('[IFRAME] Final URL:', finalUrl);
                                                        return finalUrl;
                                                    })()}
                                                    onLoad={(e) => {
                                                        // Force page navigation after iframe loads
                                                        if (m.page && m.page > 1) {
                                                            setTimeout(() => {
                                                                const iframe = e.target;
                                                                if (iframe && iframe.contentWindow) {
                                                                    try {
                                                                        iframe.contentWindow.location.hash = `page=${m.page}`;
                                                                    } catch (err) {
                                                                        console.log('Cannot access iframe content for page navigation');
                                                                    }
                                                                }
                                                            }, 1000);
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        height: 600,
                                                        borderRadius: radii.md,
                                                        border: `1px solid ${colors.border}`,
                                                    }}
                                                    title={m.file}
                                                />
                                            </div>
                                        )}
                                        <div style={{ marginTop: spacing.sm, padding: spacing.lg, backgroundColor: colors.warningLight, borderRadius: radii.md, border: `2px solid ${colors.warningBorder}`, fontSize: font.sizeMd, lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto', fontFamily: 'Georgia, serif' }}>
                                            <div style={{ fontSize: 14, color: '#92400e', marginBottom: 12, fontWeight: 'bold', fontFamily: 'system-ui', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>📄 Retrieved Paragraph:</span>
                                                <button style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 5, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                                                    onClick={() => { if (hasContext) setChunkContext(null); else fetchChunkContext(m.file, m.snippet); }}
                                                    disabled={loadingContext}
                                                >{loadingContext ? '⏳ Loading...' : hasContext ? 'Hide Context' : '🔍 Show Context'}</button>
                                            </div>
                                            {cleanSnippet(m.display_snippet || m.snippet)}
                                        </div>
                                    </>
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

    const headerIconBtn = (onClick, title, children, extraStyle = {}) => (
        <button onClick={onClick} title={title}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: radii.sm, color: colors.surface, fontSize: font.sizeSm, fontWeight: font.weightSemibold, cursor: 'pointer', transition, ...extraStyle }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = extraStyle.background || 'rgba(255,255,255,0.15)'; }}
        >
            {children}
        </button>
    );

    // RAG/classroom mode state
    // Multi-source RAG state
    const [selectedSources, setSelectedSources] = useState({ general: true }); // { general: bool, [classroomId]: bool }
    const [enrolledClassrooms, setEnrolledClassrooms] = useState([]);

        useEffect(() => {
                // Fetch enrolled classrooms for RAG mode when chat opens
                if (!showChat) return;
                
                const token = getToken();
                
                // If no token yet, retry after a short delay
                if (!token) {
                    console.log('⏭️ [AI] No token available yet, retrying in 500ms...');
                    const timer = setTimeout(() => {
                        const retryToken = getToken();
                        if (retryToken) {
                            console.log(`🔑 [AI] Token available after retry, fetching classrooms...`);
                        }
                    }, 500);
                    return () => clearTimeout(timer);
                }

                const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
                console.log(`🔑 [AI] Fetching classrooms with valid token (length=${token.length})`);
                
                fetch(`${API_BASE}/classrooms/enrolled`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                    .then((r) => {
                        if (!r.ok) {
                            console.warn(`❌ [AI] Failed to fetch classrooms: ${r.status}`);
                            return [];
                        }
                        return r.json();
                    })
                    .then((data) => {
                        console.log('✅ [AI] Enrolled classrooms:', data);
                        setEnrolledClassrooms(Array.isArray(data) ? data : []);
                    })
                    .catch((err) => {
                        console.error('❌ [AI] Error fetching classrooms:', err);
                        setEnrolledClassrooms([]);
                    });
        }, [showChat]);

        const toggleSource = (key) => {
            setSelectedSources(prev => ({ ...prev, [key]: !prev[key] }));
        };

    return (
        <>
            {showChat && (
                <div style={{ position: 'fixed', top: 64, right: 20, width: 800, height: '75vh', backgroundColor: colors.surface, boxShadow: shadows.lg, borderRadius: radii.lg, zIndex: 10000, display: 'flex', flexDirection: 'column' }}>

                    {/* Header */}
                    <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.accent, borderRadius: `${radii.lg}px ${radii.lg}px 0 0`, color: colors.surface }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {headerIconBtn(
                                () => setShowHistoryPanel(v => !v),
                                showHistoryPanel ? 'Hide history' : 'Show history',
                                <><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><polyline points="8 5 8 8 10.5 10" /></svg><span>History</span></>,
                                showHistoryPanel ? { background: 'rgba(255,255,255,0.3)' } : {}
                            )}
                            <h3 style={{ margin: 0, fontSize: font.sizeMd, fontWeight: font.weightSemibold }}>
                                ☕ {activeId ? (sessions.find(s => s.id === activeId)?.title || 'AI Java Tutor') : 'AI Java Tutor'}
                            </h3>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {headerIconBtn(handleEnlarge, 'Open full history page', <><ExpandIcon /><span>Expand</span></>)}
                            {headerIconBtn(toggleChat, 'Close chat',
                                <><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg><span>Close</span></>,
                                { background: 'rgba(220,38,38,0.55)', border: '1px solid rgba(220,38,38,0.7)' }
                            )}
                        </div>
                    </div>

                    {/* Body */}
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {showHistoryPanel && (
                            <div style={{ width: 220, borderRight: `1px solid ${colors.divider}`, background: colors.bg, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                                <div style={{ padding: '10px 10px 6px', borderBottom: `1px solid ${colors.divider}` }}>
                                    <button onClick={startNewChat}
                                        style={{ width: '100%', padding: '7px 10px', background: colors.primary, color: colors.surface, border: 'none', borderRadius: radii.md, cursor: 'pointer', fontSize: font.sizeXs, fontWeight: font.weightSemibold, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                    >
                                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
                                        New Chat
                                    </button>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                                    {sessions.length === 0 && (
                                        <div style={{ padding: 12, color: colors.textMuted, fontSize: '11px', textAlign: 'center' }}>No history yet</div>
                                    )}
                                    {sessions.map(s => (
                                        <div key={s.id} onClick={() => loadSession(s)}
                                            style={{ padding: '8px 10px', borderRadius: radii.sm, cursor: 'pointer', marginBottom: 2, background: activeId === s.id ? colors.primaryLight : 'transparent', border: activeId === s.id ? `1px solid ${colors.primaryBorder}` : '1px solid transparent', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, transition }}
                                        >
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '11px', fontWeight: font.weightSemibold, color: activeId === s.id ? colors.primary : colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || 'Untitled'}</div>
                                                <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: 1 }}>{formatDate(s.createdAt)} · {s.messages ? s.messages.length : (s.turnCount * 2 || 0)} msgs</div>
                                            </div>
                                            <button onClick={(e) => deleteSession(s.id, e)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: '12px', padding: '0 2px', opacity: 0.6, flexShrink: 0 }}
                                            >✕</button>
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
                                    <div style={{ fontSize: font.sizeXs, color: colors.textMuted, marginTop: 4 }}>Click History to browse past conversations</div>
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
                                                {/* RAG Mode Selector */}
                                                                                                {/* Multi-Source Selector */}
                                                                                                <div style={{ marginBottom: spacing.sm }}>
                                                                                                    <div style={{ fontSize: font.sizeXs, color: colors.textMuted, marginBottom: 4, fontWeight: 600 }}>
                                                                                                        📚 Knowledge Sources:
                                                                                                    </div>
                                                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                                                                        {/* General KB chip */}
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => toggleSource('general')}
                                                                                                            style={{
                                                                                                                padding: '3px 10px',
                                                                                                                borderRadius: radii.full,
                                                                                                                border: `1px solid ${selectedSources['general'] ? colors.primary : colors.border}`,
                                                                                                                background: selectedSources['general'] ? colors.primary : 'transparent',
                                                                                                                color: selectedSources['general'] ? colors.surface : colors.textMuted,
                                                                                                                fontSize: font.sizeXs,
                                                                                                                cursor: 'pointer',
                                                                                                                fontWeight: 600,
                                                                                                            }}
                                                                                                        >
                                                                                                            {selectedSources['general'] ? '✓' : '+'} General Java KB
                                                                                                        </button>

                                                                                                        {/* Classroom chips */}
                                                                                                        {enrolledClassrooms && enrolledClassrooms.length > 0 ? (
                                                                                                            enrolledClassrooms.map(c => (
                                                                                                                <button
                                                                                                                    key={c.id}
                                                                                                                    type="button"
                                                                                                                    onClick={() => toggleSource(String(c.id))}
                                                                                                                    style={{
                                                                                                                        padding: '3px 10px',
                                                                                                                        borderRadius: radii.full,
                                                                                                                        border: `1px solid ${selectedSources[String(c.id)] ? colors.accent : colors.border}`,
                                                                                                                        background: selectedSources[String(c.id)] ? colors.accent : 'transparent',
                                                                                                                        color: selectedSources[String(c.id)] ? colors.surface : colors.textMuted,
                                                                                                                        fontSize: font.sizeXs,
                                                                                                                        cursor: 'pointer',
                                                                                                                        fontWeight: 600,
                                                                                                                    }}
                                                                                                                >
                                                                                                                    {selectedSources[String(c.id)] ? '✓' : '+'} {c.name}
                                                                                                                </button>
                                                                                                            ))
                                                                                                        ) : (
                                                                                                            <div style={{ fontSize: font.sizeXs, color: colors.textMuted, padding: '4px 0' }}>
                                                                                                                No classrooms joined yet
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    {Object.values(selectedSources).every(v => !v) && (
                                                                                                        <div style={{ fontSize: font.sizeXs, color: 'orange', marginTop: 3 }}>
                                                                                                            ⚠️ No sources selected — answer will use general knowledge only
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                <TextareaAutosize value={userInput} onChange={e => setUserInput(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                                                        placeholder="Ask anything about Java..." minRows={2} maxRows={6}
                                                        style={{ width: '100%', padding: spacing.sm, marginBottom: spacing.sm, borderRadius: radii.sm, border: `2px solid ${colors.border}`, fontSize: font.sizeMd, fontFamily: font.family }}
                                                />
                                                <button type="submit" disabled={loading} style={loading ? btn.disabled : btn.accent}>
                                                        {loading ? '⏳ Thinking...' : '📤 Send'}
                                                </button>
                                        </form>
                </div>
            )}

            <button data-tour="ai-button"
                style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, backgroundColor: colors.accent, color: colors.surface, borderRadius: radii.full, width: 72, height: 72, border: 'none', cursor: 'pointer', fontWeight: font.weightBold, fontSize: font.sizeMd, boxShadow: shadows.lg, transition }}
                onClick={toggleChat}
            >
                ☕ Ask AI
            </button>
        </>
    );
}
