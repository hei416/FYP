import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { colors, radii, font, spacing, btn, shadows, transition } from './theme';
import { ProgressTracker } from './ProgressTracker';

const progressTracker = new ProgressTracker();

export default function AI({ showChat, setShowChat, setSelectedPdf, setTargetPage }) {
    // Removed: const [showChat, setShowChat] = useState(false);
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    
    const [splitView, setSplitView] = useState(false);
    const [history, setHistory] = useState([]);
    const [userInput, setUserInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [expandedChunk, setExpandedChunk] = useState(null);
    const [chunkContext, setChunkContext] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    const toggleSplitView = () => setSplitView((v) => !v);
    const toggleChat = () => setShowChat((v) => !v); // This now uses the prop

    // Fetch surrounding chunks for context
    const fetchChunkContext = async (sourceFile, chunkContent) => {
        setLoadingContext(true);
        try {
            const res = await fetch(`${API_BASE}/api/get-chunk-context`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_file: sourceFile,
                    chunk_content: chunkContent
                }),
            });
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            setChunkContext(data);
        } catch (e) {
            console.error("Error fetching context:", e);
            alert("Failed to load context: " + e.message);
        }
        setLoadingContext(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        const userMessage = {
            role: "user",
            content: userInput,
        };
        setHistory((prev) => [...prev, userMessage]);
        setUserInput("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/ragAI`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_input: userInput,
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

            // Track AI tutor interaction in progress
            progressTracker.trackAIInteraction();
        } catch (e) {
            setHistory((prev) => [
                ...prev,
                { role: "assistant", content: "Error: " + e.message },
            ]);
        }

        setLoading(false);
    };

    const renderAIMessage = (msg, msgIndex) => {
        return (
            <div>
                {/* Main answer */}
                <div style={{ marginBottom: 10 }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* Performance metrics */}
                {msg.debug_log && (
                    <div style={{
                        fontSize: font.sizeSm,
                        color: colors.textMuted,
                        marginTop: spacing.sm,
                        padding: '8px 10px',
                        backgroundColor: colors.divider,
                        borderRadius: radii.sm,
                    }}>
                        ⚡ {msg.debug_log.response_time_sec}s 
                        
                    </div>
                )}

                {/* Source chunks */}
                {msg.pdf_matches && msg.pdf_matches.length > 0 && (
                    <div style={{
                        marginTop: spacing.lg,
                        paddingTop: spacing.lg,
                        borderTop: `1px solid ${colors.border}`,
                    }}>
                        <div style={{
                            fontSize: font.sizeMd,
                            fontWeight: font.weightBold,
                            color: colors.textSecondary,
                            marginBottom: spacing.sm,
                        }}>
                            📚 Retrieved Sources ({msg.pdf_matches.length}):
                        </div>
                        
                        {msg.pdf_matches.map((m, i) => {
                            const chunkKey = `${msgIndex}-${i}`;
                            const isExpanded = expandedChunk === chunkKey;
                            const hasContext = chunkContext && expandedChunk === chunkKey;
                            
                            return (
                                <div key={i} style={{ marginBottom: 10 }}>
                                    {/* Source title button */}
                                    <button
                                        style={{
                                            backgroundColor: isExpanded ? colors.success : colors.primary,
                                            color: colors.surface,
                                            padding: '12px 16px',
                                            borderRadius: radii.md,
                                            border: "none",
                                            cursor: "pointer",
                                            fontSize: font.sizeMd,
                                            fontWeight: font.weightSemibold,
                                            width: "100%",
                                            textAlign: "left",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            transition,
                                        }}
                                        onClick={() => {
                                            if (isExpanded) {
                                                setExpandedChunk(null);
                                                setChunkContext(null);
                                            } else {
                                                setExpandedChunk(chunkKey);
                                            }
                                        }}
                                    >
                                        <span>
                                            {isExpanded ? "📖" : "📄"} {m.file.replace(".txt", "").split("/").pop()}
                                        </span>
                                        <span style={{ fontSize: font.sizeSm, opacity: 0.9 }}>
                                            {isExpanded ? "▼ Collapse" : "▶ Expand"}
                                        </span>
                                    </button>

                                    {/* Retrieved chunk (always shown when expanded) */}
                                    {isExpanded && (
                                        <div style={{
                                            marginTop: spacing.sm,
                                            padding: spacing.lg,
                                            backgroundColor: colors.warningLight,
                                            borderRadius: radii.md,
                                            border: `2px solid ${colors.warningBorder}`,
                                            fontSize: font.sizeMd,
                                            lineHeight: 1.8,
                                            whiteSpace: "pre-wrap",
                                            maxHeight: 400,
                                            overflowY: "auto",
                                            fontFamily: "Georgia, serif"
                                        }}>
                                            <div style={{
                                                fontSize: 14,
                                                color: "#92400e",
                                                marginBottom: 12,
                                                fontWeight: "bold",
                                                fontFamily: "system-ui",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center"
                                            }}>
                                                <span>📄 Retrieved Paragraph:</span>
                                                <button
                                                    style={{
                                                        backgroundColor: "#3b82f6",
                                                        color: "white",
                                                        border: "none",
                                                        padding: "6px 12px",
                                                        borderRadius: 5,
                                                        fontSize: 13,
                                                        cursor: "pointer",
                                                        fontWeight: 600,
                                                    }}
                                                    onClick={() => {
                                                        if (hasContext) {
                                                            setChunkContext(null);
                                                        } else {
                                                            fetchChunkContext(m.file, m.snippet);
                                                        }
                                                    }}
                                                    disabled={loadingContext}
                                                >
                                                    {loadingContext ? "⏳ Loading..." : 
                                                     hasContext ? "Hide Context" : "🔍 Show Context"}
                                                </button>
                                            </div>
                                            {m.snippet}
                                        </div>
                                    )}

                                    {/* Context view (chunks before and after) */}
                                    {isExpanded && hasContext && (
                                        <div style={{
                                            marginTop: spacing.sm,
                                            padding: spacing.lg,
                                            backgroundColor: colors.primaryLight,
                                            borderRadius: radii.md,
                                            border: `2px solid ${colors.primaryBorder}`,
                                            maxHeight: 500,
                                            overflowY: "auto",
                                        }}>
                                            <div style={{
                                                fontSize: font.sizeSm,
                                                color: colors.primary,
                                                marginBottom: spacing.md,
                                                fontWeight: font.weightBold,
                                            }}>
                                                📚 Full Context ({chunkContext.chunks.length} chunks, {chunkContext.total_chunks} total in document):
                                            </div>
                                            
                                            {chunkContext.chunks.map((chunk, idx) => {
                                                const isTarget = idx === chunkContext.target_index;
                                                
                                                return (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            padding: 14,
                                                            marginBottom: 10,
                                                            backgroundColor: isTarget ? "#fef3c7" : "#ffffff",
                                                            border: isTarget ? "3px solid #f59e0b" : "1px solid #e5e7eb",
                                                            borderRadius: 6,
                                                            fontSize: 13,
                                                            lineHeight: 1.8,
                                                            whiteSpace: "pre-wrap",
                                                            fontFamily: "Georgia, serif",
                                                            position: "relative"
                                                        }}
                                                    >
                                                        {isTarget && (
                                                            <div style={{
                                                                position: "absolute",
                                                                top: -10,
                                                                left: 10,
                                                                backgroundColor: "#f59e0b",
                                                                color: "white",
                                                                padding: "3px 10px",
                                                                borderRadius: 4,
                                                                fontSize: 10,
                                                                fontWeight: "bold",
                                                                fontFamily: "system-ui"
                                                            }}>
                                                                ⭐ RETRIEVED CHUNK
                                                            </div>
                                                        )}
                                                        <div style={{
                                                            fontSize: 13,
                                                            color: "#6b7280",
                                                            marginBottom: 6,
                                                            fontFamily: "system-ui",
                                                            fontStyle: "italic"
                                                        }}>
                                                            {isTarget ? "→ This paragraph was used in the answer" : 
                                                             idx < chunkContext.target_index ? "↑ Previous chunk" : "↓ Next chunk"}
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
                    top: splitView ? 0 : 64,
                    right: splitView ? 0 : 20,
                    left: splitView ? 0 : "auto",
                    bottom: splitView ? 0 : "auto",
                    width: splitView ? "100vw" : 800,
                    height: splitView ? "100vh" : "75vh",
                    backgroundColor: colors.surface,
                    boxShadow: shadows.lg,
                    borderRadius: splitView ? 0 : radii.lg,
                    zIndex: 10000,
                    display: "flex",
                    flexDirection: "column",
                }}>
                    {/* Header */}
                    <div style={{
                        padding: spacing.lg,
                        borderBottom: `1px solid ${colors.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: colors.accent,
                        borderRadius: `${radii.lg}px ${radii.lg}px 0 0`,
                        color: colors.surface
                    }}>
                        <h3 style={{ margin: 0, fontSize: font.sizeLg, fontWeight: font.weightSemibold }}>☕ AI Java Tutor</h3>
                        <div>
                            <button
                                onClick={toggleSplitView}
                                style={{
                                    ...btn.small,
                                    marginRight: spacing.sm,
                                    padding: "6px 12px",
                                    cursor: "pointer",
                                    borderRadius: radii.sm,
                                    border: "none",
                                    backgroundColor: colors.surface,
                                    color: colors.accent,
                                    fontWeight: font.weightSemibold
                                }}
                            >
                                {splitView ? "⬇ Shrink" : "⬆ Enlarge"}
                            </button>
                            <button
                                onClick={toggleChat}
                                style={{
                                    padding: "6px 12px",
                                    cursor: "pointer",
                                    borderRadius: radii.sm,
                                    border: "none",
                                    backgroundColor: colors.danger,
                                    color: colors.surface,
                                    fontWeight: font.weightSemibold
                                }}
                            >
                                ✕ Close
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1,
                        padding: spacing.lg,
                        overflowY: "auto",
                        backgroundColor: colors.bg,
                    }}>
                        {history.map((msg, idx) => (
                            <div key={idx} style={{
                                display: "flex",
                                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                marginBottom: spacing.lg,
                            }}>
                                <div style={{
                                    padding: spacing.lg,
                                    borderRadius: radii.md,
                                    backgroundColor: msg.role === "user" ? colors.primary : colors.surface,
                                    color: msg.role === "user" ? colors.surface : colors.text,
                                    boxShadow: shadows.sm,
                                    maxWidth: "90%",
                                    wordBreak: "break-word",
                                }}>
                                    {msg.role === "assistant" ? (
                                        renderAIMessage(msg, idx)
                                    ) : (
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input form */}
                    <form
                        onSubmit={handleSubmit}
                        style={{
                            padding: spacing.lg,
                            borderTop: `2px solid ${colors.border}`,
                            backgroundColor: colors.surface,
                            borderRadius: `0 0 ${radii.lg}px ${radii.lg}px`
                        }}
                    >
                        <TextareaAutosize
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Ask anything about Java..."
                            minRows={2}
                            maxRows={6}
                            style={{
                                width: "100%",
                                padding: spacing.sm,
                                marginBottom: spacing.sm,
                                borderRadius: radii.sm,
                                border: `2px solid ${colors.border}`,
                                fontSize: font.sizeMd,
                                fontFamily: font.family
                            }}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            style={loading ? btn.disabled : btn.accent}
                        >
                            {loading ? "⏳ Thinking..." : "📤 Send"}
                        </button>
                    </form>
                </div>
            )}

            {/* Floating button */}
            <button 
                data-tour="ai-button"
                style={{
                    position: "fixed",
                    bottom: 20,
                    right: 20,
                    zIndex: 9999,
                    backgroundColor: colors.accent,
                    color: colors.surface,
                    borderRadius: radii.full,
                    width: 72,
                    height: 72,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: font.weightBold,
                    fontSize: font.sizeMd,
                    boxShadow: shadows.lg,
                    transition,
                }}
                onClick={toggleChat}
            >
                ☕ Ask AI
            </button>
        </>
    );
}
