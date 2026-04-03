import React, { useState, useEffect, useRef, useCallback } from "react";
import Compiler from "./Compiler";
import { ProgressTracker } from "./ProgressTracker";
import { submitPracticalChallengeAttempt } from "./classroomService";
import {
    colors, radii, font, spacing, btn, card, codeOutput,
} from './theme';

// ─── helpers (shared with PracticalTest) ──────────────────────────────────────
export function buildInstructionHtml(q) {
    if (!q) return '';
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

export function buildStarterCode(baseCode) {
    if (!baseCode) return 'public class Main {\n\n}';
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

/**
 * CodingChallengePlayer
 *
 * A fully self-contained coding challenge UI. Works for both:
 *  - AI-generated practice challenges (standalone)
 *  - Teacher-created classroom challenges (pass `classroomId` and `challengeId`)
 *
 * Props
 * ─────
 * challenge        { question: obj, baseCode: obj, modelSolution: obj, id?: number }
 *                  Always in camelCase-normalized form. Use normalizeChallenge() below to
 *                  convert raw classroom payloads (snake_case) before passing.
 * onBack           () => void   – called when user clicks "← Back"
 * topics           string[]     – optional, displayed as tags and used in my-work saving
 * label            string       – optional badge text (e.g. "🤖 AI Generated", "📝 Classroom")
 * onNewQuestion    () => void   – optional, shows a "🔄 New Question" button when provided
 * generating       bool         – optional, shows spinner on the new-question button
 * classroomId      number       – optional, required for classroom challenges to save results
 * challengeId      number       – optional, the classroom challenge ID for saving submissions
 */
export default function CodingChallengePlayer({
    challenge,
    onBack,
    topics = [],
    label = '🤖 AI Generated',
    onNewQuestion,
    generating = false,
    classroomId = null,
    challengeId = null,
}) {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

    const [instruction, setInstruction]         = useState('');
    const [studentCode, setStudentCode]         = useState('');
    const [baseClassName, setBaseClassName]     = useState('Main');

    const [result, setResult]                   = useState('');
    const [compilerErrorLines, setCompilerErrorLines] = useState([]);
    const [elapsedTime, setElapsedTime]         = useState(0);
    const [started, setStarted]                 = useState(false);
    const [submitted, setSubmitted]             = useState(false);

    const [gradingResults, setGradingResults]   = useState(null);
    const [gradingLoading, setGradingLoading]   = useState(false);
    const [hints, setHints]                     = useState([]);
    const [hintLevel, setHintLevel]             = useState('gentle');
    const [hintLoading, setHintLoading]         = useState(false);
    const [testResults, setTestResults]         = useState(null);
    const [modelSolution, setModelSolution]     = useState(null);
    const [showModelAnswer, setShowModelAnswer] = useState(false);

    const tracker = useRef(new ProgressTracker()).current;

    // ── Diagnostic: log classroom context on mount ────────────────────────────
    useEffect(() => {
        console.log(`📎 [CodingChallengePlayer] Props loaded:`, {
            hasChallenge: !!challenge,
            classroomId,
            challengeId,
            label,
        });
    }, [classroomId, challengeId, challenge, label]);

    // ── initialize state from challenge prop ──────────────────────────────────
    useEffect(() => {
        if (!challenge) return;
        const cls = challenge.baseCode?.class || "Main";
        setBaseClassName(cls);
        setInstruction(buildInstructionHtml(challenge.question));
        setStudentCode(buildStarterCode(challenge.baseCode));
        localStorage.setItem("expectedOutput", JSON.stringify(challenge.question?.expectedOutput || []));
        setResult('');
        setCompilerErrorLines([]);
        setGradingResults(null);
        setHints([]);
        setHintLevel('gentle');
        setTestResults(null);
        setElapsedTime(0);
        setStarted(true);
        setSubmitted(false);
        setModelSolution(null);
        setShowModelAnswer(false);
    }, [challenge]);

    // ── timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!started) return;
        const interval = setInterval(() => setElapsedTime(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [started]);

    // ── build eval payload ────────────────────────────────────────────────────
    const buildEvalPayload = useCallback(() => {
        const cleanCode = studentCode
            .replace(/public\s+void\s+runApp\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g, '')
            .trim();

        const codeFiles = {
            [baseClassName]: cleanCode,
            Main: cleanCode,
            Solution: cleanCode,
        };

        // Classroom challenges have no pre-persisted question_db_id; pass question_data
        // so the server uses it directly. Practice challenges with a real DB id use it.
        const questionDbId = challenge?.id || null;
        const questionData = {
            baseCode: challenge?.baseCode,
            solution: challenge?.modelSolution,
            question: challenge?.question,
        };

        return {
            url: `${API_BASE}/api/practical-tests/evaluate-ai`,
            body: {
                code_files: codeFiles,
                question_db_id: questionDbId,
                question_data: questionData,
            },
        };
    }, [studentCode, baseClassName, challenge, API_BASE]);

    // ── run ───────────────────────────────────────────────────────────────────
    const handleRun = useCallback(async () => {
        const { url, body } = buildEvalPayload();
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.error && !data.success) {
                setResult(`❌ Compilation/Runtime Error:\n${data.error}`);
                const WRAPPER_LINE_OFFSET = 0;
                const parsed = parseCompilerErrors(data.error).map(l => Math.max(1, l - WRAPPER_LINE_OFFSET));
                setCompilerErrorLines(parsed);
            } else {
                setResult(data.success
                    ? `Output:\n\n${data.output}`
                    : `❌ Compilation/Runtime Error:\n${data.error}`);
                setCompilerErrorLines([]);
            }
        } catch (e) {
            setResult(`Failed to run code: ${e.message}`);
        }
    }, [buildEvalPayload]);

    // ── submit ────────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (e) => {
        if (submitted) return;
        if (e) e.preventDefault();
        
        // Log classroom context
        if (classroomId && challengeId) {
            console.log(`🎓 [Classroom Challenge Submission] classroom=${classroomId}, challenge=${challengeId}`);
        } else {
            console.log(`🤖 [AI Practice Submission] (not linked to classroom)`);
        }
        
        setSubmitted(true);
        setStarted(false);
        const { url, body } = buildEvalPayload();
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!data.success) {
                setResult(`❌ Submission Failed - Compilation/Runtime Error:\n${data.error}`);
                const WRAPPER_LINE_OFFSET = 0;
                const parsed = parseCompilerErrors(data.error).map(l => Math.max(1, l - WRAPPER_LINE_OFFSET));
                setCompilerErrorLines(parsed);
                const errorResults = {
                    passed: [], failed: ["Compilation Error"],
                    expected_outputs: [], actual_outputs: [data.error],
                };
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
                const exp    = expectedLines[i]  || "(missing)";
                if (actual === exp) { passed.push(`Line ${i + 1}`); }
                else {
                    failed.push(`Line ${i + 1}`);
                    expectedOutputs.push(exp);
                    actualOutputs.push(actual);
                }
            }

            const results = { passed, failed, expected_outputs: expectedOutputs, actual_outputs: actualOutputs };
            setTestResults(results);

            if (data.model_solution) setModelSolution(data.model_solution);

            if (failed.length === 0) {
                setResult(`✅ All tests passed! Your solution is correct.\n\nYour Output:\n${actualOutput}`);
            } else {
                const lines = ["❌ Tests failed - Output does not match expected:\n"];
                for (let i = 0; i < maxLines; i++) {
                    const actual = actualLines[i] || "(missing)";
                    const exp    = expectedLines[i]  || "(missing)";
                    if (actual === exp) { lines.push(`✓ Line ${i + 1}: ${actual}`); }
                    else {
                        lines.push(`✗ Line ${i + 1}:`);
                        lines.push(`  Your output:    "${actual}"`);
                        lines.push(`  Expected:       "${exp}"`);
                        lines.push('');
                    }
                }
                setResult(lines.join("\n"));
            }

            await gradeSubmission(results);

            // ── Save to classroom backend if this is a classroom challenge ────
            if (classroomId && challengeId) {
                try {
                    console.log(`📤 [Classroom] Saving attempt: classroom=${classroomId}, challenge=${challengeId}, passed=${failed.length === 0}`);
                    const submittedCode = {
                        [baseClassName]: studentCode,
                    };
                    const executionOutput = {
                        success: true,
                        output: actualOutput,
                        passed: failed.length === 0,
                        stdout: actualOutput,
                        stderr: "", // No errors if we got here
                        build_stderr: "", // No build errors if we got here
                    };
                    const result = await submitPracticalChallengeAttempt(classroomId, challengeId, submittedCode, executionOutput);
                    console.log(`✅ [Classroom] Attempt saved for challenge ${challengeId}:`, result);
                } catch (submitErr) {
                    console.error(`❌ [Classroom] Failed to save attempt:`, submitErr);
                    // Don't block the submission if saving fails; user already has their result
                }
            }
        } catch (e) {
            setResult(`❌ Failed to evaluate code: ${e.message}`);

            // ── Also save failed attempts to classroom ────
            if (classroomId && challengeId) {
                try {
                    console.log(`📤 [Classroom] Saving failed attempt: classroom=${classroomId}, challenge=${challengeId}`);
                    const submittedCode = {
                        [baseClassName]: studentCode,
                    };
                    const executionOutput = {
                        success: false,
                        error: e.message,
                        passed: false,
                    };
                    const result = await submitPracticalChallengeAttempt(classroomId, challengeId, submittedCode, executionOutput);
                    console.log(`✅ [Classroom] Failed attempt saved:`, result);
                } catch (submitErr) {
                    console.error(`❌ [Classroom] Failed to save failed attempt:`, submitErr);
                }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitted, buildEvalPayload]);

    // ── grade ─────────────────────────────────────────────────────────────────
    const gradeSubmission = useCallback(async (results) => {
        setGradingLoading(true);
        try {
            const questionDesc  = challenge?.question?.description || "Complete the coding task";
            const questionTitle = challenge?.question?.title        || "Coding Challenge";
            const res = await fetch(`${API_BASE}/api/grading/evaluate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

                if (grading && typeof grading.total_score === 'number' && grading.total_score >= 60) {
                    const testId = `test_${challenge?.id || 'classroom'}_${Date.now()}`;
                    try {
                        tracker.markTestPassed(testId, grading.total_score);
                        window.dispatchEvent(new Event('progress-updated'));
                    } catch (err) {
                        console.warn('Failed to mark progress locally:', err);
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
                            title: questionTitle,
                            topic_id: topics[0] || null,
                            content: studentCode,
                            result_data: {
                                score: grading.total_score,
                                grade: grading.grade_letter,
                                passed,
                                feedback: grading.feedback,
                                suggestions: grading.suggestions || [],
                                topics,
                                topics_covered: topics,
                                question: {
                                    title: questionTitle,
                                    description: questionDesc,
                                    methods: challenge?.question?.methods || [],
                                    expected_output: challenge?.question?.expectedOutput || [],
                                },
                                test_cases: { passed: results.passed, failed: results.failed },
                            },
                        }),
                    }).catch(err => console.warn('saveWork failed:', err));
                }
            }
        } catch { /* swallow */ }
        finally { setGradingLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [challenge, studentCode, topics, API_BASE]);

    // ── hint ──────────────────────────────────────────────────────────────────
    const requestHint = useCallback(async () => {
        setHintLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/hints/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_description: challenge?.question?.description || "",
                    student_code: studentCode,
                    test_cases_failed: testResults?.failed || [],
                    expected_output: testResults?.expected_outputs?.[0] || 'Not yet tested',
                    actual_output:   testResults?.actual_outputs?.[0]   || 'Not yet tested',
                    hint_level: hintLevel,
                    previous_hints: hints.map(h => h.hint),
                }),
            });
            if (!res.ok) throw new Error('Failed to get hint');
            const hintData = await res.json();
            setHints(prev => [...prev, hintData]);
            if (hintData.next_level) setHintLevel(hintData.next_level);
        } catch { alert('Failed to generate hint. Please try again.'); }
        finally { setHintLoading(false); }
    }, [API_BASE, challenge, studentCode, testResults, hintLevel, hints]);

    const formatTime = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

    if (!challenge) return null;

    return (
        <div>
            {/* ── header bar ────────────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                    <span style={{ fontWeight: font.weightBold, color: colors.text, fontSize: font.sizeMd }}>
                        ⏱ {formatTime(elapsedTime)}
                    </span>
                    <span style={{
                        background: colors.primaryLight,
                        color: colors.primary,
                        border: `1px solid ${colors.primaryBorder}`,
                        borderRadius: radii.full, padding: '2px 10px',
                        fontSize: font.sizeXs, fontWeight: font.weightSemibold,
                    }}>
                        {label}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: spacing.sm }}>
                    {onNewQuestion && (
                        <button
                            onClick={onNewQuestion}
                            disabled={generating}
                            style={{ ...btn.secondary, fontSize: font.sizeSm }}
                        >
                            {generating ? '⏳...' : '🔄 New Question'}
                        </button>
                    )}
                    <button onClick={onBack} style={{ ...btn.ghost, fontSize: font.sizeSm }}>
                        ← Back
                    </button>
                </div>
            </div>

            {/* ── instruction card ──────────────────────────────────────────── */}
            <div
                style={{ ...card.base, marginTop: spacing.lg, maxHeight: 320, overflowY: 'auto' }}
                dangerouslySetInnerHTML={{ __html: instruction }}
            />

            {/* ── editor ────────────────────────────────────────────────────── */}
            <Compiler
                code={studentCode}
                setCode={setStudentCode}
                onRun={handleRun}
                output={result}
                hideRunButton={true}
                readOnly={submitted}
                compilerErrorLines={compilerErrorLines}
            />

            {/* ── run / submit buttons ──────────────────────────────────────── */}
            <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                <button
                    onClick={handleRun}
                    disabled={submitted}
                    style={{ ...btn.primary, opacity: submitted ? 0.5 : 1 }}
                >
                    ▶ Run Code
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={submitted}
                    style={{ ...btn.success, opacity: submitted ? 0.5 : 1 }}
                >
                    {submitted ? '✅ Submitted' : '📤 Submit Code'}
                </button>
            </div>

            {/* ── hints panel ───────────────────────────────────────────────── */}
            <div style={{ ...card.warning, padding: spacing.xl, margin: `${spacing.xl}px 0` }}>
                <h3 style={{ marginTop: 0, color: colors.text, fontSize: font.sizeLg }}>💡 Need Help?</h3>
                {testResults ? (
                    testResults.failed?.length > 0
                        ? <p style={{ marginBottom: spacing.lg, color: colors.warning }}>
                            You have {testResults.failed.length} failed test(s). Get AI hints to help fix your code!
                          </p>
                        : <p style={{ marginBottom: spacing.lg, color: colors.success }}>
                            ✅ All tests passed! Want to improve your code further?
                          </p>
                ) : (
                    <p style={{ marginBottom: spacing.lg, color: colors.textSecondary }}>
                        Stuck? Request AI hints to guide you through the solution!
                    </p>
                )}
                <button
                    onClick={requestHint}
                    disabled={hintLoading || hints.length >= 3}
                    style={{ ...(hints.length >= 3 ? btn.disabled : btn.warning), marginBottom: spacing.lg }}
                >
                    {hintLoading        ? '⏳ Generating hint...' :
                     hints.length === 0 ? '💡 Get Your First Hint' :
                     hints.length === 1 ? '💡 Get a More Specific Hint' :
                                          '💡 Get Final Detailed Hint'}
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
                        <p style={{ fontSize: font.sizeMd, lineHeight: 1.6, color: colors.textSecondary, margin: 0 }}>
                            {hintData.hint}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── grading loading spinner ───────────────────────────────────── */}
            {gradingLoading && !gradingResults && (
                <div style={{
                    ...card.info, padding: spacing.xl, margin: `${spacing.xl}px 0`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.md,
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

            {/* ── grading results ───────────────────────────────────────────── */}
            {gradingResults && (
                <div style={{ ...card.info, padding: spacing.xl, margin: `${spacing.xl}px 0` }}>
                    <h3 style={{ color: colors.primary, marginBottom: spacing.lg, fontSize: font.sizeLg }}>
                        📊 Your Score: {gradingResults.total_score}/100 ({gradingResults.grade_letter})
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing.lg, marginBottom: spacing.xl }}>
                        {[
                            { label: 'Test Cases',   val: gradingResults.breakdown?.test_cases,   max: 50 },
                            { label: 'Approach',     val: gradingResults.breakdown?.approach,     max: 30 },
                            { label: 'Code Quality', val: gradingResults.breakdown?.code_quality, max: 20 },
                        ].map((item, i) => (
                            <div key={i} style={{ ...card.base, textAlign: 'center' }}>
                                <div style={{ fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 5, fontSize: font.sizeSm }}>
                                    {item.label}
                                </div>
                                <div style={{ fontSize: font.sizeXxl, color: colors.primary, fontWeight: font.weightBold }}>
                                    {item.val}/{item.max}
                                </div>
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
                                {gradingResults.suggestions.map((s, i) => (
                                    <li key={i} style={{ marginBottom: spacing.sm }}>{s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div style={card.base}>
                        <h5 style={{ color: colors.text, margin: `0 0 ${spacing.sm}px 0` }}>✨ Code Quality Notes:</h5>
                        <p style={{ color: colors.textSecondary, margin: 0 }}>{gradingResults.code_quality_notes}</p>
                    </div>
                </div>
            )}

            {/* ── output ────────────────────────────────────────────────────── */}
            {result && <pre style={{ ...codeOutput, marginTop: spacing.lg }}>{result}</pre>}

            {/* ── model answer ──────────────────────────────────────────────── */}
            {submitted && modelSolution && (
                <div style={{ marginTop: spacing.lg }}>
                    <button
                        onClick={() => setShowModelAnswer(v => !v)}
                        style={{
                            ...btn.secondary,
                            background: showModelAnswer ? '#f3f0ff' : undefined,
                            border: `1px solid ${showModelAnswer ? '#a78bfa' : colors.border}`,
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
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── utility: parse compiler error line numbers ────────────────────────────────
function parseCompilerErrors(errorText) {
    const errors = [];
    const regex = /(?:[\w\-]+)\.java:(\d+):/g;
    let match;
    while ((match = regex.exec(errorText)) !== null) {
        errors.push(parseInt(match[1], 10));
    }
    return errors;
}

/**
 * normalizeChallenge
 *
 * Converts a raw classroom practical challenge (snake_case, from the API) into
 * the canonical form expected by CodingChallengePlayer.
 *
 * @param {object} raw  - challenge object from listClassroomPracticalChallenges / getClassroomPracticalChallenge
 * @returns {{ id, question, baseCode, modelSolution, title }}
 */
export function normalizeChallenge(raw) {
    if (!raw) return null;
    return {
        id:            raw.id    || null,
        title:         raw.title || '',
        question:      raw.question      || raw.question_data?.question || {},
        baseCode:      raw.base_code     || raw.baseCode                || raw.question_data?.baseCode || {},
        modelSolution: raw.model_solution || raw.modelSolution          || raw.question_data?.solution || null,
    };
}
