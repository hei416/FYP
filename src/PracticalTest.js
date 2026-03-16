import React, { useState, useEffect, useRef } from "react";
import Compiler from "./Compiler";
import { TOPIC_GROUPS } from "./HomePage";
import { ProgressTracker } from "./ProgressTracker";
import { colors, radii, font, spacing, btn, card, pageContainer, pageHeading, codeOutput } from './theme';

// ─── helpers ──────────────────────────────────────────────────────────────────
function buildInstructionHtml(q) {
    const lines = [];

    // Title
    if (q.title) lines.push(`<h3 style="margin:0 0 8px 0">${q.title}</h3>`);

    // Description
    if (q.description) lines.push(`<p style="margin:0 0 10px 0">${q.description}</p>`);

    // Optional note
    if (q.note) lines.push(`<p style="margin:0 0 10px 0;color:#6b7280"><em>${q.note}</em></p>`);

    // Methods to implement
    if (Array.isArray(q.methods) && q.methods.length > 0) {
        lines.push(`<p style="margin:0 0 4px 0"><strong>Implement:</strong></p><ul style="margin:0 0 10px 0;padding-left:20px">`);
        q.methods.forEach(m => {
            lines.push(`<li><code>${m.name}</code> — ${m.description}</li>`);
        });
        lines.push(`</ul>`);
    }

    // Expected output
    if (Array.isArray(q.expectedOutput) && q.expectedOutput.length > 0) {
        lines.push(`<p style="margin:0 0 4px 0"><strong>Expected output:</strong></p>`);
        lines.push(`<pre style="background:#f3f4f6;padding:8px 12px;border-radius:6px;margin:0;font-size:13px">${q.expectedOutput.join("\n")}</pre>`);
    }

    return lines.join("");
}

function buildStarterCode(baseCode) {
    const baseClass = baseCode?.class || "Solution";
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

const ALL_TOPICS = TOPIC_GROUPS.map(g => g.label);

// ─── component ────────────────────────────────────────────────────────────────
export default function PracticalTest() {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

    // screen: 'select' | 'active'
    const [screen, setScreen] = useState('select');

    // topic selection
    const [selectedTopics, setSelectedTopics] = useState([]);

    // generation
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState('');

    // current question
    const [currentQuestionData, setCurrentQuestionData] = useState(null);
    const [questionDbId, setQuestionDbId] = useState(null);
    const [isAiQuestion, setIsAiQuestion] = useState(false);

    // test state
    const [instruction, setInstruction] = useState('');
    const [studentCode, setStudentCode] = useState('');
    const [result, setResult] = useState('');
    const [elapsedTime, setElapsedTime] = useState(0);
    const [started, setStarted] = useState(false);

    // grading / hints
    const [gradingResults, setGradingResults] = useState(null);
    const [hints, setHints] = useState([]);
    const [hintLevel, setHintLevel] = useState('gentle');
    const [hintLoading, setHintLoading] = useState(false);
    const [testResults, setTestResults] = useState(null);

    // dedup tracking: last recorded "questionId+score" pair
    const lastRecordedRef = useRef(null);

    const tracker = useRef(new ProgressTracker()).current;

    // timer
    useEffect(() => {
        if (!started) return;
        const interval = setInterval(() => setElapsedTime(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [started]);

    // Fire when gradingResults arrives — call markTestPassed + dispatch event (deduped)
    useEffect(() => {
        if (!gradingResults) return;
        const score = gradingResults.total_score ?? 0;
        const testId = `test_${questionDbId || 'unknown'}`;
        const dedupKey = `${testId}__${score}`;
        if (lastRecordedRef.current === dedupKey) return;
        lastRecordedRef.current = dedupKey;
        tracker.markTestPassed(testId, score);
        window.dispatchEvent(new Event('progress-updated'));
    }, [gradingResults, questionDbId, tracker]);

    // ── topic toggle ──────────────────────────────────────────────────────────
    const toggleTopic = (label) => {
        setSelectedTopics(prev =>
            prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
        );
    };
    const selectAll = () => setSelectedTopics([...ALL_TOPICS]);
    const clearAll  = () => setSelectedTopics([]);
    const selectCompleted = () => {
        const completed = tracker.getCompletedTopics();
        const completedLabels = TOPIC_GROUPS
            .filter(g => g.subtopics.some(s => completed.includes(s)))
            .map(g => g.label);
        if (completedLabels.length === 0) {
            alert("⚠️ You haven't completed any topics on the Roadmap yet. Select topics manually or complete some lessons first!");
            return;
        }
        setSelectedTopics(completedLabels);
    };

    // ── load question data into component state ───────────────────────────────
    const applyQuestionData = (data, aiId) => {
        setCurrentQuestionData(data);
        setIsAiQuestion(!!aiId);
        setQuestionDbId(aiId || null);
        setInstruction(buildInstructionHtml(data.question));
        setStudentCode(buildStarterCode(data.baseCode));
        localStorage.setItem("baseClass", data.baseCode?.class || "Solution");
        localStorage.setItem("expectedOutput", JSON.stringify(data.question?.expectedOutput || []));
        setGradingResults(null);
        setHints([]);
        setHintLevel('gentle');
        setTestResults(null);
        setResult('');
        // reset dedup when a new question loads
        lastRecordedRef.current = null;
    };

    // ── generate AI question ──────────────────────────────────────────────────
    const generateAiQuestion = async (forceNew = false) => {
        if (selectedTopics.length === 0) { alert("Please select at least one topic first."); return; }
        setGenerating(true);
        setGenError('');
        const topic = selectedTopics[Math.floor(Math.random() * selectedTopics.length)];
        try {
            const res = await fetch(`${API_BASE}/api/practical-tests/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, force_new: forceNew }),
            });
            if (!res.ok) throw new Error(await res.text());
            const payload = await res.json();
            applyQuestionData(payload.question_data, payload.question_data.id);
            setStarted(false);
            setElapsedTime(0);
            setScreen('active');
        } catch (e) {
            setGenError(`Failed to generate question: ${e.message}`);
        } finally {
            setGenerating(false);
        }
    };

    // ── evaluate helpers ──────────────────────────────────────────────────────
    const buildEvalPayload = () => {
        const baseClass = localStorage.getItem("baseClass");
        const cleanCode = studentCode
            .replace(/public\s+void\s+runApp\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g, '')
            .trim();
        if (isAiQuestion && questionDbId) {
            return {
                url: `${API_BASE}/api/practical-tests/evaluate-ai`,
                body: { code_files: { [baseClass]: cleanCode }, question_db_id: questionDbId },
            };
        }
        return {
            url: `${API_BASE}/evaluate`,
            body: { code_files: { [baseClass]: cleanCode }, question_id: currentQuestionData?.id || '' },
        };
    };

    const handleRun = async () => {
        const { url, body } = buildEvalPayload();
        try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            setResult(data.success ? `Output:\n\n${data.output}` : `❌ Compilation/Runtime Error:\n${data.error}`);
        } catch (e) {
            setResult(`Failed to run code: ${e.message}`);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const { url, body } = buildEvalPayload();
        try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!data.success) {
                setResult(`❌ Submission Failed - Compilation/Runtime Error:\n${data.error}`);
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
        try {
            const questionDesc = currentQuestionData?.question?.description || "Complete the coding task";
            const questionTitle = currentQuestionData?.question?.title || "Coding Challenge";
            const res = await fetch(`${API_BASE}/api/grading/evaluate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_description: `${questionTitle}: ${questionDesc}`,
                    expected_approach: "Implement the solution correctly following Java best practices",
                    student_code: studentCode,
                    test_results: { passed: results.passed || [], failed: results.failed || [] },
                    expected_outputs: results.expected_outputs || [],
                    actual_outputs: results.actual_outputs || [],
                }),
            });
            if (res.ok) setGradingResults(await res.json());
        } catch {}
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

    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════
    return (
        <div style={pageContainer(1100)}>
            <h2 style={pageHeading}>🎯 Code Exercise</h2>

            {/* ── SCREEN 1: topic selection ────────────────────────────────── */}
            {screen === 'select' && (
                <>
                    <p style={{ color: colors.textSecondary, fontSize: font.sizeMd, marginBottom: spacing.lg }}>
                        Select one or more topics, then generate an AI coding exercise tailored to those concepts.
                    </p>

                    {/* quick-select row */}
                    <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg }}>
                        <button onClick={selectCompleted} style={{ ...btn.primary, fontSize: font.sizeSm }}>✅ My Completed Topics</button>
                        <button onClick={selectAll}       style={{ ...btn.secondary, fontSize: font.sizeSm }}>Select All</button>
                        <button onClick={clearAll}        style={{ ...btn.ghost, fontSize: font.sizeSm }}>Clear</button>
                    </div>

                    {/* topic grid */}
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

                    {selectedTopics.length > 0 && (
                        <p style={{ marginTop: spacing.md, fontSize: font.sizeSm, color: colors.textSecondary }}>
                            Selected: {selectedTopics.join(' · ')}
                        </p>
                    )}
                </>
            )}

            {/* ── SCREEN 2: active test ────────────────────────────────────── */}
            {screen === 'active' && currentQuestionData && (
                <>
                    {/* header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                            {!started ? (
                                <button onClick={() => { setStarted(true); setElapsedTime(0); }} style={btn.success}>▶ Start Timer</button>
                            ) : (
                                <span style={{ fontWeight: font.weightBold, color: colors.text, fontSize: font.sizeMd }}>⏱ {formatTime(elapsedTime)}</span>
                            )}
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

                    {/* question card */}
                    <div style={{ ...card.base, marginTop: spacing.lg, maxHeight: 320, overflowY: 'auto' }}
                        dangerouslySetInnerHTML={{ __html: instruction }} />

                    {/* code editor */}
                    <Compiler code={studentCode} setCode={setStudentCode} onRun={handleRun} output={result} hideRunButton={true} />

                    {/* action buttons */}
                    <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                        <button onClick={handleRun} style={btn.primary}>▶ Run Code</button>
                        <button onClick={handleSubmit} style={btn.success}>📤 Submit Code</button>
                    </div>

                    {/* hints */}
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

                    {/* grading */}
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
                </>
            )}
        </div>
    );
}
