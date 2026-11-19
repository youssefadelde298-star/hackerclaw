import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, NODE_ENV: 'production' };
delete env.DEV;

function runBuilt(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env,
    timeout: 10_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${args.join(' ')} failed:\n${result.stderr}`);
  return result;
}

const version = runBuilt(['dist/cli.js', '--version']);
assert.match(version.stdout, /^hackerclaw\s/i);
runBuilt(['dist/cli.js', '--help']);
const browserHelp = runBuilt(['dist/browser-mcp.js', '--help']);
assert.match(browserHelp.stderr, /hackerclaw-browser-mcp/);

const tempDir = mkdtempSync(join(tmpdir(), 'hackerclaw-build-smoke-'));
let serverProcess;
try {
  const port = await availablePort();
  serverProcess = spawn(
    process.execPath,
    ['dist/browser-mcp.js', '--port', String(port), '--log', join(tempDir, 'browser-mcp.log')],
    { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const startup = await waitForOutput(
    serverProcess,
    /ingest listening at http:\/\/127\.0\.0\.1:\d+\/ingest/,
  );
  assert.match(startup, /token: [a-f0-9]{32}/i);
} finally {
  try {
    if (serverProcess) await stopProcess(serverProcess);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

process.stdout.write('Built CLI and browser MCP runtime checks passed.\n');

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  return address.port;
}

function waitForOutput(child, pattern) {
  return new Promise((resolveOutput, reject) => {
    let output = '';
    const cleanup = () => {
      clearTimeout(timer);
      child.stderr.off('data', onData);
      child.off('error', onError);
      child.off('exit', onExit);
    };
    const onData = (chunk) => {
      output += chunk.toString();
      if (pattern.test(output)) {
        cleanup();
        resolveOutput(output);
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`browser MCP exited before startup (${code ?? signal}):\n${output}`));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`browser MCP startup timed out:\n${output}`));
    }, 10_000);
    child.stderr.on('data', onData);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  child.kill('SIGTERM');
  const forcedStop = setTimeout(() => child.kill('SIGKILL'), 2_000);
  let stopTimeout;
  try {
    await Promise.race([
      exited,
      new Promise((_, reject) => {
        stopTimeout = setTimeout(() => reject(new Error('browser MCP did not stop')), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(forcedStop);
    clearTimeout(stopTimeout);
  }
}
