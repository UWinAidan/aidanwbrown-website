// ---------- Portfolio page: project cards ----------
// Builds a card for every project in js/projects.js, grouped into the SECTIONS listed there, with a row of
// jump buttons at the top. Covers come from images/projects/projects.json,
// or, for projects without photos yet, the 3D model's card picture from the Designs page.

async function showProjects() {
  const page = document.getElementById('project-grid');
  const [photos, small] = await Promise.all([fetch('images/projects/projects.json').then((r) => r.json()).catch(() => ({})), thumbs()]);

  // one group per section, in the SECTIONS order; a project with no (or a misspelt) section lands in "Other"
  const known = new Set(SECTIONS.map((s) => s.id));
  const groups = [...SECTIONS, { id: 'other', title: 'Other' }]
    .map((s) => ({ ...s, projects: PROJECTS.filter((p) => (known.has(p.section) ? p.section : 'other') === s.id) }))
    .filter((g) => g.projects.length);
  // the "Featured" row on top: projects with featured: 1, 2, 3... (they also stay in their own section)
  const featured = PROJECTS.filter((p) => p.featured).sort((a, b) => a.featured - b.featured);
  if (featured.length) groups.unshift({ id: 'featured', title: 'Featured', projects: featured, top: true });

  const jump = document.createElement('nav');
  jump.className = 'section-nav';
  jump.setAttribute('aria-label', 'Jump to a section');
  page.appendChild(jump);

  groups.forEach((g) => {
    if (!g.top) {   // (the Featured row is already at the top - no button needed)
      const button = document.createElement('a');
      button.className = 'pill';
      button.href = `#${g.id}`;
      button.textContent = `${g.title} · ${g.projects.length}`;
      jump.appendChild(button);
    }

    const section = document.createElement('section');
    section.className = 'work-section';
    section.id = g.id;
    const heading = document.createElement('h2');
    heading.textContent = g.title;
    const grid = document.createElement('div');
    grid.className = 'work-grid';
    section.append(heading, grid);
    page.appendChild(section);

    g.projects.forEach((p) => {
      const pics = (photos[p.id] || []).filter((f) => !/\.(mp4|webm)$/i.test(f));   // photos, not videos
      // the chosen photo (cover:), else a file named cover.jpg, else the first one
      const cover = pics.includes(p.cover) ? p.cover : pics.find((f) => /^cover\./i.test(f)) || pics[0];
      const models = typeof DESIGNS === 'undefined' ? [] : DESIGNS.filter((d) => d.project === p.id);
      const has3d = models.length > 0;
      // no photos yet: use the 3D model's card picture (images/designs/<id>.webp)
      // (if a project has several models, the most recent one - e.g. the V2 gearbox)
      const model = [...models].sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')))[0];
      const render = !cover && model && `images/designs/${model.thumb || `${model.id}.webp`}`;
      const card = document.createElement('a');
      card.className = 'work-card';
      card.href = `project.html?id=${p.id}`;
      card.innerHTML = `
        <div class="work-cover${render ? ' rendered' : ''}">${cover ? `<img src="${photo(small, 'projects', p.id, cover).src}" alt="" loading="lazy" decoding="async">` : render ? `<img src="${render}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('rendered'); this.remove()">` : ''}${has3d ? '<span class="badge-3d" title="This project has a 3D model you can spin and zoom">3D model</span>' : ''}${p.status ? '<span class="badge-status"></span>' : ''}</div>
        <div class="work-body">
          <h2></h2>
          <p class="work-meta"></p>
          <p class="work-summary"></p>
        </div>`;
      if (cover && p.coverFocus) card.querySelector('.work-cover img').style.objectPosition = p.coverFocus;   // which part to keep when cropped
      card.querySelector('h2').textContent = p.title;
      card.querySelector('.work-meta').textContent = [p.year, ...p.tags].filter(Boolean).join(' · ');
      if ((p.types || []).length) card.querySelector('.work-meta').after(projectTypes(p));
      card.querySelector('.work-summary').textContent = projectSummary(p);
      if (p.status) card.querySelector('.badge-status').textContent = p.status;
      grid.appendChild(card);
    });
  });

  // a link like portfolio.html#school: the sections only exist now, so jump there by hand
  if (location.hash.length > 1) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

showProjects();
