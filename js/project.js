// ---------- Project page: project.html?id=<id> ----------
// Finds the project in js/projects.js and shows its write-up, its documents/code from files/<id>/
// and its photos from images/projects/<id>/.
// Order on the page: the showcase (best photo, 3D model, a clip) next to the summary, then the simulation
// (if there is one), documents & code, the write-up, any other 3D models, videos and the rest of the photos.

async function showProject() {
  const id = new URLSearchParams(location.search).get('id');
  const project = PROJECTS.find((p) => p.id === id);
  const main = document.querySelector('#project');

  if (!project) {
    main.innerHTML = '<p class="page-intro">Project not found. <a href="portfolio.html">Back to the portfolio</a></p>';
    return;
  }

  document.getElementById('design-grid').dataset.project = project.id;   // designs.js shows only this project's models
  showcase.wantsModel = typeof DESIGNS !== 'undefined' && DESIGNS.some((d) => d.project === project.id);
  document.title = `${project.title} · Aidan Brown`;
  document.querySelector('.page-title').textContent = project.title;
  main.querySelector('.work-meta').textContent = [project.year, ...project.tags].filter(Boolean).join(' · ');
  if (project.status) {
    const s = document.createElement('span');
    s.className = 'status-pill';
    s.textContent = project.status;
    main.querySelector('.work-meta').appendChild(s);
  }

  if ((project.types || []).length) main.querySelector('.work-meta').after(projectTypes(project));

  main.querySelector('.project-lead').textContent = projectSummary(project);   // same text as the card
  const body = main.querySelector('.project-body');
  // (a project that only says "Write-up coming soon." gets no write-up section at all)
  if (project.body.length === 1 && /coming soon/i.test(project.body[0])) body.closest('section').remove();
  else project.body.forEach((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    body.appendChild(p);
  });

  const links = main.querySelector('.project-links');
  project.links.forEach((l) => {
    const a = document.createElement('a');
    a.className = 'out-link';
    a.href = l.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = l.label;
    links.appendChild(a);
  });

  const rights = projectRights(project);
  if (!rights.mine) main.querySelector('.project-rights').textContent = rights.text;   // (my own work is covered by the footer line)

  showSim(project);
  showFiles(project);
  showVideos(project);

  const [photos, small] = await Promise.all([fetch('images/projects/projects.json').then((r) => r.json()).catch(() => ({})), thumbs()]);
  const list = (photos[project.id] || []).filter((f) => !/^cover\./i.test(f));   // cover.jpg is only for the card
  const gallery = main.querySelector('.gallery');

  const items = list.map((file) => {
    const src = `images/projects/${project.id}/${encodeURIComponent(file)}`;
    if (isVideo(file)) {
      // short clips straight from the folder: muted loop, controls to unmute
      const v = document.createElement('video');
      Object.assign(v, { src, controls: true, muted: true, loop: true, playsInline: true, preload: 'metadata' });
      return v;
    }
    return photoLink(small, 'projects', project.id, file, project.title);
  });

  // The showcase at the top takes the first photo and one clip (or the next photos); the 3D model takes a
  // place too when the project has one. Everything else goes in the gallery at the bottom, in its usual order.
  const isClip = (el) => el.tagName === 'VIDEO';
  const stills = items.filter((el) => !isClip(el)), clips = items.filter(isClip);
  const picked = stills.slice(0, 1);
  picked.push(...[...clips.slice(0, 1), ...stills.slice(1)].slice(0, (showcase.wantsModel ? 2 : 3) - picked.length));
  showcase.media = picked;
  showcase.ready = true;
  drawShowcase();

  const rest = items.filter((el) => !picked.includes(el));
  rest.forEach((el) => gallery.appendChild(el));
  if (!rest.length) gallery.closest('section').remove();
  else {
    const what = rest.every(isClip) ? 'clips' : rest.some(isClip) ? 'photos & clips' : 'photos';
    gallery.closest('section').querySelector('h2').textContent = picked.length ? `More ${what}` : what[0].toUpperCase() + what.slice(1);
  }

  buildNav();   // (the banner is one of the site's own banner photos, like every other page)
}

// ---------- the showcase: the project itself, on the first screen ----------
// Up to three tiles: the first photo (large), the 3D model, and a clip or another photo.
// The 3D model card is made by js/designs.js, which may finish before or after the photo list arrives, so the
// showcase is drawn when the photos are known and again when the card turns up (placeModel, below).
const showcase = { media: [], ready: false, wantsModel: false };

function drawShowcase() {
  const box = document.querySelector('.project-showcase');
  if (!box || !showcase.ready) return;
  const tiles = showcase.media.map((el) => {
    if (el.closest('.showcase-tile')) return el.closest('.showcase-tile');
    const tile = document.createElement('div');
    tile.className = 'showcase-tile';
    el.querySelectorAll?.('img').forEach((img) => { img.loading = 'eager'; img.fetchPriority = 'high'; });   // it's on the first screen
    if (el.tagName === 'VIDEO') {
      tile.classList.add('showcase-clip');
      // plays quietly on its own once the page has settled (not on a data-saving connection, or if motion is off)
      const calm = navigator.connection?.saveData || matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!calm) whenSettled(() => el.play().catch(() => {}));
    }
    tile.appendChild(el);
    return tile;
  });
  if (showcase.model) tiles.splice(Math.min(1, tiles.length), 0, showcase.model);   // the model sits second: top right
  if (!tiles.length) {
    if (!showcase.wantsModel) { box.closest('.project-top').classList.add('no-showcase'); box.remove(); }
    return;
  }
  box.dataset.tiles = tiles.length + (showcase.wantsModel && !showcase.model ? 1 : 0);   // (keeps a place for a model still on its way)
  tiles.forEach((tile, i) => { tile.classList.toggle('is-big', i === 0); box.appendChild(tile); });

  // Phones: a wide first photo gets the full width (css/style.css) instead of being cropped to a tall tile.
  // Its shape is known as soon as the photo starts arriving, so this doesn't wait for the whole file.
  const big = tiles[0].matches('.showcase-model') ? null : tiles[0].querySelector('img');
  const shape = () => {
    if (!big.naturalWidth) { if (!big.complete) requestAnimationFrame(shape); return; }
    const ratio = big.naturalWidth / big.naturalHeight;
    box.dataset.shape = ratio >= 1.2 ? 'wide' : 'tall';
    box.style.setProperty('--big-ratio', Math.min(2, Math.max(1.3, ratio)).toFixed(3));
  };
  if (big) shape(); else delete box.dataset.shape;
}

// The first 3D model card (made by js/designs.js) moves into the showcase; any others stay in "More 3D models".
function placeModel() {
  const grid = document.getElementById('design-grid'), section = grid?.closest('.project-models');
  if (!grid || !section) return;
  if (!showcase.model) {
    const card = grid.querySelector('.work-card');
    if (!card) return;
    const tile = document.createElement('div');
    tile.className = 'showcase-tile showcase-model';
    tile.id = 'model-3d';
    tile.appendChild(card);
    tile.insertAdjacentHTML('beforeend', '<span class="model-cta"><span aria-hidden="true">⟲</span> Open 3D model</span>');
    showcase.model = tile;
    drawShowcase();
  }
  const left = grid.querySelectorAll('.work-card').length;
  section.hidden = !left;
  if (left) section.querySelector('h2').textContent = left > 1 ? 'More 3D models' : 'Another 3D model';
}

// ---------- "on this page" chips under the intro: jump straight to the model, documents, photos ----------
function buildNav() {
  placeModel();   // (js/designs.js calls buildNav when its cards are ready)
  const nav = document.querySelector('.project-nav');
  if (!nav) return;
  const items = [
    ['#simulation', 'Simulation', document.querySelectorAll('.project-sim .sim').length],
    ['#documents', 'Documents', document.querySelectorAll('.file-list li').length],
    ['#writeup', 'Write-up', document.querySelectorAll('.project-body p').length ? 1 : 0],
    ['#model', document.querySelector('#model h2')?.textContent || '3D models', document.querySelectorAll('#design-grid .work-card').length],
    ['#videos', 'Videos', document.querySelectorAll('.project-videos iframe').length],
    ['#photos', document.querySelector('#photos h2')?.textContent || 'Photos', document.querySelectorAll('.gallery > *').length],
  ].filter(([id, , n]) => n && document.querySelector(id));
  nav.innerHTML = '';
  items.forEach(([id, label, n]) => {
    const a = document.createElement('a');
    a.className = 'jump-link';
    a.href = id;
    a.textContent = n > 1 ? `${label} · ${n}` : label;
    nav.appendChild(a);
  });
}

// ---------- interactive simulation (only the trebuchet has one: sim: 'trebuchet' in js/projects.js) ----------
// Its style sheet and scripts are only loaded on a project that uses them, so every other page stays light.
const SIMS = {
  trebuchet: { css: 'css/sim.css', scripts: ['js/trebuchet-physics.js', 'js/trebuchet-sim.js'], start: (box) => TREB.mount(box, 'compact'), page: 'trebuchet-sim.html' },
};

const loadScript = (src) => new Promise((done, failed) => {
  const s = document.createElement('script');
  Object.assign(s, { src, onload: done, onerror: failed });
  document.head.appendChild(s);
});

async function showSim(project) {
  const section = document.querySelector('.project-sim');
  const sim = SIMS[project.sim];
  if (!sim) { section.remove(); return; }
  section.querySelector('.page-intro').textContent = project.simText || '';
  try {
    await new Promise((done, failed) => {
      const link = document.createElement('link');
      Object.assign(link, { rel: 'stylesheet', href: sim.css, onload: done, onerror: failed });
      document.head.appendChild(link);
    });
    for (const src of sim.scripts) await loadScript(src);
    sim.start(section.querySelector('.sim-mount'));
    if (sim.page) whenSettled(() => readyPage(sim.page));   // have the full simulator ready for the button
  } catch {
    section.remove();   // a file didn't load - show the page without the demo
  }
  buildNav();
}

// ---------- videos ----------
const isVideo = (f) => /\.(mp4|webm)$/i.test(f);

// videos: ['https://youtu.be/...', 'https://www.youtube.com/watch?v=...', 'https://vimeo.com/...']
function embedUrl(url) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function showVideos(project) {
  const box = document.querySelector('.project-videos');
  const urls = (project.videos || []).map(embedUrl).filter(Boolean);
  if (!urls.length) { box.closest('section').remove(); return; }
  urls.forEach((src) => {
    const frame = document.createElement('iframe');
    Object.assign(frame, { src, title: `${project.title} video`, loading: 'lazy', allowFullscreen: true });
    frame.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    box.appendChild(frame);
  });
}

// ---------- documents & code (files/<id>/) ----------
const CODE = /\.(py|ino|c|cpp|h|hpp|js|ts|java|m|cs|rs|go|txt|md|json|csv|yaml|yml|xml|html|css|sh)$/i;
const KINDS = [[/\.pdf$/i, 'PDF'], [CODE, 'Code'], [/\.(docx?|odt)$/i, 'Doc'], [/\.(xlsx?|ods)$/i, 'Sheet'],
  [/\.(pptx?|odp)$/i, 'Slides'], [/\.(zip|7z|rar)$/i, 'Zip'], [/\.(step|stp|iges|igs|ipt|iam|f3d|sldprt)$/i, 'CAD']];

const kindOf = (name) => (KINDS.find(([re]) => re.test(name)) || [, 'File'])[1];
const sizeOf = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
// "02-Final_report.pdf" -> "Final report"
const nameOf = (f) => f.replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]+/, '').replace(/[_-]+/g, ' ');

async function showFiles(project) {
  const id = project.id;
  const section = document.querySelector('.project-files');
  const all = await fetch('files/files.json').then((r) => r.json()).catch(() => ({}));
  const files = all[id] || [];
  if (!files.length) { section.remove(); return; }

  const ul = section.querySelector('.file-list');
  files.forEach(({ name, size }) => {
    const url = `files/${id}/${encodeURIComponent(name)}`;
    const kind = kindOf(name);
    const li = document.createElement('li');
    li.innerHTML = '<span class="file-kind"></span><span class="file-name"></span><span class="file-size"></span><span class="file-actions"></span>';
    li.querySelector('.file-kind').textContent = kind;
    li.querySelector('.file-name').textContent = nameOf(name);
    li.querySelector('.file-name').title = name;
    li.querySelector('.file-size').textContent = sizeOf(size);
    const actions = li.querySelector('.file-actions');

    if (kind === 'PDF') actions.innerHTML = `<a class="pill" href="${url}" target="_blank" rel="noopener">View</a>`;
    if (kind === 'Code' && size < 300e3) {
      const view = document.createElement('button');
      view.className = 'pill';
      view.textContent = 'View';
      view.onclick = () => showCode(url, name);
      actions.appendChild(view);
    }
    actions.insertAdjacentHTML('beforeend', `<a class="pill" href="${url}" download>Download</a>`);
    ul.appendChild(li);
  });
  // all rights reserved: these are here to read, not to reuse
  section.querySelector('.rights-note').textContent = `${projectRights(project).text.replace(/^Design /, '')} Shared for reading only: please ask before copying or reusing them.`;
  buildNav();
}

// code files open in a dialog with line numbers
const codeView = document.getElementById('code-view');
codeView.querySelector('.dialog-close').onclick = () => codeView.close();
codeView.addEventListener('click', (e) => { if (e.target === codeView) codeView.close(); });

async function showCode(url, name) {
  const code = codeView.querySelector('code');
  codeView.querySelector('.code-name').textContent = name;
  code.textContent = 'Loading…';
  codeView.showModal();
  const text = await fetch(url).then((r) => r.text()).catch(() => 'Could not load this file.');
  code.innerHTML = '';
  text.replace(/\n$/, '').split('\n').forEach((line) => {
    const span = document.createElement('span');
    span.textContent = line + '\n';
    code.appendChild(span);
  });
}

showProject();
