// Puts the new sha512 and size of a rebuilt DMG into latest-mac.yml (the update manifest).
//   usage: node update-mac-manifest.mjs <release folder> <dmg file name>
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, name] = process.argv.slice(2);
if (!dir || !name) throw new Error('usage: update-mac-manifest.mjs <dir> <dmg name>');

const dmgPath = join(dir, name);
const sha512 = createHash('sha512').update(readFileSync(dmgPath)).digest('base64');
const size = statSync(dmgPath).size;

const manifestPath = join(dir, 'latest-mac.yml');
const pattern = new RegExp(`(url: ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n    sha512: )\\S+(\\n    size: )\\d+`);
const text = readFileSync(manifestPath, 'utf8');
if (!pattern.test(text)) throw new Error(`${name} has no entry in latest-mac.yml`);
writeFileSync(manifestPath, text.replace(pattern, (_m, a, b) => `${a}${sha512}${b}${size}`));
console.log(`manifest: ${name} sha512 and size updated (${size} bytes)`);
