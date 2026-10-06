// ---------- Designs: model cards + 3D viewer ----------
// Used on designs.html (every design) and project.html (only that project's designs).
// Each design's files live in models/<folder>/ (listed in models/models.json by the build script).
// - 1 file  -> normal viewer
// - 2+ files -> configuration toggle. If the files share part names (same assembly exported twice),
//              the parts glide into their new positions; otherwise the views crossfade.
// - section: true -> a "3/4 section" button that cuts away a quarter (filled cut faces).
// Every model also gets a "Reset view" button (back to the iso view, spinning).
// - rotate: [x, y, z] in degrees, for exports that come out lying on their side.
// Card pictures: images/designs/<id>.webp if it exists (fast), otherwise an isometric
// snapshot of the first file is rendered in the browser (slow for big robots).

const grid = document.getElementById('design-grid') || document.createElement('div');   // (missing on a "not found" project page)
const dialog = document.getElementById('viewer');
const stage = dialog.querySelector('.viewer-stage');
const canvas = dialog.querySelector('canvas');
const status = dialog.querySelector('.viewer-status');
const toggle = dialog.querySelector('.viewer-configs');
const tools = dialog.querySelector('.viewer-tools');

// on a project page, project.js sets data-project so only that project's models show
const onlyProject = grid.dataset.project;
const list = onlyProject ? DESIGNS.filter((d) => d.project === onlyProject) : DESIGNS;
if (onlyProject && !list.length) grid.closest('.project-models').remove();   // no models: hide the section

// A design with a portfolio project gets that project's year, tags, links, status and summary,
// unless the design sets its own (e.g. the two cycloidal gearbox versions keep their own years).
const isBlank = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
const projectOf = (id) => (typeof PROJECTS === 'undefined' ? undefined : PROJECTS.find((p) => p.id === id));
DESIGNS.forEach((d) => {
  const p = projectOf(d.project);
  if (p) {
    if (isBlank(d.year)) d.year = p.year;
    if (isBlank(d.tags)) d.tags = p.tags;
    if (isBlank(d.link)) d.link = p.links;
    if (isBlank(d.status)) d.status = p.status;
  }
  d.tags = d.tags || [];
});

// description: the design's own summary, or else its portfolio project's summary
const summaryOf = (d) => d.summary || projectOf(d.project)?.summary || 'Description coming soon.';
const projectTitle = (id) => projectOf(id)?.title || id;
const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

// files for each design, from models/models.json; STEP downloads from cad/cad.json
const modelList = fetch('models/models.json').then((r) => r.json()).catch(() => ({}));
const cadList = fetch('cad/cad.json').then((r) => r.json()).catch(() => ({}));
// Made on every deploy (scripts/small-copies.mjs): which model files have a packed copy (.gz, about half the
// download) and which are only "the same parts, moved" (.poses.json). No list - e.g. in Live Server - means
// the plain files are used, as before.
const fastList = fetch('models/fast.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const fastOf = async (url) => (await fastList)[decodeURIComponent(url).replace(/^models\//, '')] || {};
const canUnpack = 'DecompressionStream' in window;
// button text from the website, e.g. makerworld.com -> "MakerWorld"
const SITES = { makerworld: 'MakerWorld', youtube: 'YouTube', youtu: 'YouTube', github: 'GitHub', printables: 'Printables',
  thingiverse: 'Thingiverse', grabcad: 'GrabCAD', onshape: 'Onshape', instagram: 'Instagram', linkedin: 'LinkedIn', drive: 'Google Drive' };
function linkLabel(url) {
  const host = url.replace(/^https?:\/\/(www\.)?/, '').split(/[/.]/)[0].toLowerCase();
  return SITES[host] ? `View on ${SITES[host]}` : 'Link';
}
const mb = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(0)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
async function filesFor(d) {
  const folder = d.folder || d.id;
  // (encoded, so a comma in a file name becomes %2C: that's the address Cloudflare serves. The plain one costs a redirect.)
  return ((await modelList)[folder] || []).map((f) => `models/${encodeURIComponent(folder)}/${encodeURIComponent(f)}`);
}
// "models/ARM/2-extended.glb" -> "Extended"   (or use labels from designs-list.js)
function configLabel(d, url, i, files) {
  if (d.configs?.[i]) return d.configs[i];
  const clean = (u) => decodeURIComponent(u.split('/').pop()).replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]*/, '');
  if (files.filter((f) => clean(f) === clean(url)).length > 1) {   // names only differ by the number
    if (files.length === 2) return ['Stowed', 'Deployed'][i];
    return i === 0 ? 'Stowed' : `Deployed ${i}`;   // 3+ files: Stowed, Deployed 1, Deployed 2...
  }
  const name = clean(url).replace(/[_-]+/g, ' ').trim();
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// ---------- shared three.js helpers ----------
let T;   // three.js, downloaded the first time it's needed
const loadThree = async () => (T ??= await import('./vendor/three-bundle.min.js'));

// Polished metal only looks like metal when it has something to reflect - without it, chrome parts
// render almost black. REFLECT is how strongly the models reflect a soft studio room:
// 0 = off, 1 = full. Higher brightens everything (robots wash out), so keep it low.
const REFLECT = 0.25;

function makeScene(camera, renderer) {
  const scene = new T.Scene();
  const lamps = 1 - 0.4 * REFLECT;   // the lamps dim a little as the reflections come up
  scene.add(new T.HemisphereLight(0xffffff, 0x404040, 2.2 * lamps));
  const key = new T.DirectionalLight(0xffffff, 2 * lamps);
  key.position.set(3, 5, 4);
  const fill = new T.DirectionalLight(0xffffff, 0.7 * lamps);
  fill.position.set(-4, 2, -3);
  camera.add(new T.DirectionalLight(0xffffff, 0.6 * lamps));   // light that follows the camera
  scene.add(key, fill, camera);
  if (REFLECT) {
    scene.environment = new T.PMREMGenerator(renderer).fromScene(new T.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = REFLECT;
  }
  return scene;
}

async function loadModel(url, color) {
  const ext = url.split('.').pop().toLowerCase();
  const material = () => new T.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.55 });

  if (ext === 'stl') {
    const mesh = new T.Mesh(await new T.STLLoader().loadAsync(url), material());
    mesh.rotation.x = -Math.PI / 2;   // STL files are Z-up, three.js is Y-up
    const group = new T.Group();      // wrap it so its own rotation isn't touched later
    group.add(mesh);
    return group;
  }
  if (ext === 'obj') {
    const obj = await new T.OBJLoader().loadAsync(url);
    obj.traverse((m) => { if (m.isMesh) m.material = material(); });
    return obj;
  }
  const loader = new T.GLTFLoader().setMeshoptDecoder(T.MeshoptDecoder);   // (compressed files need the decoder)
  let gltf;
  if (canUnpack && (await fastOf(url)).gz) {
    // the packed copy: about half the download. Unpack it here, then read it like the plain file.
    try {
      const response = await fetch(`${url}.gz`);
      if (!response.ok) throw new Error(response.status);
      let data = await response.arrayBuffer();
      const head = new Uint8Array(data, 0, 2);
      if (head[0] === 0x1f && head[1] === 0x8b) data = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      gltf = await loader.parseAsync(data, '');
    } catch (err) {
      console.warn(`Packed copy of ${url} not used (${err.message})`);
    }
  }
  gltf ??= await loader.loadAsync(url);
  const scene = gltf.scene;   // .glb / .gltf keep their own colours
  scene.userData.named = true;                                     // has real part names (for gliding)
  scene.userData.nodeOf = (o) => gltf.parser.associations.get(o)?.nodes;   // which entry in the file's part list an object is
  return scene;
}

// Clean up an export before showing it:
// - clear plastics (Lexan / polycarbonate) come out of Inventor in different ways - some glow grey and
//   look solid - so make every see-through material actually see-through
// - hideSurfaces: true removes reference surface bodies (Inventor names them Srf1, Srf2...)
function tidy(model, d) {
  const surfaces = [];
  model.traverse((o) => {
    if (d.hideSurfaces && /^Srf\d*(_\d+)?$/.test(o.name)) surfaces.push(o);   // the loader renames repeats to Srf1_1, Srf1_2...
    if (!o.isMesh) return;
    [o.material].flat().forEach((m) => {
      if (!(m.transmission > 0) || m.userData.cleared) return;
      m.userData.cleared = true;
      const smoked = /smoke|tint/i.test(m.name);
      m.emissive?.set(0x000000);                                   // no self-glow
      m.transmission = Math.max(m.transmission, smoked ? 0.7 : 0.85);
      if (!smoked) m.color.lerp(new T.Color(0xffffff), 0.6);       // clear, not dark glass
      m.roughness = Math.min(m.roughness, 0.15);                   // glossy, not frosted (frosted renders solid)
    });
  });
  surfaces.forEach((o) => o.removeFromParent());
}

// turn a model upright if its export came out on its side (rotate: [x, y, z] degrees)
function orient(model, d) {
  tidy(model, d);
  if (!d.rotate) return model;
  const g = new T.Group();
  g.rotation.set(...d.rotate.map((deg) => (deg * Math.PI) / 180));
  g.add(model);
  g.userData.named = model.userData.named;
  g.userData.nodeOf = model.userData.nodeOf;
  return g;
}

// centre the models on the origin and back the camera off along `dir` until everything fits
// (`bounds` = models to measure, so a gliding model is framed for every pose)
function fit(objects, cam, dir, tightness, bounds = objects) {
  const wrap = new T.Group();
  const box = new T.Box3();
  bounds.forEach((o) => box.expandByObject(o));
  objects.forEach((o) => wrap.add(o));
  const centre = box.getCenter(new T.Vector3());
  objects.forEach((o) => o.position.sub(centre));
  const size = box.getSize(new T.Vector3()).length();
  cam.position.copy(new T.Vector3(...dir).normalize().multiplyScalar(distanceFor(size, cam) * tightness));
  cam.lookAt(0, 0, 0);
  cam.near = size / 100;
  cam.far = size * 100;
  cam.updateProjectionMatrix();
  return { wrap, size };
}

// how far back a camera has to be for something `size` across to fill its view
const distanceFor = (size, cam) => size / (2 * Math.tan((cam.fov * Math.PI) / 360));

const dispose = (o) => o.traverse((m) => { m.geometry?.dispose(); [m.material].flat().forEach((x) => x?.dispose?.()); });

// ---------- getting ready before the click ----------
// Opening a model needs the 3D code (three.js) and the model file(s). warm() fetches them ahead of time, so the
// viewer opens at once. The files land in the browser's cache and the viewer reads them from there.
const warmed = new Set();
function warm(d, { files = true, asked = true } = {}) {
  loadThree().catch(() => {});
  if (!files) return;
  filesToFetch(d).then(async (list) => {
    for (const url of list) {   // one at a time, so the first configuration arrives first
      if (warmed.has(url)) continue;
      warmed.add(url);
      try {
        const stop = new AbortController();
        const r = await fetch(url, { priority: 'low', signal: stop.signal });
        // fetched without being asked (project page): give up on a big file if the connection looks slow
        if (!asked && slowLink() && Number(r.headers.get('content-length')) > 4e6) { stop.abort(); warmed.delete(url); continue; }
        await r.arrayBuffer();
      } catch { warmed.delete(url); }
    }
  });
}
// the files the viewer will ask for: packed copies, and part positions instead of a second or third full model
async function filesToFetch(d) {
  const files = await filesFor(d);
  const info = await Promise.all(files.map(fastOf));
  const light = files.length > 1 && info.slice(1).every((f) => f.poses);
  return files.map((f, i) => (light && i > 0 ? `${f}.poses.json` : info[i].gz && canUnpack ? `${f}.gz` : f));
}
// (Chrome and Edge report the connection; browsers that don't are treated as fast)
const slowLink = () => { const c = navigator.connection; return Boolean(c && (c.saveData || c.downlink < 5 || /2g|3g/.test(c.effectiveType || ''))); };

// ---------- card snapshots (isometric view of the first file) ----------
let snap;   // one hidden renderer, reused for every card
let queue = Promise.resolve();

async function snapshot(cover) {
  const [first] = await filesFor(cover.design);
  if (!first) return;
  await loadThree();
  if (!snap) {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(800, 500, false);   // same 16:10 shape as the card cover
    renderer.outputColorSpace = T.SRGBColorSpace;
    const camera = new T.PerspectiveCamera(30, 800 / 500, 0.1, 1000);
    snap = { renderer, camera, scene: makeScene(camera, renderer) };
  }
  const { wrap } = fit([orient(await loadModel(first, cover.design.color || accent()), cover.design)], snap.camera, [1, 0.9, 1], 0.8 * (cover.design.frame || 1));
  snap.scene.add(wrap);
  snap.renderer.render(snap.scene, snap.camera);
  const img = new Image();
  img.alt = '';
  img.src = snap.renderer.domElement.toDataURL('image/png');
  cover.prepend(img);
  cover.classList.add('rendered');
  snap.scene.remove(wrap);
  dispose(wrap);
}

const watcher = new IntersectionObserver((entries) => {
  entries.filter((e) => e.isIntersecting).forEach(({ target }) => {
    watcher.unobserve(target);
    queue = queue.then(() => snapshot(target)).catch((err) => console.error(err));   // one at a time
  });
}, { rootMargin: '200px' });

// ---------- cards ----------
function buildCards() {
  list.forEach((d) => {
    const card = document.createElement('button');
    card.className = 'work-card';
    card.innerHTML = `
      <div class="work-cover"><img src="images/designs/${d.thumb || `${d.id}.webp`}" alt="" loading="lazy"><span class="badge-3d">3D</span>${d.status ? '<span class="badge-status"></span>' : ''}</div>
      <div class="work-body">
        <h2></h2>
        <p class="work-meta"></p>
        <p class="work-summary"></p>
      </div>`;
    card.querySelector('h2').textContent = d.title;
    card.querySelector('.work-meta').textContent = [d.year, ...d.tags].filter(Boolean).join(' · ');
    card.querySelector('.work-summary').textContent = summaryOf(d);
    if (d.status) card.querySelector('.badge-status').textContent = d.status;
    if (d.project && !onlyProject && d.project !== d.id && projectTitle(d.project) !== d.title) {   // only when the model is one piece of a bigger project
      const from = document.createElement('p');
      from.className = 'work-from';
      from.textContent = `Part of ${projectTitle(d.project)}`;
      card.querySelector('.work-body').appendChild(from);
    }
    card.onclick = () => openViewer(d);
    // the pointer (or a finger, or keyboard focus) reaching a card is a good sign it's about to be opened
    ['pointerenter', 'touchstart', 'focus'].forEach((type) => card.addEventListener(type, () => warm(d), { passive: true, once: true }));
    grid.appendChild(card);
    const cover = card.querySelector('.work-cover');
    cover.design = d;
    const img = cover.querySelector('img');
    img.onload = () => { if (!d.thumb) cover.classList.add('rendered'); };
    img.onerror = () => { img.remove(); watcher.observe(cover); };   // no saved picture: render one
  });
}

buildCards();
// On a project page the visitor is likely to open that project's model: get it ready once the page has settled.
// (Phones get the 3D code only - model files run up to 15 MB, too much to fetch on mobile data without being asked.)
if (onlyProject && list.length && !navigator.connection?.saveData) {
  whenSettled(() => list.forEach((d) => warm(d, { files: matchMedia('(hover: hover) and (pointer: fine)').matches, asked: false })));
}
// project page: "3D models" when there are two, and refresh the jump links
if (onlyProject && list.length > 1) grid.closest('.project-models')?.querySelector('h2')?.replaceChildren('3D models');
window.buildNav?.();

// ---------- configurations ----------
// Gliding: every node gets a key from its path of names, e.g. "ARM1/LINK_21/Solid1".
// Nodes with the same key in two files are the same part, so we can move it between their poses.
function poses(root) {
  const map = new Map();
  (function walk(node, path) {
    const seen = {};
    node.children.forEach((child) => {
      if (child.userData.helper) return;
      const n = (seen[child.name] = (seen[child.name] || 0) + 1);
      const key = `${path}/${child.name}#${n}`;
      map.set(key, { node: child, pos: child.position.clone(), quat: child.quaternion.clone(), scale: child.scale.clone() });
      walk(child, key);
    });
  })(root, '');
  return map;
}

// Stowed / deployed files usually hold exactly the same parts, only moved. The deploy spots that and saves the
// extra files as a list of part positions, so the viewer downloads and builds the model once.
// lightConfigs() loads the first file and asks for those lists, but only waits for the model: the viewer shows the
// first configuration at once, and lightRest() works out the other configurations' poses when the lists arrive.
// Returns null when that isn't possible (no lists, or the model failed) - then every file is loaded, as before.
const setPoses = (map) => map.forEach((p) => { p.node.position.copy(p.pos); p.node.quaternion.copy(p.quat); p.node.scale.copy(p.scale); });
// where a configuration sits and how big it is, for the camera (frame: 1.2 in designs-list.js = 20% further back)
const frameOf = (box, centre0, d) => ({ target: box.getCenter(new T.Vector3()).sub(centre0), size: box.getSize(new T.Vector3()).length() * (d.frame || 1) });
// the other configurations have arrived: let the camera reach them and wake up their buttons
function configsReady(v) {
  controls.maxDistance = Math.max(controls.maxDistance, ...v.frames.map((f) => f.size * 5));
  v.ready = v.ready.map(() => true);
  toggle.querySelectorAll('button').forEach((b) => { b.disabled = false; b.removeAttribute('title'); });
}
const configsFailed = (v, err) => {
  console.error(err);
  if (current === v) toggle.querySelectorAll('button:disabled').forEach((b) => { b.title = 'Could not load this configuration'; });
};

async function lightConfigs(files, d, colour) {
  if (files.length < 2) return null;
  const info = await Promise.all(files.map(fastOf));
  if (!info.slice(1).every((f) => f.poses)) return null;
  // both start now; only the model is waited for here
  const lists = Promise.all(files.slice(1).map((f) => fetch(`${f}.poses.json`).then((r) => { if (!r.ok) throw new Error(`${r.status} for ${f}.poses.json`); return r.json(); })));
  lists.catch(() => {});   // (a failure is dealt with in lightRest)
  let model;
  try {
    model = orient(await loadModel(files[0], colour), d);
    if (!model.userData.nodeOf) throw new Error('no part list');
    return { model, lists };
  } catch (err) {
    console.warn(`Loading every configuration in full (${err.message})`);
    if (model) dispose(model);
    return null;
  }
}

// The other configurations of a "same parts, moved" model, once their lists of part positions are in.
async function lightRest(v, d, ticket, centre0, light) {
  let moved;
  try { moved = await light.lists; } catch (err) {
    console.warn(`Loading every configuration in full (${err.message})`);
    return loadRest(v, d, ticket, centre0);
  }
  if (ticket !== opening || current !== v || !dialog.open) return;   // closed or changed meanwhile
  try {
    const model = light.model, nodeOf = model.userData.nodeOf;
    const base = poses(model);   // (nothing has moved the parts yet: the other buttons are still off)
    const maps = [base, ...moved.map((list) => {
      const map = new Map();
      base.forEach((p, key) => {
        const to = list[nodeOf(p.node)];   // null / missing = this part doesn't move
        if (!to) { map.set(key, p); return; }
        const pos = p.pos.clone().set(0, 0, 0), quat = p.quat.clone().identity(), scale = p.scale.clone().set(1, 1, 1);
        if (to.m) p.node.matrix.clone().fromArray(to.m).decompose(pos, quat, scale);
        else { if (to.t) pos.fromArray(to.t); if (to.r) quat.fromArray(to.r); if (to.s) scale.fromArray(to.s); }
        map.set(key, { node: p.node, pos, quat, scale });
      });
      return map;
    })];
    // where each configuration sits and how big it is (for the camera): put the parts there, measure, put them
    // back - all in one go, between two frames, so none of it is ever drawn
    const boxOf = (map) => { setPoses(map); model.updateMatrixWorld(true); return new T.Box3().setFromObject(model); };
    const home = boxOf(base).getCenter(new T.Vector3());
    maps.slice(1).forEach((map) => v.frames.push(frameOf(boxOf(map), home, d)));
    setPoses(base);
    model.updateMatrixWorld(true);
    v.poses = maps;
    v.glide = true;
    configsReady(v);
  } catch (err) {
    configsFailed(v, err);
  }
}

function canGlide(models) {
  if (!models.every((m) => m.userData.named)) return false;
  const a = poses(models[0]);
  return models.slice(1).every((m) => {
    const b = poses(m);
    const meshes = [...a].filter(([, v]) => v.node.isMesh);
    return meshes.filter(([k]) => b.has(k)).length / meshes.length > 0.6;   // most parts match by name
  });
}

const anims = new Set();   // transitions in progress, advanced every frame
const animate = (ms, step, done) => anims.add({ start: performance.now(), ms, step, done });
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function switchConfig(v, to) {
  if (to === v.active || to >= v.files.length || v.ready?.[to] === false) return;   // (false = still loading)
  const from = v.active;
  v.active = to;
  toggle.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', i === to));

  if (v.glide) {
    // move every matching part of the shown model to its pose in the target file
    const target = v.poses[to];
    const moves = [...v.poses[0]].map(([key, p]) => {
      const goal = target.get(key);
      p.node.visible = !!goal;   // parts that don't exist in the target file disappear
      return goal && { p, pos: p.node.position.clone(), quat: p.node.quaternion.clone(), scale: p.node.scale.clone(), goal };
    }).filter(Boolean);
    animate(1200, (t) => moves.forEach(({ p, pos, quat, scale, goal }) => {
      p.node.position.lerpVectors(pos, goal.pos, t);
      p.node.quaternion.slerpQuaternions(quat, goal.quat, t);
      p.node.scale.lerpVectors(scale, goal.scale, t);
    }));
  } else {
    // crossfade between the two models
    const mats = (o) => { const out = []; o.traverse((m) => m.isMesh && !m.userData.helper && out.push(...[m.material].flat())); return out; };
    const out = mats(v.models[from]), inn = mats(v.models[to]);
    [...out, ...inn].forEach((m) => { m.transparent = true; });
    v.models[to].visible = true;
    animate(600, (t) => {
      out.forEach((m) => { m.opacity = 1 - t; });
      inn.forEach((m) => { m.opacity = t; });
    }, () => {
      v.models[from].visible = false;
      [...out, ...inn].forEach((m) => { m.transparent = false; m.opacity = 1; });
    });
  }
  reframe(v, to, v.glide ? 1200 : 600);
}

// ---------- cutaways: 3/4 section (section: true) and moving slice (slice: 'yz') ----------
// Clipping planes hide part of the model. The cut faces are filled with the "stencil" trick:
// for each plane, every part is drawn invisibly, counting how many of its surfaces each pixel's
// sight line passes through. An odd count means that point on the plane is inside solid
// material, so a flat cap is drawn there.
const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

// cuts: [{ normal, edge }] - each cut removes everything on the +normal side of its plane;
// `edge` (optional) limits that cut's cap to where the other cut also removes material.
function addCutaway(v, size, cuts, together) {
  const box = new T.Box3().setFromObject(v.wrap);   // measured before the caps are added
  const planes = cuts.map((c) => new T.Plane(c.normal.clone().negate(), 0));
  const edges = cuts.map((c) => c.edge && new T.Plane(c.edge.clone(), 0));

  // surface bodies (Inventor names them Srf1, Srf2...) aren't closed solids, so they'd confuse the count
  const isSurface = (m) => /^Srf\d*/.test(m.name) || /^Srf\d*/.test(m.parent?.name || '');
  const meshes = [];
  v.wrap.traverse((m) => { if (m.isMesh && !m.userData.helper) meshes.push(m); });
  meshes.forEach((m) => {
    [m.material].flat().forEach((mat) => { mat.clippingPlanes = planes; mat.clipIntersection = together; });
    m.renderOrder = 10;   // after the caps
  });
  const solids = meshes.filter((m) => !isSurface(m));

  const counter = (plane, side, op) => new T.MeshBasicMaterial({
    side, clippingPlanes: [plane], depthWrite: false, depthTest: false, colorWrite: false,
    stencilWrite: true, stencilFunc: T.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op,
  });
  const capColour = new T.Color(v.colour).multiplyScalar(0.62);
  const helpers = [];

  cuts.forEach((c, i) => {
    const order = i * 2 + 1;
    const back = counter(planes[i], T.BackSide, T.IncrementWrapStencilOp);
    const front = counter(planes[i], T.FrontSide, T.DecrementWrapStencilOp);
    solids.forEach((m) => [back, front].forEach((mat) => {
      const s = new T.Mesh(m.geometry, mat);
      s.userData.helper = true;
      s.renderOrder = order;
      m.add(s);
      helpers.push(s);
    }));
    const cap = new T.Mesh(new T.PlaneGeometry(size * 2, size * 2), new T.MeshStandardMaterial({
      color: capColour, metalness: 0.1, roughness: 0.8, clippingPlanes: edges[i] ? [edges[i]] : [],
      stencilWrite: true, stencilRef: 0, stencilFunc: T.NotEqualStencilFunc,
      stencilFail: T.ReplaceStencilOp, stencilZFail: T.ReplaceStencilOp, stencilZPass: T.ReplaceStencilOp,
    }));
    cap.userData = { helper: true, normal: c.normal };
    cap.renderOrder = order + 0.5;
    cap.onAfterRender = (r) => r.clearStencil();   // fresh count for the next plane
    v.wrap.add(cap);
    helpers.push(cap);
  });

  // where the model ends along each cut direction ("closed" = planes just outside it)
  const far = Math.max(...cuts.map((c) => box.max.dot(c.normal))) + size * 0.01;

  return {
    depth: far, far, low: Math.min(...cuts.map((c) => box.min.dot(c.normal))),
    set(d) {
      this.depth = d;
      planes.forEach((p) => { p.constant = d; });
      edges.forEach((e) => { if (e) e.constant = -d; });
      helpers.forEach((h) => {
        h.visible = d < far;   // skip the extra drawing while nothing is cut
        if (h.userData.normal) { h.position.copy(h.userData.normal).multiplyScalar(d); h.lookAt(h.userData.normal.clone().multiplyScalar(d + 1)); }
      });
    },
  };
}

// 3/4 section: two planes that both contain `axis` remove one quarter
function addSection(v, size, axis) {
  const [a, b] = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] }[axis] || ['x', 'z'];
  const na = new T.Vector3(...AXES[a]), nb = new T.Vector3(...AXES[b]);
  v.section = addCutaway(v, size, [{ normal: na, edge: nb }, { normal: nb, edge: na }], true);
  v.section.set(v.section.far);
}

function toggleSection(v, button) {
  const s = v.section;
  s.on = !s.on;
  button.setAttribute('aria-pressed', s.on);
  const from = s.depth, to = s.on ? 0 : s.far;
  animate(900, (t) => s.set(from + (to - from) * t));
}

// slice: one plane (e.g. 'yz') that slowly pans back and forth through the whole model
function addSlice(v, size, plane) {
  const normal = new T.Vector3(...AXES[{ yz: 'x', xz: 'y', zx: 'y', xy: 'z' }[plane] || 'x']);
  v.slice = addCutaway(v, size, [{ normal }], false);
  v.slice.set(v.slice.far);
}

function toggleSlice(v, button) {
  const s = v.slice;
  s.on = !s.on;
  button.setAttribute('aria-pressed', s.on);
  const top = s.far * 0.97, bottom = s.low + (s.far - s.low) * 0.03;   // stop just short of each end
  if (s.on) {
    // glide in to the near side, then pan slowly through and back, until switched off
    const from = s.depth;
    animate(900, (t) => s.set(from + (top - from) * t), () => {
      const start = performance.now();
      s.tick = (now) => {
        const phase = ((now - start) / 16000) % 1;                 // 8 s across, 8 s back
        const t = (1 - Math.cos(phase * 2 * Math.PI)) / 2;         // smooth turn-around at each end
        s.set(top + (bottom - top) * t);
      };
    });
  } else {
    s.tick = null;
    const from = s.depth;
    animate(900, (t) => s.set(from + (s.far - from) * t));
  }
}

// ---------- exploded view (explode: { layers: [...] } in js/designs-list.js) ----------
// Each layer is [part names, how far to move along the vertical axis in mm, { below / above: height in mm }].
// The parts glide apart along the axis and back, and the camera pulls back to keep everything in view.
function addExplode(model, d, centre0) {
  const src = d.rotate ? model.children[0] : model;   // the loaded file itself (inside the "rotate" wrapper)
  model.updateMatrixWorld(true);
  const parts = new Set();
  src.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.parent;
    parts.add(p !== src && p.children.every((c) => c.isMesh) ? p : m);   // a part made of several pieces moves as one
  });
  const layers = d.explode.layers.map(([names, mm, where = {}]) => ({ re: new RegExp(names), mm, ...where }));
  const hide = d.explode.hide && new RegExp(d.explode.hide);
  const moves = [], hidden = [];
  parts.forEach((part) => {
    const names = [];   // its own name + the sub-assemblies it sits in
    for (let o = part; o && o !== src && names.length < 3; o = o.parent) names.push(o.name);
    const name = names.join('/');
    if (hide && hide.test(name)) hidden.push(part);
    const y = new T.Box3().setFromObject(part).getCenter(new T.Vector3()).y * 1000;   // its height in the model, mm
    const layer = layers.find((l) => l.re.test(name) && y < (l.below ?? Infinity) && y >= (l.above ?? -Infinity));
    if (!layer) return;   // not listed: stays where it is
    const to = part.getWorldPosition(new T.Vector3());
    to.y += layer.mm / 1000;
    moves.push({ part, from: part.position.clone(), to: part.parent.worldToLocal(to) });
  });
  const set = (t) => moves.forEach((m) => m.part.position.lerpVectors(m.from, m.to, t));

  set(1);   // measure it spread out, so the camera knows where to go
  const box = new T.Box3().setFromObject(model);
  set(0);
  const frame = { target: box.getCenter(new T.Vector3()).sub(centre0), size: box.getSize(new T.Vector3()).length() };
  return { set, hidden, frame, t: 0, on: false };
}

// It is shown lying on its side (the stage is wider than it is tall), from a fixed starting angle.
const EXPLODE_DIR = [0.45, 0.3, 0.85];
const explodedFrame = (e) => ({
  target: e.frame.target.clone().applyAxisAngle(new T.Vector3(0, 0, 1), -Math.PI / 2),
  size: e.frame.size * Math.max(0.9, 1.2 / camera.aspect),   // wide stage: come closer; narrow screen: stand back
});

function toggleExplode(v, button) {
  const e = v.explode;
  e.on = !e.on;
  button.setAttribute('aria-pressed', e.on);
  if (e.on) e.hidden.forEach((p) => { p.visible = false; });   // reference bodies that would cover the parts
  const from = e.t, to = e.on ? 1 : 0;
  animate(1400, (t) => {
    e.t = from + (to - from) * t;
    e.set(e.t);
    v.wrap.rotation.z = (-Math.PI / 2) * e.t;   // tip it over as it opens
  }, () => { if (!e.on) e.hidden.forEach((p) => { p.visible = true; }); });
  // fly to the exploded view and hold still; closing it goes back to the spinning start view
  controls.autoRotate = false;
  flyTo(e.on ? explodedFrame(e) : v.frames[v.active], 1400, e.on ? EXPLODE_DIR : HOME_DIR, () => { controls.autoRotate = !e.on; });
}

// ---------- camera moves ----------
const HOME_DIR = [0.6, 0.45, 0.75];   // the starting iso direction
const fitDistance = (size) => distanceFor(size, camera) * 0.85;

// follow a configuration change: keep the viewing angle, move the centre + distance to the new pose
function reframe(v, to, ms) {
  const f = v.frames[to];
  const t0 = controls.target.clone(), t1 = f.target.clone();
  const l0 = camera.position.distanceTo(t0), l1 = fitDistance(f.size);
  animate(ms, (t) => {
    const off = camera.position.clone().sub(controls.target).setLength(l0 + (l1 - l0) * t);
    controls.target.lerpVectors(t0, t1, t);
    camera.position.copy(controls.target).add(off);
  });
}

// fly to frame f = { target, size }, turning to look from direction `dir` on the way
function flyTo(f, ms, dir, done) {
  const t0 = controls.target.clone(), t1 = f.target.clone();
  const off0 = camera.position.clone().sub(t0);
  const dirFrom = off0.clone().normalize(), dirTo = new T.Vector3(...dir).normalize();
  const l0 = off0.length(), l1 = fitDistance(f.size);
  controls.enabled = false;
  animate(ms, (t) => {
    controls.target.lerpVectors(t0, t1, t);
    camera.position.copy(controls.target).add(dirFrom.clone().lerp(dirTo, t).normalize().multiplyScalar(l0 + (l1 - l0) * t));
    camera.lookAt(controls.target);
  }, () => { controls.enabled = true; done?.(); });
}

// reset view: fly back to the iso view of the current configuration and start spinning again
function resetView(v) {
  const exploded = v.explode?.on;   // exploded: back to its own starting angle, and hold still
  controls.autoRotate = false;
  flyTo(exploded ? explodedFrame(v.explode) : v.frames[v.active], 800, exploded ? EXPLODE_DIR : HOME_DIR, () => { controls.autoRotate = !exploded; });
}

// ---------- viewer ----------
let renderer, scene, camera, controls, current;

async function setupViewer() {
  await loadThree();
  renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true });
  renderer.localClippingEnabled = true;   // for the 3/4 section
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;

  camera = new T.PerspectiveCamera(35, 1, 0.1, 1000);
  scene = makeScene(camera, renderer);

  controls = new T.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotateSpeed = 1.5;
  controls.addEventListener('start', () => { controls.autoRotate = false; });   // stop spinning once they grab it

  new ResizeObserver(resize).observe(stage);
}

function resize() {
  if (!renderer) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

let opening = 0;   // ignore a slow load if another model was opened meanwhile

async function openViewer(d) {
  const ticket = ++opening;
  dialog.querySelector('h2').textContent = d.title;
  dialog.querySelector('.work-meta').textContent = [d.year, ...d.tags].filter(Boolean).join(' · ');
  dialog.querySelector('.work-summary').textContent = summaryOf(d);
  dialog.querySelector('.viewer-note').textContent = d.status ? `${d.status} - this CAD isn't finished yet, so parts may be missing or change.` : '';
  toggle.innerHTML = '';
  tools.innerHTML = '';
  anims.clear();
  dialog.showModal();
  if (current) { scene.remove(current.wrap); dispose(current.wrap); current = null; }

  const files = await filesFor(d);
  const links = dialog.querySelector('.project-links');
  links.innerHTML = '';
  if (d.project && !onlyProject) links.innerHTML = `<a class="pill pill-cta" href="project.html?id=${encodeURIComponent(d.project)}">See the ${projectTitle(d.project).replace(/[<>&"]/g, '')} project →</a>`;
  [d.link].flat().filter(Boolean).forEach((l) => {   // one link or a list: 'https://...' or { label, url }
    const url = l.url || l;
    const label = l.label || linkLabel(url);
    links.innerHTML += `<a class="pill" href="${encodeURI(url)}" target="_blank" rel="noopener">${label.replace(/[<>&"]/g, '')} ↗</a>`;
  });
  // (the download list comes from the Cloudflare bucket and can be the slowest thing on the page, so it isn't
  //  waited for: the buttons are added when it arrives, in their usual place before "Full CAD")
  if (d.download !== false) cadList.then((list) => {
    if (ticket !== opening) return;
    const html = (list[d.id] || []).map(({ name, size }) => `<a class="pill" href="cad/${encodeURIComponent(d.id)}/${encodeURIComponent(name)}" download>Download STEP · ${mb(size)}</a>`).join('');
    const before = links.querySelector('.pill-fullcad');
    if (before) before.insertAdjacentHTML('beforebegin', html); else links.insertAdjacentHTML('beforeend', html);
  });
  // who owns it - every design defaults to "© <year> Aidan Brown. All rights reserved."
  const year = typeof rightsYear === 'function' ? rightsYear(d.year) : d.year || new Date().getFullYear();   // ("2024-present" -> "2024-2026")
  dialog.querySelector('.viewer-license').textContent = d.license || `© ${year} Aidan Brown. All rights reserved.`;
  if (d.cadLink) links.innerHTML += `<a class="pill pill-fullcad" href="${encodeURI(d.cadLink)}" target="_blank" rel="noopener">Full CAD ↗</a>`;

  if (!files.length) { status.textContent = 'Model coming soon'; return; }
  status.textContent = files.length > 1 ? `Loading ${files.length} configurations…` : 'Loading model…';
  try {
    if (!renderer) await setupViewer();
    resize();
    const colour = d.color || accent();
    // the quick way first: one model + part positions for the other configurations (see lightConfigs)
    const light = await lightConfigs(files, d, colour);
    // With more than one configuration: show the first as soon as it's in and bring the others in behind it
    // (lightRest / loadRest) - nobody can use the second configuration before they've seen the first.
    // (Models with a cutaway that need every file in full are loaded all at once: the cut is set up on every part.)
    const later = files.length > 1 && (Boolean(light) || (!d.section && !d.slice));
    const models = light ? [light.model] : await Promise.all((later ? files.slice(0, 1) : files).map(async (f) => orient(await loadModel(f, colour), d)));
    if (ticket !== opening || !dialog.open) return models.forEach(dispose);   // another model was opened, or the viewer was closed

    const glide = !later && models.length > 1 && canGlide(models);
    const shown = glide ? [models[0]] : models;   // gliding animates one model; crossfade keeps them all
    // frame the first configuration; remember where the others sit so the camera can follow
    const boxes = models.map((m) => new T.Box3().setFromObject(m));
    const centre0 = boxes[0].getCenter(new T.Vector3());
    const far = d.frame || 1;   // (frame: 1.2 in designs-list.js = camera 20% further back)
    const frames = boxes.map((b) => frameOf(b, centre0, d));
    const explode = d.explode && files.length === 1 ? addExplode(models[0], d, centre0) : null;   // (before anything is moved)
    const { wrap, size } = fit(shown, camera, HOME_DIR, 0.85 * far, [models[0]]);
    shown.forEach((m, i) => { m.visible = i === 0; });
    const poseMaps = glide ? models.map(poses) : [];
    if (glide) models.slice(1).forEach(dispose);   // only their poses are needed
    current = { wrap, files, models: shown, active: 0, glide, poses: poseMaps, frames, explode, colour, ready: files.map((f, i) => !later || i === 0) };
    if (d.section) addSection(current, size, d.section);
    if (d.slice) addSlice(current, size, d.slice);

    controls.target.set(0, 0, 0);
    controls.minDistance = size * 0.3;
    controls.maxDistance = Math.max(...frames.map((f) => f.size), explode ? explode.frame.size : 0) * 5;
    controls.autoRotate = true;
    scene.add(wrap);
    status.textContent = '';

    if (files.length > 1) {
      files.forEach((f, i) => {
        const b = document.createElement('button');
        b.textContent = configLabel(d, f, i, files);
        b.setAttribute('aria-pressed', i === 0);
        b.onclick = () => switchConfig(current, i);
        if (!current.ready[i]) { b.disabled = true; b.title = 'Loading this configuration…'; }
        toggle.appendChild(b);
      });
    }

    const tool = (label, title, onclick) => {
      const b = document.createElement('button');
      b.innerHTML = label;
      b.title = title;
      b.onclick = onclick;
      tools.appendChild(b);
      return b;
    };
    tool('<span aria-hidden="true">⟲</span> Reset view', 'Back to the starting view', () => resetView(current));
    // 3/4 section and Explode: one at a time (a cut through spread-out parts makes no sense)
    let sectionButton, explodeButton;
    if (current.section) {
      sectionButton = tool('<span aria-hidden="true">◪</span> 3/4 section', 'Cut away a quarter to see inside', () => {
        if (current.explode?.on) toggleExplode(current, explodeButton);
        toggleSection(current, sectionButton);
      });
      sectionButton.setAttribute('aria-pressed', false);
    }
    if (current.explode) {
      explodeButton = tool('<span aria-hidden="true">⇕</span> Explode', 'Spread the parts out to see how it goes together', () => {
        if (current.section?.on) toggleSection(current, sectionButton);
        toggleExplode(current, explodeButton);
      });
      explodeButton.setAttribute('aria-pressed', false);
    }
    if (current.slice) {
      const s = tool('<span aria-hidden="true">◫</span> Slice', 'Pan a cut through the model', () => toggleSlice(current, s));
      s.setAttribute('aria-pressed', false);
    }

    renderer.setAnimationLoop((now) => {
      anims.forEach((a) => {
        const t = Math.min((now - a.start) / a.ms, 1);
        a.step(ease(t));
        if (t === 1) { anims.delete(a); a.done?.(); }
      });
      current?.slice?.tick?.(now);
      controls.update();
      renderer.render(scene, camera);
    });
    if (light) lightRest(current, d, ticket, centre0, light);   // (not waited for - the viewer is already usable)
    else if (later) loadRest(current, d, ticket, centre0);
  } catch (err) {
    console.error(err);
    status.textContent = 'Could not load this model.';
  }
}

// Bring in the other configurations behind the first one, one at a time, then wake up their buttons.
async function loadRest(v, d, ticket, centre0) {
  try {
    const rest = [];
    for (const f of v.files.slice(1)) {
      const m = orient(await loadModel(f, v.colour), d);
      if (ticket !== opening || current !== v || !dialog.open) { [m, ...rest].forEach(dispose); return; }   // closed or changed meanwhile
      rest.push(m);
    }
    // where each one sits, so the camera can follow (measured before anything is moved, like the first)
    rest.forEach((m) => v.frames.push(frameOf(new T.Box3().setFromObject(m), centre0, d)));
    if (canGlide([v.models[0], ...rest])) {
      v.poses = [v.models[0], ...rest].map(poses);   // gliding animates the one model; only the others' poses are needed
      v.glide = true;
      rest.forEach(dispose);
    } else {
      rest.forEach((m) => { m.position.sub(centre0); m.visible = false; v.wrap.add(m); v.models.push(m); });   // crossfade keeps them all
    }
    configsReady(v);
  } catch (err) {
    configsFailed(v, err);
  }
}

// Closing the viewer: stop drawing, drop a model that is still on its way (so it doesn't start drawing behind
// the closed card) and free the memory of the one that was showing. Opening it again reads the files from the
// browser's cache.
dialog.addEventListener('close', () => {
  if (dialog.open) return;   // (already opened again)
  anims.clear();
  if (controls) controls.enabled = true;
  renderer?.setAnimationLoop(null);
  if (current) { scene.remove(current.wrap); dispose(current.wrap); current = null; }
});
dialog.querySelector('.viewer-close').onclick = () => dialog.close();
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });   // click outside to close

// designs.html#<id> opens that model straight away (used by links from project pages)
const fromHash = DESIGNS.find((d) => d.id === decodeURIComponent(location.hash.slice(1)));
if (fromHash && !onlyProject) openViewer(fromHash);
