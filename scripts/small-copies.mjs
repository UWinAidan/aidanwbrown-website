// ---------- Faster pages: small copies made on every deploy ----------
// scripts/list-banners.mjs runs this at the end, but ONLY for a deploy (Cloudflare runs it with --deploy, see
// "build" in wrangler.jsonc). On your own computer nothing is made, so Live Server always shows your original files.
//
// 1. Photos:  images/projects/<id>/x.jpg  ->  images/thumbs/projects/<id>/x.jpg.webp   (900 px wide, a fraction of the size)
//             images/travels/<place>/x.jpg -> images/thumbs/travels/<place>/x.jpg.webp
//             and images/thumbs/thumbs.json lists the ones that exist. Cards and galleries use the small copy
//             and link to the original.
// 2. Banners: images/banners/x.jpg -> images/banners/small/x.jpg.webp, and banners.json is pointed at those.
//    Landing photo: images/me.png -> images/me.webp (index.html asks for me.webp first and falls back to me.png).
// 3. Word pages: resume/…docx and about/…docx -> the same name + .page.txt (the page as HTML), so the visitor's
//             browser doesn't have to download a converter and convert the Word file itself.
//
// 4. 3D models: models/<design>/x.glb -> x.glb.gz (about half the size to download; the viewer unpacks it).
//             When a design's files are the same parts in different positions (stowed / deployed), the extra files
//             become x.glb.poses.json - just where each part sits - so the viewer downloads the parts once.
//             models/fast.json lists what was made.
// 5. Music page: asks Spotify for each playlist's name and cover picture and saves them in images/music.json, so the
//             cards can show something at once while Spotify's own player is still loading.
//
// Nothing here can break the site: every step is optional. If one fails, that step is skipped and the pages
// fall back to the originals (the full photo, me.png, converting the Word file in the browser).
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const deploying = process.argv.includes('--deploy');
const WIDTH = 900, HEIGHT = 1350;   // small copies fit inside this (smaller photos are left at their own size)
const QUALITY = 70;
const isPhoto = (name) => /\.(jpe?g|png|webp|avif)$/i.test(name);

// The image tool (sharp) isn't part of the site, so it's installed for the build (into node_modules, which is
// never published or committed).
function getSharp() {
  try { return require('sharp'); } catch {}
  if (process.argv.includes('--no-install')) return null;
  try {
    execSync('npm install --no-save --no-package-lock --no-audit --no-fund sharp', { stdio: 'ignore', timeout: 180000 });
    return require('sharp');
  } catch { return null; }
}

async function photos(sharp) {
  const list = {};
  let made = 0, saved = 0;
  for (const area of ['projects', 'travels']) {
    const root = `images/${area}`;
    if (!existsSync(root)) continue;
    for (const id of readdirSync(root)) {
      if (!statSync(`${root}/${id}`).isDirectory()) continue;
      for (const file of readdirSync(`${root}/${id}`).filter(isPhoto)) {
        const from = `${root}/${id}/${file}`, to = `images/thumbs/${area}/${id}/${file}.webp`;
        try {
          const img = sharp(from).rotate();                    // (rotate = turn phone photos the right way up)
          const meta = await img.metadata();
          if ((meta.pages || 1) > 1) continue;                 // animated: leave it alone
          mkdirSync(`images/thumbs/${area}/${id}`, { recursive: true });
          const info = await img.resize({ width: WIDTH, height: HEIGHT, fit: 'inside', withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(to);
          const before = statSync(from).size;
          if (info.size > before * 0.9) continue;              // not worth it - the page keeps using the original
          list[`${area}/${id}/${file}`] = [info.width, info.height];
          made++;  saved += before - info.size;
        } catch (err) {
          console.warn(`  small copy skipped for ${from}: ${err.message}`);
        }
      }
    }
  }
  mkdirSync('images/thumbs', { recursive: true });
  writeFileSync('images/thumbs/thumbs.json', JSON.stringify(list) + '\n');
  console.log(`Small photo copies: ${made} made, ${(saved / 1048576).toFixed(1)} MB lighter in total`);
}

async function landing(sharp) {
  if (!existsSync('images/me.png')) return;
  const info = await sharp('images/me.png').webp({ quality: 84, alphaQuality: 90 }).toFile('images/me.webp');
  console.log(`Landing photo: ${(statSync('images/me.png').size / 1024).toFixed(0)} KB -> ${(info.size / 1024).toFixed(0)} KB`);
}

// Banners keep their full width (they span the page) - they're just saved in a lighter format.
// banners.json was written a moment ago with the original names; swap in the lighter copies.
async function banners(sharp) {
  const listFile = 'images/banners/banners.json';
  const names = JSON.parse(readFileSync(listFile, 'utf8'));
  mkdirSync('images/banners/small', { recursive: true });
  let saved = 0;
  const out = [];
  for (const name of names) {
    try {
      const from = `images/banners/${name}`, to = `images/banners/small/${name}.webp`;
      const info = await sharp(from).rotate().resize({ width: 2200, withoutEnlargement: true }).webp({ quality: 72 }).toFile(to);
      const before = statSync(from).size;
      if (info.size > before * 0.9) { out.push(name); continue; }
      out.push(`small/${name}.webp`);
      saved += before - info.size;
    } catch { out.push(name); }
  }
  writeFileSync(listFile, JSON.stringify(out, null, 2) + '\n');
  console.log(`Banners: ${(saved / 1024).toFixed(0)} KB lighter in total`);
}

// ---------- 3D models ----------
// A .glb file is a short header, a block of text (JSON: the list of parts and where they sit) and the geometry.
function readGlb(path) {
  const file = readFileSync(path);
  const n = file.readUInt32LE(12);
  return { file, json: JSON.parse(file.subarray(20, 20 + n).toString('utf8')), geometry: createHash('sha1').update(file.subarray(20 + n)).digest('hex') };
}
const PLACE = ['translation', 'rotation', 'scale', 'matrix'];
const placeOf = (node) => Object.fromEntries(PLACE.filter((k) => node[k]).map((k) => [k[0], node[k]]));   // { t, r, s } or { m }
// everything except where the parts sit (and the random ids Inventor puts in material and picture names)
const without = (list, keys) => (list || []).map((item) => Object.fromEntries(Object.entries(item).filter(([k]) => !keys.includes(k))));
const shapeOf = (json) => JSON.stringify({ ...json, nodes: without(json.nodes, PLACE), materials: without(json.materials, ['name']), images: without(json.images, ['name']), textures: without(json.textures, ['name']) });

function models() {
  if (!existsSync('models')) return;
  const made = {};
  let before = 0, after = 0;
  for (const folder of readdirSync('models')) {
    if (!statSync(`models/${folder}`).isDirectory()) continue;
    const files = readdirSync(`models/${folder}`).filter((f) => /\.glb$/i.test(f)).sort();
    if (!files.length) continue;
    const glbs = files.map((f) => readGlb(`models/${folder}/${f}`));
    // the same parts in every file, only moved? then the first file + a list of positions is enough
    const moved = glbs.length > 1 && glbs.slice(1).every((g) => g.geometry === glbs[0].geometry && shapeOf(g.json) === shapeOf(glbs[0].json));
    files.forEach((f, i) => {
      const path = `models/${folder}/${f}`, entry = {};
      before += glbs[i].file.length;
      if (moved && i > 0) {
        const base = glbs[0].json.nodes;
        const list = glbs[i].json.nodes.map((node, k) => (JSON.stringify(placeOf(node)) === JSON.stringify(placeOf(base[k])) ? null : placeOf(node)));
        writeFileSync(`${path}.poses.json`, JSON.stringify(list));
        entry.poses = true;
        after += statSync(`${path}.poses.json`).size;
      } else {
        const gz = gzipSync(glbs[i].file, { level: 7 });
        if (gz.length < glbs[i].file.length * 0.9) { writeFileSync(`${path}.gz`, gz); entry.gz = true; }
        after += entry.gz ? gz.length : glbs[i].file.length;
      }
      made[`${folder}/${f}`] = entry;
    });
  }
  writeFileSync('models/fast.json', JSON.stringify(made, null, 1) + '\n');
  console.log(`3D models: ${(before / 1048576).toFixed(0)} MB -> ${(after / 1048576).toFixed(0)} MB to download`);
}

// ---------- Music page ----------
async function music() {
  const links = [...readFileSync('js/music.js', 'utf8').matchAll(/https:\/\/open\.spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/g)];
  const out = {};
  await Promise.all(links.map(async ([url, , id]) => {
    try {
      const reply = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) });
      if (!reply.ok) return;
      const info = await reply.json();
      if (typeof info.title === 'string') out[id] = { title: info.title.slice(0, 120), cover: /^https:\/\//.test(info.thumbnail_url || '') ? info.thumbnail_url : '' };
    } catch {}
  }));
  writeFileSync('images/music.json', JSON.stringify(out, null, 1) + '\n');
  console.log(`Music page: names and covers for ${Object.keys(out).length} of ${links.length} players`);
}

async function wordPages() {
  const mammoth = require('../js/vendor/mammoth.browser.min.js');   // the same converter the pages use
  for (const dir of ['resume', 'about']) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => /\.docx$/i.test(f) && !f.startsWith('~$'))) {
      const buf = readFileSync(`${dir}/${file}`);
      const result = await mammoth.convertToHtml({ arrayBuffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
      writeFileSync(`${dir}/${file}.page.txt`, result.value);
      console.log(`Word page ready: ${dir}/${file}.page.txt`);
    }
  }
}

// Not a deploy: remove anything left from an earlier run, so a preview never shows an out-of-date copy.
function clear() {
  const made = ['images/thumbs', 'images/banners/small', 'images/me.webp', 'images/music.json'];
  for (const dir of ['resume', 'about']) if (existsSync(dir)) made.push(...readdirSync(dir).filter((f) => /\.page\.txt$/i.test(f)).map((f) => `${dir}/${f}`));
  if (existsSync('models')) {
    made.push('models/fast.json');
    for (const folder of readdirSync('models')) {
      if (statSync(`models/${folder}`).isDirectory()) made.push(...readdirSync(`models/${folder}`).filter((f) => /\.glb\.(gz|poses\.json)$/i.test(f)).map((f) => `models/${folder}/${f}`));
    }
  }
  for (const path of made) { try { rmSync(path, { recursive: true, force: true }); } catch {} }
}

export async function smallCopies() {
  if (!deploying) { clear(); return; }
  try { await wordPages(); } catch (err) { console.warn(`Word pages not pre-made (${err.message}) - they'll be converted in the browser`); }
  try { models(); } catch (err) { console.warn(`3D models left as they are: ${err.message}`); }
  try { await music(); } catch (err) { console.warn(`Music names and covers not fetched: ${err.message}`); }
  const sharp = getSharp();
  if (!sharp) { console.warn('Small photo copies skipped (image tool not available) - pages use the full photos'); return; }
  try { await photos(sharp); } catch (err) { console.warn(`Small photo copies stopped: ${err.message}`); }
  try { await banners(sharp); } catch (err) { console.warn(`Banners left as they are: ${err.message}`); }
  try { await landing(sharp); } catch (err) { console.warn(`Landing photo not converted: ${err.message}`); }
}
