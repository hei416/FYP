import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";

export default function AI({ showChat, setShowChat, setSelectedPdf, setTargetPage }) {
    // Removed: const [showChat, setShowChat] = useState(false);
    
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
            const res = await fetch("http://localhost:8000/api/get-chunk-context", {
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
            const res = await fetch("http://localhost:8000/ragAI", {
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
                        fontSize: 12,
                        color: "#666",
                        marginTop: 8,
                        padding: "8px 10px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: 5,
                    }}>
                        ⚡ {msg.debug_log.response_time_sec}s 
                        
                    </div>
                )}

                {/* Source chunks */}
                {msg.pdf_matches && msg.pdf_matches.length > 0 && (
                    <div style={{
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: "1px solid #e0e0e0",
                    }}>
                        <div style={{
                            fontSize: 13,
                            fontWeight: "bold",
                            color: "#555",
                            marginBottom: 10,
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
                                            backgroundColor: isExpanded ? "#28a745" : "#007AFF",
                                            color: "white",
                                            padding: "12px 16px",
                                            borderRadius: 8,
                                            border: "none",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            fontWeight: 600,
                                            width: "100%",
                                            textAlign: "left",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            transition: "all 0.2s",
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
                                        <span style={{ fontSize: 12, opacity: 0.9 }}>
                                            {isExpanded ? "▼ Collapse" : "▶ Expand"}
                                        </span>
                                    </button>

                                    {/* Retrieved chunk (always shown when expanded) */}
                                    {isExpanded && (
                                        <div style={{
                                            marginTop: 8,
                                            padding: 16,
                                            backgroundColor: "#fffbea",
                                            borderRadius: 8,
                                            border: "2px solid #fbbf24",
                                            fontSize: 14,
                                            lineHeight: 1.8,
                                            whiteSpace: "pre-wrap",
                                            maxHeight: 400,
                                            overflowY: "auto",
                                            fontFamily: "Georgia, serif"
                                        }}>
                                            <div style={{
                                                fontSize: 12,
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
                                                        fontSize: 11,
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
                                            marginTop: 8,
                                            padding: 16,
                                            backgroundColor: "#f0f9ff",
                                            borderRadius: 8,
                                            border: "2px solid #3b82f6",
                                            maxHeight: 500,
                                            overflowY: "auto",
                                        }}>
                                            <div style={{
                                                fontSize: 12,
                                                color: "#1e40af",
                                                marginBottom: 12,
                                                fontWeight: "bold",
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
                                                            fontSize: 11,
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
                    top: splitView ? 0 : 70,
                    right: splitView ? 0 : 20,
                    left: splitView ? 0 : "auto",
                    bottom: splitView ? 0 : "auto",
                    width: splitView ? "100vw" : 800,
                    height: splitView ? "100vh" : "75vh",
                    backgroundColor: "white",
                    boxShadow: "0 0 20px rgba(0,0,0,0.3)",
                    borderRadius: splitView ? 0 : 10,
                    zIndex: 10000,
                    display: "flex",
                    flexDirection: "column",
                }}>
                    {/* Header */}
                    <div style={{
                        padding: 14,
                        borderBottom: "1px solid #ccc",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: "#128C7E",
                        borderRadius: "10px 10px 0 0",
                        color: "white"
                    }}>
                        <h3 style={{ margin: 0 }}>☕ AI Java Tutor</h3>
                        <div>
                            <button
                                onClick={toggleSplitView}
                                style={{
                                    marginRight: 8,
                                    padding: "6px 12px",
                                    cursor: "pointer",
                                    borderRadius: 5,
                                    border: "none",
                                    backgroundColor: "white",
                                    color: "#128C7E",
                                    fontWeight: "600"
                                }}
                            >
                                {splitView ? "⬇ Shrink" : "⬆ Enlarge"}
                            </button>
                            <button
                                onClick={toggleChat}
                                style={{
                                    padding: "6px 12px",
                                    cursor: "pointer",
                                    borderRadius: 5,
                                    border: "none",
                                    backgroundColor: "#dc3545",
                                    color: "white",
                                    fontWeight: "600"
                                }}
                            >
                                ✕ Close
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1,
                        padding: 16,
                        overflowY: "auto",
                        backgroundColor: "#f0f0f0",
                    }}>
                        {history.map((msg, idx) => (
                            <div key={idx} style={{
                                display: "flex",
                                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                marginBottom: 16,
                            }}>
                                <div style={{
                                    padding: 14,
                                    borderRadius: 12,
                                    backgroundColor: msg.role === "user" ? "#007AFF" : "white",
                                    color: msg.role === "user" ? "white" : "black",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
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
                            padding: 14,
                            borderTop: "2px solid #ddd",
                            backgroundColor: "white",
                            borderRadius: "0 0 10px 10px"
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
                                padding: 10,
                                marginBottom: 10,
                                borderRadius: 8,
                                border: "2px solid #ddd",
                                fontSize: 14,
                                fontFamily: "system-ui"
                            }}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                backgroundColor: loading ? "#95a5a6" : "#128C7E",
                                color: "white",
                                padding: "10px 20px",
                                border: "none",
                                borderRadius: 8,
                                fontWeight: "bold",
                                fontSize: 14,
                                cursor: loading ? "not-allowed" : "pointer",
                            }}
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
                    backgroundColor: "#128C7E",
                    color: "white",
                    borderRadius: "50%",
                    width: 80,
                    height: 80,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: 16,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
                onClick={toggleChat}
            >
                ☕ Ask AI
            </button>
        </>
    );
}
