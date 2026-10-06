// ---------- Music page ----------
// To add a playlist or album: in Spotify, ⋯ → Share → Copy link, then add a line below.
// "note" is optional - a short line shown under the player.

const MUSIC = [
  { url: 'https://open.spotify.com/playlist/7zIzwQnpSu9SW47z9hGrbq', note: 'GOOD VIBES — everything I listen to, all in one place' },
  { url: 'https://open.spotify.com/playlist/0l4NYhVJm2roZyofMrn168', note: 'ANTHEM VIBES — big choruses and windows-down energy' },
  { url: 'https://open.spotify.com/playlist/1LHabiIRfMzrR6PG2CNBun', note: 'COUNTRY VIBES — Zach Bryan, Stapleton and the red dirt crowd' },
  { url: 'https://open.spotify.com/playlist/0J2CeFX7VN9CjW9USzWfD9', note: 'CLASSIC VIBES — Fleetwood Mac, the Eagles and old favourites' },
  { url: 'https://open.spotify.com/playlist/73rhi6xa0Z4pfgVZWSCklR', note: 'CHILL VIBES — for late-night CAD sessions' },
  { url: 'https://open.spotify.com/playlist/6wrNMNeXKH8aErV37ewlTo', note: 'WORKOUT VIBES — AC/DC, Linkin Park and louder' },
];

const musicGrid = document.querySelector('#music-grid');

// Spotify's player takes a moment to arrive, so each card first shows a stand-in in the same spot:
// the playlist's name, and its cover picture when images/music.json has it (made on every deploy by
// scripts/small-copies.mjs). The real player sits on top and covers it the moment Spotify draws anything.
const waiting = {};   // Spotify id -> its stand-in

MUSIC.forEach((item) => {
  // turn a normal Spotify link into an embeddable player link
  const match = item.url.match(/open\.spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/);
  if (!match) return; // skip placeholders or broken links

  const [, type, id] = match;
  const first = musicGrid.children.length < 2;   // the top two start loading at once; the rest when they're near the screen
  const card = document.createElement('figure');
  card.className = 'music-card';
  card.innerHTML = `
    <div class="music-frame">
      <div class="music-wait" aria-hidden="true">
        <div class="music-wait-top"><span class="music-wait-cover"></span><span class="music-wait-text"><b></b><small>Loading the Spotify player…</small></span></div>
        <i></i><i></i><i></i><i></i>
      </div>
      <iframe src="https://open.spotify.com/embed/${type}/${id}?theme=0"
              loading="${first ? 'eager' : 'lazy'}" allow="encrypted-media; clipboard-write; fullscreen; picture-in-picture"
              title="Spotify player"></iframe>
    </div>
    <figcaption></figcaption>`;
  card.querySelector('figcaption').textContent = item.note || '';
  card.querySelector('.music-wait b').textContent = (item.note || '').split(/\s[—–-]\s/)[0];   // "GOOD VIBES — ..." -> "GOOD VIBES"
  card.querySelector('iframe').addEventListener('load', () => card.classList.add('loaded'));
  waiting[id] = card.querySelector('.music-wait');
  musicGrid.appendChild(card);
});

// names and covers, if the deploy saved them
fetch('images/music.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((info) => {
  Object.entries(info).forEach(([id, { title, cover }]) => {
    const wait = waiting[id];
    if (!wait) return;
    if (title) wait.querySelector('b').textContent = title;
    if (cover) {
      const img = new Image();
      img.alt = '';
      img.onload = () => wait.querySelector('.music-wait-cover').replaceChildren(img);
      img.src = cover;
    }
  });
});

if (!musicGrid.children.length) {
  musicGrid.innerHTML = '<p class="page-intro">Playlists coming soon.</p>';
}
