// ---------- Travels page: the map ----------
// Draws a minimal world map (D3 + Natural Earth), adds a pin for every place in js/places.js,
// shows a card on hover and opens place.html?id=... when a "been" pin is clicked.

async function drawMap() {
  const [world, lakes, photos] = await Promise.all([
    fetch('data/land-50m.json').then((r) => r.json()),
    fetch('data/lakes.json').then((r) => r.json()),
    fetch('images/travels/travels.json').then((r) => r.json()).catch(() => ({})),
  ]);

  // --- the map ---
  const W = 1000, H = 520;
  const svg = d3.select('#map').attr('viewBox', `0 0 ${W} ${H}`);
  const projection = d3.geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: 'Sphere' });
  const path = d3.geoPath(projection);
  const g = svg.append('g');

  g.append('path').datum(topojson.feature(world, world.objects.land)).attr('class', 'land').attr('d', path);
  g.append('path').datum(lakes).attr('class', 'lakes').attr('d', path);

  // --- the pins ---
  const pins = g.append('g').selectAll('g').data(PLACES).join('g')
    .attr('class', (d) => `pin ${d.status}`)
    .attr('tabindex', 0)
    .attr('aria-label', (d) => d.name);
  pins.append('circle').attr('class', 'halo').attr('r', 11);
  pins.append('circle').attr('class', 'dot').attr('r', 5);

  // Pins are drawn in map units, so on a narrow (phone) map they would shrink with it.
  // This keeps them close to the same size on screen whatever the map's width or zoom.
  const pinSize = () => Math.max(1, (W / (svg.node().clientWidth || W)) * 0.8);
  const placePins = (k = d3.zoomTransform(svg.node()).k) =>
    pins.attr('transform', (d) => `translate(${projection([d.lon, d.lat])}) scale(${pinSize() / k})`);
  placePins();
  new ResizeObserver(() => placePins()).observe(svg.node());

  const cover = (d) => (photos[d.id] || [])[0];
  const openPlace = (d) => { if (d.status === 'been') location.href = sitePath(`place.html?id=${d.id}`); };

  // --- hover card ---
  const wrap = document.querySelector('.map-wrap');
  const card = document.getElementById('map-card');

  function showCard(d) {
    const img = d.status === 'been' && cover(d);
    card.innerHTML = `
      ${img ? `<img src="images/travels/${d.id}/${img}" alt="">` : ''}
      <div class="card-body">
        <b></b><span class="region"></span>
        ${d.status === 'want' && d.why ? '<p class="why"></p>' : ''}
        <span class="coords">${coords(d.lat, d.lon)}</span>
        <span class="hint">${d.status === 'been' ? 'Click for photos →' : 'On the list'}</span>
      </div>`;
    card.querySelector('b').textContent = d.name;
    card.querySelector('.region').textContent = d.region;
    if (card.querySelector('.why')) card.querySelector('.why').textContent = d.why;
    card.classList.add('show');
  }

  function moveCard(x, y) {
    const r = wrap.getBoundingClientRect();
    let left = x - r.left + 16, top = y - r.top + 16;
    if (left + card.offsetWidth > r.width) left -= card.offsetWidth + 32;
    if (top + card.offsetHeight > r.height) top -= card.offsetHeight + 32;
    card.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  }

  pins
    .on('mouseenter focus', (e, d) => { showCard(d); const b = e.currentTarget.getBoundingClientRect(); moveCard(b.x, b.y); })
    .on('mousemove', (e) => moveCard(e.clientX, e.clientY))
    .on('mouseleave blur', () => card.classList.remove('show'))
    .on('click', (e, d) => openPlace(d))
    .on('keydown', (e, d) => { if (e.key === 'Enter') openPlace(d); });

  // --- zoom & pan (pins stay the same size on screen) ---
  const zoom = d3.zoom().scaleExtent([1, 30]).translateExtent([[0, 0], [W, H]])
    .on('zoom', ({ transform: t }) => {
      g.attr('transform', t);
      placePins(t.k);
      card.classList.remove('show');
    });
  svg.call(zoom);

  const flyTo = (lon, lat, k) => {
    const [x, y] = projection([lon, lat]);
    svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-x, -y));
  };
  document.getElementById('zoom-in').onclick = () => svg.transition().call(zoom.scaleBy, 2);
  document.getElementById('zoom-out').onclick = () => svg.transition().call(zoom.scaleBy, 0.5);
  document.getElementById('zoom-home').onclick = () => flyTo(-81, 43.5, 9);
  document.getElementById('zoom-world').onclick = () => svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity);

  // --- lists under the map (and how phones use it, since phones can't hover) ---
  ['been', 'want'].forEach((status) => {
    const ul = document.getElementById(`${status}-list`);
    const items = PLACES.filter((p) => p.status === status);
    if (!items.length) { ul.innerHTML = '<li class="empty">Coming soon</li>'; return; }
    items.forEach((p) => {
      const li = document.createElement('li');
      li.innerHTML = `<button><span class="legend-dot ${status}"></span><span class="place-name"></span><small></small></button>`;
      li.querySelector('.place-name').textContent = p.name;
      li.querySelector('small').textContent = status === 'want' ? (p.why || p.region) : p.region;
      li.querySelector('button').onclick = () => {
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flyTo(p.lon, p.lat, status === 'been' ? 10 : 5);
      };
      ul.appendChild(li);
    });
  });
}

drawMap();
