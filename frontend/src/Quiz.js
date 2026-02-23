import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ProgressTracker } from "./ProgressTracker";

const DEFAULT_TOPICS = [
    "Bridging from Python",
    "Problem Solving with Java",
    "String",
    "Array",
    "Methods",
    "Exception Handling and File IO",
    "Class - constructor/attributes/methods",
    "Class - access modifier/static",
    "Inheritance",
    "Polymorphism",
    "Interface and Lambda expression",
    "Recursion and Revision"
];

function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

export default function Quiz() {
    const selectedType = "multiple_choice";
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [feedback, setFeedback] = useState(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [shuffledOptions, setShuffledOptions] = useState([]);
    const [score, setScore] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [allUserAnswers, setAllUserAnswers] = useState({});
    const [showExplanation, setShowExplanation] = useState(false);

    // Topic selection state
    const [showTopicSelect, setShowTopicSelect] = useState(true);
    const [selectedTopics, setSelectedTopics] = useState([]);

    // AI quiz state
    const isFetchingRef = useRef(false);
    const [quizData, setQuizData] = useState([]);
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [quizSource, setQuizSource] = useState("");

    const tracker = useMemo(() => new ProgressTracker(), []);

   const generateAIQuiz = useCallback(async (topicsOverride = null) => {
        if (isFetchingRef.current) return; // ← block duplicate calls
        isFetchingRef.current = true;

        setLoadingQuiz(true);
        setQuizData([]);
        setCurrentIndex(0);
        setScore(0);
        setCompleted(false);
        setAllUserAnswers({});

        try {
            const completedTopics = tracker.getCompletedTopics();
            const topicsToUse = topicsOverride || (completedTopics.length > 0 ? completedTopics : DEFAULT_TOPICS);
            const sourceLabel = topicsOverride ? "selected topics" : (completedTopics.length > 0 ? "completed topics" : "default topics");

            setQuizSource(
                `AI-generated from ${sourceLabel}: ${topicsToUse.slice(0, 3).join(", ")}${topicsToUse.length > 3 ? "..." : ""}`
            );

            const res = await fetch("http://localhost:8000/api/quizzes/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    completed_topics: topicsToUse,
                    num_questions: 10
                })
            });

            if (!res.ok) {
                throw new Error(`Backend error: ${res.status}`);
            }

            const data = await res.json();
            const normalized = data.questions.map((q) => ({
                ...q,
                type: q.type ?? (Array.isArray(q.options) ? "multiple_choice" : "short_answer")
            }));
            const filtered = normalized.filter(
                (q) => selectedType === "all" || q.type === selectedType
            );

            setQuizData(filtered);
            tracker.trackAIInteraction();
        } catch (error) {
            console.error("Quiz generation failed:", error);
            alert("Failed to generate quiz. Make sure backend is running.");
            setQuizData([]);
        } finally {
            setLoadingQuiz(false);
            isFetchingRef.current = false;
            setShowTopicSelect(false);
        }
    }, [tracker]);



    const filteredQuestions =
        selectedType === "all" ? quizData : quizData.filter((q) => q.type === selectedType);

    const currentQ = filteredQuestions[currentIndex] || null;

    useEffect(() => {
        if (!currentQ?.options) {
            setShuffledOptions([]);
            return;
        }
        setShuffledOptions(shuffleArray([...currentQ.options]));
        if (currentQ.type === "code_trace" || currentQ.type === "syntax") {
            // ... blank logic
        } else {
            setUserAnswers({ answer: "" });
        }
        setFeedback(null);
        setShowExplanation(false);
        setHasAnswered(false);
    }, [currentIndex, selectedType, currentQ]);


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

    console.log("🔍 DEBUG currentQ:", JSON.stringify(currentQ, null, 2));
    console.log("🔍 userAnswers:", userAnswers);

    let isCorrect = false;
    let correctAnswer = "";

    // backend has no "type" field - treat all questions with options as MCQ
    if (Array.isArray(currentQ.options) && currentQ.correct_index !== undefined) {
        correctAnswer = currentQ.options[currentQ.correct_index];
        isCorrect = userAnswers.answer === correctAnswer;
        console.log(`✅ Compare: "${userAnswers.answer}" === "${correctAnswer}" = ${isCorrect}`);
    } else if (currentQ.answer) {
        correctAnswer = currentQ.answer;
        isCorrect = (userAnswers.answer || "").trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    } else {
        console.log("❌ Unknown question format");
    }

    const feedbackMsg = isCorrect ? "✅ Correct!" : `❌ Incorrect. Correct: "${correctAnswer}"`;
    setFeedback(feedbackMsg);
    setHasAnswered(true);
    if (isCorrect) setScore((prev) => prev + 1);
    setAllUserAnswers((prev) => ({ ...prev, [currentIndex]: { ...userAnswers } }));
};




    const nextQuestion = () => {
        setFeedback(null);
        setUserAnswers({});
        if (currentIndex + 1 === filteredQuestions.length) {
            setCompleted(true);
        } else {
            setCurrentIndex((idx) => idx + 1);
        }
    };

    // NEW: Topic Selection Screen
    if (showTopicSelect) {
        return (
            <div style={{ padding: 20, maxWidth: 800, margin: "auto", textAlign: "center" }}>
                <h2>🎯 Select Quiz Topics</h2>
                <p>Choose topics to quiz yourself on (or use auto-detection):</p>
                <button
                    onClick={() => setSelectedTopics(DEFAULT_TOPICS)}
                    style={{
                        marginBottom: 12,
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid #128C7E",
                        background: "white",
                        color: "#128C7E",
                        cursor: "pointer",
                        fontWeight: "bold"
                    }}
                >
                    All Topics
                </button>
                
                <div style={{ 
                    maxHeight: 300, 
                    overflowY: "auto", 
                    margin: "20px 0",
                    padding: 10,
                    border: "2px solid #eee",
                    borderRadius: 8
                }}>
                    {DEFAULT_TOPICS.map((topic, idx) => (
                        <label key={idx} style={{ display: "block", margin: "8px 0" }}>
                            <input
                                type="checkbox"
                                checked={selectedTopics.includes(topic)}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedTopics(checked 
                                        ? [...selectedTopics, topic] 
                                        : selectedTopics.filter(t => t !== topic)
                                    );
                                }}
                            />{" "}
                            {topic}
                        </label>
                    ))}
                </div>

                <div>
                    <button
                        onClick={() => generateAIQuiz(selectedTopics.length > 0 ? selectedTopics : null)}
                        disabled={loadingQuiz}
                        style={{
                            padding: "12px 24px",
                            marginRight: 10,
                            backgroundColor: "#128C7E",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 16,
                            fontWeight: "bold",
                            cursor: loadingQuiz ? "not-allowed" : "pointer"
                        }}
                    >
                        {loadingQuiz ? "Generating..." : "🚀 Start Quiz"}
                    </button>
                    
                    <button
                        onClick={() => generateAIQuiz(null)} // Use auto-detection
                        disabled={loadingQuiz}
                        style={{
                            padding: "12px 24px",
                            backgroundColor: "#007AFF",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 16,
                            cursor: loadingQuiz ? "not-allowed" : "pointer"
                        }}
                    >
                        🤖 Auto-Detect Completed Topics
                    </button>
                </div>
            </div>
        );
    }

    if (loadingQuiz) {
        return (
            <div style={{ padding: 20, maxWidth: 800, margin: "auto", textAlign: "center" }}>
                <h2>Generating AI Quiz...</h2>
                <p>Fetching content from your selected topics</p>
            </div>
        );
    }

    if (!currentQ && !completed) {
        return (
            <div style={{ padding: 20, maxWidth: 800, margin: "auto", textAlign: "center" }}>
                <p>No questions available.</p>
                <button onClick={() => setShowTopicSelect(true)}>← Back to Topics</button>
            </div>
        );
    }

    if (completed) {
        return (
            <div style={{ padding: 20, maxWidth: 800, margin: "auto" }}>
                <h2>Quiz Completed! 🎉</h2>
                <p style={{ fontSize: 24, fontWeight: "bold", color: "#128C7E" }}>
                    Score: {score} / {filteredQuestions.length} ({Math.round((score / filteredQuestions.length) * 100)}%)
                </p>
                <h3>Review Answers:</h3>
                {filteredQuestions.map((q, idx) => {
                    const userAns = allUserAnswers[idx];
                    const correctAns = q.options ? q.options[q.correct_index] : q.answer;
                    const isCorrect = userAns?.answer === correctAns;
                    return (
                        <div
                            key={idx}
                            style={{
                                marginBottom: 20,
                                padding: 15,
                                border: `2px solid ${isCorrect ? "#4CAF50" : "#f44336"}`,
                                borderRadius: 8,
                                backgroundColor: isCorrect ? "#E8F5E8" : "#FFEBEE"
                            }}
                        >
                            <p><strong>Q{idx + 1}:</strong> {q.question}</p>
                            <p><strong>You:</strong> {userAns?.answer || "(no answer)"}</p>
                            <p><strong>Correct:</strong> {correctAns}</p>
                        </div>
                    );
                })}

                <button
                    onClick={() => {
                        setShowTopicSelect(true);
                        setScore(0);
                        setAllUserAnswers({});
                        setCurrentIndex(0);
                    }}
                    style={{
                        padding: "12px 24px",
                        backgroundColor: "#128C7E",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 16,
                        fontWeight: "bold",
                        cursor: "pointer"
                    }}
                >
                    🔄 New Quiz
                </button>
            </div>
        );
    }

    // Quiz in progress
    return (
        <div style={{ padding: 20, maxWidth: 800, margin: "auto" }}>
            <div style={{ marginBottom: 16 }}>
                <p><em>{quizSource}</em></p>
                <button
                    onClick={() => setShowTopicSelect(true)}
                    style={{
                        marginLeft: 8,
                        padding: "6px 12px",
                        backgroundColor: "#FF3B30",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer"
                    }}
                >
                    ← Change Topics
                </button>
            </div>

            <h3>Question {currentIndex + 1} of {filteredQuestions.length}</h3>
            <p style={{ fontSize: 16, lineHeight: 1.5 }}>{currentQ?.question}</p>

            {/* Multiple choice options */}
            {currentQ?.options && (
                <div style={{ margin: "20px 0" }}>
                    {shuffledOptions.map((opt, idx) => (
                        <div key={idx} style={{ marginBottom: 10 }}>
                            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="mcq"
                                    value={opt}
                                    checked={userAnswers.answer === opt}
                                    onChange={(e) => handleInputChange(e)}
                                    style={{ marginRight: 8 }}
                                />
                                <span style={{ fontSize: 15 }}>{opt}</span>
                            </label>
                        </div>
                    ))}
                </div>
            )}

            {/* Check Answer button */}
            <button
                onClick={checkAnswer}
                disabled={feedback?.startsWith("✅") || hasAnswered}
                style={{
                    padding: "12px 24px",
                    marginTop: 12,
                    cursor: feedback?.startsWith("✅") || hasAnswered ? "not-allowed" : "pointer",
                    backgroundColor: feedback?.startsWith("✅") || hasAnswered ? "#aaa" : "#128C7E",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: "bold",
                    fontSize: 16
                }}
            >
                {feedback?.startsWith("✅") ? "✅ Correct!" : "Check Answer"}
            </button>

            {feedback && (
                <p
                    style={{
                        marginTop: 16,
                        padding: "12px 16px",
                        borderRadius: 8,
                        fontWeight: "bold",
                        fontSize: 16,
                        backgroundColor: feedback.startsWith("✅") ? "#E8F5E8" : "#FFEBEE",
                        color: feedback.startsWith("✅") ? "#2E7D32" : "#C62828",
                        borderLeft: `4px solid ${feedback.startsWith("✅") ? "#4CAF50" : "#f44336"}`
                    }}
                >
                    {feedback}
                </p>
            )}
            {feedback && currentQ?.explanation && (
                <button
                    onClick={() => setShowExplanation((prev) => !prev)}
                    style={{
                        marginTop: 10,
                        padding: "8px 18px",
                        backgroundColor: "#FF9500",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: 15
                    }}
                >
                    {showExplanation ? "🙈 Hide Explanation" : "💡 Explain"}
                </button>
            )}

            {showExplanation && currentQ?.explanation && (
                <div
                    style={{
                        marginTop: 10,
                        padding: "12px 16px",
                        borderRadius: 8,
                        backgroundColor: "#FFF8E1",
                        color: "#5D4037",
                        borderLeft: "4px solid #FF9500",
                        fontSize: 15,
                        lineHeight: 1.6
                    }}
                >
                    <strong>💡 Explanation:</strong> {currentQ.explanation}
                </div>
            )}

            {hasAnswered && (
                <button
                    onClick={nextQuestion}
                    style={{
                        marginTop: 12,
                        padding: "10px 20px",
                        backgroundColor: "#007AFF",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: "bold"
                    }}
                >
                    Next Question →
                </button>
            )}

            <p style={{ marginTop: 24, fontWeight: "bold", fontSize: 18 }}>
                Score: {score} / {filteredQuestions.length}
            </p>
        </div>
    );
}
