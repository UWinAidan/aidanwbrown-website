// Pushes the STEP downloads in cad/ up to the R2 bucket (the live site reads them from there, not from the repo).
// Run it in the VS Code terminal after adding or changing anything in cad/:
//   node scripts/sync-cad.mjs            uploads whatever is new or changed
//   node scripts/sync-cad.mjs --delete   also removes bucket files that are no longer in cad/
// One-time setup on a new computer: npx wrangler login   (opens Cloudflare in your browser)
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const BUCKET = 'aidanwbrown-cad';
const SITE = process.env.CAD_SITE || 'https://aidanwbrown.com';
const WHERE = process.env.CAD_SITE ? '--local' : '--remote';   // CAD_SITE is only for testing with "wrangler dev"
const isCad = (name) => /\.(zip|7z|step|stp)$/i.test(name);
const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;

if (!existsSync('cad') || !existsSync('js/designs-list.js')) {
  console.error('Run this from the website folder (the one with cad/ and js/ in it).');
  process.exit(1);
}

// designs with download: false must never be uploaded (e.g. team CAD that isn't mine to hand out)
const DESIGNS = new Function(`${readFileSync('js/designs-list.js', 'utf8')}; return DESIGNS;`)();
const blocked = new Set(DESIGNS.filter((d) => d.download === false).map((d) => d.id));
const known = new Set(DESIGNS.map((d) => d.id));

// what is on this computer
const local = [];
for (const id of readdirSync('cad')) {
  if (!statSync(`cad/${id}`).isDirectory()) continue;
  const files = readdirSync(`cad/${id}`).filter(isCad);
  if (!files.length) continue;
  if (blocked.has(id)) { console.log(`Skipped  ${id}/ - marked download: false in js/designs-list.js`); continue; }
  if (!known.has(id)) console.log(`Note     ${id}/ doesn't match any design id, so no card will show it`);
  for (const name of files) {
    if (/[#?%]/.test(name)) { console.log(`Skipped  ${id}/${name} - rename it without # ? or % first`); continue; }
    local.push({ key: `${id}/${name}`, path: `cad/${id}/${name}`, size: statSync(`cad/${id}/${name}`).size });
  }
}

// what is in the bucket (the live site's own list)
const res = await fetch(`${SITE}/cad/cad.json`).catch(() => null);
if (!res || !res.ok) {
  console.error(`Couldn't read ${SITE}/cad/cad.json - check your internet, and that the site has deployed.`);
  process.exit(1);
}
const remote = new Map();
for (const [id, files] of Object.entries(await res.json())) {
  for (const f of files) remote.set(`${id}/${f.name}`, f);
}

// a file needs uploading if the bucket doesn't have it, or its size or contents differ
function changed(file) {
  const there = remote.get(file.key);
  if (!there) return 'new';
  if (there.size !== file.size) return 'changed';
  if (/^[0-9a-f]{32}$/.test(there.etag || '')) {   // the bucket's fingerprint of the file, when it has a simple one
    if (createHash('md5').update(readFileSync(file.path)).digest('hex') !== there.etag) return 'changed';
  }
  return '';
}

function wrangler(...args) {
  const command = `npx --yes wrangler@4 ${args.map((a) => `"${a}"`).join(' ')}`;   // quotes: file names have ; and , in them
  const run = spawnSync(command, { shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.status === 0) return;
  console.error(`\n${`${run.stdout || ''}${run.stderr || ''}`.trim() || run.error || 'wrangler did not run'}\n`);
  console.error('Stopped. If that says you are not logged in, run:  npx wrangler login   then run this again.');
  process.exit(1);
}

// ask the live site for the file, to be sure it really landed
async function landed(file) {
  const url = `${SITE}/cad/${file.key.split('/').map(encodeURIComponent).join('/')}`;
  const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
  return Boolean(head && head.ok && Number(head.headers.get('content-length')) === file.size);
}

let uploaded = 0;
for (const file of local) {
  const why = changed(file);
  if (!why) continue;
  process.stdout.write(`Upload   ${file.key} (${mb(file.size)}, ${why}) ... `);
  wrangler('r2', 'object', 'put', `${BUCKET}/${file.key}`, '--file', file.path, WHERE);
  console.log((await landed(file)) ? 'done' : "sent, but the site isn't serving it yet - check the Designs page after the next deploy");
  uploaded += 1;
}

// bucket files that are no longer on this computer
const here = new Set(local.map((f) => f.key));
const extra = [...remote.keys()].filter((key) => !here.has(key));
let removed = 0;
for (const key of extra) {
  if (!process.argv.includes('--delete')) { console.log(`Extra    ${key} is in the bucket but not in cad/`); continue; }
  process.stdout.write(`Delete   ${key} ... `);
  wrangler('r2', 'object', 'delete', `${BUCKET}/${key}`, WHERE);
  console.log('done');
  removed += 1;
}

console.log(`\n${uploaded} uploaded, ${removed} deleted, ${local.length - uploaded} already up to date.`);
if (extra.length && !removed) console.log('To remove the extra files from the bucket, run:  node scripts/sync-cad.mjs --delete');
if (uploaded || removed) console.log('The site picks up the change within 5 minutes.');
