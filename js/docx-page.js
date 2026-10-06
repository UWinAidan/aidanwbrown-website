// ---------- Word-document pages (Resume, About) ----------
// Any element with data-docx="path/to/file.docx" gets that Word file converted
// to HTML with Mammoth, then tidied so it matches the site's style.
// To update a page: edit its .docx (same name, same folder), commit and sync.

document.querySelectorAll('[data-docx]').forEach(loadDocx);

async function loadDocx(target) {
  const file = target.dataset.docx;
  try {
    // On every deploy the Word file is converted ahead of time (scripts/small-copies.mjs) and saved next to it.
    // If that copy is there, use it - nothing to download or convert here.
    const ready = await fetch(`${file}.page.txt`).then((r) => (r.ok ? r.text() : null)).catch(() => null);
    if (ready && ready.trimStart().startsWith('<')) {
      target.innerHTML = ready;
    } else {
      // No copy (e.g. in Live Server): fetch the converter and the Word file and convert it here, as before.
      const [response] = await Promise.all([fetch(file), loadMammoth()]);
      if (!response.ok) throw new Error(`${file} not found`);
      const arrayBuffer = await response.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      target.innerHTML = result.value;
    }
    tidyDocx(target);
  } catch (error) {
    console.error(error);
    target.innerHTML = `<p>Sorry, this content couldn't be displayed right now.</p>`;
  }
  target.classList.remove('is-loading');
}

// the Word converter (400 KB) - only fetched when a page really has to convert a file itself
let mammothLoading;
function loadMammoth() {
  return (mammothLoading ??= new Promise((done, failed) => {
    if (window.mammoth) { done(); return; }
    const script = document.createElement('script');
    Object.assign(script, { src: 'js/vendor/mammoth.browser.min.js', onload: done, onerror: failed });
    document.head.appendChild(script);
  }));
}

function tidyDocx(root) {
  // 1. Word sometimes nests bullet lists inside an empty bullet - flatten them
  root.querySelectorAll('li > ul, li > ol').forEach((innerList) => {
    const wrapperItem = innerList.parentElement;
    if (wrapperItem.childNodes.length === 1) {
      wrapperItem.replaceWith(...innerList.children);
    }
  });

  // 2. ALL-CAPS bold lines are section titles -> real headings
  root.querySelectorAll('p').forEach((p) => {
    const text = p.textContent.trim();
    const bold = p.querySelector('strong');
    const isAllCaps = /[A-Z]/.test(text) && text === text.toUpperCase();
    if (bold && bold.textContent.trim() === text && isAllCaps) {
      const heading = document.createElement('h2');
      heading.textContent = text.toLowerCase();
      p.replaceWith(heading);
    }
  });

  // 3. "Left <tab> Right" lines -> left text and right-aligned text (dates, facts)
  root.querySelectorAll('p, li').forEach((el) => {
    if (!el.textContent.includes('\t')) return;
    const [left, ...rest] = el.textContent.split(/\t+/).map((part) => part.trim());
    const right = rest.join(' ').trim();

    if (el.tagName === 'P') {
      if (!right) { el.textContent = left; el.classList.add('entry-sub'); return; }
      const head = document.createElement('div');
      head.className = 'entry-head';
      head.innerHTML = '<h3></h3><span class="date"></span>';
      head.querySelector('h3').textContent = left;
      head.querySelector('.date').textContent = right;
      el.replaceWith(head);
    } else {
      el.innerHTML = '<span class="li-row"><span></span><span class="date"></span></span>';
      el.querySelector('.li-row span').textContent = left;
      el.querySelector('.date').textContent = right;
    }
  });

  // 4. The line right under each title (company, location) -> grey subtitle
  root.querySelectorAll('.entry-head + p').forEach((p) => p.classList.add('entry-sub'));
}
