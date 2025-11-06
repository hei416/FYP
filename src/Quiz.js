import React, { useState, useEffect } from "react";
import quizData from "./quizQuestions.json";

const questionTypes = [
    { label: "All", value: "all" },
    { label: "Short Answer", value: "short_answer" },
    { label: "Code Trace", value: "code_trace" },
    { label: "Multiple Choice", value: "multiple_choice" },
    { label: "Code Understanding", value: "code_understanding" },
    { label: "Java Syntax", value: "syntax" },
];

function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

export default function Quiz() {
    const [selectedType, setSelectedType] = useState("all");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [feedback, setFeedback] = useState(null);
    const [shuffledOptions, setShuffledOptions] = useState([]);
    const [score, setScore] = useState(0);
    const [completed, setCompleted] = useState(false);
    // Store user answers for all questions to show after quiz ends
    const [allUserAnswers, setAllUserAnswers] = useState({});

    const filteredQuestions =
        selectedType === "all"
            ? quizData
            : quizData.filter((q) => q.type === selectedType);

    const currentQ = filteredQuestions[currentIndex] || null;

    useEffect(() => {
        if (currentQ?.type === "multiple_choice") {
            setShuffledOptions(shuffleArray([...currentQ.options]));
        } else {
            setShuffledOptions([]);
        }

        if (currentQ) {
            if (currentQ.type === "code_trace" || currentQ.type === "syntax") {
                const blanksCount = currentQ.blanks?.length || 0;
                const initAnswers = {};
                for (let i = 0; i < blanksCount; i++) {
                    initAnswers[i] = "";
                }
                setUserAnswers(initAnswers);
            } else {
                setUserAnswers({ answer: "" });
            }
        }
        setFeedback(null);
    }, [currentIndex, selectedType, currentQ]);

    if (!currentQ && !completed) return <p>No questions of this type.</p>;

    // Handle input changes, support multiple blanks or single answer
    const handleInputChange = (e, index = null) => {
        const value = e.target.value;
        if (index !== null) {
            setUserAnswers((prev) => ({ ...prev, [index]: value }));
        } else {
            setUserAnswers({ answer: value });
        }
    };

    const checkAnswer = () => {
        if (!currentQ) return;
        let isCorrect = false;
        if (
            currentQ.type === "short_answer" ||
            currentQ.type === "code_understanding"
        ) {
            isCorrect = (userAnswers.answer || "").trim() === currentQ.answer;
        } else if (currentQ.type === "code_trace") {
            isCorrect = currentQ.answers.every(
                (ans, idx) => ans.trim() === (userAnswers[idx] || "").trim()
            );
        } else if (currentQ.type === "syntax") {
            isCorrect = currentQ.answers.every(
                (ans, idx) =>
                    (userAnswers[idx] || "").toLowerCase().trim() ===
                    ans.toLowerCase().trim()
            );
        } else if (currentQ.type === "multiple_choice") {
            isCorrect = userAnswers.answer === currentQ.answer;
        }

        setFeedback(isCorrect ? "Correct!" : "Incorrect. Try again.");

        if (isCorrect) {
            setScore((prev) => prev + 1);
        }

        // Save user's answer for review later
        setAllUserAnswers((prev) => ({
            ...prev,
            [currentIndex]: { ...userAnswers },
        }));
    };

    const nextQuestion = () => {
        setFeedback(null);
        setUserAnswers({});
        if (currentIndex + 1 === filteredQuestions.length) {
            // Quiz completed
            setCompleted(true);
        } else {
            setCurrentIndex((idx) => idx + 1);
        }
    };

    // Show review after quiz ends
    if (completed) {
        return (
            <div style={{ padding: 20, maxWidth: 800, margin: "auto" }}>
                <h2>Quiz Completed!</h2>
                <p>
                    Your score: {score} out of {filteredQuestions.length}
                </p>
                <h3>Review your answers:</h3>
                {filteredQuestions.map((q, idx) => {
                    const userAns = allUserAnswers[idx];
                    return (
                        <div
                            key={idx}
                            style={{
                                marginBottom: 20,
                                padding: 10,
                                border: "1px solid #ccc",
                                borderRadius: 8,
                            }}
                        >
                            <p>
                                <strong>Q{idx + 1}:</strong> {q.question}
                            </p>

                            {/* Show code blocks if present */}
                            {q.javaCode && (
                                <pre
                                    style={{
                                        backgroundColor: "#272822",
                                        color: "#f8f8f2",
                                        padding: 16,
                                        borderRadius: 8,
                                        fontFamily: "Source Code Pro, monospace",
                                        whiteSpace: "pre-wrap",
                                        overflowX: "auto",
                                    }}
                                >
                  {q.javaCode}
                </pre>
                            )}
                            {q.codeSnippet && (
                                <pre
                                    style={{
                                        background: "#f0f0f0",
                                        padding: 10,
                                        whiteSpace: "pre-wrap",
                                        fontFamily: "monospace",
                                        borderRadius: 6,
                                    }}
                                >
                  {q.codeSnippet}
                </pre>
                            )}

                            <p>
                                <strong>Your answer:</strong>{" "}
                                {q.type === "syntax" || q.type === "code_trace"
                                    ? q.blanks
                                        .map((_, i) => userAns?.[i] ?? "(no answer)")
                                        .join(", ")
                                    : userAns?.answer || "(no answer)"}
                            </p>
                            <p>
                                <strong>Correct answer:</strong>{" "}
                                {q.type === "syntax" || q.type === "code_trace"
                                    ? q.answers.join(", ")
                                    : q.answer}
                            </p>
                        </div>
                    );
                })}

                <button
                    onClick={() => {
                        setCompleted(false);
                        setScore(0);
                        setAllUserAnswers({});
                        setCurrentIndex(0);
                        setSelectedType("all");
                    }}
                    style={{
                        marginTop: 12,
                        padding: "8px 20px",
                        cursor: "pointer",
                        backgroundColor: "#128C7E",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        fontWeight: "bold",
                        fontSize: 16,
                    }}
                >
                    Restart Quiz
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: 20, maxWidth: 800, margin: "auto" }}>
            {/* Question type selector */}
            <div style={{ marginBottom: 16 }}>
                {questionTypes.map(({ label, value }) => (
                    <button
                        key={value}
                        onClick={() => {
                            setSelectedType(value);
                            setCurrentIndex(0);
                            setScore(0);
                            setCompleted(false);
                            setAllUserAnswers({});
                        }}
                        style={{
                            marginRight: 8,
                            padding: "6px 12px",
                            backgroundColor: selectedType === value ? "#128C7E" : "#eee",
                            color: selectedType === value ? "white" : "black",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <h3>
                Question {currentIndex + 1} of {filteredQuestions.length}
            </h3>
            <p>{currentQ.question}</p>

            {currentQ.javaCode && (
                <pre
                    style={{
                        backgroundColor: "#272822",
                        color: "#f8f8f2",
                        padding: 16,
                        borderRadius: 8,
                        fontFamily: "Source Code Pro, monospace",
                        whiteSpace: "pre-wrap",
                        overflowX: "auto",
                    }}
                >
          {currentQ.javaCode}
        </pre>
            )}

            {currentQ.codeSnippet && (
                <pre
                    style={{
                        background: "#f0f0f0",
                        padding: 10,
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        borderRadius: 6,
                    }}
                >
          {currentQ.codeSnippet}
        </pre>
            )}

            {/* Single answer input */}
            {["short_answer", "code_understanding"].includes(currentQ.type) && (
                <input
                    type="text"
                    placeholder="Type your answer"
                    value={userAnswers.answer || ""}
                    onChange={(e) => handleInputChange(e)}
                    style={{ width: "100%", padding: 8, fontSize: 16 }}
                />
            )}

            {/* Multiple blanks for code_trace */}
            {currentQ.type === "code_trace" && (
                <div>
                    {currentQ.blanks.map((blank, idx) => (
                        <div key={idx} style={{ marginBottom: 8 }}>
                            <label>
                                {blank} ={" "}
                                <input
                                    type="text"
                                    value={userAnswers[idx] || ""}
                                    onChange={(e) => handleInputChange(e, idx)}
                                    style={{ width: 80, padding: 4, fontSize: 16 }}
                                />
                            </label>
                        </div>
                    ))}
                </div>
            )}

            {/* Multiple blanks for syntax */}
            {currentQ.type === "syntax" && (
                <div>
                    {currentQ.blanks.map((_, idx) => (
                        <div key={idx} style={{ marginBottom: 8 }}>
                            <label>
                                Blank {idx + 1}:{" "}
                                <input
                                    type="text"
                                    value={userAnswers[idx] || ""}
                                    onChange={(e) => handleInputChange(e, idx)}
                                    style={{ width: "100%", padding: 8 }}
                                />
                            </label>
                        </div>
                    ))}
                </div>
            )}

            {/* Multiple choice */}
            {currentQ.type === "multiple_choice" && (
                <div>
                    {shuffledOptions.map((opt, idx) => (
                        <div key={idx} style={{ marginBottom: 6 }}>
                            <label>
                                <input
                                    type="radio"
                                    name="mcq"
                                    value={opt}
                                    checked={userAnswers.answer === opt}
                                    onChange={(e) => handleInputChange(e)}
                                />{" "}
                                {opt}
                            </label>
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={checkAnswer}
                disabled={feedback === "Correct!"}
                style={{
                    marginTop: 12,
                    padding: "8px 20px",
                    cursor: feedback === "Correct!" ? "not-allowed" : "pointer",
                    backgroundColor: feedback === "Correct!" ? "#aaa" : "#128C7E",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: "bold",
                    fontSize: 16,
                }}
            >
                Check Answer
            </button>

            {feedback && (
                <p
                    style={{
                        marginTop: 12,
                        color: feedback === "Correct!" ? "green" : "red",
                        fontWeight: "bold",
                    }}
                >
                    {feedback}
                </p>
            )}

            {feedback === "Correct!" && (
                <button
                    onClick={nextQuestion}
                    style={{
                        marginTop: 12,
                        padding: "6px 12px",
                        cursor: "pointer",
                        backgroundColor: "#007AFF",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                    }}
                >
                    Next Question
                </button>
            )}

            {/* Show current score in the quiz */}
            <p style={{ marginTop: 20, fontWeight: "bold" }}>
                Score: {score} / {filteredQuestions.length}
            </p>
        </div>
    );
}
