// ---------- Menu button (phones and narrow windows) ----------
const menuButton = document.querySelector('.menu-toggle');

function setMenu(isOpen) {
  document.body.classList.toggle('menu-open', isOpen);
  menuButton.setAttribute('aria-expanded', isOpen);
  menuButton.textContent = isOpen ? 'Close' : 'Menu';
}

menuButton.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));

// Measure the real visible screen height (phone toolbars make CSS units unreliable)
function setAppHeight() {
  document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
}

setAppHeight();
window.addEventListener('resize', setAppHeight);

// ---------- Light / dark switch (remembered for the next visit) ----------
const themeButton = document.querySelector('.theme-toggle');

themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
});

// ---------- Contact card ----------
const contactCard = document.querySelector('#contact');

document.querySelectorAll('.contact-open').forEach((link) => {
  ['pointerenter', 'touchstart', 'focus'].forEach((type) => link.addEventListener(type, loadTurnstile, { passive: true, once: true }));
  link.addEventListener('click', (event) => {
    event.preventDefault();
    loadTurnstile();
    setMenu(false);
    contactCard.showModal();
  });
});

contactCard.querySelector('.dialog-close').addEventListener('click', () => contactCard.close());

contactCard.addEventListener('click', (event) => {
  if (event.target === contactCard) contactCard.close();
});

const copyButton = contactCard.querySelector('.copy-btn');

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText('contact@aidanwbrown.com');
    copyButton.textContent = 'Copied!';
  } catch {
    copyButton.textContent = 'Copy failed';   // (the browser refused - the address is right beside it to select)
  }
  setTimeout(() => { copyButton.textContent = 'Copy'; }, 2000);
});

// The spam check (Turnstile) is only needed by this form, so it isn't loaded with every page: it's fetched
// the moment someone reaches for a Contact button (pointer over it, a touch, or keyboard focus).
let turnstileAsked = false;
function loadTurnstile() {
  if (turnstileAsked) return;
  turnstileAsked = true;
  contactCard.querySelector('.cf-turnstile').dataset.theme = document.documentElement.dataset.theme;   // match the site's theme
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  script.async = true;
  document.head.appendChild(script);
}

// On very narrow phones the normal check (300px wide) won't fit - use the compact version
if (window.innerWidth < 348) contactCard.querySelector('.cf-turnstile').dataset.size = 'compact';

// ---------- Contact form ----------
const contactForm = contactCard.querySelector('.contact-form');
const formStatus = contactCard.querySelector('.form-status');
const sendButton = contactCard.querySelector('.send-btn');

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  sendButton.disabled = true;
  sendButton.textContent = 'Sending…';
  formStatus.textContent = '';
  formStatus.className = 'form-status';

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      body: new FormData(contactForm),
    });
    const result = await response.json();

    if (result.ok) {
      contactForm.reset();
      formStatus.textContent = 'Thanks! Your message is on its way.';
      formStatus.classList.add('success');
    } else {
      formStatus.textContent = result.error;
      formStatus.classList.add('error');
    }
  } catch {
    formStatus.textContent = 'Could not send right now. Please email me directly.';
    formStatus.classList.add('error');
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = 'Send message';
    if (window.turnstile) turnstile.reset();
  }
});

// ---------- Page banner: a different photo on each visit ----------
// Every photo in images/banners/ is used automatically. On each deploy,
// scripts/list-banners.mjs writes the list to images/banners/banners.json.
// To add or remove a photo: just add or delete it in the folder, commit and sync.
const bannerImg = document.querySelector('.banner-img');

async function pickBanner() {
  if (!bannerImg) return;
  bannerImg.addEventListener('load', () => bannerImg.classList.add('loaded'));
  const standIn = bannerImg.dataset.default;   // the photo named in the HTML, used when there's no list or a photo is gone
  const useStandIn = () => { if (standIn && !bannerImg.dataset.fixed && !(bannerImg.getAttribute('src') || '').endsWith(standIn)) bannerImg.src = standIn; };
  bannerImg.addEventListener('error', useStandIn);

  const choose = (photos) => {
    if (bannerImg.dataset.fixed || bannerImg.getAttribute('src') || !Array.isArray(photos) || !photos.length) return;   // place pages use their own photo
    let last = null;
    try { last = sessionStorage.getItem('lastBanner'); } catch {}

    // pick randomly, but never the same photo twice in a row
    const choices = photos.length > 1 ? photos.filter((name) => name !== last) : photos;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    try { sessionStorage.setItem('lastBanner', pick); } catch {}
    bannerImg.src = 'images/banners/' + pick;
  };

  // The list is remembered from the last page, so the photo starts loading at once instead of waiting for the list.
  try { choose(JSON.parse(localStorage.getItem('banners'))); } catch {}
  try {
    const photos = await (await fetch('images/banners/banners.json')).json();
    try { localStorage.setItem('banners', JSON.stringify(photos)); } catch {}
    choose(photos);
  } catch {
    if (!bannerImg.getAttribute('src')) useStandIn();   // no list (e.g. testing locally in Live Server)
  }

  if (bannerImg.complete && bannerImg.naturalWidth) bannerImg.classList.add('loaded');
}

pickBanner();

// footer year stays current
document.querySelectorAll('.year').forEach((el) => { el.textContent = new Date().getFullYear(); });

// ---------- Back to top: a round button that appears once you've scrolled down (every page but the landing) ----------
if (!document.body.classList.contains('landing')) {
  const toTop = document.createElement('button');
  toTop.className = 'to-top';
  toTop.type = 'button';
  toTop.title = 'Back to top';
  toTop.setAttribute('aria-label', 'Back to top');
  toTop.innerHTML = '&uarr;';
  toTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(toTop);
  const showToTop = () => toTop.classList.toggle('show', window.scrollY > 600);
  window.addEventListener('scroll', showToTop, { passive: true });
  showToTop();
}

// ---------- Speed: small photo copies ----------
// On every deploy scripts/small-copies.mjs makes a 900 px wide copy of each project and travel photo and lists them
// in images/thumbs/thumbs.json. Cards and galleries show the small copy; the original is one click away.
// No list (e.g. in Live Server) just means the originals are used.
let thumbList;
const thumbs = () => (thumbList ??= fetch('images/thumbs/thumbs.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

// photo(list, 'projects', id, file) -> { src: the small copy if there is one, full: the original, width, height }
function photo(list, area, id, file) {
  const full = `images/${area}/${id}/${encodeURIComponent(file)}`;
  const size = list[`${area}/${id}/${file}`];
  return size ? { src: `images/thumbs/${area}/${id}/${encodeURIComponent(file)}.webp`, full, width: size[0], height: size[1] } : { src: full, full };
}

// photoLink(...): that photo for a gallery - the small copy, linked to the original (which opens in a new tab)
function photoLink(list, area, id, file, alt) {
  const pic = photo(list, area, id, file);
  const link = document.createElement('a');
  Object.assign(link, { href: pic.full, target: '_blank', rel: 'noopener', title: 'Open the full-size photo' });
  const img = document.createElement('img');
  Object.assign(img, { src: pic.src, alt, loading: 'lazy', decoding: 'async' });
  if (pic.width) { img.width = pic.width; img.height = pic.height; }   // holds its place while it loads
  link.appendChild(img);
  return link;
}

// ---------- Speed: getting things ready before they're asked for ----------
// whenSettled(fn): run fn once the page has finished loading and the browser has a quiet moment
// (and, if the browser loaded this page ahead of time in the background, not until the visitor really arrives).
function whenSettled(run) {
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 1200));
  const loaded = () => (document.readyState === 'complete' ? idle() : window.addEventListener('load', idle, { once: true }));
  if (document.prerendering) document.addEventListener('prerenderingchange', loaded, { once: true });
  else loaded();
}

// 1. Cloudflare serves about.html at /about, and answers a request for about.html with "go to /about" first:
//    one wasted trip on every page change. On the real site, point links straight at the short address.
//    (Live Server needs the .html, so nothing changes when you preview.)
const LIVE = /(^|\.)aidanwbrown\.com$/.test(location.hostname);

function sitePath(url) {
  if (!LIVE) return url;
  const u = new URL(url, location.href);
  if (u.origin !== location.origin || !/^\/[^/]+\.html$/.test(u.pathname)) return url;   // only the pages themselves
  u.pathname = u.pathname === '/index.html' ? '/' : u.pathname.slice(0, -5);
  return u.href;
}

function shortLinks(root) {
  root.querySelectorAll('a[href*=".html"]').forEach((a) => { if (!a.hasAttribute('download')) a.href = sitePath(a.href); });
}

if (LIVE) {
  shortLinks(document);
  // cards and other links that are added later
  new MutationObserver((changes) => changes.forEach((c) => c.addedNodes.forEach((n) => {
    if (n.nodeType === 1) shortLinks(n.matches('a') ? n.parentNode : n);
  }))).observe(document.body, { childList: true, subtree: true });
}

// 2. Have the next page ready before the click. Chrome and Edge load a page in the background once the pointer
//    rests on its link (or a finger touches it), so it opens instantly. Firefox fetches the page file early instead.
const canPrerender = Boolean(HTMLScriptElement.supports?.('speculationrules'));
const NOT_PAGES = ['/cad/*', '/files/*', '/api/*', '/images/*', '/models/*', '/resume/*', '/about/*', '/fonts/*', '/data/*'];

function speculate(rule) {
  const rules = document.createElement('script');
  rules.type = 'speculationrules';
  rules.textContent = JSON.stringify({ prerender: [rule] });
  document.head.appendChild(rules);
}

const fetchedEarly = new Set();
function fetchEarly(href) {
  if (fetchedEarly.has(href)) return;
  fetchedEarly.add(href);
  const link = document.createElement('link');
  Object.assign(link, { rel: 'prefetch', href });
  document.head.appendChild(link);
}

if (canPrerender) {
  speculate({ eagerness: 'moderate', where: { and: [
    { href_matches: '/*' },
    { not: { href_matches: NOT_PAGES } },
    { not: { selector_matches: '[download], [target="_blank"]' } },
  ] } });
} else {
  const reach = (event) => {
    const a = event.target.closest?.('a[href]');
    if (!a || a.origin !== location.origin || a.hasAttribute('download') || a.target === '_blank') return;
    if (a.pathname === location.pathname || !/^\/[^/.]*(\.html)?$/.test(a.pathname)) return;   // pages only, and not this one
    fetchEarly(a.href);
  };
  document.addEventListener('pointerover', reach, { passive: true });
  document.addEventListener('touchstart', reach, { passive: true });
}

// readyPage('trebuchet-sim.html'): get one page ready straight away, without waiting for the pointer
function readyPage(url) {
  const href = sitePath(new URL(url, location.href).href);
  if (canPrerender) speculate({ urls: [href], eagerness: 'immediate' });
  else fetchEarly(href);
}
