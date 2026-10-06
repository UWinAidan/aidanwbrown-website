// ---------- Trebuchet simulator: draws the model in js/trebuchet-physics.js ----------
// TREB.mount(element, 'compact')  -> the small demo on the trebuchet project page (animation + three sliders)
// TREB.mount(element, 'full')     -> everything, on trebuchet-sim.html (all sliders, flight, graphs, tables)
// Colours come from the site's own variables (css/sim.css adds the few extra ones), so both themes work.

TREB.MEASURED_FT = 115;   // the winning throw

// The sliders. `compact: true` ones are also on the project page.
TREB.INPUTS = [
  ['The machine', [
    { key: 'm_cw', label: 'Counterweight mass', min: 0.5, max: 2.5, step: 0.002, unit: ' kg', dp: 3, compact: true },
    { key: 'L', label: 'Sling length', min: 0.5, max: 1.3, step: 0.01, unit: ' m', dp: 2, compact: true },
    { key: 'm_p', label: 'Ball mass', min: 10, max: 50, step: 1, unit: ' g', dp: 0, scale: 0.001 },
    { key: 'I_arm_cg', label: 'Arm inertia about its centre', min: 0.008, max: 0.03, step: 0.00002, unit: ' kg·m²', dp: 5 },
  ]],
  ['Start and release', [
    { key: 'release_deg', label: 'Release angle (sling to arm)', min: 0, max: 60, step: 1, unit: '°', dp: 0, compact: true },
    { key: 'start_past_deg', label: 'Start, past the balance point', min: 0.5, max: 20, step: 0.5, unit: '°', dp: 1 },
    { key: 'cw_rel_deg', label: 'Counterweight arm rest angle', min: 2, max: 12, step: 0.1, unit: '°', dp: 1 },
  ]],
  ['Losses', [
    { key: 'mu', label: 'Pivot and hinge friction', min: 0, max: 0.8, step: 0.01, unit: '', dp: 2 },
    { key: 'air', label: 'Air drag on the machine', min: 0, max: 200, step: 5, unit: '%', dp: 0, scale: 0.01 },
    { key: 'Cd', label: 'Ball drag coefficient', min: 0, max: 0.7, step: 0.01, unit: '', dp: 2 },
    { key: 'rho', label: 'Air density', min: 0.9, max: 1.4, step: 0.01, unit: ' kg/m³', dp: 2 },
  ]],
];

TREB.mount = function (root, mode) {
  const full = mode === 'full';
  const FT = 3.28084, MEASURED = TREB.MEASURED_FT;
  // the site's colours: each one is read once and remembered until the light / dark switch is used
  const colours = {};
  const css = (name) => (colours[name] ??= getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  const num = (v, dp) => v.toFixed(dp);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  const q = (sel) => root.querySelector(sel);

  // ---------- page pieces ----------
  root.classList.add('sim', full ? 'sim-full' : 'sim-compact');
  const stat = (id, label, main) => `<div class="sim-stat${main ? ' main' : ''}"><div class="k">${label}</div><div class="v" data-s="${id}">–</div><div class="n" data-n="${id}"></div></div>`;
  const throwPanel = `
    <canvas class="sim-view" aria-label="Animation of the trebuchet throwing"></canvas>
    <div class="sim-bar">
      <button type="button" class="pill sim-play">Play</button>
      ${full ? `<select class="sim-speed" aria-label="Playback speed">
        <option value="0.05">1/20 speed</option><option value="0.125" selected>1/8 speed</option>
        <option value="0.25">1/4 speed</option><option value="1">Real time</option></select>
      <input class="sim-scrub" type="range" min="0" max="1" step="1" value="0" aria-label="Time">` : ''}
      <span class="sim-time"></span>
    </div>
    <div class="sim-legend">
      <span><i style="border-color:var(--accent)"></i>main arm</span>
      <span><i style="border-color:var(--sim-cw)"></i>counterweight</span>
      <span><i style="border-color:var(--sim-ball)"></i>ball and its path</span>
    </div>`;

  if (full) {
    root.innerHTML = `
      <div class="sim-stats">${stat('range', 'Range, with air drag', true)}${stat('vac', 'Range, no drag')}${stat('speed', 'Launch speed')}${stat('angle', 'Launch angle')}</div>
      <p class="sim-fail" hidden></p>
      <div class="sim-grid sim-two">
        <div class="sim-panel"><h3>Inputs</h3><div class="sim-controls"></div>
          <div class="sim-bar"><button type="button" class="pill sim-reset">Reset to the built machine</button></div></div>
        <div class="sim-panel"><h3>The throw</h3>${throwPanel}</div>
      </div>
      <div class="sim-grid"><div class="sim-panel"><h3>Flight</h3><canvas class="sim-traj"></canvas>
        <div class="sim-legend"><span><i style="border-color:var(--sim-ball)"></i>with air drag</span>
          <span><i class="dash" style="border-color:var(--muted)"></i>no drag</span>
          <span><i style="border-color:var(--highlight)"></i>measured on launch day, ${MEASURED} ft</span></div></div></div>
      <div class="sim-grid sim-half">
        <div class="sim-panel"><h3>Main arm angle (degrees from horizontal)</h3><canvas class="sim-chart" data-c="angle"></canvas></div>
        <div class="sim-panel"><h3>Turning speed (rad/s)</h3><canvas class="sim-chart" data-c="speed"></canvas>
          <div class="sim-legend"><span><i style="border-color:var(--accent)"></i>main arm</span>
            <span><i style="border-color:var(--sim-cw)"></i>counterweight arm</span>
            <span><i style="border-color:var(--sim-ball)"></i>sling</span></div></div>
      </div>
      <div class="sim-grid sim-half">
        <div class="sim-panel"><h3>What happens when</h3><table class="sim-events"></table></div>
        <div class="sim-panel"><h3>Energy and loads</h3><table class="sim-energy"></table><p class="sim-warn" hidden></p></div>
      </div>`;
  } else {
    root.innerHTML = `
      <div class="sim-panel sim-stage">${throwPanel}</div>
      <div class="sim-side">
        <div class="sim-stats">${stat('range', 'Predicted range', true)}${stat('speed', 'Launch speed')}</div>
        <p class="sim-fail" hidden></p>
        <div class="sim-controls"></div>
        <div class="sim-bar"><button type="button" class="pill sim-reset">Reset</button>
          <a class="pill pill-cta" href="trebuchet-sim.html">Open the full simulator</a></div>
      </div>`;
  }

  // ---------- sliders ----------
  const fields = [];
  let uid = 0;
  for (const [title, list] of TREB.INPUTS) {
    const use = list.filter((f) => full || f.compact);
    if (!use.length) continue;
    const group = el('div', 'sim-group', full ? `<p>${title}</p>` : '');
    for (const spec of use) {
      const f = { ...spec, scale: spec.scale || 1 };
      f.def = TREB.DEFAULTS[f.key] / f.scale;
      const id = `sim-${f.key}-${mode}-${uid++}`;
      f.row = el('div', 'sim-row', `<label for="${id}">${f.label}</label><output></output>
        <input id="${id}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.def}">`);
      f.input = f.row.querySelector('input');
      f.out = f.row.querySelector('output');
      f.input.addEventListener('input', () => { showValue(f); schedule(); });
      group.appendChild(f.row);
      fields.push(f);
      showValue(f);
    }
    q('.sim-controls').appendChild(group);
  }
  function showValue(f) {
    const v = parseFloat(f.input.value);
    f.out.textContent = num(v, f.dp) + f.unit;
    f.row.classList.toggle('changed', Math.abs(v - f.def) > f.step / 2);
  }
  q('.sim-reset').addEventListener('click', () => { fields.forEach((f) => { f.input.value = f.def; showValue(f); }); schedule(); });

  // ---------- run the model ----------
  let res = null, frame = 0, playing = false, playStart = 0, playFrom = 0, pending = false;
  const playBtn = q('.sim-play'), scrub = q('.sim-scrub'), speedSel = q('.sim-speed');
  const playSpeed = () => (speedSel ? parseFloat(speedSel.value) : 0.125);

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; run(); });
  }
  function run() {
    const input = {};
    fields.forEach((f) => { input[f.key] = parseFloat(f.input.value) * f.scale; });
    res = TREB.simulate(input);
    stop();
    const n = res.frames.length;
    // rest on the moment of release: the most useful still picture
    frame = res.ok ? res.frames.findIndex((f) => f.ball === 3) - 1 : n - 1;
    if (frame < 0) frame = n - 1;
    if (scrub) { scrub.max = Math.max(1, n - 1); scrub.value = frame; }
    report();
    drawAll();
  }

  function report() {
    const set = (id, main, note) => { const a = q(`[data-s="${id}"]`); if (a) { a.innerHTML = main; q(`[data-n="${id}"]`).textContent = note; } };
    const fail = q('.sim-fail');
    fail.hidden = res.ok;
    fail.textContent = res.message;
    if (!res.ok) {
      ['range', 'vac', 'speed', 'angle'].forEach((id) => set(id, '–', ''));
      if (full) { q('.sim-energy').innerHTML = ''; q('.sim-warn').hidden = true; }
    } else {
      const ft = res.drag.range * FT, d = ft - MEASURED;
      set('range', `${num(ft, 1)} <small>ft</small>`, `${num(res.drag.range, 1)} m · the real throw was ${MEASURED} ft` + (Math.abs(d) >= 0.5 ? ` (${d > 0 ? '+' : '−'}${num(Math.abs(d), 0)})` : ''));
      set('vac', `${num(res.vacuum.range * FT, 1)} <small>ft</small>`, `${num(res.vacuum.range, 1)} m`);
      set('speed', `${num(res.launch.speed, 1)} <small>m/s</small>`, `${num(res.launch.speed * 3.6, 0)} km/h, ${num(res.launch.angle_deg, 0)}° above horizontal`);
      set('angle', `${num(res.launch.angle_deg, 1)}<small>°</small>`, `above horizontal, from ${num(res.launch.y, 2)} m up`);
      if (full) {
        const e = res.energy, rows = [
          ['Ball at release', `${num(e.ball, 2)} J`],
          ['Lost to air drag on the arm, counterweight and sling', `${num(e.air, 2)} J`],
          ['Lost to pivot and hinge friction', `${num(e.friction, 2)} J`],
          ['Lost when the sling snapped tight', `${num(e.tautLoss, 2)} J`],
          ['Peak load on the main pivot', `${num(res.peak.pivot, 1)} N`],
          ['Peak load on the counterweight hinge', `${num(res.peak.hinge, 1)} N`],
          ['Peak sling tension', `${num(res.peak.sling, 1)} N`],
          ['Highest point of the flight', `${num(res.drag.top, 2)} m`],
          ['Closest the ball gets to the floor', `${num(res.minBallHeight, 2)} m`],
        ];
        q('.sim-energy').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
        const low = res.minBallHeight < 0.02, warn = q('.sim-warn');
        warn.hidden = !low;
        if (low) warn.textContent = 'With these inputs the ball would hit the floor before release. The model does not stop it, so treat the range as unreliable.';
      }
    }
    if (full) {
      const ev = [['Balance point', '', `${num(res.balance_deg, 1)}°`], ['Start, arms cocked', '0.000 s', `${num(res.start_deg, 1)}°`]]
        .concat(res.events.map((x, i) => [`<b>${i + 1}</b>&ensp;${x.text[0].toUpperCase()}${x.text.slice(1)}`, `${num(x.t, 3)} s`, `${num(x.arm_deg, 1)}°`]));
      q('.sim-events').innerHTML = '<tr class="head"><td>Event</td><td>Time · arm angle</td></tr>' +
        ev.map((r) => `<tr><td>${r[0]}</td><td>${r[1] ? r[1] + ' · ' : ''}${r[2]}</td></tr>`).join('');
    }
  }

  // ---------- drawing ----------
  function prep(canvas) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return { ctx, w, h };
  }
  const niceStep = (span, target) => {
    const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  };

  function drawView() {
    const { ctx, w, h } = prep(q('.sim-view'));
    const P = res.P, f = res.frames[Math.min(frame, res.frames.length - 1)];
    const reach = P.r_tip + P.L, x0 = -reach - 0.25, x1 = reach + 0.25, y0 = -0.12, y1 = P.pivot_h + reach + 0.15;
    const s = Math.min(w / (x1 - x0), h / (y1 - y0)), ox = (w - s * (x1 - x0)) / 2, oy = (h - s * (y1 - y0)) / 2;
    const X = (x) => ox + (x - x0) * s, Y = (y) => h - oy - (y - y0) * s;       // world: floor at y = 0, pivot at (0, pivot_h)
    const line = (a, b, c, d, col, lw, dash) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(X(a), Y(b)); ctx.lineTo(X(c), Y(d)); ctx.stroke(); ctx.setLineDash([]); };
    const dot = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, 7); ctx.fill(); };
    const muted = css('--muted'), faint = css('--sim-line'), k = Math.max(0.7, Math.min(1, w / 520));   // thinner lines on a phone

    line(x0, 0, x1, 0, muted, 1);                                                                       // floor
    line(-0.38, 0, 0, P.pivot_h, faint, 5 * k);  line(0.38, 0, 0, P.pivot_h, faint, 5 * k);             // frame
    ctx.fillStyle = muted;  ctx.textAlign = 'right';  ctx.textBaseline = 'alphabetic';
    ctx.fillText('throw this way →', w - 8, Y(0) - 8);

    ctx.strokeStyle = css('--sim-ball');  ctx.globalAlpha = 0.45;  ctx.lineWidth = 1.5;  ctx.beginPath();   // the ball's path so far
    for (let i = 0; i <= frame && i < res.frames.length; i += 2) { const g = res.frames[i]; if (i) ctx.lineTo(X(g.bx), Y(g.by + P.pivot_h)); else ctx.moveTo(X(g.bx), Y(g.by + P.pivot_h)); }
    ctx.stroke();  ctx.globalAlpha = 1;

    const ph = P.pivot_h, c = Math.cos(f.th), sn = Math.sin(f.th);
    const hx = -P.r_h * c, hy = ph - P.r_h * sn, tx = P.r_tip * c, ty = ph + P.r_tip * sn;
    const cx = hx + P.r_c * Math.cos(f.ph), cy = hy + P.r_c * Math.sin(f.ph), bx = f.bx, by = f.by + ph;
    if (f.ball < 3) line(tx, ty, bx, by, css('--sim-sling'), 1.5, f.ball === 2 ? [] : [4, 4]);          // dashed while the sling is slack
    line(hx, hy, cx, cy, css('--sim-cw'), 4 * k);
    dot(cx, cy, 9 * k, css('--sim-cw'));
    line(hx, hy, tx, ty, css('--accent'), 5 * k);
    dot(0, ph, 4 * k, css('--text'));  dot(hx, hy, 3 * k, css('--text'));
    dot(bx, by, 5 * k, css('--sim-ball'));

    const names = ['ball resting on the arm', 'ball falling, sling slack', 'ball on the sling', 'ball released'];
    q('.sim-time').textContent = `${f.t.toFixed(3)} s · ${names[f.ball]}`;
  }

  function axes(ctx, w, h, m, xr, yr, xlabel) {
    const X = (x) => m.l + (x - xr[0]) / (xr[1] - xr[0]) * (w - m.l - m.r), Y = (y) => h - m.b - (y - yr[0]) / (yr[1] - yr[0]) * (h - m.t - m.b);
    ctx.fillStyle = css('--muted');  ctx.strokeStyle = css('--sim-line');  ctx.lineWidth = 1;
    const ys = niceStep(yr[1] - yr[0], 4), xs = niceStep(xr[1] - xr[0], w < 420 ? 4 : 6);
    ctx.textAlign = 'right';  ctx.textBaseline = 'middle';
    for (let v = Math.ceil(yr[0] / ys) * ys; v <= yr[1] + 1e-9; v += ys) { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke(); ctx.fillText(+v.toFixed(6), m.l - 6, Y(v)); }
    ctx.textAlign = 'center';  ctx.textBaseline = 'top';
    for (let v = Math.ceil(xr[0] / xs) * xs; v <= xr[1] + 1e-9; v += xs) ctx.fillText(+v.toFixed(6), X(v), h - m.b + 6);
    ctx.fillText(xlabel, (m.l + w - m.r) / 2, h - 15);
    return { X, Y };
  }
  function path(ctx, pts, X, Y, col, lw, dash) {
    ctx.strokeStyle = col;  ctx.lineWidth = lw;  ctx.setLineDash(dash || []);  ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
    ctx.stroke();  ctx.setLineDash([]);
  }

  function drawTraj() {
    const { ctx, w, h } = prep(q('.sim-traj'));
    if (!res.ok) return;
    const m = { l: 38, r: 14, t: 12, b: 38 }, meas = MEASURED / FT;
    const lo = Math.min(-1, res.drag.range, res.launch.x - 0.5), hi = Math.max(res.vacuum.range, res.drag.range, meas) * 1.06;
    const { X, Y } = axes(ctx, w, h, m, [lo, hi], [0, Math.max(res.vacuum.top, res.drag.top) * 1.12], 'distance from the pivot (m)');
    path(ctx, res.vacuum.path, X, Y, css('--muted'), 1.5, [5, 5]);
    path(ctx, res.drag.path, X, Y, css('--sim-ball'), 2);
    ctx.strokeStyle = css('--highlight');  ctx.lineWidth = 2;  ctx.beginPath();  ctx.moveTo(X(meas), Y(0));  ctx.lineTo(X(meas), Y(0) - 26);  ctx.stroke();
    ctx.fillStyle = css('--highlight');  ctx.textAlign = 'center';  ctx.textBaseline = 'bottom';  ctx.fillText(`${MEASURED} ft`, X(meas), Y(0) - 29);
    ctx.fillStyle = css('--sim-ball');  ctx.beginPath();  ctx.arc(X(res.drag.range), Y(0), 4, 0, 7);  ctx.fill();
    ctx.fillStyle = css('--text');  ctx.beginPath();  ctx.arc(X(res.launch.x), Y(res.launch.y), 3.5, 0, 7);  ctx.fill();
  }

  function drawChart(name, series) {
    const { ctx, w, h } = prep(q(`[data-c="${name}"]`));
    const fr = res.frames, m = { l: 44, r: 12, t: 22, b: 38 };
    let lo = Infinity, hi = -Infinity;
    series.forEach((s) => s.pts.forEach((p) => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }));
    const pad = (hi - lo) * 0.06 || 1;
    const { X, Y } = axes(ctx, w, h, m, [0, fr[fr.length - 1].t], [lo - pad, hi + pad], 'time (s)');
    ctx.textBaseline = 'bottom';  ctx.textAlign = 'center';  ctx.font = '600 11px Inter, system-ui, sans-serif';
    res.events.forEach((e, i) => {                                                                      // numbers match the events table
      ctx.strokeStyle = css('--sim-line');  ctx.lineWidth = 1;  ctx.setLineDash([3, 3]);
      ctx.beginPath();  ctx.moveTo(X(e.t), m.t);  ctx.lineTo(X(e.t), h - m.b);  ctx.stroke();  ctx.setLineDash([]);
      ctx.fillStyle = css('--muted');  ctx.fillText(i + 1, X(e.t), m.t - 3);
    });
    series.forEach((s) => path(ctx, s.pts, X, Y, s.col, 1.8));
    const f = fr[Math.min(frame, fr.length - 1)];                                                       // where the animation is
    ctx.strokeStyle = css('--text');  ctx.globalAlpha = 0.5;  ctx.lineWidth = 1;
    ctx.beginPath();  ctx.moveTo(X(f.t), m.t);  ctx.lineTo(X(f.t), h - m.b);  ctx.stroke();  ctx.globalAlpha = 1;
  }

  function drawAll() {
    if (!res || !res.frames.length) return;
    drawView();
    if (!full) return;
    const fr = res.frames, D = 180 / Math.PI;
    drawTraj();
    drawChart('angle', [{ col: css('--accent'), pts: fr.map((f) => [f.t, f.th * D]) }]);
    drawChart('speed', [
      { col: css('--accent'), pts: fr.map((f) => [f.t, f.w1]) },
      { col: css('--sim-cw'), pts: fr.map((f) => [f.t, f.w2]) },
      { col: css('--sim-ball'), pts: fr.filter((f) => f.ball === 2).map((f) => [f.t, f.w3]) },
    ]);
  }

  // ---------- playback ----------
  function stop() { playing = false; playBtn.textContent = 'Play'; }
  function tick(now) {
    if (!playing) return;
    const fr = res.frames, tSim = fr[playFrom].t + (now - playStart) / 1000 * playSpeed();
    let i = frame;
    while (i < fr.length - 1 && fr[i].t < tSim) i++;
    frame = i;
    if (scrub) scrub.value = i;
    full ? drawAll() : drawView();
    if (i >= fr.length - 1) { stop(); return; }
    requestAnimationFrame(tick);
  }
  function play() {
    if (!res || !res.frames.length) return;
    if (frame >= res.frames.length - 2 || res.frames[frame].ball >= 2) frame = 0;   // start over from the cocked position
    // skip the slow first part of the fall, where almost nothing moves
    if (frame === 0) { const go = res.frames.findIndex((f) => Math.abs(f.w1) > 1.5); if (go > 0) frame = go; }
    playing = true;  playFrom = frame;  playStart = performance.now();  playBtn.textContent = 'Pause';
    requestAnimationFrame(tick);
  }
  playBtn.addEventListener('click', () => (playing ? stop() : play()));
  if (speedSel) speedSel.addEventListener('change', () => { playFrom = frame; playStart = performance.now(); });
  if (scrub) scrub.addEventListener('input', (e) => { stop(); frame = +e.target.value; drawAll(); });

  window.addEventListener('resize', drawAll);
  new MutationObserver(() => { Object.keys(colours).forEach((name) => delete colours[name]); drawAll(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });   // light / dark switch
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);

  run();

  // the demo on the project page plays once by itself when it scrolls into view
  if (!full && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { seen.disconnect(); play(); }
    }, { threshold: 0.6 });
    seen.observe(q('.sim-view'));
  }
};
