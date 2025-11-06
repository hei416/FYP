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

                if (data.solution?.runApp) {
                    content += `<h4>Example Execution (runApp):</h4><pre>${data.solution.runApp.join("\n")}</pre>`;
                }

                setInstruction(content);

                const baseClass = data.baseCode?.class || "Main";
                const methods = data.baseCode?.methods || {};
                let code = `public class ${baseClass} {\n`;
                for (let key in methods) {
                    code += `    ${methods[key]}\n\n`;
                }
                code += "}";
                setStudentCode(code);

                localStorage.setItem("baseClass", baseClass);
                localStorage.setItem("expectedOutput", JSON.stringify(q.expectedOutput || []));
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
    };

    const handleRun = async () => {
        const baseClass = localStorage.getItem("baseClass");
        const payload = {
            code_files: { [baseClass]: studentCode },
            question_id: selectedQuestion
        };
        


        try {
            const res = await fetch("http://localhost:8000/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            const output = data.output || data.error || "No output.";
            setResult(output);
        } catch (e) {
            setResult("Failed to run code.");
        }
    };

    const handleSubmit = async () => {
        const runWrapper = `
            public class Main {
    public static void main(String[] args) {
        ${baseClass} app = new ${baseClass}();
        // RunApp or sample test cases from JSON
        {currentQuestionData?.solution?.runApp?.map(line => <pre>{line}</pre>)}
    }
}
`;
        const baseClass = localStorage.getItem("baseClass");
        const payload = {
            code_files: {
                "Main.java": studentCode + "\n\n" + runWrapper
              },
            question_id: selectedQuestion
        };

        try {
            const res = await fetch("http://localhost:8000/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            const output = data.output || data.error || "No output.";
            const expected = JSON.parse(localStorage.getItem("expectedOutput") || "[]");

            const actualLines = output.trim().split("\n").map(l => l.trim());
            const expectedLines = expected.map(l => l.trim());

            const comparison = actualLines.map((line, idx) => {
                const exp = expectedLines[idx] || "";
                const match = line === exp;
                return `${match ? "OK" : "Error"} ${line} ${match ? "" : `(Expected: ${exp})`}`;
            }).join("\n");

            setResult(comparison);
        } catch (e) {
            setResult("Failed to evaluate code.");
        }
    };

    const formatTime = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

    return (
        <div style={{ padding: 24 }}>
            <h2>Practical Test</h2>

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
                    <button onClick={handleStart} style={{ marginTop: 16 }}>
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

                    <Compiler code={studentCode} setCode={setStudentCode} onRun={handleRun} output={result} />
                    <div style={{ marginTop: 16 }}>
                        <button onClick={handleSubmit}>
                            Submit Code
                        </button>
                    </div>

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
