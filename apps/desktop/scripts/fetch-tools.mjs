// Downloads the bundled tools archive for one target from the public GitHub release, checks its
// SHA-256 against tools.lock.json, and unpacks it into resources/bin/<target>/.
//
//   node scripts/fetch-tools.mjs [target]     (default: this machine, e.g. mac-arm64)
//
// Unauthenticated on purpose: the repository is public, and the release files are public.
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const REPO = 'PrathameshBelvalkar/web-asmrone';
const TARGETS = ['mac-arm64', 'mac-x64'];

function defaultTarget() {
  return `mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
}

function fail(message) {
  console.error(`fetch-tools: ${message}`);
  process.exit(1);
}

const target = process.argv[2] ?? defaultTarget();
if (!TARGETS.includes(target)) fail(`unknown target ${target}; use one of ${TARGETS.join(', ')}`);

const lock = JSON.parse(readFileSync(join(appDir, 'tools.lock.json'), 'utf8'));
const expected = lock.sha256[target];
if (!expected) {
  fail(`tools.lock.json has no checksum for ${target} yet. Run the tools workflow first, then copy its checksums.`);
}

const archive = `echo-tools-${target}.tar.gz`;
const url = `https://github.com/${REPO}/releases/download/${lock.release}/${archive}`;
console.log(`fetch-tools: downloading ${url}`);
const res = await fetch(url);
if (!res.ok) fail(`download failed with HTTP ${res.status}`);
const bytes = Buffer.from(await res.arrayBuffer());

const actual = createHash('sha256').update(bytes).digest('hex');
if (actual !== expected) {
  fail(`checksum mismatch for ${archive}: expected ${expected}, got ${actual}`);
}

const out = join(appDir, 'resources', 'bin', target);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const tmp = join(appDir, '.build', archive);
mkdirSync(dirname(tmp), { recursive: true });
writeFileSync(tmp, bytes);
execFileSync('tar', ['-xzf', tmp, '-C', out], { stdio: 'inherit' });

for (const name of ['ffmpeg', join('whisper', 'metal', 'whisper-server'), join('whisper', 'cpu', 'whisper-server')]) {
  const path = join(out, name);
  if (existsSync(path)) chmodSync(path, 0o755);
}
console.log(`fetch-tools: installed ${target} into ${out}`);
