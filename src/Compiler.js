import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

function Compiler({ code: externalCode, setCode: setExternalCode, onRun, output: externalOutput, loading: externalLoading }) {
    const [internalCode, setInternalCode] = useState(`public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}`);
    const [internalOutput, setInternalOutput] = useState("");
    const [loading, setLoading] = useState(false);
    const editorRef = useRef(null);

    // 🔁 Move runCode ABOVE isControlled/handleRun
    const runCode = async () => {
        setLoading(true);
        setInternalOutput("");
        try {
            const res = await fetch("http://localhost:8000/api/run-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            const data = await res.json();
            setInternalOutput(data.error ? `Error: ${data.error}` : data.output);
        } catch (e) {
            setInternalOutput("Error: " + e.message);
        }
        setLoading(false);
    };

    const isControlled = typeof externalCode === "string" && typeof setExternalCode === "function";
    const code = isControlled ? externalCode : internalCode;
    const setCode = isControlled ? setExternalCode : setInternalCode;
    const result = isControlled ? externalOutput : internalOutput;
    const handleRun = isControlled ? onRun : runCode;
    const isLoading = isControlled ? externalLoading : loading;

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
    };

    const checkSyntax = async (sourceCode) => {
        const res = await fetch("http://localhost:8000/api/check-syntax", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: sourceCode })
        });
        const data = await res.json();

        const model = editorRef.current?.getModel();
        const monaco = await import("monaco-editor");
        const markers = data.errors.map(err => ({
            startLineNumber: err.line,
            startColumn: 1,
            endLineNumber: err.line,
            endColumn: 100,
            message: err.message,
            severity: monaco.MarkerSeverity.Error
        }));
        monaco.editor.setModelMarkers(model, "owner", markers);
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            checkSyntax(code);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [code]);

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <h3>Java Editor</h3>
            <Editor
                height="300px"
                language="java"
                theme="vs-light"
                value={code}
                onMount={handleEditorDidMount}
                onChange={(value) => setCode(value || "")}
                options={{ fontSize: 14, minimap: { enabled: false }, wordWrap: "on", automaticLayout: true }}
            />
            <button onClick={handleRun} disabled={isLoading} style={{ marginTop: 12 }}>
                {isLoading ? "Running..." : "Run Code"}
            </button>
            <pre style={{ marginTop: 12, backgroundColor: "#f0f0f0", padding: 12, borderRadius: 6 }}>
                {result}
            </pre>
        </div>
    );
}

export default Compiler;