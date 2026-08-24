const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra }
});

const clean = (value, max) => String(value || '').trim().slice(0, max);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedOrigin(request, configured) {
  const origin = request.headers.get('origin');
  const allowed = String(configured || '').split(',').map(value => value.trim()).filter(Boolean);
  return { origin, allowed: Boolean(origin && allowed.includes(origin)), header: origin && allowed.includes(origin) ? origin : '' };
}

export async function onRequestOptions(context) {
  const check = allowedOrigin(context.request, context.env.LEAD_FORM_ORIGIN);
  if (!check.allowed) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': check.header,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  }});
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = allowedOrigin(request, env.LEAD_FORM_ORIGIN);
  const cors = origin.header ? { 'access-control-allow-origin': origin.header, 'vary': 'Origin' } : {};
  if (!origin.allowed) return json({ ok: false, error: 'origin_not_allowed' }, 403, cors);

  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MARKETINGMIND_WORKSPACE_ID', 'TURNSTILE_SECRET_KEY'];
  if (!required.every(key => env[key]) || !uuidPattern.test(env.MARKETINGMIND_WORKSPACE_ID)) {
    return json({ ok: false, error: 'not_configured' }, 503, cors);
  }

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 12_000) return json({ ok: false, error: 'payload_too_large' }, 413, cors);
  let input;
  try { input = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400, cors); }
  if (input.website) return json({ ok: true, received: true }, 202, cors);

  const name = clean(input.name, 100), phone = clean(input.phone, 40), email = clean(input.email, 160);
  const service = clean(input.service, 120), preferredDate = clean(input.preferredDate, 20), message = clean(input.message, 1000);
  const token = clean(input.turnstileToken, 2048);
  if (name.length < 2 || (!phone && !email) || input.consent !== true) return json({ ok: false, error: 'invalid_submission' }, 400, cors);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'invalid_email' }, 400, cors);
  if (!token) return json({ ok: false, error: 'verification_required' }, 400, cors);

  const remoteip = request.headers.get('CF-Connecting-IP') || undefined;
  let verification;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip })
    });
    verification = await response.json();
  } catch { return json({ ok: false, error: 'verification_unavailable' }, 503, cors); }
  if (!verification.success) return json({ ok: false, error: 'verification_failed' }, 400, cors);

  const notes = [email && `Email: ${email}`, preferredDate && `Preferred date: ${preferredDate}`, message, `Consent captured: ${new Date().toISOString()}`].filter(Boolean).join(' | ');
  const supabaseUrl = String(env.SUPABASE_URL).replace(/\/$/, '');
  let stored;
  try {
    stored = await fetch(`${supabaseUrl}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
        prefer: 'return=minimal'
      },
      body: JSON.stringify({ workspace_id: env.MARKETINGMIND_WORKSPACE_ID, name, phone, source: 'Website form', service: service || 'Not specified', status: 'New', notes })
    });
  } catch { return json({ ok: false, error: 'storage_unavailable' }, 503, cors); }
  if (!stored.ok) return json({ ok: false, error: 'storage_failed' }, 502, cors);
  return json({ ok: true, received: true }, 201, cors);
}

