// Contact form backend for aidanwbrown.com
// Receives the form, checks it's a human (Turnstile), then emails it to Aidan.
// Also serves the CAD downloads (/cad/*) from the R2 bucket - see the bottom of this file.

const TO_ADDRESS = 'you@example.com';     // must be a verified Email Routing destination
const FROM_ADDRESS = 'website@aidanwbrown.com'; // any address on your domain

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'Method not allowed.' }, 405);
      }
      return handleContact(request, env);
    }

    if (url.pathname.startsWith('/cad/')) return handleCad(request, env, ctx, url);

    // Anything else: serve the normal website files
    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Invalid form data.' }, 400);
  }

  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim();
  const message = String(form.get('message') || '').trim();
  const token = String(form.get('cf-turnstile-response') || '');
  const honeypot = String(form.get('botcheck') || '');

  // Bots fill in the hidden "botcheck" field; humans never see it. Pretend it worked.
  if (honeypot) return json({ ok: true });

  // Basic validation
  if (!name || name.length > 100) return json({ ok: false, error: 'Please enter your name.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
  }
  if (message.length < 10 || message.length > 5000) {
    return json({ ok: false, error: 'Message should be between 10 and 5000 characters.' }, 400);
  }

  // Check the Turnstile token with Cloudflare
  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET,
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP') || '',
    }),
  });
  const outcome = await verify.json();
  if (!outcome.success) {
    return json({ ok: false, error: 'Spam check failed. Please try again.' }, 400);
  }

  // Send the email. replyTo means hitting "Reply" goes straight to the visitor.
  const safeName = name.replace(/[\r\n]+/g, ' ');
  try {
    await env.EMAIL.send({
      to: TO_ADDRESS,
      from: FROM_ADDRESS,
      replyTo: email,
      subject: `Website contact: ${safeName}`,
      text: `Name: ${safeName}\nEmail: ${email}\n\n${message}\n\n-- Sent from the contact form on aidanwbrown.com`,
    });
  } catch (err) {
    console.error('Email send failed:', err);
    return json({ ok: false, error: 'Something went wrong sending your message. Please email me directly.' }, 500);
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- CAD downloads ----------
// The STEP downloads are too big for the repo, so they live in a Cloudflare R2 bucket ("CAD" in wrangler.jsonc).
// Bucket layout matches the old folder: <design-id>/<file>   e.g. frc-2024/FORTISSIMO_ROBOT_ASSY.7z
//   /cad/cad.json             -> the list the Designs page reads (made live from what is in the bucket)
//   /cad/<design-id>/<file>   -> downloads that file
const isCad = (name) => /\.(zip|7z|step|stp)$/i.test(name);
const CAD_TYPES = { zip: 'application/zip', '7z': 'application/x-7z-compressed', step: 'model/step', stp: 'model/step' };

async function handleCad(request, env, ctx, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  if (url.pathname === '/cad/cad.json') return cadList(request, env, ctx);

  let key;
  try {
    key = decodeURIComponent(url.pathname.slice('/cad/'.length));
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!isCad(key)) return new Response('Not found', { status: 404 });

  // "range" lets a browser resume a download that got interrupted
  const options = request.headers.has('range') ? { range: request.headers } : {};
  let object;
  try {
    object = (await env.CAD.get(key, options)) || (await env.CAD.get(`cad/${key}`, options));
  } catch {
    return new Response('Range not satisfiable', { status: 416 });
  }
  if (!object) return new Response('Not found', { status: 404 });

  const name = key.split('/').pop();
  const headers = new Headers({
    'Content-Type': CAD_TYPES[name.split('.').pop().toLowerCase()] || 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    ETag: object.httpEtag,
  });

  const partial = request.headers.has('range') && object.range;
  if (partial) {
    const start = object.range.offset ?? object.size - object.range.suffix;
    const length = object.range.length ?? object.size - start;
    if (start < 0 || start >= object.size || length <= 0) return new Response('Range not satisfiable', { status: 416 });
    headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
  } else {
    headers.set('Content-Length', String(object.size));
  }
  return new Response(request.method === 'HEAD' ? null : object.body, { status: partial ? 206 : 200, headers });
}

// { "frc-2024": [{ name, size }], ... } - remembered for 5 minutes so the bucket isn't asked on every visit
async function cadList(request, env, ctx) {
  const cacheKey = new Request(new URL('/cad/cad.json', request.url).toString());
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const list = {};
  let cursor;
  do {
    const page = await env.CAD.list({ cursor });
    for (const o of page.objects) {
      const parts = o.key.replace(/^cad\//, '').split('/');
      if (parts.length !== 2 || !isCad(parts[1])) continue;   // skips .gitkeep, loose files, deeper folders
      (list[parts[0]] ||= []).push({ name: parts[1], size: o.size, etag: o.etag });   // etag: used by scripts/sync-cad.mjs
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const response = new Response(JSON.stringify(list), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
  ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
  return response;
}
