// Builds the web UI and the server, and copies them into staging/ for electron-builder:
//   staging/ui/            the built web UI
//   staging/server/        server.mjs (one bundled file) and assets/
// Then starts the bundled server on a throwaway data folder and checks that it answers.
import { spawn, execSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(appDir, '..', '..', 'web');
const staging = join(appDir, 'staging');

rmSync(staging, { recursive: true, force: true });
mkdirSync(join(staging, 'server'), { recursive: true });

// 1. The UI.
execSync('npm run build', { cwd: join(web, 'frontend'), stdio: 'inherit' });
cpSync(join(web, 'frontend', 'dist'), join(staging, 'ui'), { recursive: true });

// 2. The server, as one file. The banner gives the CommonJS dependencies a `require`.
await esbuild.build({
  entryPoints: [join(web, 'backend-express', 'src', 'server.ts')],
  outfile: join(staging, 'server', 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  logLevel: 'warning',
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});
cpSync(join(web, 'backend-express', 'assets'), join(staging, 'server', 'assets'), { recursive: true });

// 3. Self-check: the bundle starts, serves the UI and answers the API.
await selfCheck(join(staging, 'server', 'server.mjs'), join(staging, 'ui'));
console.log('stage: ok');

function selfCheck(entry, uiDir) {
  const dataDir = mkdtempSync(join(tmpdir(), 'echo-stage-'));
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      PORT: '0',
      ECHO_WEB_DIST: uiDir,
      ECHO_WEB_DATA: dataDir,
      LOG_LEVEL: 'info',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const fail = (message) => {
    child.kill();
    rmSync(dataDir, { recursive: true, force: true });
    throw new Error(`stage self-check failed: ${message}`);
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { fail('the server did not start within 60 seconds'); } catch (e) { reject(e); }
    }, 60_000);
    let buffer = '';
    child.stderr.on('data', (chunk) => (buffer += chunk));
    child.stdout.on('data', async (chunk) => {
      buffer += chunk;
      const line = buffer.split('\n').find((l) => l.includes('Echo Web listening'));
      if (!line) return;
      clearTimeout(timer);
      child.stdout.removeAllListeners('data');
      try {
        const url = JSON.parse(line).url;
        const root = await fetch(`${url}/`);
        const html = await root.text();
        if (!html.includes('<div id="root">')) fail('the UI page does not contain <div id="root">');
        const tools = await fetch(`${url}/api/tools`);
        if (tools.status !== 200) fail(`/api/tools answered ${tools.status}`);
        child.kill();
        rmSync(dataDir, { recursive: true, force: true });
        resolve();
      } catch (err) {
        try { fail(err instanceof Error ? err.message : String(err)); } catch (e) { reject(e); }
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!existsSync(dataDir)) return;
      try { fail(`the server exited early (code ${code}): ${buffer.slice(-400)}`); } catch (e) { reject(e); }
    });
  });
}
