// ---------- Socials page ----------
// To add an account: copy one line, change the name, handle and link. That's it.

const SOCIALS = [
  { name: 'LinkedIn',  handle: 'aidanbrown5',  url: 'https://www.linkedin.com/in/aidanbrown5/' },
  { name: 'GitHub',    handle: 'UWinAidan',    url: 'https://github.com/UWinAidan' },
  { name: 'Instagram', handle: '@aidan_b.5',   url: 'https://www.instagram.com/aidan_b.5/' },
  { name: 'Facebook',  handle: 'Aidan Brown',  url: 'https://www.facebook.com/aidan.brown.3114935/' },
  { name: 'Strava',    handle: 'Aidan Brown',  url: 'https://www.strava.com/athletes/728821542' },
  { name: 'MakerWorld', handle: 'Aidan Brown', url: 'https://makerworld.com/en/@aidan.b_55' },
];

const socialGrid = document.querySelector('#social-grid');

SOCIALS.forEach((social) => {
  const card = document.createElement('a');
  card.className = 'social-card';
  card.href = social.url;
  card.target = '_blank';
  card.rel = 'noopener';
  card.innerHTML = `
    <span class="social-name"></span>
    <span class="social-handle"></span>
    <span class="social-arrow" aria-hidden="true">↗</span>`;
  card.querySelector('.social-name').textContent = social.name;
  card.querySelector('.social-handle').textContent = social.handle;
  socialGrid.appendChild(card);
});
