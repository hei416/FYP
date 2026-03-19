import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from './AuthContext';
import { useLocation } from "react-router-dom";
import { ProgressTracker, QUIZ_PASS_SCORE } from "./ProgressTracker";
import { TOPIC_GROUPS } from "./HomePage";
import { colors, radii, font, spacing, btn, card, pageContainer, pageHeading, pageSubheading, transition } from './theme';

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
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [feedback, setFeedback] = useState(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [shuffledOptions, setShuffledOptions] = useState([]);
    const [score, setScore] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [allUserAnswers, setAllUserAnswers] = useState({});
    const [showExplanation, setShowExplanation] = useState(false);
    const [openExplanations, setOpenExplanations] = useState({});

    // Topic selection state
    const [showTopicSelect, setShowTopicSelect] = useState(true);
    const [selectedTopics, setSelectedTopics] = useState([]);

    // AI quiz state
    const isFetchingRef = useRef(false);
    const [quizData, setQuizData] = useState([]);
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [quizSource, setQuizSource] = useState("");
    const [generatingMore, setGeneratingMore] = useState(false);
    const [moreProgress, setMoreProgress] = useState({ received: 0, total: 5 });
    const [poolSize, setPoolSize] = useState(0);
    const [lastTopics, setLastTopics] = useState([]);

    const tracker = useMemo(() => new ProgressTracker(), []);

    const location = useLocation();
    const { user: authUser } = useAuth();

    // Refs to avoid stale-closure issues in the completed effect
    const scoreRef = useRef(0);
    const filteredQuestionsRef = useRef([]);
    const allUserAnswersRef = useRef({});

    // Derived values must be declared before any useEffect that references them
    

    useEffect(() => { scoreRef.current = score; }, [score]);
    useEffect(() => { allUserAnswersRef.current = allUserAnswers; }, [allUserAnswers]);

    // Pre-populate selected topics if navigated from a milestone prompt
    useEffect(() => {
        const preSelected = location.state?.preSelectedTopics;
        if (preSelected && Array.isArray(preSelected) && preSelected.length > 0) {
            setSelectedTopics(preSelected);
        }
    }, [location.state]);

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
                // Resolve user id from AuthContext first, then fall back to common localStorage keys
                const userId = authUser?.id
                    || JSON.parse(localStorage.getItem('user') || 'null')?.id
                    || JSON.parse(localStorage.getItem('userData') || 'null')?.id
                    || JSON.parse(localStorage.getItem('currentUser') || 'null')?.id
                    || null;
                console.log('🔑 userId for quiz:', userId);
                const completedTopics = tracker.getCompletedTopics();
            // Only allow completed topics - no fallback to all topics
            const topicsToUse = topicsOverride || (completedTopics.length > 0 ? completedTopics : null);
            
            if (!topicsToUse || topicsToUse.length === 0) {
                alert("⚠️ You haven't completed any topics on the Roadmap yet. Complete some topics first so we can generate relevant questions!");
                setLoadingQuiz(false);
                isFetchingRef.current = false;
                return;
            }

            const sourceLabel = topicsOverride ? "selected topics" : "completed topics";

            setQuizSource(
                `AI-generated from ${sourceLabel}: ${topicsToUse.slice(0, 3).join(", ")}${topicsToUse.length > 3 ? "..." : ""}`
            );

            setLastTopics(topicsToUse);

            const res = await fetch(`${API_BASE}/api/quizzes/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    completed_topics: topicsToUse,
                    num_questions: 10,
                    user_id: userId || null,
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
            setPoolSize(data.metadata?.pool_size || filtered.length);
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
    }, [tracker, authUser]);



    const generateMoreQuestions = useCallback(async () => {
        if (isFetchingRef.current || lastTopics.length === 0) return;
        isFetchingRef.current = true;
        setGeneratingMore(true);
        setMoreProgress({ received: 0, total: 5 });

        // Reset quiz state for new questions
        setQuizData([]);
        setCurrentIndex(0);
        setScore(0);
        setCompleted(false);
        setAllUserAnswers({});
        setQuizSource(`✨ Generating new questions for: ${lastTopics.slice(0, 3).join(", ")}${lastTopics.length > 3 ? "..." : ""}`);
        setShowTopicSelect(false);

        try {
            // Resolve user id for streaming endpoint as well
            const userId = authUser?.id
                || JSON.parse(localStorage.getItem('user') || 'null')?.id
                || JSON.parse(localStorage.getItem('userData') || 'null')?.id
                || JSON.parse(localStorage.getItem('currentUser') || 'null')?.id
                || null;
            console.log('🔑 userId for streaming quiz:', userId);

            const res = await fetch(`${API_BASE}/api/quizzes/more`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    completed_topics: lastTopics,
                    num_questions: 5
                    , user_id: userId || null
                })
            });

            if (!res.ok) throw new Error(`Backend error: ${res.status}`);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let count = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const parsed = JSON.parse(jsonStr);

                        // Done signal
                        if (parsed.done) {
                            setPoolSize(parsed.total_pool || 0);
                            continue;
                        }

                        // Error from backend
                        if (parsed.error) {
                            console.warn("Stream error:", parsed.error);
                            continue;
                        }

                        // It's a question — append it
                        const q = {
                            ...parsed,
                            type: parsed.type ?? (Array.isArray(parsed.options) ? "multiple_choice" : "short_answer")
                        };
                        count++;
                        setMoreProgress((prev) => ({ ...prev, received: count }));
                        setQuizData((prev) => [...prev, q]);
                    } catch (parseErr) {
                        console.warn("SSE parse error:", parseErr, jsonStr);
                    }
                }
            }

            setQuizSource(`✨ ${count} new questions generated for: ${lastTopics.slice(0, 3).join(", ")}${lastTopics.length > 3 ? "..." : ""}`);
        } catch (error) {
            console.error("More questions streaming failed:", error);
            alert("Failed to generate more questions. Try again.");
        } finally {
            setGeneratingMore(false);
            isFetchingRef.current = false;
        }
    }, [lastTopics, authUser]);

    const filteredQuestions =
        selectedType === "all" ? quizData : quizData.filter((q) => q.type === selectedType);

    useEffect(() => { filteredQuestionsRef.current = filteredQuestions; }, [filteredQuestions]);

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

        // Log correct answer to browser console immediately when question loads
        try {
            if (currentQ?.options && currentQ.correct_index !== undefined) {
                console.log(`Q${currentIndex + 1} loaded | Correct: "${currentQ.options[currentQ.correct_index]}" | index: ${currentQ.correct_index}`);
            } else if (currentQ?.answer) {
                console.log(`Q${currentIndex + 1} loaded | Correct (text): "${currentQ.answer}"`);
            }
        } catch (e) {
            console.warn('Could not log correct answer:', e);
        }
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

    // (no-op) keep original behavior — do not persist debug state here
    const feedbackMsg = isCorrect ? "✅ Correct!" : `❌ Incorrect. Correct: "${correctAnswer}"`;
    setFeedback(feedbackMsg);
    setHasAnswered(true);
    if (isCorrect) setScore((prev) => prev + 1);
    setAllUserAnswers((prev) => ({ ...prev, [currentIndex]: { ...userAnswers } }));
};




    const nextQuestion = () => {
        setFeedback(null);
        setUserAnswers({});
        if (currentIndex + 1 >= filteredQuestions.length) {
            if (generatingMore) {
                // More questions are still streaming in — stay on the last question
                // The useEffect on currentQ will auto-update when a new question arrives
                setCurrentIndex(filteredQuestions.length); // will pick up next question when it arrives
            } else {
                setCompleted(true);
            }
        } else {
            setCurrentIndex((idx) => idx + 1);
        }
    };

    useEffect(() => {
        if (completed && filteredQuestionsRef.current.length > 0) {
            const scorePercent = Math.round((scoreRef.current / filteredQuestionsRef.current.length) * 100);
            const quizId = `quiz_${Date.now()}`;
            tracker.markQuizCompleted(quizId, scorePercent);
            window.dispatchEvent(new Event('progress-updated'));

            // Auto-save to My Work if logged in — use refs to ensure latest values
            const token = localStorage.getItem('authToken');
            if (token) {
                const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
                const reviewData = filteredQuestionsRef.current.map((q, idx) => ({
                    question_id: q.id,
                    question: q.question,
                    your_answer: allUserAnswersRef.current[idx]?.answer || '(no answer)',
                    correct_answer: q.options ? q.options[q.correct_index] : q.answer,
                    is_correct: (allUserAnswersRef.current[idx]?.answer) === (q.options ? q.options[q.correct_index] : q.answer),
                    explanation: q.explanation || '',
                }));
                fetch(`${API_BASE}/my-work/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        work_type: 'quiz',
                        title: `Quiz — ${lastTopics.slice(0, 2).join(', ')}${lastTopics.length > 2 ? '...' : ''}`,
                        topic_id: lastTopics[0] || null,
                        content: null,
                        result_data: {
                            score: scorePercent,
                            total_questions: filteredQuestionsRef.current.length,
                            correct: scoreRef.current,
                            topics: lastTopics,
                            review: reviewData,
                        },
                    }),
                }).catch(err => console.warn('saveWork failed:', err));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [completed]);

    // Topic Selection Screen
    if (showTopicSelect) {
        const completedTopics = tracker.getCompletedTopics();
        const topicGroupMap = {
            "Bridging from Python": 0,
            "Problem Solving with Java": 1,
            "String": 2,
            "Array": 3,
            "Methods": 4,
            "Exception Handling and File IO": 5,
            "Class - constructor/attributes/methods": 6,
            "Class - access modifier/static": 7,
            "Inheritance": 8,
            "Polymorphism": 9,
            "Interface and Lambda expression": 10,
            "Recursion and Revision": 11,
        };

        const isTopicAvailable = (topic) => {
            const groupIdx = topicGroupMap[topic];
            if (groupIdx === undefined) return false;
            const group = TOPIC_GROUPS[groupIdx];
            return Array.isArray(group?.subtopics) && group.subtopics.some((id) => completedTopics.includes(id));
        };

        const availableTopics = DEFAULT_TOPICS.filter(isTopicAvailable);

        return (
            <div style={pageContainer(800)}>
                <h2 style={pageHeading}>🎯 Select Quiz Topics</h2>
                <p style={pageSubheading}>
                    {availableTopics.length > 0
                        ? `${availableTopics.length} topic(s) completed. All topics are available — uncompleted ones are marked with ⚠️:`
                        : "All topics are available. Complete subtopics on the Roadmap to track your progress!"}
                </p>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {availableTopics.length > 0 && (
                        <button
                            onClick={() => setSelectedTopics([...availableTopics])}
                            style={{
                                ...btn.outline,
                            }}
                        >
                            Select All Completed Topics
                        </button>
                    )}
                    <button
                        onClick={() => setSelectedTopics([...DEFAULT_TOPICS])}
                        style={{
                            ...btn.outline,
                        }}
                    >
                        Select All Topics
                    </button>
                </div>

                <div
                    style={{
                        maxHeight: 350,
                        overflowY: "auto",
                        margin: "20px 0",
                        padding: spacing.md,
                        ...card.base,
                        textAlign: "left",
                    }}
                >
                    {DEFAULT_TOPICS.map((topic, idx) => {
                        const groupIdx = topicGroupMap[topic];
                        if (groupIdx === undefined) {
                            return null;
                        }
                        const group = TOPIC_GROUPS[groupIdx];
                        const anyDone = Array.isArray(group?.subtopics) && group.subtopics.some((id) => completedTopics.includes(id));
                        const allDone = Array.isArray(group?.subtopics) && group.subtopics.every((id) => completedTopics.includes(id));

                        // `anyDone` keeps current availability behavior; `allDone` used for completed styling
                        const completed = allDone;

                        return (
                            <label
                                key={idx}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    margin: "8px 0",
                                    padding: "10px 14px",
                                    borderRadius: radii.sm,
                                    backgroundColor: completed
                                        ? (selectedTopics.includes(topic) ? colors.successLight : colors.surface)
                                        : (selectedTopics.includes(topic) ? '#FEF3C7' : colors.surface),
                                    border: `1px solid ${completed ? colors.border : '#F59E0B'}`,
                                    opacity: 1,
                                    cursor: "pointer",
                                    fontSize: font.sizeMd,
                                    lineHeight: 1.4,
                                    gap: 10,
                                    transition,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedTopics.includes(topic)}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSelectedTopics(
                                            checked
                                                ? [...selectedTopics, topic]
                                                : selectedTopics.filter((t) => t !== topic)
                                        );
                                    }}
                                    style={{ width: 18, height: 18, marginTop: 1 }}
                                />
                                <span style={{ flex: 1 }}>{allDone ? "" : anyDone ? "" : "⚠️ "}{topic}</span>
                                {allDone ? (
                                    <span
                                        style={{
                                            fontSize: font.sizeXs,
                                            color: colors.success,
                                            fontWeight: font.weightSemibold,
                                        }}
                                    >
                                        ✓ Completed
                                    </span>
                                ) : anyDone ? (
                                    <span
                                        style={{
                                            fontSize: font.sizeXs,
                                            color: '#2563eb',
                                            fontWeight: font.weightSemibold,
                                        }}
                                    >
                                        📖 In Progress
                                    </span>
                                ) : (
                                    <span
                                        style={{
                                            fontSize: font.sizeXs,
                                            color: '#D97706',
                                            fontWeight: font.weightSemibold,
                                        }}
                                    >
                                        Not completed
                                    </span>
                                )}
                            </label>
                        );
                    })}
                </div>

                <div>
                    <button
                        onClick={() => {
                            if (selectedTopics.length === 0) {
                                alert("Please select at least one topic!");
                                return;
                            }
                            generateAIQuiz(selectedTopics);
                        }}
                        disabled={loadingQuiz || selectedTopics.length === 0}
                        style={{
                            ...(selectedTopics.length > 0 ? btn.accent : btn.disabled),
                            ...btn.large,
                            marginRight: 10,
                        }}
                    >
                        {loadingQuiz ? "Generating..." : `🚀 Start Quiz (${selectedTopics.length} topics)`}
                    </button>


                </div>
            </div>
        );
    }

    if (loadingQuiz && !generatingMore) {
        return (
            <div style={{ ...pageContainer(800), textAlign: "center" }}>
                <h2 style={pageHeading}>Generating AI Quiz...</h2>
                <p style={pageSubheading}>Fetching content from your selected topics</p>
            </div>
        );
    }

    if (!currentQ && !completed && !generatingMore) {
        return (
            <div style={{ ...pageContainer(800), textAlign: "center" }}>
                <p style={{ color: colors.textSecondary }}>No questions available.</p>
                <button onClick={() => setShowTopicSelect(true)} style={btn.ghost}>← Back to Topics</button>
            </div>
        );
    }

    if (!currentQ && !completed && generatingMore) {
        return (
            <div style={{ ...pageContainer(800), textAlign: "center" }}>
                <h2 style={pageHeading}>✨ Generating New Questions...</h2>
                <p style={pageSubheading}>
                    {moreProgress.received > 0
                        ? `${moreProgress.received} of ${moreProgress.total} questions ready`
                        : "Waiting for the first question..."}
                </p>
                <div style={{
                    width: 200, height: 6, backgroundColor: colors.divider,
                    borderRadius: radii.sm, margin: '20px auto', overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${(moreProgress.received / moreProgress.total) * 100}%`,
                        height: '100%', backgroundColor: colors.primary,
                        borderRadius: radii.sm, transition: 'width 0.3s ease'
                    }} />
                </div>
            </div>
        );
    }

    if (completed) {
        const scorePercent = Math.round((score / filteredQuestions.length) * 100);
        const passed = scorePercent >= QUIZ_PASS_SCORE;

        return (
            <div style={pageContainer(800)}>
                {/* Score header */}
                <h2 style={pageHeading}>Quiz Completed! 🎉</h2>
                <div style={{
                    padding: '20px 24px', borderRadius: 12, marginBottom: 28,
                    background: passed ? '#f0fdf4' : '#fef2f2',
                    border: `2px solid ${passed ? '#10b981' : '#ef4444'}`,
                    display: 'flex', alignItems: 'center', gap: 20
                }}>
                    <div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: passed ? '#10b981' : '#ef4444' }}>
                            {scorePercent}%
                        </div>
                        <div style={{ fontSize: 14, color: '#6b7280' }}>
                            {score} / {filteredQuestions.length} correct
                        </div>
                    </div>
                    <div style={{ fontSize: 28 }}>{passed ? '✅ Passed' : '❌ Failed'}</div>
                </div>

                {/* Answer Log */}
                <h3 style={{ fontSize: font.sizeLg, fontWeight: font.weightSemibold, marginBottom: 16 }}>
                    📋 Answer Log
                </h3>
                {filteredQuestions.map((q, idx) => {
                    const userAns = allUserAnswers[idx]?.answer || '(no answer)';
                    const correctAns = q.options ? q.options[q.correct_index] : q.answer;
                    const isCorrect = userAns === correctAns;
                    const isExplainOpen = !!openExplanations[idx];

                    return (
                        <div key={idx} style={{
                            marginBottom: 12, padding: '14px 18px', borderRadius: 10,
                            background: isCorrect ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${isCorrect ? '#bbf7d0' : '#fecaca'}`,
                        }}>
                            {/* Question row */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <span style={{
                                    minWidth: 28, height: 28, borderRadius: '50%',
                                    background: isCorrect ? '#10b981' : '#ef4444',
                                    color: '#fff', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0
                                }}>
                                    {idx + 1}
                                </span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
                                        {q.question}
                                    </p>

                                    {/* Answer comparison row */}
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                                        <div style={{
                                            padding: '4px 12px', borderRadius: 20,
                                            background: isCorrect ? '#dcfce7' : '#fee2e2',
                                            color: isCorrect ? '#16a34a' : '#dc2626',
                                            fontWeight: 600
                                        }}>
                                            Your answer: {userAns}
                                        </div>
                                        {!isCorrect && (
                                            <div style={{
                                                padding: '4px 12px', borderRadius: 20,
                                                background: '#dcfce7', color: '#16a34a', fontWeight: 600
                                            }}>
                                                ✓ Correct: {correctAns}
                                            </div>
                                        )}
                                    </div>

                                    {/* Explain toggle */}
                                    {q.explanation && (
                                        <>
                                            <button
                                                onClick={() => setOpenExplanations(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                                style={{
                                                    marginTop: 8, background: 'none',
                                                    border: '1px solid #fbbf24', borderRadius: 6,
                                                    padding: '3px 10px', cursor: 'pointer',
                                                    fontSize: 12, color: '#92400e'
                                                }}
                                            >
                                                {isExplainOpen ? '🙈 Hide' : '💡 Explanation'}
                                            </button>
                                            {isExplainOpen && (
                                                <div style={{
                                                    marginTop: 8, padding: '8px 12px',
                                                    background: 'rgba(251,191,36,0.12)',
                                                    borderLeft: '3px solid #F59E0B',
                                                    borderRadius: 6, fontSize: 13, lineHeight: 1.6, color: '#374151'
                                                }}>
                                                    {q.explanation}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Action buttons — keep your existing ones unchanged */}
                <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', marginTop: spacing.lg }}>
                    <button
                        onClick={() => {
                            setShowTopicSelect(true);
                            setScore(0);
                            setAllUserAnswers({});
                            setCurrentIndex(0);
                        }}
                        style={btn.accent}
                    >
                        🔄 New Quiz (Same Pool)
                    </button>
                    <button
                        onClick={() => generateAIQuiz(lastTopics)}
                        disabled={loadingQuiz || lastTopics.length === 0}
                        style={{
                            ...btn.primary,
                            opacity: loadingQuiz ? 0.6 : 1,
                        }}
                    >
                        {loadingQuiz ? "Shuffling..." : "🔀 Reshuffle from Pool"}
                    </button>
                    <button
                        onClick={generateMoreQuestions}
                        disabled={generatingMore}
                        style={{
                            ...btn.warning,
                            opacity: generatingMore ? 0.6 : 1,
                        }}
                    >
                        {generatingMore ? "⏳ Generating..." : "✨ Generate More Questions"}
                    </button>
                </div>
                {poolSize > 0 && (
                    <p style={{ marginTop: spacing.md, color: colors.textSecondary, fontSize: font.sizeSm }}>
                        📚 Question pool: {poolSize} questions stored for your topics
                    </p>
                )}
            </div>
        );
    }

    // Quiz in progress
    return (
        <div style={pageContainer(800)}>
            <div style={{ marginBottom: spacing.lg, display: 'flex', alignItems: 'center', gap: spacing.md }}>
                <p style={{ margin: 0, color: colors.textSecondary, fontStyle: 'italic', fontSize: font.sizeSm }}>{quizSource}</p>
                <button
                    onClick={() => setShowTopicSelect(true)}
                    style={{
                        ...btn.danger,
                        ...btn.small,
                    }}
                >
                    ← Change Topics
                </button>
            </div>

            <h3 style={{ fontSize: font.sizeLg, fontWeight: font.weightSemibold, color: colors.text }}>
                Question {currentIndex + 1} of {filteredQuestions.length}
                {generatingMore && (
                    <span style={{ fontSize: font.sizeSm, color: colors.primary, fontWeight: font.weightNormal, marginLeft: 8 }}>
                        ⏳ generating {moreProgress.received}/{moreProgress.total}...
                    </span>
                )}
            </h3>
            <p style={{ fontSize: font.sizeMd, lineHeight: 1.6, color: colors.textSecondary }}>{currentQ?.question}</p>

            {/* Correct answer shown in console only */}

            {/* Multiple choice options */}
            {currentQ?.options && (
                <div style={{ margin: `${spacing.xl}px 0` }}>
                    {shuffledOptions.map((opt, idx) => (
                        <div key={idx} style={{ marginBottom: spacing.sm }}>
                            <label style={{
                                display: "flex",
                                alignItems: "center",
                                cursor: "pointer",
                                padding: '10px 14px',
                                borderRadius: radii.sm,
                                border: `1px solid ${userAnswers.answer === opt ? colors.primary : colors.border}`,
                                backgroundColor: userAnswers.answer === opt ? colors.primaryLight : colors.surface,
                                transition,
                            }}>
                                <input
                                    type="radio"
                                    name="mcq"
                                    value={opt}
                                    checked={userAnswers.answer === opt}
                                    onChange={(e) => handleInputChange(e)}
                                    style={{ marginRight: spacing.sm }}
                                />
                                <span style={{ fontSize: font.sizeMd }}>{opt}</span>
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
                    ...(feedback?.startsWith("✅") || hasAnswered ? btn.disabled : btn.accent),
                    marginTop: spacing.md,
                }}
            >
                {feedback?.startsWith("✅") ? "✅ Correct!" : "Check Answer"}
            </button>

            {feedback && (
                <p style={{
                    marginTop: spacing.lg,
                    ...(feedback.startsWith("✅") ? alert.success : alert.error),
                }}>
                    {feedback}
                </p>
            )}
            {feedback && currentQ?.explanation && (
                <button
                    onClick={() => setShowExplanation((prev) => !prev)}
                    style={{
                        ...btn.warning,
                        ...btn.small,
                        marginTop: spacing.sm,
                    }}
                >
                    {showExplanation ? "🙈 Hide Explanation" : "💡 Explain"}
                </button>
            )}

            {showExplanation && currentQ?.explanation && (
                <div style={{
                    ...alert.warning,
                    marginTop: spacing.sm,
                    fontWeight: font.weightNormal,
                    lineHeight: 1.6,
                }}>
                    <strong>💡 Explanation:</strong> {currentQ.explanation}
                </div>
            )}

            {hasAnswered && (
                <button
                    onClick={nextQuestion}
                    style={{
                        ...btn.primary,
                        marginTop: spacing.md,
                    }}
                >
                    Next Question →
                </button>
            )}

            <p style={{ marginTop: spacing.xxl, fontWeight: font.weightBold, fontSize: font.sizeLg, color: colors.text }}>
                Score: {score} / {filteredQuestions.length}
            </p>
            { /* debug panel removed as requested */ }
        </div>
    );
}
