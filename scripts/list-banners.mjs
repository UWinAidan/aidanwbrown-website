// Runs automatically on every Cloudflare deploy (see "build" in wrangler.jsonc).
// Run it yourself (node scripts/list-banners.mjs) to see new files in Live Server.
// It makes the lists the pages read, so adding or deleting files never needs a code change:
// 1. images/banners/            -> images/banners/banners.json     (random page banners)
// 2. images/travels/<place>/    -> images/travels/travels.json     (travel photos)
// 3. images/projects/<project>/ -> images/projects/projects.json   (portfolio photos + .mp4/.webm videos)
// 4. models/<design>/           -> models/models.json              (3D files; 2+ files = configuration toggle)
// 5. files/<project>/           -> files/files.json                (portfolio reports, code, etc.)
// 6. cad/<design-id>/           -> cad/cad.json                    (STEP downloads - Live Server preview only;
//                                   the live site reads them from the R2 bucket, see worker/index.js)
// 7. On a deploy only (--deploy): small copies of the photos, the landing photo and the Word pages, which make
//    the site load faster. See scripts/small-copies.mjs.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';

// 0. A typo in the hand-edited lists (a missing comma, say) empties the whole Portfolio or Designs page.
//    Check them first and stop the deploy if one is broken, so the live site keeps its last working version.
function checkList(file, name) {
  try {
    const list = new Function(`${readFileSync(file, 'utf8')}; return ${name};`)();
    console.log(`${file} OK: ${list.length} entries`);
  } catch (err) {
    console.error(`\nSTOPPED: ${file} has a typo - ${err.message}`);
    console.error(`Open it in VS Code and look for the red underline (usually a missing comma, quote or bracket), then try again.\n`);
    process.exit(1);
  }
}
checkList('js/projects.js', 'PROJECTS');
checkList('js/designs-list.js', 'DESIGNS');

const isPhoto = (name) => /\.(jpe?g|png|webp|avif)$/i.test(name);
const isMedia = (name) => isPhoto(name) || /\.(mp4|webm)$/i.test(name);
const isModel = (name) => /\.(glb|gltf|stl|obj)$/i.test(name);
const isFile = (name) => !name.startsWith('.');   // anything except hidden files like .gitkeep
const isCad = (name) => /\.(zip|7z|step|stp)$/i.test(name);

// 1. banners
const banners = readdirSync('images/banners').filter(isPhoto).sort();
writeFileSync('images/banners/banners.json', JSON.stringify(banners, null, 2) + '\n');
console.log(`Banner list updated: ${banners.length} photos`);

// 2-5. one entry per sub-folder
function listFolders(dir, keep, out, label, withSize = false) {
  const list = {};
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      const sub = `${dir}/${name}`;
      if (!statSync(sub).isDirectory()) continue;
      const files = readdirSync(sub).filter(keep).sort();
      list[name] = withSize ? files.map((f) => ({ name: f, size: statSync(`${sub}/${f}`).size })) : files;
    }
  }
  mkdirSync(dir, { recursive: true });   // git skips empty folders, so make sure it exists
  writeFileSync(`${dir}/${out}`, JSON.stringify(list, null, 2) + '\n');
  console.log(`${label} updated: ${Object.keys(list).length} folders`);
}

listFolders('images/travels', isPhoto, 'travels.json', 'Travel photos');
listFolders('images/projects', isMedia, 'projects.json', 'Project photos + videos');
listFolders('models', isModel, 'models.json', '3D models');
listFolders('files', isFile, 'files.json', 'Project files', true);
if (existsSync('cad')) listFolders('cad', isCad, 'cad.json', 'CAD downloads (local preview)', true);

// Cloudflare refuses any single file over 25 MiB - catch it here instead of in a failed deploy
const LIMIT = 25 * 1024 * 1024;
(function check(dir) {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules', 'testing files', 'Claude outputs', 'cad'].includes(name)) continue;
    const path = `${dir}/${name}`;
    const s = statSync(path);
    if (s.isDirectory()) check(path);
    else if (s.size > LIMIT) console.warn(`WARNING: ${path} is ${(s.size / 1048576).toFixed(0)} MB - over Cloudflare's 25 MB limit, the deploy will fail`);
  }
})('.');

// 7. small copies for speed (deploys only). Never allowed to stop a deploy.
try {
  const { smallCopies } = await import('./small-copies.mjs');
  await smallCopies();
} catch (err) {
  console.warn(`Small copies skipped: ${err.message}`);
}
