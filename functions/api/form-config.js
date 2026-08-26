export async function onRequestGet(context) {
  const { env } = context;
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MARKETINGMIND_WORKSPACE_ID', 'LEAD_FORM_ORIGIN', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'];
  const ready = required.every(key => Boolean(env[key]));
  const services = String(env.FORM_SERVICES || 'Haircut,Hair colour,Hair spa,Bridal package,Skin care,Spa ritual')
    .split(',').map(value => value.trim()).filter(Boolean).slice(0, 20);
  return Response.json({
    ok: true,
    ready,
    business: {
      name: env.FORM_BUSINESS_NAME || 'Studio Salvador Salon & Holistic Health Spa',
      category: env.FORM_BUSINESS_CATEGORY || 'Salon & Spa',
      phone: env.FORM_BUSINESS_PHONE || ''
    },
    form: {
      title: env.FORM_TITLE || 'Book a consultation',
      intro: env.FORM_INTRO || 'Tell us what you are looking for and our team will contact you to confirm a convenient time.',
      services,
      button: env.FORM_BUTTON_LABEL || 'Request appointment',
      success: env.FORM_SUCCESS_MESSAGE || 'Thank you — our team will contact you shortly.'
    },
    turnstile: { siteKey: ready ? env.TURNSTILE_SITE_KEY : '' },
    endpoint: '/api/leads'
  }, { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
