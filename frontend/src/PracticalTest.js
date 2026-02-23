import React, { useState, useEffect } from "react";
import Compiler from "./Compiler";

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
        <div style={{ padding: 24 }}>
            <h2>Code Exercise</h2>

            {!started ? (
                <>
                    <div
                        style={{
                            background: "#f4f4f4",
                            padding: 16,
                            marginTop: 16,
                            border: "1px solid #ccc",
                            maxHeight: 300,
                            overflowY: "auto"
                        }}
                        dangerouslySetInnerHTML={{ __html: instruction }}
                    />
                    <button 
                        onClick={handleStart} 
                        style={{ 
                            marginTop: 16,
                            padding: '10px 20px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Start Test
                    </button>
                </>
            ) : (
                <>
                    <div style={{ marginTop: 16 }}>
                        <label>
                            Select Question:
                            <select value={selectedQuestion} onChange={e => setSelectedQuestion(e.target.value)} style={{ marginLeft: 8 }}>
                                {questions.map((q, i) => (
                                    <option key={q.id} value={q.id}>
                                       {q.id.replace(".json", "")}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div style={{ marginTop: 8, fontWeight: "bold" }}>
                        Time Elapsed: {formatTime(elapsedTime)}
                    </div>

                    <div
                        style={{
                            background: "#f4f4f4",
                            padding: 16,
                            marginTop: 16,
                            border: "1px solid #ccc",
                            maxHeight: 300,
                            overflowY: "auto"
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
                    
                    <div style={{ marginTop: 16, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button 
                            onClick={handleRun}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            Run Code
                        </button>
                        <button 
                            onClick={handleSubmit}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            Submit Code
                        </button>
                    </div>

                    {/* HINTS SECTION - ALWAYS AVAILABLE */}
                    <div style={{
                        background: '#fff9e6',
                        padding: 20,
                        borderRadius: 8,
                        margin: '20px 0',
                        border: '2px solid #ffc107'
                    }}>
                        <h3 style={{ marginTop: 0 }}>💡 Need Help?</h3>
                        
                        {testResults ? (
                            testResults.failed && testResults.failed.length > 0 ? (
                                <p style={{ marginBottom: 15, color: '#856404' }}>
                                    You have {testResults.failed.length} failed test(s). Get AI hints to help you fix your code!
                                </p>
                            ) : (
                                <p style={{ marginBottom: 15, color: '#28a745' }}>
                                    ✅ All tests passed! Want to learn how to improve your code further?
                                </p>
                            )
                        ) : (
                            <p style={{ marginBottom: 15, color: '#666' }}>
                                Stuck on this problem? Request AI hints to guide you through the solution!
                            </p>
                        )}
                        
                        <button 
                            onClick={requestHint}
                            disabled={hintLoading || hints.length >= 3}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: hints.length >= 3 ? '#ddd' : '#ffc107',
                                color: hints.length >= 3 ? '#999' : '#000',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: hints.length >= 3 ? 'not-allowed' : 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                marginBottom: 15
                            }}
                        >
                            {hintLoading ? '⏳ Generating hint...' : 
                             hints.length === 0 ? '💡 Get Your First Hint' : 
                             hints.length === 1 ? '💡 Get a More Specific Hint' :
                             '💡 Get Final Detailed Hint'}
                        </button>
                        
                        {hints.length >= 3 && (
                            <p style={{ color: '#856404', fontStyle: 'italic', marginBottom: 15 }}>
                                ✋ You've used all 3 hint levels. Try implementing the solution based on the hints above!
                            </p>
                        )}
                        
                        {hints.map((hintData, idx) => (
                            <div key={idx} style={{
                                background: 'white',
                                padding: 15,
                                borderRadius: 4,
                                marginBottom: 15,
                                borderLeft: '4px solid #ffc107',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    marginBottom: 10
                                }}>
                                    <strong>Hint {idx + 1}</strong>
                                    <span style={{
                                        background: '#ffc107',
                                        color: '#000',
                                        padding: '2px 8px',
                                        borderRadius: 12,
                                        fontSize: 12,
                                        textTransform: 'uppercase',
                                        fontWeight: 'bold'
                                    }}>
                                        {hintData.hint_level}
                                    </span>
                                </div>
                                <p style={{ fontSize: 16, lineHeight: 1.6, color: '#333', margin: 0 }}>
                                    {hintData.hint}
                                </p>
                                {hintData.sources && hintData.sources.length > 0 && (
                                    <div style={{ 
                                        marginTop: 10, 
                                        paddingTop: 10, 
                                        borderTop: '1px solid #eee' 
                                    }}>
                                        <small style={{ color: '#666' }}>
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
                            background: '#e7f3ff',
                            padding: 20,
                            borderRadius: 8,
                            margin: '20px 0',
                            border: '2px solid #007bff'
                        }}>
                            <h3 style={{ color: '#007bff', marginBottom: 15 }}>
                                📊 Your Score: {gradingResults.total_score}/100 ({gradingResults.grade_letter})
                            </h3>
                            
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                                gap: 15,
                                marginBottom: 20
                            }}>
                                <div style={{ background: 'white', padding: 15, borderRadius: 4, textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', color: '#666', marginBottom: 5 }}>Test Cases</div>
                                    <div style={{ fontSize: 24, color: '#007bff', fontWeight: 'bold' }}>
                                        {gradingResults.breakdown.test_cases}/50
                                    </div>
                                </div>
                                <div style={{ background: 'white', padding: 15, borderRadius: 4, textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', color: '#666', marginBottom: 5 }}>Approach</div>
                                    <div style={{ fontSize: 24, color: '#007bff', fontWeight: 'bold' }}>
                                        {gradingResults.breakdown.approach}/30
                                    </div>
                                </div>
                                <div style={{ background: 'white', padding: 15, borderRadius: 4, textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', color: '#666', marginBottom: 5 }}>Code Quality</div>
                                    <div style={{ fontSize: 24, color: '#007bff', fontWeight: 'bold' }}>
                                        {gradingResults.breakdown.code_quality}/20
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'white', padding: 15, borderRadius: 4, marginBottom: 15 }}>
                                <h4>📝 Feedback:</h4>
                                <p>{gradingResults.feedback}</p>
                            </div>

                            {gradingResults.breakdown.test_cases < 50 && (
                                <div style={{ 
                                    background: '#fff3cd', 
                                    padding: 15, 
                                    borderRadius: 4,
                                    borderLeft: '4px solid #ffc107',
                                    marginBottom: 15
                                }}>
                                    <h5>💡 Partial Credit:</h5>
                                    <p>{gradingResults.partial_credit_reasoning}</p>
                                </div>
                            )}

                            {gradingResults.suggestions && gradingResults.suggestions.length > 0 && (
                                <div style={{ background: 'white', padding: 15, borderRadius: 4, marginBottom: 15 }}>
                                    <h5>🔧 How to Improve:</h5>
                                    <ul style={{ paddingLeft: 20 }}>
                                        {gradingResults.suggestions.map((suggestion, idx) => (
                                            <li key={idx} style={{ marginBottom: 8 }}>{suggestion}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div style={{ background: 'white', padding: 15, borderRadius: 4 }}>
                                <h5>✨ Code Quality Notes:</h5>
                                <p>{gradingResults.code_quality_notes}</p>
                            </div>
                        </div>
                    )}

                    {result && (
                        <pre
                            style={{
                                background: "#e8e8e8",
                                padding: 16,
                                marginTop: 16,
                                whiteSpace: "pre-wrap"
                            }}
                        >
                            {result}
                        </pre>
                    )}
                </>
            )}
        </div>
    );
}
