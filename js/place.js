// ---------- Place page: place.html?id=<id> ----------
// Finds the place in js/places.js and shows its photos from images/travels/<id>/.

async function showPlace() {
  const id = new URLSearchParams(location.search).get('id');
  const place = PLACES.find((p) => p.id === id);
  const main = document.querySelector('#place');
  const banner = document.querySelector('.banner-img');   // (place.html marks it data-fixed, so no random banner is loaded first)

  if (!place) {
    main.innerHTML = '<p class="page-intro">Place not found. <a href="travels.html">Back to the map</a></p>';
    banner.src = banner.dataset.default;
    return;
  }

  document.title = `${place.name} · Aidan Brown`;
  document.querySelector('.page-title').textContent = place.name;
  main.querySelector('.place-coords').textContent = coords(place.lat, place.lon);
  main.querySelector('.place-region').textContent = place.region;
  main.querySelector('.place-blurb').textContent = place.blurb || '';

  const [photos, small] = await Promise.all([fetch('images/travels/travels.json').then((r) => r.json()).catch(() => ({})), thumbs()]);
  const list = photos[place.id] || [];
  const gallery = main.querySelector('.gallery');

  if (!list.length) { gallery.innerHTML = '<p class="page-intro">Photos coming soon.</p>'; banner.src = banner.dataset.default; return; }

  list.forEach((file) => gallery.appendChild(photoLink(small, 'travels', place.id, file, place.name)));

  // use the first photo as this page's banner
  banner.dataset.fixed = 'true';
  banner.src = `images/travels/${place.id}/${encodeURIComponent(list[0])}`;
}

showPlace();
