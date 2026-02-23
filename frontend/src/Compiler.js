import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { v4 as uuidv4 } from 'uuid';

function Compiler({ code, setCode, onRun, output, hideRunButton = false }) {
    const [files, setFiles] = useState([]);
    const [activeFileId, setActiveFileId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [localOutput, setLocalOutput] = useState("");
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const [editingFileId, setEditingFileId] = useState(null);

    // Initialize files from parent's code prop
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

    // Sync active file content back to parent
    useEffect(() => {
        const activeFile = files.find(f => f.id === activeFileId);
        if (activeFile && setCode) {
            setCode(activeFile.content);
        }
    }, [files, activeFileId, setCode]);

    const extractClassName = (code) => {
        const match = code.match(/public\s+class\s+([a-zA-Z0-9_]+)/);
        return match ? match[1] : 'Main';
    };

    const activeFile = files.find((file) => file.id === activeFileId);

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
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

    const handleFileNameChange = (e, fileId) => {
        updateFileName(fileId, e.target.value);
    };

    const handleFileNameBlur = () => {
        setEditingFileId(null);
    };

    const handleFileNameKeyDown = (e) => {
        if (e.key === 'Enter') {
            setEditingFileId(null);
        }
    };

    const updateFileContent = (fileId, newContent) => {
        setFiles(files.map(file =>
            file.id === fileId ? { ...file, content: newContent || '' } : file
        ));
    };

    const checkSyntax = async () => {
        if (!editorRef.current || !monacoRef.current || files.length === 0) return;

        const filesToSend = files.map(file => ({
            filename: file.filename,
            content: file.content,
        }));

        try {
            const res = await fetch('http://localhost:8000/api/check-syntax', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesToSend }),
            });
            const data = await res.json();

            monacoRef.current.editor.getModels().forEach(model => {
                monacoRef.current.editor.setModelMarkers(model, 'owner', []);
            });

            if (data.errors && data.errors.length > 0) {
                const errorsByFile = {};

                data.errors.forEach(err => {
                    const filename = err.file || 'general';
                    if (!errorsByFile[filename]) {
                        errorsByFile[filename] = [];
                    }
                    errorsByFile[filename].push(err);
                });

                for (const filename in errorsByFile) {
                    const fileErrors = errorsByFile[filename];
                    const model = monacoRef.current.editor.getModels().find(m => m.uri.path.endsWith(filename));

                    if (model) {
                        const markers = fileErrors.map(err => ({
                            startLineNumber: err.line,
                            startColumn: 1,
                            endLineNumber: err.line,
                            endColumn: model.getLineMaxColumn(err.line),
                            message: `${err.file ? `[${err.file}] ` : ''}${err.message}`,
                            severity: monacoRef.current.MarkerSeverity.Error,
                        }));
                        monacoRef.current.editor.setModelMarkers(model, 'owner', markers);
                    }
                }
            }
        } catch (e) {
            console.error('Syntax check error:', e);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            checkSyntax();
        }, 1000);
        return () => clearTimeout(timeout);
    }, [files, activeFileId]);

    // Built-in Run Code function (for pages without external buttons)
    const handleInternalRun = async () => {
        setLoading(true);
        setLocalOutput("Running code...");

        const filesToSend = files.map(file => ({
            filename: file.filename,
            content: file.content,
        }));

        try {
            const res = await fetch('http://localhost:8000/api/run-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesToSend }),
            });
            const data = await res.json();

            if (data.output) {
                setLocalOutput(data.output);
            } else if (data.error) {
                setLocalOutput(`Error:\n${data.error}`);
            } else {
                setLocalOutput("No output received.");
            }
        } catch (e) {
            setLocalOutput(`Failed to run code: ${e.message}`);
        } finally {
            setLoading(false);
            window.dispatchEvent(new CustomEvent('demo-code-output'));
        }
    };

    // Use parent's onRun if provided, otherwise use internal handler
    const handleRun = onRun || handleInternalRun;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3>Java Editor</h3>
            <div style={{ display: 'flex', marginBottom: '10px', borderBottom: '1px solid #ccc' }}>
                {files.map((file) => (
                    <div
                        key={file.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 10px',
                            cursor: 'pointer',
                            border: 'none',
                            borderBottom: file.id === activeFileId ? '2px solid blue' : 'none',
                            backgroundColor: file.id === activeFileId ? '#e0e0e0' : '#f0f0f0',
                            marginRight: '5px',
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
                                style={{ marginRight: '10px' }}
                            >
                                {file.filename}
                            </span>
                        )}
                        <button 
                            onClick={() => removeFile(file.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}
                            title="Close Tab"
                        >
                            ✕
                        </button>
                    </div>
                ))}
                <button onClick={addFile} style={{ padding: '8px 15px', cursor: 'pointer', border: 'none', backgroundColor: '#d0d0d0' }}>
                    +
                </button>
            </div>

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

            {/* Show Run button ONLY if hideRunButton is false */}
            {!hideRunButton && (
                <div style={{ marginTop: '10px' }}>
                    <button 
                        data-tour="run-button"
                        onClick={handleRun}
                        disabled={loading}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: loading ? '#ccc' : '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        {loading ? 'Running...' : 'Run Code'}
                    </button>
                </div>
            )}

            {/* Show output - use parent's output if provided, otherwise use local */}
            {(output || localOutput) && !hideRunButton && (
                <pre
                    style={{
                        background: "#e8e8e8",
                        padding: 16,
                        marginTop: 16,
                        whiteSpace: "pre-wrap",
                        maxHeight: '200px',
                        overflowY: 'auto',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                    }}
                >
                    {output || localOutput}
                </pre>
            )}
        </div>
    );
}

export default Compiler;
