import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { useNavigate } from "react-router-dom";
import { colors, radii, font, spacing, btn, shadows, transition } from './theme';
import { useAuth } from './AuthContext';
import { askClassroom } from "./services/classroomService";

// Add getToken helper for fetching classrooms
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";

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

export default function AI({ showChat, setShowChat }) {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    const navigate = useNavigate();
    const { user } = useAuth();

    const [sessions, setSessions] = useState(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
    });
    const [activeId, setActiveId] = useState(null);
    const [history, setHistory] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [expandedChunk, setExpandedChunk] = useState(null);
    const [chunkContext, setChunkContext] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const messagesEndRef = useRef(null);
    // Stable conversation_id for this chat session — reset on new chat
    const conversationIdRef = useRef(generateId());

    useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }, [sessions]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

    useEffect(() => {
        const handleCloseTour = () => setShowChat(false);
        window.addEventListener('close-ai-chat', handleCloseTour);
        return () => window.removeEventListener('close-ai-chat', handleCloseTour);
    }, []);

    const toggleChat = () => setShowChat(v => !v);
    const startNewChat = () => {
        setActiveId(null);
        setHistory([]);
        setShowHistoryPanel(false);
        conversationIdRef.current = generateId();
    };
    const loadSession = (session) => {
        setActiveId(session.id);
        setHistory(session.messages);
        setShowHistoryPanel(false);
        // Restore conversation_id stored on the session, or generate a new one
        conversationIdRef.current = session.conversationId || generateId();
    };

    const deleteSession = (id, e) => {
        e.stopPropagation();
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeId === id) { setActiveId(null); setHistory([]); conversationIdRef.current = generateId(); }
    };

    const saveCurrentSession = (msgs) => {
        if (msgs.length === 0) return null;
        const convId = conversationIdRef.current;
        if (activeId) {
            setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: msgs, conversationId: convId } : s));
            return activeId;
        } else {
            const newId = generateId();
            const title = msgs.find(m => m.role === 'user')?.content?.slice(0, 50) || 'Chat';
            const session = { id: newId, title, createdAt: Date.now(), messages: msgs, conversationId: convId };
            setSessions(prev => [session, ...prev]);
            setActiveId(newId);
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
        const userMessage = { role: 'user', content: userInput };
        const newHistory = [...history, userMessage];
        setHistory(newHistory);
        setUserInput('');
        setLoading(true);
        try {
            if (ragMode === "classroom" && selectedClassroomId) {
                const result = await askClassroom(selectedClassroomId, userInput);
                const aiMsg = { role: 'assistant', content: result.answer };
                const finalHistory = [...newHistory, aiMsg];
                setHistory(finalHistory);
                saveCurrentSession(finalHistory);
            } else {
                const res = await fetch(`${API_BASE}/ragAI`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_input: userInput,
                        history: [],
                        user_id: user?.id || null,
                        conversation_id: conversationIdRef.current,
                    }),
                });
                const data = await res.json();
                if (data.conversation_id) conversationIdRef.current = data.conversation_id;
                const aiMsg = { role: 'assistant', content: data.final_answer || 'No response.', pdf_matches: data.debug_log?.pdf_matches || [], debug_log: data.debug_log };
                const finalHistory = [...newHistory, aiMsg];
                setHistory(finalHistory);
                saveCurrentSession(finalHistory);
            }
        } catch (err) {
            setHistory([...newHistory, { role: 'assistant', content: 'Error: ' + err.message }]);
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
                                <button style={{ backgroundColor: isExpanded ? colors.success : colors.primary, color: colors.surface, padding: '12px 16px', borderRadius: radii.md, border: 'none', cursor: 'pointer', fontSize: font.sizeMd, fontWeight: font.weightSemibold, width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition }}
                                    onClick={() => { if (isExpanded) { setExpandedChunk(null); setChunkContext(null); } else { setChunkContext(null); setExpandedChunk(chunkKey); } }}
                                >
                                    <span>{isExpanded ? '📖' : '📄'} {m.file.replace('.txt', '').split('/').pop()}</span>
                                    <span style={{ fontSize: font.sizeSm, opacity: 0.9 }}>{isExpanded ? '▼ Collapse' : '► Expand'}</span>
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
                                        {cleanSnippet(m.display_snippet || m.snippet)}
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
    const [ragMode, setRagMode] = useState("general"); // "general" | "classroom"
    const [selectedClassroomId, setSelectedClassroomId] = useState("");
    const [enrolledClassrooms, setEnrolledClassrooms] = useState([]);

    useEffect(() => {
        // Fetch enrolled classrooms for RAG mode
        fetch("/classrooms/enrolled", {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
          .then((r) => r.ok ? r.json() : [])
          .then(setEnrolledClassrooms)
          .catch(() => {});
    }, []);

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
                                                <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: 1 }}>{formatDate(s.createdAt)} · {s.messages.length} msgs</div>
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
                                                <div style={{ display: 'flex', gap: 8, marginBottom: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <button type="button"
                                                        onClick={() => setRagMode("general")}
                                                        style={{ padding: '4px 12px', borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: ragMode === "general" ? colors.primary : colors.surface, color: ragMode === "general" ? colors.surface : colors.text, fontSize: font.sizeSm, cursor: 'pointer' }}
                                                    >General AI</button>
                                                    <button type="button"
                                                        onClick={() => setRagMode("classroom")}
                                                        style={{ padding: '4px 12px', borderRadius: radii.sm, border: `1px solid ${colors.border}`, background: ragMode === "classroom" ? colors.primary : colors.surface, color: ragMode === "classroom" ? colors.surface : colors.text, fontSize: font.sizeSm, cursor: 'pointer' }}
                                                    >Classroom Docs</button>
                                                    {ragMode === "classroom" && (
                                                        <select value={selectedClassroomId} onChange={e => setSelectedClassroomId(e.target.value)}
                                                            style={{ padding: '4px 8px', borderRadius: radii.sm, border: `1px solid ${colors.border}`, fontSize: font.sizeSm, background: colors.surface, color: colors.text }}
                                                        >
                                                            <option value="">Select classroom...</option>
                                                            {enrolledClassrooms.map(c => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>
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
