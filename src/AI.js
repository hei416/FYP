import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { colors, radii, font, spacing, btn, shadows, transition } from './theme';
import { ProgressTracker } from './ProgressTracker';
import { useAuth } from './AuthContext';

const progressTracker = new ProgressTracker();

// Generate a stable conversation ID for this browser session
function getOrCreateConversationId() {
    let id = sessionStorage.getItem('ai_conversation_id');
    if (!id) {
        id = 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('ai_conversation_id', id);
    }
    return id;
}

export default function AI({ showChat, setShowChat, setSelectedPdf, setTargetPage }) {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    const { token } = useAuth();

    const [splitView, setSplitView] = useState(false);
    const [history, setHistory] = useState([]);
    const [userInput, setUserInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [expandedChunk, setExpandedChunk] = useState(null);
    const [chunkContext, setChunkContext] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [showSessions, setShowSessions] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [conversationId, setConversationId] = useState(getOrCreateConversationId);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    // Load conversation history from backend when chat opens (only if logged in)
    useEffect(() => {
        if (showChat && token && !historyLoaded) {
            loadHistory(conversationId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showChat, token]);

    const authHeaders = () => token ? { "Content-Type": "application/json", "Authorization": `Bearer ${token}` } : { "Content-Type": "application/json" };

    const loadHistory = async (convId) => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/conversation/history/${convId}`, {
                headers: authHeaders(),
            });
            if (!res.ok) return;
            const turns = await res.json();
            const restored = [];
            for (const turn of turns) {
                restored.push({ role: "user", content: turn.user_message });
                restored.push({ role: "assistant", content: turn.assistant_response, pdf_matches: [], debug_log: null });
            }
            setHistory(restored);
            setHistoryLoaded(true);
        } catch (e) {
            console.error("Failed to load conversation history:", e);
        }
    };

    const loadSessions = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/conversation/sessions`, { headers: authHeaders() });
            if (!res.ok) return;
            setSessions(await res.json());
        } catch (e) {
            console.error("Failed to load sessions:", e);
        }
    };

    const switchSession = async (convId) => {
        sessionStorage.setItem('ai_conversation_id', convId);
        setConversationId(convId);
        setHistory([]);
        setHistoryLoaded(false);
        setShowSessions(false);
        await loadHistory(convId);
    };

    const startNewConversation = () => {
        const newId = 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('ai_conversation_id', newId);
        setConversationId(newId);
        setHistory([]);
        setHistoryLoaded(false);
        setShowSessions(false);
    };

    const saveTurnToBackend = async (userMsg, assistantMsg) => {
        if (!token) return;
        try {
            await fetch(`${API_BASE}/conversation/save`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    conversation_id: conversationId,
                    user_message: userMsg,
                    assistant_response: assistantMsg,
                    context_type: "general",
                }),
            });
        } catch (e) {
            console.error("Failed to save conversation turn:", e);
        }
    };

    const toggleSplitView = () => setSplitView((v) => !v);
    const toggleChat = () => setShowChat((v) => !v);

    const fetchChunkContext = async (sourceFile, chunkContent) => {
        setLoadingContext(true);
        try {
            const res = await fetch(`${API_BASE}/api/get-chunk-context`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source_file: sourceFile, chunk_content: chunkContent }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setChunkContext(await res.json());
        } catch (e) {
            console.error("Error fetching context:", e);
            alert("Failed to load context: " + e.message);
        }
        setLoadingContext(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        const userMessage = { role: "user", content: userInput };
        setHistory((prev) => [...prev, userMessage]);
        const submittedInput = userInput;
        setUserInput("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/ragAI`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_input: submittedInput,
                    history: [...history, userMessage],
                }),
            });
            const data = await res.json();

            const aiMessage = {
                role: "assistant",
                content: data.final_answer || "AI did not provide a response.",
                pdf_matches: data.debug_log?.pdf_matches || [],
                debug_log: data.debug_log,
            };

            setHistory((prev) => [...prev, aiMessage]);
            progressTracker.trackAIInteraction();

            // Save turn to backend (non-blocking)
            saveTurnToBackend(submittedInput, aiMessage.content);
        } catch (e) {
            setHistory((prev) => [...prev, { role: "assistant", content: "Error: " + e.message }]);
        }

        setLoading(false);
    };

    const renderAIMessage = (msg, msgIndex) => {
        return (
            <div>
                <div style={{ marginBottom: 10 }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {msg.debug_log && (
                    <div style={{
                        fontSize: font.sizeSm, color: colors.textMuted, marginTop: spacing.sm,
                        padding: '8px 10px', backgroundColor: colors.divider, borderRadius: radii.sm,
                    }}>
                        ⚡ {msg.debug_log.response_time_sec}s
                    </div>
                )}

                {msg.pdf_matches && msg.pdf_matches.length > 0 && (
                    <div style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTop: `1px solid ${colors.border}` }}>
                        <div style={{ fontSize: font.sizeMd, fontWeight: font.weightBold, color: colors.textSecondary, marginBottom: spacing.sm }}>
                            📚 Retrieved Sources ({msg.pdf_matches.length}):
                        </div>
                        {msg.pdf_matches.map((m, i) => {
                            const chunkKey = `${msgIndex}-${i}`;
                            const isExpanded = expandedChunk === chunkKey;
                            const hasContext = chunkContext && expandedChunk === chunkKey;
                            return (
                                <div key={i} style={{ marginBottom: 10 }}>
                                    <button
                                        style={{
                                            backgroundColor: isExpanded ? colors.success : colors.primary,
                                            color: colors.surface, padding: '12px 16px', borderRadius: radii.md,
                                            border: "none", cursor: "pointer", fontSize: font.sizeMd,
                                            fontWeight: font.weightSemibold, width: "100%", textAlign: "left",
                                            display: "flex", justifyContent: "space-between", alignItems: "center", transition,
                                        }}
                                        onClick={() => {
                                            if (isExpanded) { setExpandedChunk(null); setChunkContext(null); }
                                            else { setExpandedChunk(chunkKey); }
                                        }}
                                    >
                                        <span>{isExpanded ? "📖" : "📄"} {m.file.replace(".txt", "").split("/").pop()}</span>
                                        <span style={{ fontSize: font.sizeSm, opacity: 0.9 }}>{isExpanded ? "▼ Collapse" : "▶ Expand"}</span>
                                    </button>

                                    {isExpanded && (
                                        <div style={{
                                            marginTop: spacing.sm, padding: spacing.lg, backgroundColor: colors.warningLight,
                                            borderRadius: radii.md, border: `2px solid ${colors.warningBorder}`,
                                            fontSize: font.sizeMd, lineHeight: 1.8, whiteSpace: "pre-wrap",
                                            maxHeight: 400, overflowY: "auto", fontFamily: "Georgia, serif"
                                        }}>
                                            <div style={{
                                                fontSize: 14, color: "#92400e", marginBottom: 12, fontWeight: "bold",
                                                fontFamily: "system-ui", display: "flex", justifyContent: "space-between", alignItems: "center"
                                            }}>
                                                <span>📄 Retrieved Paragraph:</span>
                                                <button
                                                    style={{
                                                        backgroundColor: "#3b82f6", color: "white", border: "none",
                                                        padding: "6px 12px", borderRadius: 5, fontSize: 13, cursor: "pointer", fontWeight: 600,
                                                    }}
                                                    onClick={() => hasContext ? setChunkContext(null) : fetchChunkContext(m.file, m.snippet)}
                                                    disabled={loadingContext}
                                                >
                                                    {loadingContext ? "⏳ Loading..." : hasContext ? "Hide Context" : "🔍 Show Context"}
                                                </button>
                                            </div>
                                            {m.snippet}
                                        </div>
                                    )}

                                    {isExpanded && hasContext && (
                                        <div style={{
                                            marginTop: spacing.sm, padding: spacing.lg, backgroundColor: colors.primaryLight,
                                            borderRadius: radii.md, border: `2px solid ${colors.primaryBorder}`,
                                            maxHeight: 500, overflowY: "auto",
                                        }}>
                                            <div style={{ fontSize: font.sizeSm, color: colors.primary, marginBottom: spacing.md, fontWeight: font.weightBold }}>
                                                📚 Full Context ({chunkContext.chunks.length} chunks, {chunkContext.total_chunks} total in document):
                                            </div>
                                            {chunkContext.chunks.map((chunk, idx) => {
                                                const isTarget = idx === chunkContext.target_index;
                                                return (
                                                    <div key={idx} style={{
                                                        padding: 14, marginBottom: 10,
                                                        backgroundColor: isTarget ? "#fef3c7" : "#ffffff",
                                                        border: isTarget ? "3px solid #f59e0b" : "1px solid #e5e7eb",
                                                        borderRadius: 6, fontSize: 13, lineHeight: 1.8,
                                                        whiteSpace: "pre-wrap", fontFamily: "Georgia, serif", position: "relative"
                                                    }}>
                                                        {isTarget && (
                                                            <div style={{
                                                                position: "absolute", top: -10, left: 10,
                                                                backgroundColor: "#f59e0b", color: "white",
                                                                padding: "3px 10px", borderRadius: 4, fontSize: 10,
                                                                fontWeight: "bold", fontFamily: "system-ui"
                                                            }}>⭐ RETRIEVED CHUNK</div>
                                                        )}
                                                        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6, fontFamily: "system-ui", fontStyle: "italic" }}>
                                                            {isTarget ? "→ This paragraph was used in the answer" : idx < chunkContext.target_index ? "↑ Previous chunk" : "↓ Next chunk"}
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
    };

    return (
        <>
            {showChat && (
                <div style={{
                    position: "fixed",
                    top: splitView ? 0 : 64, right: splitView ? 0 : 20,
                    left: splitView ? 0 : "auto", bottom: splitView ? 0 : "auto",
                    width: splitView ? "100vw" : 800, height: splitView ? "100vh" : "75vh",
                    backgroundColor: colors.surface, boxShadow: shadows.lg,
                    borderRadius: splitView ? 0 : radii.lg, zIndex: 10000,
                    display: "flex", flexDirection: "column",
                }}>
                    {/* Header */}
                    <div style={{
                        padding: spacing.lg, borderBottom: `1px solid ${colors.border}`,
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        backgroundColor: colors.accent, borderRadius: `${radii.lg}px ${radii.lg}px 0 0`, color: colors.surface
                    }}>
                        <h3 style={{ margin: 0, fontSize: font.sizeLg, fontWeight: font.weightSemibold }}>☕ AI Java Tutor</h3>
                        <div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
                            {token && (
                                <>
                                    <button
                                        onClick={() => { setShowSessions((v) => !v); if (!showSessions) loadSessions(); }}
                                        style={{
                                            ...btn.small, padding: "6px 12px", cursor: "pointer",
                                            borderRadius: radii.sm, border: "none",
                                            backgroundColor: colors.surface, color: colors.accent, fontWeight: font.weightSemibold
                                        }}
                                    >
                                        🕘 History
                                    </button>
                                    <button
                                        onClick={startNewConversation}
                                        style={{
                                            ...btn.small, padding: "6px 12px", cursor: "pointer",
                                            borderRadius: radii.sm, border: "none",
                                            backgroundColor: colors.surface, color: colors.accent, fontWeight: font.weightSemibold
                                        }}
                                    >
                                        ➕ New Chat
                                    </button>
                                </>
                            )}
                            <button
                                onClick={toggleSplitView}
                                style={{
                                    ...btn.small, padding: "6px 12px", cursor: "pointer",
                                    borderRadius: radii.sm, border: "none",
                                    backgroundColor: colors.surface, color: colors.accent, fontWeight: font.weightSemibold
                                }}
                            >
                                {splitView ? "⬇ Shrink" : "⬆ Enlarge"}
                            </button>
                            <button
                                onClick={toggleChat}
                                style={{
                                    padding: "6px 12px", cursor: "pointer", borderRadius: radii.sm,
                                    border: "none", backgroundColor: colors.danger, color: colors.surface, fontWeight: font.weightSemibold
                                }}
                            >
                                ✕ Close
                            </button>
                        </div>
                    </div>

                    {/* Session History Panel */}
                    {showSessions && (
                        <div style={{
                            padding: spacing.lg, backgroundColor: colors.bg,
                            borderBottom: `1px solid ${colors.border}`, maxHeight: 220, overflowY: "auto"
                        }}>
                            <div style={{ fontWeight: font.weightBold, marginBottom: spacing.sm, fontSize: font.sizeMd }}>📂 Past Conversations</div>
                            {sessions.length === 0 ? (
                                <div style={{ color: colors.textMuted, fontSize: font.sizeSm }}>No past conversations found.</div>
                            ) : (
                                sessions.map((s) => (
                                    <div
                                        key={s.conversation_id}
                                        onClick={() => switchSession(s.conversation_id)}
                                        style={{
                                            padding: "10px 12px", marginBottom: spacing.sm,
                                            backgroundColor: s.conversation_id === conversationId ? colors.primaryLight : colors.surface,
                                            border: `1px solid ${s.conversation_id === conversationId ? colors.primary : colors.border}`,
                                            borderRadius: radii.sm, cursor: "pointer", fontSize: font.sizeSm,
                                        }}
                                    >
                                        <div style={{ fontWeight: font.weightSemibold, marginBottom: 2 }}>{s.first_message}</div>
                                        <div style={{ color: colors.textMuted }}>
                                            {s.turn_count} turn{s.turn_count !== 1 ? 's' : ''} · {new Date(s.last_message_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Messages */}
                    <div style={{ flex: 1, padding: spacing.lg, overflowY: "auto", backgroundColor: colors.bg }}>
                        {history.length === 0 && (
                            <div style={{ color: colors.textMuted, textAlign: "center", marginTop: spacing.xl, fontSize: font.sizeMd }}>
                                👋 Ask me anything about Java!
                            </div>
                        )}
                        {history.map((msg, idx) => (
                            <div key={idx} style={{
                                display: "flex",
                                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                marginBottom: spacing.lg,
                            }}>
                                <div style={{
                                    padding: spacing.lg, borderRadius: radii.md,
                                    backgroundColor: msg.role === "user" ? colors.primary : colors.surface,
                                    color: msg.role === "user" ? colors.surface : colors.text,
                                    boxShadow: shadows.sm, maxWidth: "90%", wordBreak: "break-word",
                                }}>
                                    {msg.role === "assistant" ? renderAIMessage(msg, idx) : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input form */}
                    <form
                        onSubmit={handleSubmit}
                        style={{
                            padding: spacing.lg, borderTop: `2px solid ${colors.border}`,
                            backgroundColor: colors.surface, borderRadius: `0 0 ${radii.lg}px ${radii.lg}px`
                        }}
                    >
                        <TextareaAutosize
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Ask anything about Java..."
                            minRows={2} maxRows={6}
                            style={{
                                width: "100%", padding: spacing.sm, marginBottom: spacing.sm,
                                borderRadius: radii.sm, border: `2px solid ${colors.border}`,
                                fontSize: font.sizeMd, fontFamily: font.family
                            }}
                        />
                        <button type="submit" disabled={loading} style={loading ? btn.disabled : btn.accent}>
                            {loading ? "⏳ Thinking..." : "📤 Send"}
                        </button>
                    </form>
                </div>
            )}

            {/* Floating button */}
            <button
                data-tour="ai-button"
                style={{
                    position: "fixed", bottom: 20, right: 20, zIndex: 9999,
                    backgroundColor: colors.accent, color: colors.surface,
                    borderRadius: radii.full, width: 72, height: 72,
                    border: "none", cursor: "pointer", fontWeight: font.weightBold,
                    fontSize: font.sizeMd, boxShadow: shadows.lg, transition,
                }}
                onClick={toggleChat}
            >
                ☕ Ask AI
            </button>
        </>
    );
}
