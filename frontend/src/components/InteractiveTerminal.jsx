import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function InteractiveTerminal({ code, filename = 'Main.java', className = 'Main', onExit }) {
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const terminalRef = useRef(null);

  // Keep latest values accessible inside callbacks without re-triggering effect
  const codeRef = useRef(code);
  const filenameRef = useRef(filename);
  const classNameRef = useRef(className);
  const onExitRef = useRef(onExit);

  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { filenameRef.current = filename; }, [filename]);
  useEffect(() => { classNameRef.current = className; }, [className]);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  useEffect(() => {
    // Mount terminal once — never re-run on code/filename/className changes
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e' },
      convertEol: true, // auto-convert \n to \r\n for display
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    terminalRef.current = term;

    if (termRef.current) {
      term.open(termRef.current);
      requestAnimationFrame(() => {
        try { fitAddon.fit(); } catch (e) {}
      });
    }

    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      // Use refs so we always send the latest code at the time of connection
      ws.send(JSON.stringify({
        type: 'run',
        code: codeRef.current,
        filename: filenameRef.current,
        className: classNameRef.current,
      }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'output') term.write(msg.data);
        if (msg.type === 'exit') {
          term.write(`\r\n\x1b[33m[Process exited with code ${msg.code}]\x1b[0m\r\n`);
          if (onExitRef.current) onExitRef.current(msg.code);
        }
      } catch (err) {}
    };

    term.onData((data) => {
      if (!data || data.length === 0) return; // guard against empty init events
      // Echo keystroke locally so user sees what they type
      term.write(data === '\r' ? '\r\n' : data);
      if (ws.readyState === WebSocket.OPEN) {
        // Normalize \r → \n for Java's Scanner.nextLine()
        const normalized = data === '\r' ? '\n' : data;
        ws.send(JSON.stringify({ type: 'input', data: normalized }));
      }
    });

    const observer = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch (e) {}
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); } catch (e) {}
      }
    });
    if (termRef.current) observer.observe(termRef.current);

    return () => {
      try { ws.close(); } catch (e) {}
      try { term.dispose(); } catch (e) {}
      observer.disconnect();
    };
  }, []); // ← empty array: mount/unmount only, never re-run

  return <div ref={termRef} style={{ height: '400px', width: '100%' }} />;
}