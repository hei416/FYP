const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFile, spawn } = require('child_process');

const PORT = 3001;

// Resolve java/javac paths once at startup
let JAVA_PATH = 'java';
let JAVAC_PATH = 'javac';
let JAVA_HOME = '';

try { JAVA_PATH = execSync('which java', { encoding: 'utf8' }).trim(); } catch (e) {}
try { JAVAC_PATH = execSync('which javac', { encoding: 'utf8' }).trim(); } catch (e) {}
try { JAVA_HOME = execSync('/usr/libexec/java_home -v 17', { encoding: 'utf8' }).trim(); } catch (e) {
  try { JAVA_HOME = execSync('/usr/libexec/java_home', { encoding: 'utf8' }).trim(); } catch (e2) {}
}

console.log(`JAVA_PATH: ${JAVA_PATH}`);
console.log(`JAVAC_PATH: ${JAVAC_PATH}`);
console.log(`JAVA_HOME: ${JAVA_HOME}`);

const spawnEnv = {
  ...process.env,
  PATH: (JAVA_HOME ? path.join(JAVA_HOME, 'bin') + ':' : '') + (process.env.PATH || ''),
  ...(JAVA_HOME ? { JAVA_HOME } : {}),
};

const waitForFile = (filePath, timeout = 1500, interval = 50) => new Promise((resolve) => {
  const deadline = Date.now() + timeout;
  (function poll() {
    if (fs.existsSync(filePath)) return resolve(true);
    if (Date.now() > deadline) return resolve(false);
    setTimeout(poll, interval);
  })();
});

const wss = new WebSocket.Server({ port: PORT });
console.log(`Terminal service running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'java-'));
  let javaProc = null;

  const cleanup = () => {
    try { if (javaProc) { javaProc.kill('SIGTERM'); javaProc = null; } } catch (e) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  };

  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch (e) { return; }

    if (data.type === 'run') {
      const className = data.className || 'Main';
      const filename = data.filename || `${className}.java`;
      const filePath = path.join(tmpDir, filename);

      try { fs.writeFileSync(filePath, data.code); } catch (e) {
        ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[31mFailed to write source: ${e.message}\x1b[0m` }));
        ws.send(JSON.stringify({ type: 'exit', code: 1 }));
        return;
      }

      // Kill any previous run
      try { if (javaProc) { javaProc.kill('SIGTERM'); javaProc = null; } } catch (e) {}

      execFile(JAVAC_PATH, [filename], { cwd: tmpDir, env: spawnEnv }, async (err, stdout, stderr) => {
        if (err) {
          const errMsg = stderr?.toString() || err.message;
          ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[31m${errMsg}\x1b[0m` }));
          ws.send(JSON.stringify({ type: 'exit', code: 1 }));
          return;
        }

        const classFile = path.join(tmpDir, `${className}.class`);
        if (!(await waitForFile(classFile))) {
          ws.send(JSON.stringify({ type: 'output', data: '\r\n\x1b[31mCompilation produced no .class file\x1b[0m' }));
          ws.send(JSON.stringify({ type: 'exit', code: 1 }));
          return;
        }

        try {
          javaProc = spawn(JAVA_PATH, ['-cp', '.', className], {
            cwd: tmpDir,
            env: spawnEnv,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
        } catch (spawnErr) {
          ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[31mSpawn failed: ${spawnErr.message}\x1b[0m` }));
          ws.send(JSON.stringify({ type: 'exit', code: 1 }));
          return;
        }

        javaProc.stdout.on('data', (d) => {
          try { ws.send(JSON.stringify({ type: 'output', data: d.toString() })); } catch (e) {}
        });
        javaProc.stderr.on('data', (d) => {
          try { ws.send(JSON.stringify({ type: 'output', data: '\x1b[31m' + d.toString() + '\x1b[0m' })); } catch (e) {}
        });
        javaProc.on('exit', (code) => {
          try { ws.send(JSON.stringify({ type: 'exit', code })); } catch (e) {}
          javaProc = null;
        });
      });
    }

    if (data.type === 'input' && javaProc?.stdin) {
      try { javaProc.stdin.write(data.data); } catch (e) {}
    }
  });

  ws.on('close', cleanup);
});