import React, { useState, useEffect } from "react";
import Compiler from "./Compiler";
import { colors, radii, font, spacing, btn, card, pageContainer, pageHeading, codeOutput, transition } from './theme';

export default function PracticalTest() {
    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState("");
    const [instruction, setInstruction] = useState("");
    const [studentCode, setStudentCode] = useState("");
    const [result, setResult] = useState("");
    const [elapsedTime, setElapsedTime] = useState(0);
    const [started, setStarted] = useState(false);
    const [currentQuestionData, setCurrentQuestionData] = useState(null);
    
    // Grading and hints state
    const [gradingResults, setGradingResults] = useState(null);
    const [hints, setHints] = useState([]);
    const [hintLevel, setHintLevel] = useState('gentle');
    const [hintLoading, setHintLoading] = useState(false);
    const [testResults, setTestResults] = useState(null);

    useEffect(() => {
        fetch("http://localhost:8000/questions")
            .then(res => res.json())
            .then(async filenames => {
                const allQuestions = await Promise.all(
                    filenames.map(async file => {
                        const res = await fetch(`http://localhost:8000/question/${file}`);
                        const json = await res.json();
                        return { id: file, data: json };
                    })
                );
                setQuestions(allQuestions);
                if (allQuestions.length > 0) setSelectedQuestion(allQuestions[0].id);
            });
    }, []);

    useEffect(() => {
        if (!selectedQuestion) return;
    
        fetch(`http://localhost:8000/question/${selectedQuestion}`)
            .then(res => res.json())
            .then(data => {
                setCurrentQuestionData(data);
                const q = data.question;
    
                let content = `<p><strong>${q.title || "Untitled"}</strong></p>`;
                if (q.description) content += `<p>${q.description}</p>`;
                if (q.note) content += `<p><em>${q.note}</em></p>`;
    
                if (Array.isArray(q.examples)) {
                    content += `<h4>Examples:</h4>`;
                    content += q.examples.map(ex => {
                        const desc = ex.description ? `<p>${ex.description}</p>` : "";
                        const puzzle = ex.puzzle ? `<pre>${ex.puzzle.map(row => row.join(" ")).join("\n")}</pre>` : "";
                        return desc + puzzle;
                    }).join("");
                }
    
                if (Array.isArray(q.methods)) {
                    content += `<h4>Methods:</h4><ul>`;
                    content += q.methods.map(m => `<li><strong>${m.name}</strong>: ${m.description}</li>`).join("");
                    content += `</ul>`;
                }
    
                if (Array.isArray(q.expectedOutput)) {
                    content += `<h4>Expected Output:</h4><pre>${q.expectedOutput.join("\n")}</pre>`;
                }
    
                setInstruction(content);
    
                const baseClass = data.baseCode?.class || "Main";
                const methods = data.baseCode?.methods || {};
                
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
                setStudentCode(code);
    
                localStorage.setItem("baseClass", baseClass);
                localStorage.setItem("expectedOutput", JSON.stringify(q.expectedOutput || []));
                
                // Reset everything when question changes
                setGradingResults(null);
                setHints([]);
                setHintLevel('gentle');
                setTestResults(null);
            });
    }, [selectedQuestion]);

    useEffect(() => {
        if (!started) return;
        const interval = setInterval(() => setElapsedTime(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [started]);

    const handleStart = () => {
        setStarted(true);
        setElapsedTime(0);
        setResult("");
        setGradingResults(null);
        setHints([]);
        setTestResults(null);
    };

    const handleRun = async () => {
        const baseClass = localStorage.getItem("baseClass");
        
        let cleanCode = studentCode;
        const runAppRegex = /public\s+void\s+runApp\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g;
        cleanCode = cleanCode.replace(runAppRegex, '').trim();
        
        const payload = {
            code_files: { [baseClass]: cleanCode },
            question_id: selectedQuestion
        };
    
        try {
            const res = await fetch("http://localhost:8000/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
    
            const data = await res.json();
            
            if (!data.success) {
                setResult(`❌ Compilation/Runtime Error:\n${data.error}`);
                return;
            }
    
            setResult(`Output:\n\n${data.output}`);
        } catch (e) {
            setResult(`Failed to run code: ${e.message}`);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        const baseClass = localStorage.getItem("baseClass");
        
        let cleanCode = studentCode;
        const runAppRegex = /public\s+void\s+runApp\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g;
        cleanCode = cleanCode.replace(runAppRegex, '').trim();
        
        const payload = {
            code_files: { [baseClass]: cleanCode },
            question_id: selectedQuestion
        };
    
        try {
            const res = await fetch("http://localhost:8000/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
    
            const data = await res.json();
            
            if (!data.success) {
                setResult(`❌ Submission Failed - Compilation/Runtime Error:\n${data.error}`);
                
                // Set test results for grading
                const errorResults = {
                    passed: [],
                    failed: ["Compilation Error"],
                    expected_outputs: [],
                    actual_outputs: [data.error]
                };
                setTestResults(errorResults);
                
                // Grade even compilation errors
                await gradeSubmission(errorResults);
                return;
            }
    
            const actualOutput = data.output.trim();
            const expected = JSON.parse(localStorage.getItem("expectedOutput") || "[]");
    
            const actualLines = actualOutput.split("\n").map(l => l.trim()).filter(l => l);
            const expectedLines = expected.map(l => l.trim());
    
            const passed = [];
            const failed = [];
            const expectedOutputs = [];
            const actualOutputs = [];
            
            const maxLines = Math.max(actualLines.length, expectedLines.length);
            
            for (let i = 0; i < maxLines; i++) {
                const actual = actualLines[i] || "(missing)";
                const exp = expectedLines[i] || "(missing)";
                
                if (actual === exp) {
                    passed.push(`Line ${i + 1}`);
                } else {
                    failed.push(`Line ${i + 1}`);
                    expectedOutputs.push(exp);
                    actualOutputs.push(actual);
                }
            }
            
            const allMatch = failed.length === 0;
            
            const results = {
                passed,
                failed,
                expected_outputs: expectedOutputs,
                actual_outputs: actualOutputs
            };
            
            setTestResults(results);
            console.log("✅ Test results set:", results);
    
            if (allMatch) {
                setResult(`✅ All tests passed! Your solution is correct.\n\nYour Output:\n${actualOutput}`);
            } else {
                const comparison = ["❌ Tests failed - Output does not match expected:\n"];
                
                for (let i = 0; i < maxLines; i++) {
                    const actual = actualLines[i] || "(missing)";
                    const exp = expectedLines[i] || "(missing)";
                    const match = actual === exp;
                    
                    if (match) {
                        comparison.push(`✓ Line ${i + 1}: ${actual}`);
                    } else {
                        comparison.push(`✗ Line ${i + 1}:`);
                        comparison.push(`  Your output:    "${actual}"`);
                        comparison.push(`  Expected:       "${exp}"`);
                        comparison.push('');
                    }
                }
                
                setResult(comparison.join("\n"));
            }
            
            // Trigger AI grading
            await gradeSubmission(results);
            
        } catch (e) {
            setResult(`❌ Failed to evaluate code: ${e.message}`);
        }
    };

    const gradeSubmission = async (results) => {
        try {
            const questionDesc = currentQuestionData?.question?.description || "Complete the coding task";
            const questionTitle = currentQuestionData?.question?.title || "Coding Challenge";
            
            const response = await fetch('http://localhost:8000/api/grading/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_description: `${questionTitle}: ${questionDesc}`,
                    expected_approach: "Implement the solution correctly following Java best practices",
                    student_code: studentCode,
                    test_results: {
                        passed: results.passed || [],
                        failed: results.failed || []
                    },
                    expected_outputs: results.expected_outputs || [],
                    actual_outputs: results.actual_outputs || []
                })
            });
            
            if (!response.ok) {
                console.error('Grading failed:', await response.text());
                return;
            }
            
            const grading = await response.json();
            setGradingResults(grading);
        } catch (error) {
            console.error('Grading error:', error);
        }
    };

    // UPDATED: Request hint works ANYTIME (with or without submission)
    const requestHint = async () => {
        setHintLoading(true);
        try {
            const questionDesc = currentQuestionData?.question?.description || "";
            
            // Use test results if available, otherwise use generic values
            const failedTests = testResults?.failed || [];
            const expectedOutputs = testResults?.expected_outputs || [];
            const actualOutputs = testResults?.actual_outputs || [];
            
            const response = await fetch('http://localhost:8000/api/hints/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_description: questionDesc,
                    student_code: studentCode,
                    test_cases_failed: failedTests,
                    expected_output: expectedOutputs[0] || 'Not yet tested',
                    actual_output: actualOutputs[0] || 'Not yet tested',
                    hint_level: hintLevel,
                    previous_hints: hints.map(h => h.hint)
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to get hint');
            }
            
            const hintData = await response.json();
            setHints([...hints, hintData]);
            
            if (hintData.next_level) {
                setHintLevel(hintData.next_level);
            }
        } catch (error) {
            console.error('Hint error:', error);
            alert('Failed to generate hint. Please try again.');
        } finally {
            setHintLoading(false);
        }
    };
    
    const formatTime = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

    return (
        <div style={pageContainer(1100)}>
            <h2 style={pageHeading}>🎯 Code Exercise</h2>

            {!started ? (
                <>
                    <div
                        style={{
                            ...card.base,
                            marginTop: spacing.lg,
                            maxHeight: 300,
                            overflowY: "auto",
                        }}
                        dangerouslySetInnerHTML={{ __html: instruction }}
                    />
                    <button 
                        onClick={handleStart} 
                        style={{ 
                            ...btn.success,
                            marginTop: spacing.lg,
                        }}
                    >
                        Start Test
                    </button>
                </>
            ) : (
                <>
                    <div style={{ marginTop: spacing.lg }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, fontSize: font.sizeMd, color: colors.textSecondary }}>
                            Select Question:
                            <select value={selectedQuestion} onChange={e => setSelectedQuestion(e.target.value)} style={{
                                padding: '8px 12px',
                                borderRadius: radii.sm,
                                border: `1px solid ${colors.border}`,
                                fontSize: font.sizeMd,
                            }}>
                                {questions.map((q, i) => (
                                    <option key={q.id} value={q.id}>
                                       {q.id.replace(".json", "")}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div style={{ marginTop: spacing.sm, fontWeight: font.weightBold, color: colors.text, fontSize: font.sizeMd }}>
                        Time Elapsed: {formatTime(elapsedTime)}
                    </div>

                    <div
                        style={{
                            ...card.base,
                            marginTop: spacing.lg,
                            maxHeight: 300,
                            overflowY: "auto",
                        }}
                        dangerouslySetInnerHTML={{ __html: instruction }}
                    />

                    <Compiler 
                        code={studentCode} 
                        setCode={setStudentCode} 
                        onRun={handleRun} 
                        output={result}
                        hideRunButton={true}
                    />
                    
                    <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                        <button 
                            onClick={handleRun}
                            style={btn.primary}
                        >
                            ▶ Run Code
                        </button>
                        <button 
                            onClick={handleSubmit}
                            style={btn.success}
                        >
                            📤 Submit Code
                        </button>
                    </div>

                    {/* HINTS SECTION - ALWAYS AVAILABLE */}
                    <div style={{
                        ...card.warning,
                        padding: spacing.xl,
                        margin: `${spacing.xl}px 0`,
                    }}>
                        <h3 style={{ marginTop: 0, color: colors.text, fontSize: font.sizeLg }}>💡 Need Help?</h3>
                        
                        {testResults ? (
                            testResults.failed && testResults.failed.length > 0 ? (
                                <p style={{ marginBottom: spacing.lg, color: colors.warning }}>
                                    You have {testResults.failed.length} failed test(s). Get AI hints to help you fix your code!
                                </p>
                            ) : (
                                <p style={{ marginBottom: spacing.lg, color: colors.success }}>
                                    ✅ All tests passed! Want to learn how to improve your code further?
                                </p>
                            )
                        ) : (
                            <p style={{ marginBottom: spacing.lg, color: colors.textSecondary }}>
                                Stuck on this problem? Request AI hints to guide you through the solution!
                            </p>
                        )}
                        
                        <button 
                            onClick={requestHint}
                            disabled={hintLoading || hints.length >= 3}
                            style={{
                                ...(hints.length >= 3 ? btn.disabled : btn.warning),
                                marginBottom: spacing.lg,
                            }}
                        >
                            {hintLoading ? '⏳ Generating hint...' : 
                             hints.length === 0 ? '💡 Get Your First Hint' : 
                             hints.length === 1 ? '💡 Get a More Specific Hint' :
                             '💡 Get Final Detailed Hint'}
                        </button>
                        
                        {hints.length >= 3 && (
                            <p style={{ color: colors.warning, fontStyle: 'italic', marginBottom: spacing.lg }}>
                                ✋ You've used all 3 hint levels. Try implementing the solution based on the hints above!
                            </p>
                        )}
                        
                        {hints.map((hintData, idx) => (
                            <div key={idx} style={{
                                ...card.base,
                                marginBottom: spacing.lg,
                                borderLeft: `4px solid ${colors.warning}`,
                            }}>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    marginBottom: spacing.sm
                                }}>
                                    <strong style={{ color: colors.text }}>Hint {idx + 1}</strong>
                                    <span style={{
                                        background: colors.warningLight,
                                        color: colors.warning,
                                        padding: '2px 8px',
                                        borderRadius: radii.full,
                                        fontSize: font.sizeXs,
                                        textTransform: 'uppercase',
                                        fontWeight: font.weightBold,
                                        border: `1px solid ${colors.warningBorder}`,
                                    }}>
                                        {hintData.hint_level}
                                    </span>
                                </div>
                                <p style={{ fontSize: font.sizeMd, lineHeight: 1.6, color: colors.textSecondary, margin: 0 }}>
                                    {hintData.hint}
                                </p>
                                {hintData.sources && hintData.sources.length > 0 && (
                                    <div style={{ 
                                        marginTop: spacing.sm, 
                                        paddingTop: spacing.sm, 
                                        borderTop: `1px solid ${colors.border}` 
                                    }}>
                                        <small style={{ color: colors.textMuted }}>
                                            📚 Sources: {hintData.sources.map(s => s.file).join(', ')}
                                        </small>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* AI Grading Results */}
                    {gradingResults && (
                        <div style={{
                            ...card.info,
                            padding: spacing.xl,
                            margin: `${spacing.xl}px 0`,
                        }}>
                            <h3 style={{ color: colors.primary, marginBottom: spacing.lg, fontSize: font.sizeLg }}>
                                📊 Your Score: {gradingResults.total_score}/100 ({gradingResults.grade_letter})
                            </h3>
                            
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                                gap: spacing.lg,
                                marginBottom: spacing.xl
                            }}>
                                {[{ label: 'Test Cases', val: gradingResults.breakdown.test_cases, max: 50 },
                                  { label: 'Approach', val: gradingResults.breakdown.approach, max: 30 },
                                  { label: 'Code Quality', val: gradingResults.breakdown.code_quality, max: 20 },
                                ].map((item, i) => (
                                    <div key={i} style={{ ...card.base, textAlign: 'center' }}>
                                        <div style={{ fontWeight: font.weightSemibold, color: colors.textSecondary, marginBottom: 5, fontSize: font.sizeSm }}>{item.label}</div>
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

                            {gradingResults.breakdown.test_cases < 50 && (
                                <div style={{ 
                                    ...alert.warning,
                                    fontWeight: font.weightNormal,
                                    marginBottom: spacing.lg
                                }}>
                                    <h5 style={{ margin: `0 0 ${spacing.xs}px 0` }}>💡 Partial Credit:</h5>
                                    <p style={{ margin: 0 }}>{gradingResults.partial_credit_reasoning}</p>
                                </div>
                            )}

                            {gradingResults.suggestions && gradingResults.suggestions.length > 0 && (
                                <div style={{ ...card.base, marginBottom: spacing.lg }}>
                                    <h5 style={{ color: colors.text, margin: `0 0 ${spacing.sm}px 0` }}>🔧 How to Improve:</h5>
                                    <ul style={{ paddingLeft: 20, margin: 0, color: colors.textSecondary }}>
                                        {gradingResults.suggestions.map((suggestion, idx) => (
                                            <li key={idx} style={{ marginBottom: spacing.sm }}>{suggestion}</li>
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

                    {result && (
                        <pre style={{ ...codeOutput, marginTop: spacing.lg }}>
                            {result}
                        </pre>
                    )}
                </>
            )}
        </div>
    );
}
