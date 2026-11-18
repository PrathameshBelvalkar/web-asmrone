// Writes the notes of the draft release for the current version.
// Usage: node .github/scripts/release-notes.mjs <folder with the installers> [--dry-run]
// Needs GITHUB_REPOSITORY and GH_TOKEN. With --dry-run it prints the notes instead of saving them.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [assetsDir, flag] = process.argv.slice(2);
const dryRun = flag === '--dry-run';
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
if (!assetsDir || !repo || !token) {
  console.error('usage: GITHUB_REPOSITORY=owner/repo GH_TOKEN=… node release-notes.mjs <assets folder> [--dry-run]');
  process.exit(2);
}

const version = JSON.parse(readFileSync('apps/desktop/package.json', 'utf8')).version;
const tag = `v${version}`;

async function api(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// The version tag before this one, ignoring tools-* tags.
function previousTag() {
  const tags = execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const i = tags.indexOf(tag);
  return i >= 0 ? tags[i + 1] : tags.find((t) => t !== tag);
}

function checksums() {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(dmg|zip)$/.test(name)) files.push(p);
    }
  };
  walk(assetsDir);
  if (files.length === 0) throw new Error(`no .dmg or .zip files in ${assetsDir}`);
  return files
    .map((p) => `${createHash('sha256').update(readFileSync(p)).digest('hex')}  ${p.split('/').pop()}`)
    .sort((a, b) => a.split('  ')[1].localeCompare(b.split('  ')[1]))
    .join('\n');
}

// The changelog: every commit since the previous version, newest first, without merges and the
// "Release x.y.z" commits themselves.
function changelog(prev) {
  const range = prev ? [`${prev}..HEAD`] : ['HEAD', '-n', '30'];
  const lines = execFileSync('git', ['log', '--no-merges', '--pretty=%h %s', ...range], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((line) => line.match(/^(\S+) (.*)$/))
    .filter(([, , subject]) => !/^Release \d/.test(subject))
    .map(([, hash, subject]) => `- ${subject} ([${hash}](https://github.com/${repo}/commit/${hash}))`);
  const since = prev ? `Since ${prev}:\n\n` : '';
  const list = lines.length > 0 ? lines.join('\n') : '- Maintenance release.';
  const compare = prev ? `\n\n**Full changelog**: https://github.com/${repo}/compare/${prev}...${tag}` : '';
  return `${since}${list}${compare}`;
}

const prev = previousTag();
const changes = changelog(prev);

const notes = readFileSync('.github/release-notes.md', 'utf8')
  .replace(/^<!-- Filled in by.*-->\n/, '')
  .replaceAll('{{VERSION}}', version)
  .replaceAll('{{TAG}}', tag)
  .replaceAll('{{REPO}}', repo)
  .replace('{{CHANGES}}', () => changes.trim())
  .replace('{{CHECKSUMS}}', () => checksums());

if (dryRun) {
  console.log(notes);
  process.exit(0);
}

const releases = await api('/releases?per_page=100');
const release = releases.find((r) => r.tag_name === tag);
if (!release) throw new Error(`no release for ${tag}`);
if (!release.draft) {
  console.log(`${tag} is already published; leaving its notes alone.`);
  process.exit(0);
}
await api(`/releases/${release.id}`, { method: 'PATCH', body: JSON.stringify({ body: notes }) });
console.log(`Wrote the notes of draft ${tag}.`);
