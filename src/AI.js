import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";

export default function AI({ setSelectedPdf, setTargetPage }) {
    const [showChat, setShowChat] = useState(false);
    const [splitView, setSplitView] = useState(false);
    const [history, setHistory] = useState([]);
    const [userInput, setUserInput] = useState("");
    const [codeSnippet, setCodeSnippet] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    const toggleSplitView = () => setSplitView((v) => !v);
    const toggleChat = () => setShowChat((v) => !v);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userInput.trim()) return;

                    const userMessage = {
                        role: "user",
                        content: codeSnippet
                            ? `${userInput || ""}\n\ncode:\n\n${codeSnippet}`
                            : userInput || "User did not provide a question.",
                    };
        setHistory((prev) => [...prev, userMessage]);
        setUserInput("");
        setCodeSnippet("");
        setLoading(true);

        try {
            const res = await fetch("http://localhost:8000/ragAI", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_input: userInput,
                    code_snippet: codeSnippet,
                    history: [...history, userMessage],
                }),
            });
            const data = await res.json();
            const aiMessage = { role: "assistant", content: data.final_answer || "AI did not provide a response." };
            const matchMessage = {
                role: "matches",
                content: data.debug_log?.pdf_matches || [],
            };
            setHistory((prev) => [...prev, aiMessage, matchMessage]);
        } catch (e) {
            setHistory((prev) => [
                ...prev,
                { role: "assistant", content: "Error: " + e.message },
            ]);
        }

        setLoading(false);
    };

    return (
        <>
            {showChat && (
                <div
                    style={{
                        position: "fixed",
                        top: 70,
                        right: 20,
                        width: splitView ? 600 : 400,
                        height: splitView ? "80vh" : "60vh",
                        backgroundColor: "white",
                        boxShadow: "0 0 15px rgba(0,0,0,0.3)",
                        borderRadius: 8,
                        zIndex: 10000,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div
                        style={{
                            padding: 12,
                            borderBottom: "1px solid #ccc",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            backgroundColor: "#eee",
                        }}
                    >
                        <h3 style={{ margin: 0 }}>AI Java Tutor</h3>
                        <div>
                            <button
                                onClick={toggleSplitView}
                                style={{
                                    marginRight: 8,
                                    padding: "4px 10px",
                                    cursor: "pointer",
                                    borderRadius: 4,
                                    border: "1px solid #128C7E",
                                    backgroundColor: splitView ? "#128C7E" : "white",
                                    color: splitView ? "white" : "#128C7E",
                                }}
                                title="Toggle enlarge/shrink chat"
                            >
                                {splitView ? "Shrink" : "Enlarge"}
                            </button>
                            <button
                                onClick={() => setShowChat(false)}
                                style={{
                                    padding: "4px 10px",
                                    cursor: "pointer",
                                    borderRadius: 4,
                                    border: "1px solid #ccc",
                                    backgroundColor: "white",
                                }}
                                title="Close chat"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    <div
                        style={{
                            flex: 1,
                            padding: 12,
                            overflowY: "auto",
                            backgroundColor: "#f0f0f0",
                        }}
                    >
                        {history.map((msg, idx) => {
                            if (msg.role === "matches") {
                                if (msg.content.length) {
                                    return (
                                        <div key={idx} style={{ marginBottom: 12 }}>
                                            <strong> Matched PDF Pages:</strong>
                                            {msg.content.map((m, i) => (
                                                <div key={i} style={{ marginTop: 8 }}>
                                                    <button
                                                        style={{
                                                            backgroundColor: "#007AFF",
                                                            color: "white",
                                                            padding: "6px 12px",
                                                            borderRadius: 6,
                                                            border: "none",
                                                            cursor: "pointer",
                                                        }}
                                                        onClick={() => {
                                                            setSelectedPdf(m.file);
                                                            setTargetPage(m.page);
                                                        }}
                                                    >
                                                        {m.file} — Page {m.page}
                                                    </button>
                                                    <div style={{ fontSize: 12, marginTop: 4 }}>
                                                        {m.snippet.slice(0, 100)}...
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                } else {
                                    return null; // Render nothing if no matches
                                }
                            }

                            return (
                                <div
                                    key={idx}
                                    style={{
                                        display: "flex",
                                        justifyContent:
                                            msg.role === "user" ? "flex-end" : "flex-start",
                                        marginBottom: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: 12,
                                            borderRadius: 12,
                                            backgroundColor:
                                                msg.role === "user" ? "#007AFF" : "white",
                                            color: msg.role === "user" ? "white" : "black",
                                            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                            width: "100%",
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        style={{
                            padding: 12,
                            borderTop: "1px solid #ccc",
                            backgroundColor: "white",
                        }}
                    >
                        <TextareaAutosize
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Type your question..."
                            minRows={2}
                            maxRows={6}
                            style={{
                                width: "100%",
                                padding: 8,
                                marginBottom: 8,
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                fontSize: 14,
                            }}
                        />
                        <TextareaAutosize
                            value={codeSnippet}
                            onChange={(e) => setCodeSnippet(e.target.value)}
                            placeholder="Optional: Paste your Java code"
                            minRows={2}
                            maxRows={6}
                            style={{
                                width: "100%",
                                padding: 8,
                                marginBottom: 8,
                                fontFamily: "monospace",
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                fontSize: 14,
                            }}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                backgroundColor: "#128C7E",
                                color: "white",
                                padding: "8px 16px",
                                border: "none",
                                borderRadius: 6,
                                fontWeight: "bold",
                                cursor: loading ? "not-allowed" : "pointer",
                            }}
                        >
                            {loading ? "Thinking..." : "Send"}
                        </button>
                    </form>
                </div>
            )}

            <button
                style={{
                    position: "fixed",
                    bottom: 20,
                    right: 20,
                    zIndex: 9999,
                    backgroundColor: "#128C7E",
                    color: "white",
                    borderRadius: "50%",
                    width: 80,
                    height: 56,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: 16,
                    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                }}
                onClick={toggleChat}
                title="Ask AI"
            >
                Ask AI
            </button>
        </>
    );
}
