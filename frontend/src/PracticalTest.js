import React, { useState, useEffect, useRef } from "react";
import Compiler from "./Compiler";
import { getTopicGroupsForPath } from "./learningPathUtils";
import { ProgressTracker } from "./ProgressTracker";
import { colors, radii, font, spacing, btn, card, pageContainer, pageHeading, codeOutput } from './theme';

// ─── helpers ──────────────────────────────────────────────────────────────────
function buildInstructionHtml(q) {
    const lines = [];

    if (q.title) lines.push(`<h3 style="margin:0 0 8px 0">${q.title}</h3>`);
    if (q.description) lines.push(`<p style="margin:0 0 10px 0">${q.description}</p>`);
    if (q.note) lines.push(`<p style="margin:0 0 10px 0;color:#6b7280"><em>${q.note}</em></p>`);

    if (Array.isArray(q.methods) && q.methods.length > 0) {
        lines.push(`<p style="margin:0 0 4px 0"><strong>Implement:</strong></p><ul style="margin:0 0 10px 0;padding-left:20px">`);
        q.methods.forEach(m => {
            lines.push(`<li><code>${m.name}</code> — ${m.description}</li>`);
        });
        lines.push(`</ul>`);
    }

    if (Array.isArray(q.expectedOutput) && q.expectedOutput.length > 0) {
        lines.push(`<p style="margin:0 0 4px 0"><strong>Expected output:</strong></p>`);
        lines.push(`<pre style="background:#f3f4f6;padding:8px 12px;border-radius:6px;margin:0;font-size:13px">${q.expectedOutput.join("\n")}</pre>`);
    }

    return lines.join("");
}

function buildStarterCode(baseCode) {
    const baseClass = baseCode?.class || "Main";
    const methods = baseCode?.methods || {};
    let code = `public class ${baseClass} {\n`;
    for (let methodName in methods) {
        if (methodName === "runApp" || methodName === "main") continue;
        const methodDef = methods[methodName];
        if (typeof methodDef === 'string') {
            code += `    ${methodDef}\n\n`;
        } else if (Array.isArray(methodDef)) {
            code += methodDef.map(line => `    ${line.replace(/^\n/, '').replace(/\n$/, '')}`).join('\n');
            code += '\n\n';
        }
    }
    code += "}";
    return code;
}

const MAX_TOPICS = 3;

// ─── component ────────────────────────────────────────────────────────────────
export default function PracticalTest() {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

    const [topicGroups, setTopicGroups] = useState([]);
    const [selectedPath, setSelectedPath] = useState(null);
    const [screen, setScreen] = useState('select');
    const [selectedTopics, setSelectedTopics] = useState([]);
    const [activeTestTopics, setActiveTestTopics] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState('');

    // Load topic groups when a path is explicitly selected
    useEffect(() => {
        if (!selectedPath) { setTopicGroups([]); return; }
        getTopicGroupsForPath(selectedPath).then(groups => {
            setTopicGroups(groups);
        }).catch(err => {
            console.error('Failed to load topic groups:', err);
            setTopicGroups([]);
        });
    }, [selectedPath]);

    const [currentQuestionData, setCurrentQuestionData] = useState(null);
    const [questionDbId, setQuestionDbId] = useState(null);
    const [isAiQuestion, setIsAiQuestion] = useState(false);
    // ✅ track baseClass in React state instead of localStorage
    const [baseClassName, setBaseClassName] = useState('Main');

    const [instruction, setInstruction] = useState('');
    const [studentCode, setStudentCode] = useState('');
    const [result, setResult] = useState('');
    const [compilerErrorLines, setCompilerErrorLines] = useState([]); // lines to highlight in editor (1-based)
    const [elapsedTime, setElapsedTime] = useState(0);
    const [started, setStarted] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [gradingResults, setGradingResults] = useState(null);
    const [gradingLoading, setGradingLoading] = useState(false);
    const [hints, setHints] = useState([]);
    const [hintLevel, setHintLevel] = useState('gentle');
    const [hintLoading, setHintLoading] = useState(false);
    const [testResults, setTestResults] = useState(null);

    // Model answer — populated from evaluate-ai response after submission
    const [modelSolution, setModelSolution] = useState(null);
    const [showModelAnswer, setShowModelAnswer] = useState(false);

    const tracker = useRef(new ProgressTracker()).current;
    const ALL_TOPICS = topicGroups.map(g => g.label);

    useEffect(() => {
        if (!started) return;
        const interval = setInterval(() => setElapsedTime(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [started]);

    const toggleTopic = (label) => {
        setSelectedTopics(prev => {
            if (prev.includes(label)) return prev.filter(t => t !== label);
            if (prev.length >= MAX_TOPICS) {
                alert(`You can select up to ${MAX_TOPICS} topics per exercise.`);
                return prev;
            }
            return [...prev, label];
        });
    };
    const selectAll = () => setSelectedTopics([...ALL_TOPICS].slice(0, MAX_TOPICS));
    const clearAll  = () => setSelectedTopics([]);
    const selectCompleted = () => {
        const completed = tracker.getCompletedTopics();
        const completedLabels = topicGroups
            .filter(g => g.subtopics.some(s => completed.includes(s)))
            .map(g => g.label);
        if (completedLabels.length === 0) {
            alert("⚠️ You haven't completed any topics on the Roadmap yet. Select topics manually or complete some lessons first!");
            return;
        }
        const capped = completedLabels.slice(0, MAX_TOPICS);
        if (completedLabels.length > MAX_TOPICS) {
            alert(`You have ${completedLabels.length} completed topics. Only the first ${MAX_TOPICS} have been selected.`);
        }
        setSelectedTopics(capped);
    };

    // ── load question data into component state ───────────────────────────────
    const applyQuestionData = (data, aiId) => {
        const cls = data.baseCode?.class || "Main";
        setCurrentQuestionData(data);
        setIsAiQuestion(!!aiId);
        setQuestionDbId(aiId || null);
        setBaseClassName(cls);  // ✅ store in React state
        setInstruction(buildInstructionHtml(data.question));
        setStudentCode(buildStarterCode(data.baseCode));
        // keep expectedOutput in localStorage (read-only during grading, safe)
        localStorage.setItem("expectedOutput", JSON.stringify(data.question?.expectedOutput || []));
        setGradingResults(null);
        setHints([]);
        setHintLevel('gentle');
        setTestResults(null);
        setResult('');
        setElapsedTime(0);   // auto-reset timer when loading a question
        setStarted(true);    // auto-start timer when question loads
        setSubmitted(false); // unlock editor for new question
        setModelSolution(null);
        setShowModelAnswer(false);
    };

    // ── generate AI question ──────────────────────────────────────────────────
    const generateAiQuestion = async (forceNew = false) => {
        if (selectedTopics.length === 0) { alert("Please select at least one topic first."); return; }
        setGenerating(true);
        setGenError('');

        // Send all selected topics to backend so the generated question can cover them
        // (previously we capped at 3 for quality; remove cap to let backend attempt all)
        const topicsForQuestion = [...selectedTopics];

        try {
            const res = await fetch(`${API_BASE}/api/practical-tests/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // keep single `topic` for backward compatibility
                    topic: topicsForQuestion[0],
                    // new: send all chosen topics so backend can craft multi-topic questions
                    topics: topicsForQuestion,
                    force_new: forceNew
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const payload = await res.json();
            applyQuestionData(payload.question_data, payload.question_data.id);
            // track which topics were actually used for this generated question
            setActiveTestTopics(topicsForQuestion);
            setScreen('active');
        } catch (e) {
            setGenError(`Failed to generate question: ${e.message}`);
        } finally {
            setGenerating(false);
        }
    };

    // ── evaluate helpers ──────────────────────────────────────────────────────
    const buildEvalPayload = () => {
        const cleanCode = studentCode
            .replace(/public\s+void\s+runApp\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g, '')
            .trim();

        // ✅ Always send code under the actual class name from current question.
        // Also include "Main" and "Solution" as fallbacks so backend always finds it.
        const codeFiles = {
            [baseClassName]: cleanCode,
            Main: cleanCode,
            Solution: cleanCode,
        };

        if (isAiQuestion && questionDbId) {
            return {
                url: `${API_BASE}/api/practical-tests/evaluate-ai`,
                body: { code_files: codeFiles, question_db_id: questionDbId, question_data: currentQuestionData },
            };
        }
        return {
            url: `${API_BASE}/evaluate`,
            body: { code_files: codeFiles, question_id: currentQuestionData?.id || '' },
        };
    };

    const handleRun = async () => {
        const { url, body } = buildEvalPayload();
        try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.error && !data.success) {
                setResult(`❌ Compilation/Runtime Error:\n${data.error}`);
                // IMPORTANT: adjust WRAPPER_LINE_OFFSET to match how many lines your server-side wrapper injects.
                const WRAPPER_LINE_OFFSET = 0; // <-- set this to e.g. 38 if your wrapper adds 38 lines before student code
                const parsed = (function parseCompilerErrors(errorText) {
                    const errors = [];
                    const regex = /(?:[\w\-]+)\.java:(\d+):/g;
                    let match;
                    while ((match = regex.exec(errorText)) !== null) {
                        errors.push(parseInt(match[1], 10));
                    }
                    return errors;
                })(data.error).map(l => Math.max(1, l - WRAPPER_LINE_OFFSET));
                setCompilerErrorLines(parsed);
            } else {
                setResult(data.success ? `Output:\n\n${data.output}` : `❌ Compilation/Runtime Error:\n${data.error}`);
                setCompilerErrorLines([]);
            }
        } catch (e) {
            setResult(`Failed to run code: ${e.message}`);
        }
    };

    const handleSubmit = async (e) => {
        if (submitted) return; // block double submit
        if (e) e.preventDefault();
        setSubmitted(true);      // lock immediately
        setStarted(false);       // stop timer
        const { url, body } = buildEvalPayload();
        try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!data.success) {
                setResult(`❌ Submission Failed - Compilation/Runtime Error:\n${data.error}`);
                // parse and pass error lines to the editor
                const WRAPPER_LINE_OFFSET = 0; // adjust to your wrapper's prepended lines
                const parsed = (function parseCompilerErrors(errorText) {
                    const errors = [];
                    const regex = /(?:[\w\-]+)\.java:(\d+):/g;
                    let match;
                    while ((match = regex.exec(errorText)) !== null) {
                        errors.push(parseInt(match[1], 10));
                    }
                    return errors;
                })(data.error).map(l => Math.max(1, l - WRAPPER_LINE_OFFSET));
                setCompilerErrorLines(parsed);
                const errorResults = { passed: [], failed: ["Compilation Error"], expected_outputs: [], actual_outputs: [data.error] };
                setTestResults(errorResults);
                await gradeSubmission(errorResults);
                return;
            }
            const actualOutput = data.output.trim();
            const expected = JSON.parse(localStorage.getItem("expectedOutput") || "[]");
            const actualLines = actualOutput.split("\n").map(l => l.trim()).filter(l => l);
            const expectedLines = expected.map(l => l.trim());
            const passed = [], failed = [], expectedOutputs = [], actualOutputs = [];
            const maxLines = Math.max(actualLines.length, expectedLines.length);
            for (let i = 0; i < maxLines; i++) {
                const actual = actualLines[i] || "(missing)";
                const exp = expectedLines[i] || "(missing)";
                if (actual === exp) { passed.push(`Line ${i + 1}`); }
                else { failed.push(`Line ${i + 1}`); expectedOutputs.push(exp); actualOutputs.push(actual); }
            }
            const results = { passed, failed, expected_outputs: expectedOutputs, actual_outputs: actualOutputs };
            setTestResults(results);
            // Capture model solution if backend returned one
            if (data.model_solution) {
                setModelSolution(data.model_solution);
            }
            if (failed.length === 0) {
                setResult(`✅ All tests passed! Your solution is correct.\n\nYour Output:\n${actualOutput}`);
            } else {
                const lines = ["❌ Tests failed - Output does not match expected:\n"];
                for (let i = 0; i < maxLines; i++) {
                    const actual = actualLines[i] || "(missing)";
                    const exp = expectedLines[i] || "(missing)";
                    if (actual === exp) { lines.push(`✓ Line ${i + 1}: ${actual}`); }
                    else { lines.push(`✗ Line ${i + 1}:`); lines.push(`  Your output:    "${actual}"`); lines.push(`  Expected:       "${exp}"`); lines.push(''); }
                }
                setResult(lines.join("\n"));
            }
            await gradeSubmission(results);
        } catch (e) {
            setResult(`❌ Failed to evaluate code: ${e.message}`);
        }
    };

    const gradeSubmission = async (results) => {
        setGradingLoading(true);
        try {
            const questionDesc  = currentQuestionData?.question?.description || "Complete the coding task";
            const questionTitle = currentQuestionData?.question?.title || "Coding Challenge";
            const res = await fetch(`${API_BASE}/api/grading/evaluate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_description: `${questionTitle}: ${questionDesc}`,
                    expected_approach: "Implement the solution correctly following Java best practices",
                    student_code: studentCode,
                    test_results: { passed: results.passed || [], failed: results.failed || [] },
                    expected_outputs: results.expected_outputs || [],
                    actual_outputs:   results.actual_outputs  || [],
                }),
            });
            if (res.ok) {
                const grading = await res.json();
                setGradingResults(grading);

                // If we have a numeric total_score, record progress with the actual score
                if (grading && typeof grading.total_score === 'number') {
                    if (grading.total_score >= 60) {
                        const testId = `test_${questionDbId || 'unknown'}_${Date.now()}`;
                        try {
                            tracker.markTestPassed(testId, grading.total_score);
                            window.dispatchEvent(new Event('progress-updated'));
                        } catch (err) {
                            console.warn('Failed to mark progress locally:', err);
                        }
                    }
                }

                const token = localStorage.getItem('authToken');
                    if (token) {
                    const passed = results.failed?.length === 0;
                    fetch(`${API_BASE}/my-work/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            work_type: 'test',
                            title: `${questionTitle}`,
                            topic_id: (activeTestTopics && activeTestTopics[0]) || selectedTopics[0] || null,
                            content: studentCode,
                            result_data: {
                                score: grading.total_score, grade: grading.grade_letter, passed,
                                feedback: grading.feedback, suggestions: grading.suggestions || [],
                                // include explicit topics covered so frontend can aggregate by topic
                                topics: activeTestTopics && activeTestTopics.length > 0 ? activeTestTopics : (selectedTopics || []),
                                topics_covered: activeTestTopics && activeTestTopics.length > 0 ? activeTestTopics : (selectedTopics || []),
                                question: { title: questionTitle, description: questionDesc,
                                    methods: currentQuestionData?.question?.methods || [],
                                    expected_output: currentQuestionData?.question?.expectedOutput || [] },
                                test_cases: { passed: results.passed, failed: results.failed },
                            },
                        }),
                    }).catch(err => console.warn('saveWork failed:', err));
                }
            }
        } catch {}
        finally { setGradingLoading(false); }
    };

    const requestHint = async () => {
        setHintLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/hints/generate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_description: currentQuestionData?.question?.description || "",
                    student_code: studentCode,
                    test_cases_failed: testResults?.failed || [],
                    expected_output: testResults?.expected_outputs?.[0] || 'Not yet tested',
                    actual_output: testResults?.actual_outputs?.[0] || 'Not yet tested',
                    hint_level: hintLevel,
                    previous_hints: hints.map(h => h.hint),
                }),
            });
            if (!res.ok) throw new Error('Failed to get hint');
            const hintData = await res.json();
            setHints([...hints, hintData]);
            if (hintData.next_level) setHintLevel(hintData.next_level);
        } catch { alert('Failed to generate hint. Please try again.'); }
        finally { setHintLoading(false); }
    };

    const formatTime = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    const handleBackToSelect = () => { setScreen('select'); setStarted(false); setElapsedTime(0); };

    return (
        <div style={pageContainer(1100)}>
            <h2 style={pageHeading}>🎯 Coding Challenge</h2>

            {screen === 'select' && (
                <>
                    {!selectedPath ? (
                        <>
                            <p style={{ color: colors.textSecondary, fontSize: font.sizeMd, marginBottom: spacing.xl }}>
                                Choose which Java course to generate a coding challenge for.
                            </p>
                            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => { setSelectedPath('basic'); setSelectedTopics([]); }}
                                    style={{
                                        padding: '32px 40px', borderRadius: radii.md,
                                        border: `2px solid ${colors.border}`, background: colors.surface,
                                        cursor: 'pointer', textAlign: 'center', minWidth: 220,
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                    }}
                                >
                                    <div style={{ fontSize: 40, marginBottom: 10 }}>☕</div>
                                    <div style={{ fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.text }}>Basic Java</div>
                                    <div style={{ fontSize: font.sizeSm, color: colors.textSecondary, marginTop: 6 }}>12 topic groups · Beginner to intermediate</div>
                                </button>
                                <button
                                    onClick={() => { setSelectedPath('enhanced'); setSelectedTopics([]); }}
                                    style={{
                                        padding: '32px 40px', borderRadius: radii.md,
                                        border: `2px solid ${colors.border}`, background: colors.surface,
                                        cursor: 'pointer', textAlign: 'center', minWidth: 220,
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                    }}
                                >
                                    <div style={{ fontSize: 40, marginBottom: 10 }}>🚀</div>
                                    <div style={{ fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.text }}>Enhanced Java</div>
                                    <div style={{ fontSize: font.sizeSm, color: colors.textSecondary, marginTop: 6 }}>8 topic groups · Advanced concepts</div>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: spacing.md }}>
                                <button onClick={() => { setSelectedPath(null); setSelectedTopics([]); }} style={{ ...btn.ghost, fontSize: font.sizeSm, padding: '4px 10px' }}>← Change Course</button>
                                <span style={{ fontSize: font.sizeSm, color: colors.textSecondary }}>{selectedPath === 'enhanced' ? '🚀 Enhanced Java' : '☕ Basic Java'}</span>
                            </div>
                            <p style={{ color: colors.textSecondary, fontSize: font.sizeMd, marginBottom: spacing.lg }}>
                                Select one or more topics, then generate an AI coding exercise tailored to those concepts.
                            </p>

                    <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg }}>
                        <button onClick={selectCompleted} style={{ ...btn.primary, fontSize: font.sizeSm }}>✅ My Completed Topics</button>
                        <button onClick={selectAll}       style={{ ...btn.secondary, fontSize: font.sizeSm }}>Select All</button>
                        <button onClick={clearAll}        style={{ ...btn.ghost, fontSize: font.sizeSm }}>Clear</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: spacing.md, marginBottom: spacing.xl }}>
                        {ALL_TOPICS.map(label => {
                            const selected = selectedTopics.includes(label);
                            return (
                                <button key={label} onClick={() => toggleTopic(label)} style={{
                                    padding: `${spacing.md}px`,
                                    borderRadius: radii.md,
                                    border: `2px solid ${selected ? colors.primary : colors.border}`,
                                    background: selected ? colors.primaryLight : colors.surface,
                                    color: selected ? colors.primary : colors.text,
                                    fontWeight: selected ? font.weightSemibold : font.weightNormal,
                                    fontSize: font.sizeSm,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s',
                                }}>
                                    {selected ? '✓ ' : ''}{label}
                                </button>
                            );
                        })}
                    </div>

                    {genError && (
                        <div style={{ ...card.base, borderLeft: `4px solid ${colors.error}`, marginBottom: spacing.lg, color: colors.error, padding: spacing.md }}>
                            {genError}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                            onClick={() => generateAiQuestion(false)}
                            disabled={generating || selectedTopics.length === 0}
                            style={{ ...btn.success, opacity: (generating || selectedTopics.length === 0) ? 0.5 : 1, cursor: (generating || selectedTopics.length === 0) ? 'not-allowed' : 'pointer', minWidth: 200 }}
                        >
                            {generating ? '⏳ Loading question...' : '▶ Start Exercise'}
                        </button>
                        <button
                            onClick={() => generateAiQuestion(true)}
                            disabled={generating || selectedTopics.length === 0}
                            style={{ ...btn.secondary, opacity: (generating || selectedTopics.length === 0) ? 0.5 : 1, cursor: (generating || selectedTopics.length === 0) ? 'not-allowed' : 'pointer' }}
                        >
                            🔄 Generate New Question
                        </button>
                    </div>

                    {(                        <p style={{ marginTop: spacing.md, fontSize: font.sizeSm, color: colors.textSecondary }}>
                            Selected: {selectedTopics.length}/{MAX_TOPICS} topics
                            {selectedTopics.length > 0 && ` · ${selectedTopics.join(' · ')}`}
                        </p>
                    )}
                        </>
                    )}
                </>
            )}

            {screen === 'active' && currentQuestionData && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                            <span style={{ fontWeight: font.weightBold, color: colors.text, fontSize: font.sizeMd }}>
                                ⏱ {formatTime(elapsedTime)}
                            </span>
                            <span style={{
                                background: isAiQuestion ? colors.primaryLight : colors.successLight,
                                color: isAiQuestion ? colors.primary : colors.success,
                                border: `1px solid ${isAiQuestion ? colors.primaryBorder : colors.successBorder}`,
                                borderRadius: radii.full, padding: '2px 10px',
                                fontSize: font.sizeXs, fontWeight: font.weightSemibold,
                            }}>
                                {isAiQuestion ? '🤖 AI Generated' : '📁 Manual Question'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: spacing.sm }}>
                            <button onClick={() => generateAiQuestion(true)} disabled={generating} style={{ ...btn.secondary, fontSize: font.sizeSm }}>
                                {generating ? '⏳...' : '🔄 New Question'}
                            </button>
                            <button onClick={handleBackToSelect} style={{ ...btn.ghost, fontSize: font.sizeSm }}>← Topics</button>
                        </div>
                    </div>

                    <div style={{ ...card.base, marginTop: spacing.lg, maxHeight: 320, overflowY: 'auto' }}
                        dangerouslySetInnerHTML={{ __html: instruction }} />

                    <Compiler code={studentCode} setCode={setStudentCode} onRun={handleRun} output={result}
                        hideRunButton={true}
                        readOnly={submitted}
                        compilerErrorLines={compilerErrorLines}
                    />

                    <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                        <button onClick={handleRun} disabled={submitted} style={{ ...btn.primary, opacity: submitted ? 0.5 : 1 }}>▶ Run Code</button>
                        <button onClick={handleSubmit} disabled={submitted} style={{ ...btn.success, opacity: submitted ? 0.5 : 1 }}>
                            {submitted ? '✅ Submitted' : '📤 Submit Code'}
                        </button>
                    </div>

                    <div style={{ ...card.warning, padding: spacing.xl, margin: `${spacing.xl}px 0` }}>
                        <h3 style={{ marginTop: 0, color: colors.text, fontSize: font.sizeLg }}>💡 Need Help?</h3>
                        {testResults ? (
                            testResults.failed?.length > 0
                                ? <p style={{ marginBottom: spacing.lg, color: colors.warning }}>You have {testResults.failed.length} failed test(s). Get AI hints to help fix your code!</p>
                                : <p style={{ marginBottom: spacing.lg, color: colors.success }}>✅ All tests passed! Want to improve your code further?</p>
                        ) : (
                            <p style={{ marginBottom: spacing.lg, color: colors.textSecondary }}>Stuck? Request AI hints to guide you through the solution!</p>
                        )}
                        <button onClick={requestHint} disabled={hintLoading || hints.length >= 3}
                            style={{ ...(hints.length >= 3 ? btn.disabled : btn.warning), marginBottom: spacing.lg }}>
                            {hintLoading ? '⏳ Generating hint...' :
                             hints.length === 0 ? '💡 Get Your First Hint' :
                             hints.length === 1 ? '💡 Get a More Specific Hint' : '💡 Get Final Detailed Hint'}
                        </button>
                        {hints.length >= 3 && (
                            <p style={{ color: colors.warning, fontStyle: 'italic', marginBottom: spacing.lg }}>
                                ✋ You've used all 3 hint levels. Try implementing the solution!
                            </p>
                        )}
                        {hints.map((hintData, idx) => (
                            <div key={idx} style={{ ...card.base, marginBottom: spacing.lg, borderLeft: `4px solid ${colors.warning}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                                    <strong style={{ color: colors.text }}>Hint {idx + 1}</strong>
                                    <span style={{
                                        background: colors.warningLight, color: colors.warning,
                                        padding: '2px 8px', borderRadius: radii.full,
                                        fontSize: font.sizeXs, textTransform: 'uppercase',
                                        fontWeight: font.weightBold, border: `1px solid ${colors.warningBorder}`,
                                    }}>{hintData.hint_level}</span>
                                </div>
                                <p style={{ fontSize: font.sizeMd, lineHeight: 1.6, color: colors.textSecondary, margin: 0 }}>{hintData.hint}</p>
                            </div>
                        ))}
                    </div>

                    {gradingLoading && !gradingResults && (
                        <div style={{
                            ...card.info,
                            padding: spacing.xl,
                            margin: `${spacing.xl}px 0`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: spacing.md,
                        }}>
                            <div style={{
                                width: 40, height: 40,
                                border: `4px solid ${colors.primaryLight}`,
                                borderTop: `4px solid ${colors.primary}`,
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }} />
                            <p style={{ color: colors.primary, fontWeight: font.weightSemibold, margin: 0 }}>
                                🤖 AI is grading your submission…
                            </p>
                            <p style={{ color: colors.textSecondary, fontSize: font.sizeSm, margin: 0 }}>
                                This usually takes 5–10 seconds
                            </p>
                        </div>
                    )}

                    {gradingResults && (
                        <div style={{ ...card.info, padding: spacing.xl, margin: `${spacing.xl}px 0` }}>
                            <h3 style={{ color: colors.primary, marginBottom: spacing.lg, fontSize: font.sizeLg }}>
                                📊 Your Score: {gradingResults.total_score}/100 ({gradingResults.grade_letter})
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing.lg, marginBottom: spacing.xl }}>
                                {[
                                    { label: 'Test Cases', val: gradingResults.breakdown.test_cases, max: 50 },
                                    { label: 'Approach',   val: gradingResults.breakdown.approach,    max: 30 },
                                    { label: 'Code Quality', val: gradingResults.breakdown.code_quality, max: 20 },
                                ].map((item, i) => (
                                    <div key={i} style={{ ...card.base, textAlign: 'center' }}>
                                        <div style={{ fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 5, fontSize: font.sizeSm }}>{item.label}</div>
                                        <div style={{ fontSize: font.sizeXxl, color: colors.primary, fontWeight: font.weightBold }}>{item.val}/{item.max}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ ...card.base, marginBottom: spacing.lg }}>
                                <h4 style={{ color: colors.text, margin: `0 0 ${spacing.sm}px 0` }}>📝 Feedback:</h4>
                                <p style={{ color: colors.textSecondary, margin: 0 }}>{gradingResults.feedback}</p>
                            </div>
                            {gradingResults.suggestions?.length > 0 && (
                                <div style={{ ...card.base, marginBottom: spacing.lg }}>
                                    <h5 style={{ color: colors.text, margin: `0 0 ${spacing.sm}px 0` }}>🔧 How to Improve:</h5>
                                    <ul style={{ paddingLeft: 20, margin: 0, color: colors.textSecondary }}>
                                        {gradingResults.suggestions.map((s, i) => <li key={i} style={{ marginBottom: spacing.sm }}>{s}</li>)}
                                    </ul>
                                </div>
                            )}
                            <div style={card.base}>
                                <h5 style={{ color: colors.text, margin: `0 0 ${spacing.sm}px 0` }}>✨ Code Quality Notes:</h5>
                                <p style={{ color: colors.textSecondary, margin: 0 }}>{gradingResults.code_quality_notes}</p>
                            </div>
                        </div>
                    )}

                    {result && <pre style={{ ...codeOutput, marginTop: spacing.lg }}>{result}</pre>}

                    {/* Model Answer — shown post-submission when solution is available */}
                    {submitted && modelSolution && (
                        <div style={{ marginTop: spacing.lg }}>
                            <button
                                onClick={() => setShowModelAnswer(v => !v)}
                                style={{
                                    ...btn.secondary,
                                    background: showModelAnswer ? '#f3f0ff' : undefined,
                                    border: `1px solid ${showModelAnswer ? '#a78bfa' : undefined}`,
                                    color: showModelAnswer ? '#7c3aed' : undefined,
                                }}
                            >
                                🔑 {showModelAnswer ? 'Hide Model Answer' : 'View Model Answer'}
                            </button>

                            {showModelAnswer && (
                                <div style={{ ...card.base, marginTop: spacing.md, border: '1px solid #d8b4fe', background: '#faf5ff' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                                        <span style={{ fontWeight: font.weightBold, color: '#7c3aed', fontSize: font.sizeMd }}>
                                            🔑 Model Answer
                                        </span>
                                        <span style={{ fontSize: font.sizeXs, color: colors.textMuted }}>
                                            Reference solution — study this after your attempt
                                        </span>
                                    </div>

                                    {Object.entries(modelSolution.methods || {}).map(([methodName, lines]) => {
                                        if (methodName === 'runApp') return null;
                                        const code = Array.isArray(lines) ? lines.join('\n') : String(lines);
                                        return (
                                            <div key={methodName} style={{ marginBottom: spacing.lg }}>
                                                <div style={{ fontSize: font.sizeXs, color: '#7c3aed', fontWeight: font.weightSemibold, marginBottom: 6 }}>
                                                    Method: <code style={{ background: '#f3f0ff', padding: '1px 6px', borderRadius: 4 }}>{methodName}</code>
                                                </div>
                                                <pre style={{
                                                    background: '#1e1b4b', color: '#e0e7ff',
                                                    borderRadius: radii.md, padding: '12px 16px',
                                                    fontFamily: 'monospace', fontSize: 13, lineHeight: 1.65,
                                                    overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                }}>{code}</pre>
                                            </div>
                                        );
                                    })}

                                    {modelSolution.helperClasses && modelSolution.helperClasses.trim() && (
                                        <div style={{ marginBottom: spacing.lg }}>
                                            <div style={{ fontSize: font.sizeXs, color: '#7c3aed', fontWeight: font.weightSemibold, marginBottom: 6 }}>
                                                Helper Classes
                                            </div>
                                            <pre style={{
                                                background: '#1e1b4b', color: '#e0e7ff',
                                                borderRadius: radii.md, padding: '12px 16px',
                                                fontFamily: 'monospace', fontSize: 13, lineHeight: 1.65,
                                                overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                            }}>{modelSolution.helperClasses}</pre>
                                        </div>
                                    )}

                                    <div style={{ fontSize: font.sizeSm, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm }}>
                                        💡 This is one possible correct solution. Your approach may differ and still be valid.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
