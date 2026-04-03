import React, { useState, useEffect, useRef, Suspense } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { colors, radii, font, spacing, btn, codeOutput, transition } from './theme';
const Editor = React.lazy(() => import('@monaco-editor/react'));

// Simple error boundary to catch editor runtime errors (monaco loader issues)
class EditorErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('Editor error:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 12, background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: 6 }}>
                    <strong>Editor failed to load.</strong>
                    <div style={{ marginTop: 8 }}>
                        The Monaco editor failed to initialize (this can happen with incompatible package versions during hot-reload).
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                        Try restarting the dev server, or run <code>npm ls @monaco-editor/loader monaco-editor @monaco-editor/react</code>.
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

function Compiler({ code, setCode, onRun, output, hideRunButton = false, readOnly = false, compilerErrorLines = [] }) {
    const [files, setFiles] = useState([]);
    const [activeFileId, setActiveFileId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [localOutput, setLocalOutput] = useState("");
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const debounceRef = useRef(null);
    const filenameDebounceRef = useRef(null);
    const [editingFileId, setEditingFileId] = useState(null);
    const [syntaxErrors, setSyntaxErrors] = useState([]);
    const [errorExplanations, setErrorExplanations] = useState({}); // { idx: "explanation text" }
    const [wsRunning, setWsRunning] = useState(false);
    const [stdinInput, setStdinInput] = useState('');
    const decorationIdsRef = useRef([]);
    const wsRef = useRef(null);
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
    const TERMINAL_WS = process.env.REACT_APP_TERMINAL_WS;

    const filesRef = useRef(files);
    useEffect(() => { filesRef.current = files; }, [files]);

    const activeFileIdRef = useRef(activeFileId);
    useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);

    useEffect(() => {
        if (code && files.length === 0) {
            const extractedClassName = extractClassName(code);
            const initialFile = {
                id: uuidv4(),
                filename: `${extractedClassName}.java`,
                content: code,
            };
            setFiles([initialFile]);
            setActiveFileId(initialFile.id);
        }
    }, [code, files.length]);

    useEffect(() => {
        const activeFile = files.find(f => f.id === activeFileId);
        if (activeFile && setCode) {
            setCode(activeFile.content);
        }
    }, [files, activeFileId, setCode]);

    useEffect(() => {
        const handleDemoFill = (event) => {
            if (event.detail && event.detail.code) {
                const newCode = event.detail.code;
                const extractedClassName = extractClassName(newCode);
                const demoFile = {
                    id: uuidv4(),
                    filename: `${extractedClassName}.java`,
                    content: newCode,
                };
                setFiles([demoFile]);
                setActiveFileId(demoFile.id);
            }
        };
        window.addEventListener('demo-fill-code', handleDemoFill);
        return () => window.removeEventListener('demo-fill-code', handleDemoFill);
    }, []);

    useEffect(() => {
        return () => {
            clearTimeout(debounceRef.current);
            clearTimeout(filenameDebounceRef.current);
            if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        };
    }, []);

    const extractClassName = (code) => {
        const match = code.match(/public\s+class\s+([a-zA-Z0-9_]+)/);
        return match ? match[1] : 'Main';
    };

    const activeFile = files.find((file) => file.id === activeFileId);

    const getLineContext = (line, content, radius = 3) => {
        const lines = content.split('\n');
        const start = Math.max(0, line - 1 - radius);
        const end = Math.min(lines.length, line - 1 + radius + 1);
        return lines.slice(start, end).join('\n');
    };

    const fetchErrorExplanations = async (errors) => {
        const code = filesRef.current.find(f => f.id === activeFileIdRef.current)?.content || '';
        const results = {};
        await Promise.all(
            errors.map(async (err, idx) => {
                try {
                    // For known class-name mismatch errors, return a deterministic hint
                    if (err.message && err.message.startsWith("Class name mismatch")) {
                        const m = err.message.match(/class '([a-zA-Z0-9_]+)'/);
                        const cls = m ? m[1] : 'YourClass';
                        const activeFilename = filesRef.current.find(f => f.id === activeFileIdRef.current)?.filename || 'YourFile.java';
                        const fileBase = activeFilename.replace(/\.java$/i, '');
                        results[idx] = `Rename the file to ${cls}.java, or change the public class name to match the file name ${fileBase}.`;
                        return;
                    }

                    const res = await fetch(`${API_BASE}/api/explain-error`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            error_message: err.message,
                            code_snippet: getLineContext(err.line, code),
                            line_number: err.line,
                        }),
                    });
                    const data = await res.json();
                    results[idx] = data.explanation;
                } catch {
                    results[idx] = null;
                }
            })
        );
        setErrorExplanations(results);
    };

    const DEBOUNCE_MS = 1000;
    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        editor.onDidChangeModelContent(() => {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => checkSyntax(), DEBOUNCE_MS);
        });

        setTimeout(() => checkSyntax(), 300);
    };

    // Apply editor decorations for compiler errors coming from remote compile step
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        const monaco = monacoRef.current;
        // convert lines into decorations
        if (Array.isArray(compilerErrorLines) && compilerErrorLines.length > 0) {
            const decorations = compilerErrorLines.map(line => ({
                range: new monaco.Range(line, 1, line, 1),
                options: {
                    isWholeLine: true,
                    className: 'errorLineHighlight',
                    glyphMarginClassName: 'errorGlyph',
                    hoverMessage: { value: `⚠️ Compiler error on line ${line}` }
                }
            }));
            try {
                decorationIdsRef.current = editorRef.current.deltaDecorations(decorationIdsRef.current || [], decorations);
            } catch (e) { console.warn('Decoration error:', e); }
        } else {
            // clear decorations
            try { decorationIdsRef.current = editorRef.current.deltaDecorations(decorationIdsRef.current || [], []); } catch (e) {}
        }
    }, [compilerErrorLines]);

    const addFile = () => {
        const newFile = {
            id: uuidv4(),
            filename: `NewClass${files.length}.java`,
            content: `public class NewClass${files.length} {\n  // Your code here\n}`,
        };
        setFiles([...files, newFile]);
        setActiveFileId(newFile.id);
    };

    const removeFile = (fileId) => {
        const updatedFiles = files.filter(file => file.id !== fileId);
        setFiles(updatedFiles);
        if (activeFileId === fileId) {
            setActiveFileId(updatedFiles.length > 0 ? updatedFiles[0].id : null);
        }
    };

    const handleDownload = (fileContent, fileName) => {
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const updateFileName = (fileId, newName) => {
        setFiles(files.map(file =>
            file.id === fileId ? { ...file, filename: newName } : file
        ));
    };

    const handleFileNameChange = (e, fileId) => {
        updateFileName(fileId, e.target.value);
        clearTimeout(filenameDebounceRef.current);
        filenameDebounceRef.current = setTimeout(() => checkSyntax(), 1000);
    };
    const handleFileNameBlur = () => setEditingFileId(null);
    const handleFileNameKeyDown = (e) => { if (e.key === 'Enter') setEditingFileId(null); };

    const updateFileContent = (fileId, newContent) => {
        setFiles(files.map(file =>
            file.id === fileId ? { ...file, content: newContent || '' } : file
        ));
    };

    const checkSyntax = async () => {
        if (!editorRef.current || !monacoRef.current || filesRef.current.length === 0) return;

        const filesToSend = filesRef.current.map(file => ({
            filename: file.filename,
            content: file.content,
        }));

        try {
            const res = await fetch(`${API_BASE}/api/check-syntax`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesToSend }),
            });
            console.log('[syntax] status:', res.status);
            console.log('[syntax] content-type:', res.headers.get('content-type'));
            const text = await res.text();
            console.log('[syntax] raw body:', text);
            const data = text ? JSON.parse(text) : { errors: [] };

            monacoRef.current.editor.getModels().forEach(model => {
                monacoRef.current.editor.setModelMarkers(model, 'java-syntax', []);
            });

            if (data.errors && data.errors.length > 0) {
                setSyntaxErrors(data.errors);
                fetchErrorExplanations(data.errors); // fetch explanations for each error

                const errorsByFile = {};
                data.errors.forEach(err => {
                    const filename = err.file || 'general';
                    if (!errorsByFile[filename]) errorsByFile[filename] = [];
                    errorsByFile[filename].push(err);
                });

                const activeFilename = filesRef.current.find(
                    f => f.id === activeFileIdRef.current
                )?.filename ?? null;

                const model = editorRef.current.getModel();
                if (model && activeFilename && errorsByFile[activeFilename]) {
                    const markers = errorsByFile[activeFilename].map(err => {
                        const lineContent = model.getLineContent(err.line) || '';
                        const startCol = err.column || (lineContent.search(/\S/) + 1) || 1;
                        let endCol;
                        if (err.column) {
                            const rest = lineContent.substring(err.column - 1);
                            const tokenMatch = rest.match(/^\S+/);
                            endCol = err.column + (tokenMatch ? tokenMatch[0].length : 1);
                        } else {
                            endCol = model.getLineMaxColumn(err.line);
                        }
                        return {
                            startLineNumber: err.line,
                            startColumn: startCol,
                            endLineNumber: err.line,
                            endColumn: endCol,
                            message: err.message,
                            severity: err.severity === 'warning'
                                ? monacoRef.current.MarkerSeverity.Warning
                                : monacoRef.current.MarkerSeverity.Error,
                        };
                    });
                    monacoRef.current.editor.setModelMarkers(model, 'java-syntax', markers);
                }
            } else {
                setSyntaxErrors([]);
                setErrorExplanations({}); // clear explanations when no errors
            }
        } catch (e) {
            console.error('Syntax check error:', e);
        }
    };

    const stripAnsi = (str) => str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

    const handleHttpRun = async () => {
        setLoading(true);
        setLocalOutput('Running code...');
        const filesToSend = filesRef.current.map(file => ({
            filename: file.filename,
            content: file.content,
        }));
        const activeFileCurrent = filesRef.current.find(f => f.id === activeFileIdRef.current);
        const mainClass = activeFileCurrent ? extractClassName(activeFileCurrent.content) : 'Main';
        try {
            const res = await fetch(`${API_BASE}/api/run-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesToSend, main_class: mainClass }),
            });
            const data = await res.json();
            if (data.error && data.error.trim()) {
                setLocalOutput(`Error:\n${data.error}`);
            } else if (data.output && data.output !== 'No output') {
                setLocalOutput(data.output);
            } else {
                setLocalOutput('(no output)');
            }
        } catch (e) {
            setLocalOutput(`Failed to run code: ${e.message}`);
        } finally {
            setLoading(false);
            window.dispatchEvent(new CustomEvent('demo-code-output'));
        }
    };

    const handleWsRun = () => {
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        setLoading(true);
        setWsRunning(true);
        setLocalOutput('');
        setStdinInput('');
        const activeFileCurrent = filesRef.current.find(f => f.id === activeFileIdRef.current);
        const mainClassName = activeFileCurrent ? extractClassName(activeFileCurrent.content) : 'Main';
        const filename = activeFileCurrent?.filename || `${mainClassName}.java`;
        const code = activeFileCurrent?.content || '';
        let ws;
        try {
            ws = new WebSocket(TERMINAL_WS);
        } catch (e) {
            setWsRunning(false);
            setLoading(false);
            handleHttpRun();
            return;
        }
        wsRef.current = ws;
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'run', code, className: mainClassName, filename }));
        };
        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                if (msg.type === 'output') {
                    setLocalOutput(prev => prev + stripAnsi(msg.data));
                } else if (msg.type === 'exit') {
                    setWsRunning(false);
                    setLoading(false);
                    if (wsRef.current === ws) wsRef.current = null;
                    window.dispatchEvent(new CustomEvent('demo-code-output'));
                }
            } catch (e) {}
        };
        ws.onerror = () => {
            setLocalOutput(prev => (prev ? prev + '\n' : '') + '[WebSocket error — retrying via HTTP]');
            ws.close();
            if (wsRef.current === ws) wsRef.current = null;
            setWsRunning(false);
            setLoading(false);
            handleHttpRun();
        };
        ws.onclose = () => {
            if (wsRef.current === ws) {
                wsRef.current = null;
                setWsRunning(false);
                setLoading(false);
            }
        };
    };

    const stopRun = () => {
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        setWsRunning(false);
        setLoading(false);
        setLocalOutput(prev => prev + '\n[Stopped]');
    };

    const sendStdin = (e) => {
        e.preventDefault();
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({ type: 'input', data: stdinInput + '\n' }));
        setLocalOutput(prev => prev + stdinInput + '\n');
        setStdinInput('');
    };

    const handleInternalRun = () => {
        if (TERMINAL_WS) {
            handleWsRun();
        } else {
            handleHttpRun();
        }
    };

    const handleRun = onRun || handleInternalRun;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* ── Header ── */}
            <h3 style={{ fontSize: font.sizeMd, fontWeight: font.weightSemibold, color: colors.text, margin: `${spacing.sm}px 0 ${spacing.xs}px 0` }}>
                Java Editor
            </h3>

            {/* ── Tab bar ── */}
            <div style={{ display: 'flex', marginBottom: spacing.xs, borderBottom: `1px solid ${colors.border}` }}>
                {files.map((file) => (
                    <div
                        key={file.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '5px 10px',
                            cursor: 'pointer',
                            border: 'none',
                            borderBottom: file.id === activeFileId ? `2px solid ${colors.primary}` : 'none',
                            backgroundColor: file.id === activeFileId ? colors.primaryLight : colors.divider,
                            marginRight: spacing.xs,
                            borderRadius: `${radii.sm}px ${radii.sm}px 0 0`,
                            transition,
                            fontSize: font.sizeSm,
                        }}
                    >
                        <button
                            onClick={() => handleDownload(file.content, file.filename)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}
                            title="Download File"
                        >
                            ⬇️
                        </button>
                        {editingFileId === file.id ? (
                            <input
                                type="text"
                                value={file.filename}
                                onChange={(e) => handleFileNameChange(e, file.id)}
                                onBlur={handleFileNameBlur}
                                onKeyDown={handleFileNameKeyDown}
                                autoFocus
                                style={{ border: '1px solid blue', padding: '2px', width: '100px' }}
                            />
                        ) : (
                            <span
                                onDoubleClick={() => setEditingFileId(file.id)}
                                onClick={() => setActiveFileId(file.id)}
                                style={{ marginRight: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                {file.filename}
                                {syntaxErrors.filter(e => e.file === file.filename).length > 0 && (
                                    <span style={{
                                        backgroundColor: colors.danger,
                                        color: '#fff',
                                        borderRadius: '50%',
                                        width: '16px',
                                        height: '16px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        lineHeight: 1,
                                    }}>
                                        {syntaxErrors.filter(e => e.file === file.filename).length}
                                    </span>
                                )}
                            </span>
                        )}
                        <button
                            onClick={() => removeFile(file.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, fontSize: font.sizeSm }}
                            title="Close Tab"
                        >
                            ✕
                        </button>
                    </div>
                ))}
                <button onClick={addFile} style={{
                    padding: '5px 12px',
                    cursor: 'pointer',
                    border: 'none',
                    backgroundColor: colors.divider,
                    borderRadius: `${radii.sm}px ${radii.sm}px 0 0`,
                    fontSize: font.sizeMd,
                    color: colors.textSecondary,
                    transition,
                }}>
                    +
                </button>
            </div>

            {/* ── Monaco Editor ── */}
            {activeFile && (
                <Suspense fallback={<div style={{ padding: 12 }}>Loading editor…</div>}>
                    <Editor
                        height="220px"
                        language="java"
                        theme="vs-light"
                        value={activeFile.content}
                        onMount={handleEditorDidMount}
                        onChange={(value) => updateFileContent(activeFile.id, value || '')}
                        options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: 'on', automaticLayout: true, scrollBeyondLastLine: false, readOnly: readOnly }}
                        path={activeFile.filename}
                    />
                </Suspense>
            )}

            {/* ── Problems panel ── */}
            {syntaxErrors.length > 0 && (
                <div style={{
                    marginTop: spacing.xs,
                    border: `1px solid ${colors.dangerBorder}`,
                    borderRadius: radii.sm,
                    backgroundColor: colors.dangerLight,
                    maxHeight: '240px',
                    overflowY: 'auto',
                    fontSize: font.sizeSm,
                    paddingBottom: spacing.sm,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        padding: `4px ${spacing.sm}px`,
                        borderBottom: `1px solid ${colors.dangerBorder}`,
                        fontWeight: font.weightSemibold,
                        color: colors.danger,
                    }}>
                        <span>⚠</span>
                        <span>Problems ({syntaxErrors.length})</span>
                    </div>
                    {syntaxErrors.map((err, idx) => (
                        <div
                            key={idx}
                            onClick={() => {
                                const targetFile = files.find(f => f.filename === err.file);
                                if (targetFile) setActiveFileId(targetFile.id);
                                if (editorRef.current) {
                                    editorRef.current.revealLineInCenter(err.line);
                                    editorRef.current.setPosition({ lineNumber: err.line, column: err.column || 1 });
                                    editorRef.current.focus();
                                }
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.sm,
                                padding: `4px ${spacing.sm}px`,
                                cursor: 'pointer',
                                borderBottom: idx < syntaxErrors.length - 1 ? `1px solid ${colors.dangerBorder}` : 'none',
                                transition,
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.surface}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <span style={{ color: err.severity === 'warning' ? colors.warning : colors.danger, flexShrink: 0 }}>
                                {err.severity === 'warning' ? '⚠' : '✕'}
                            </span>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ color: colors.text }}>{err.message}</span>
                                {errorExplanations[idx] && (
                                    <div style={{ color: colors.textSecondary, fontSize: '12px', marginTop: '6px', whiteSpace: 'pre-wrap', lineHeight: 1.25 }}>
                                        💡 {errorExplanations[idx]}
                                    </div>
                                )}
                            </div>
                            <span style={{ color: colors.textMuted, flexShrink: 0, fontFamily: font.mono, fontSize: '12px' }}>
                                {err.file}:{err.line}{err.column ? `:${err.column}` : ''}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Run / Stop buttons ── */}
            {!hideRunButton && (
                <div style={{ marginTop: spacing.sm, display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
                    <button
                        data-tour="run-button"
                        onClick={handleRun}
                        disabled={loading}
                        style={loading ? btn.disabled : btn.primary}
                    >
                        {loading ? 'Running...' : '▶ Run Code'}
                    </button>
                    {wsRunning && (
                        <button onClick={stopRun} style={btn.danger}>
                            ■ Stop
                        </button>
                    )}
                </div>
            )}

            {/* ── stdin input (shown while program awaits input) ── */}
            {wsRunning && !hideRunButton && (
                <form onSubmit={sendStdin} style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.xs }}>
                    <input
                        type="text"
                        value={stdinInput}
                        onChange={e => setStdinInput(e.target.value)}
                        placeholder="Type input and press Enter…"
                        autoFocus
                        style={{
                            flex: 1,
                            padding: '4px 8px',
                            border: `1px solid ${colors.border}`,
                            borderRadius: radii.sm,
                            fontFamily: font.mono,
                            fontSize: font.sizeSm,
                        }}
                    />
                    <button type="submit" style={{ ...btn.primary, ...btn.small }}>Send</button>
                </form>
            )}

            {/* ── Output panel ── */}
            {(output || localOutput) && !hideRunButton && (
                <pre style={{ ...codeOutput, marginTop: spacing.sm }}>
                    {output || localOutput}
                </pre>
            )}
        </div>
    );
}

export default Compiler;
