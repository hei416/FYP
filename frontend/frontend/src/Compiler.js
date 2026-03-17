import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { v4 as uuidv4 } from 'uuid';
import { colors, radii, font, spacing, btn, codeOutput, transition } from './theme';

function Compiler({ code, setCode, onRun, output, hideRunButton = false }) {
    const [files, setFiles] = useState([]);
    const [activeFileId, setActiveFileId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [localOutput, setLocalOutput] = useState("");
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const debounceRef = useRef(null);
    const [editingFileId, setEditingFileId] = useState(null);
    const [syntaxErrors, setSyntaxErrors] = useState([]);
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

    // ── Stale closure fix: mirror files and activeFileId into refs ──
    const filesRef = useRef(files);
    useEffect(() => { filesRef.current = files; }, [files]);

    const activeFileIdRef = useRef(activeFileId);
    useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);

    // ── Initialize files from parent's code prop ──
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
    }, [code]);

    // ── Sync active file content back to parent ──
    useEffect(() => {
        const activeFile = files.find(f => f.id === activeFileId);
        if (activeFile && setCode) {
            setCode(activeFile.content);
        }
    }, [files, activeFileId, setCode]);

    // ── Listen for demo tour code fill ──
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

    // ── Cleanup debounce only on unmount ──
    useEffect(() => {
        return () => clearTimeout(debounceRef.current);
    }, []);

    const extractClassName = (code) => {
        const match = code.match(/public\s+class\s+([a-zA-Z0-9_]+)/);
        return match ? match[1] : 'Main';
    };

    const activeFile = files.find((file) => file.id === activeFileId);

    const DEBOUNCE_MS = 1000;
    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        editor.onDidChangeModelContent(() => {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => checkSyntax(), DEBOUNCE_MS);
        });

        // Delay initial check to allow files state to populate
        setTimeout(() => checkSyntax(), 300);
    };

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

    const handleFileNameChange = (e, fileId) => updateFileName(fileId, e.target.value);
    const handleFileNameBlur = () => setEditingFileId(null);
    const handleFileNameKeyDown = (e) => { if (e.key === 'Enter') setEditingFileId(null); };

    const updateFileContent = (fileId, newContent) => {
        setFiles(files.map(file =>
            file.id === fileId ? { ...file, content: newContent || '' } : file
        ));
    };

    // ── Syntax check (uses refs to avoid stale closures) ──
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
            // Debug lines for response
            console.log('[syntax] status:', res.status);
            console.log('[syntax] content-type:', res.headers.get('content-type'));
            const text = await res.text();
            console.log('[syntax] raw body:', text);
            const data = text ? JSON.parse(text) : { errors: [] }; // safe parse

            // Clear all existing markers
            monacoRef.current.editor.getModels().forEach(model => {
                monacoRef.current.editor.setModelMarkers(model, 'java-syntax', []);
            });

            if (data.errors && data.errors.length > 0) {
                setSyntaxErrors(data.errors);

                const errorsByFile = {};
                data.errors.forEach(err => {
                    const filename = err.file || 'general';
                    if (!errorsByFile[filename]) errorsByFile[filename] = [];
                    errorsByFile[filename].push(err);
                });

                // Note: Monaco only holds a model for the active file.
                // Squiggles apply to active file only; tab badges cover all files.
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
            }
        } catch (e) {
            console.error('Syntax check error:', e);
        }
    };

    // ── Built-in Run Code ──
    const handleInternalRun = async () => {
        setLoading(true);
        setLocalOutput("Running code...");

        const filesToSend = files.map(file => ({
            filename: file.filename,
            content: file.content,
        }));
        const mainClass = activeFile ? extractClassName(activeFile.content) : 'Main';

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
                setLocalOutput("(no output)");
            }
        } catch (e) {
            setLocalOutput(`Failed to run code: ${e.message}`);
        } finally {
            setLoading(false);
            window.dispatchEvent(new CustomEvent('demo-code-output'));
        }
    };

    const handleRun = onRun || handleInternalRun;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: font.sizeLg, fontWeight: font.weightSemibold, color: colors.text, margin: `0 0 ${spacing.sm}px 0` }}>
                Java Editor
            </h3>

            {/* ── Tab bar ── */}
            <div style={{ display: 'flex', marginBottom: spacing.sm, borderBottom: `1px solid ${colors.border}` }}>
                {files.map((file) => (
                    <div
                        key={file.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
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
                            style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '5px' }}
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
                                style={{ marginRight: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                {file.filename}
                                {syntaxErrors.filter(e => e.file === file.filename).length > 0 && (
                                    <span style={{
                                        backgroundColor: colors.danger,
                                        color: '#fff',
                                        borderRadius: '50%',
                                        width: '18px',
                                        height: '18px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
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
                    padding: '8px 15px',
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
                <Editor
                    height="300px"
                    language="java"
                    theme="vs-light"
                    value={activeFile.content}
                    onMount={handleEditorDidMount}
                    onChange={(value) => updateFileContent(activeFile.id, value || '')}
                    options={{ fontSize: 14, minimap: { enabled: false }, wordWrap: 'on', automaticLayout: true }}
                    path={activeFile.filename}
                />
            )}

            {/* ── Problems panel ── */}
            {syntaxErrors.length > 0 && (
                <div style={{
                    marginTop: spacing.sm,
                    border: `1px solid ${colors.dangerBorder}`,
                    borderRadius: radii.sm,
                    backgroundColor: colors.dangerLight,
                    maxHeight: '140px',
                    overflowY: 'auto',
                    fontSize: font.sizeSm,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        padding: `${spacing.xs}px ${spacing.sm}px`,
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
                                padding: `${spacing.xs}px ${spacing.sm}px`,
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
                            <span style={{ color: colors.text, flex: 1 }}>{err.message}</span>
                            <span style={{ color: colors.textMuted, flexShrink: 0, fontFamily: font.mono, fontSize: '12px' }}>
                                {err.file}:{err.line}{err.column ? `:${err.column}` : ''}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Run button ── */}
            {!hideRunButton && (
                <div style={{ marginTop: spacing.sm }}>
                    <button
                        data-tour="run-button"
                        onClick={handleRun}
                        disabled={loading}
                        style={loading ? btn.disabled : btn.primary}
                    >
                        {loading ? 'Running...' : '▶ Run Code'}
                    </button>
                </div>
            )}

            {/* ── Output panel ── */}
            {(output || localOutput) && !hideRunButton && (
                <pre style={{ ...codeOutput, marginTop: spacing.lg }}>
                    {output || localOutput}
                </pre>
            )}
        </div>
    );
}

export default Compiler;
