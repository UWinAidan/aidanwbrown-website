// Makes the public copy of this repo (github.com/UWinAidan/aidanwbrown-website).
// Runs automatically on every push to main (see .github/workflows/publish-public.yml) - you never edit the public repo.
//
// How nothing private gets out:
// 1. APPROVED LIST: only files matching PUBLISH below are copied. A new folder or file type stays private until it
//    is added here. Files in .gitignore (generated lists, cad/, testing files/) are never considered.
// 2. SWAPS: the Gmail address is replaced with a placeholder in the copy (the private files are not touched).
// 3. CHECK: before anything is written, every copied file (and the commit message) is scanned for the Gmail
//    address, phone numbers and student numbers. One hit stops the whole copy.
//
//   node scripts/publish-public.mjs --dry-run              list what would be published
//   node scripts/publish-public.mjs --out <folder>         empty <folder> (except .git) and copy into it
//   ... --message "<commit message>"                        also check the message; prints the one to use
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ---------- 1. Approved list (paths relative to the repo root) ----------
const PUBLISH = [
  /^[^/]+\.html$/,                         // the pages
  /^css\/[^/]+\.css$/,
  /^js\/.+\.js$/,                          // site code + js/vendor libraries (they keep their own licences)
  /^data\/[^/]+\.json$/,                   // map outlines (public domain Natural Earth data)
  /^worker\/[^/]+\.js$/,                   // contact form + CAD download Worker
  /^wrangler\.jsonc$/,
  /^_headers$/, /^\.assetsignore$/, /^\.gitattributes$/,
  /^scripts\/[^/]+\.mjs$/,                 // build + sync scripts, including this one
  /^scripts\/license-templates\/[^/]+\.txt$/,
  /^\.github\/workflows\/[^/]+\.yml$/,
  /^public-repo\//,                        // README, LICENSE, screenshots - copied to the public repo's root
];
// The workflow goes one folder up in the public repo, so it's there to read but GitHub doesn't try to run it
const rename = (path) => path.replace(/^public-repo\//, '').replace(/^\.github\/workflows\//, '.github/');

// Never published, even if a pattern above would match by mistake
const BLOCKED_TYPE = /\.(pdf|docx?|glb|gltf|gz|jpe?g|png|webp|avif|heic|mp4|webm|step|stp|stl|3mf|ipt|iam|zip|7z|xlsx?)$/i;
const ALLOWED_DESPITE_TYPE = /^screenshots\/[^/]+\.(png|webp)$/;   // README screenshots (checked by hand first)
const MAX_BYTES = 5 * 1024 * 1024;

// ---------- 2. Swaps (each must match at least once, so a changed file can't slip the address through) ----------
// Written as a pattern so the address itself never appears in this (public) file
const GMAIL = /[\w.+-]+@gmail\.com/g;
const SWAPS = [
  { file: 'worker/index.js', from: GMAIL, to: 'you@example.com' },
  { file: 'wrangler.jsonc', from: GMAIL, to: 'you@example.com' },
];

// ---------- 3. Privacy check ----------
const ALWAYS = [
  { name: 'Gmail address', re: /gmail\.com/i },
];
// Numbers that look like the patterns below but are already public on the site
const KNOWN_OK = [
  '728821542',   // Strava athlete id (js/socials.js)
];
// Skipped in minified libraries and map data, where long numbers are just coordinates and constants
const NUMBERS = [
  { name: 'phone number', re: /(?<![\d.])\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?![\d.])/ },
  { name: 'student number (9 digits)', re: /(?<![\d.])\d{9}(?![\d.])/ },
];
const NUMBERS_SKIP = /^(js\/vendor\/|data\/)/;

function problems(text, path) {
  const rules = NUMBERS_SKIP.test(path) ? ALWAYS : [...ALWAYS, ...NUMBERS];
  const found = [];
  text.split('\n').forEach((line, i) => {
    const clean = KNOWN_OK.reduce((text, ok) => text.replaceAll(ok, ''), line);
    for (const { name, re } of rules) if (re.test(clean)) found.push(`${path}:${i + 1}  ${name}`);
  });
  return found;
}

// ---------- Run ----------
const args = process.argv.slice(2);
const arg = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const out = arg('--out');
const dryRun = args.includes('--dry-run');
const message = arg('--message');
if (!out && !dryRun) {
  console.error('Usage: node scripts/publish-public.mjs --dry-run | --out <folder> [--message "<msg>"]');
  process.exit(1);
}

const tracked = execSync('git ls-files -z --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\0').filter((path) => path && existsSync(path));
const chosen = tracked.filter((path) => PUBLISH.some((re) => re.test(path)));

const errors = [];
const files = chosen.map((path) => {
  const target = rename(path);
  const bytes = statSync(path).size;
  if (BLOCKED_TYPE.test(target) && !ALLOWED_DESPITE_TYPE.test(target)) errors.push(`${path}  blocked file type`);
  if (bytes > MAX_BYTES) errors.push(`${path}  over 5 MB`);
  const binary = ALLOWED_DESPITE_TYPE.test(target);
  let content = readFileSync(path, binary ? undefined : 'utf8');
  if (!binary) {
    for (const swap of SWAPS.filter((s) => s.file === path)) {
      if (!content.match(swap.from)) errors.push(`${path}  swap ${swap.from} no longer matches - update SWAPS`);
      content = content.replaceAll(swap.from, swap.to);
    }
    errors.push(...problems(content, path));
  }
  return { path, target, bytes, content };
});
for (const swap of SWAPS) if (!chosen.includes(swap.file)) errors.push(`${swap.file}  in SWAPS but not published`);

// The commit message goes public too: if it trips the check, use a plain one instead
const GENERIC = 'Update from the main site repo';
const publicMessage = message === undefined ? GENERIC
  : (message.trim() && problems(message, 'commit message').length === 0 ? message : GENERIC);

if (errors.length) {
  console.error(`\nSTOPPED - nothing was published. Fix these first:\n  ${errors.join('\n  ')}\n`);
  process.exit(1);
}

if (dryRun) {
  for (const f of files) console.log(`${(f.bytes / 1024).toFixed(0).padStart(6)} KB  ${f.target}`);
  const total = files.reduce((sum, f) => sum + f.bytes, 0);
  console.log(`\n${files.length} files, ${(total / 1024 / 1024).toFixed(1)} MB. Privacy check passed.`);
  process.exit(0);
}

// Empty the output folder (keep its .git), then write the copy
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) if (name !== '.git') rmSync(join(out, name), { recursive: true, force: true });
for (const f of files) {
  mkdirSync(dirname(join(out, f.target)), { recursive: true });
  writeFileSync(join(out, f.target), f.content);
}
console.error(`Copied ${files.length} files to ${out}. Privacy check passed.`);
console.log(publicMessage);   // stdout = the commit message to use (the workflow reads it)
