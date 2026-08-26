export async function onRequestGet(context) {
  const configured = (...keys) => keys.every(key => Boolean(context.env[key]));
  const integrations = [
    { id: 'supabase', name: 'Supabase cloud sync', configured: configured('SUPABASE_URL', 'SUPABASE_ANON_KEY') },
    { id: 'openai', name: 'AI content generation', configured: Boolean(context.env.AI || context.env.GEMINI_API_KEY || context.env.GROQ_API_KEY || context.env.OPENAI_API_KEY) },
    { id: 'media', name: 'Picture & video generation', configured: Boolean(context.env.AI || context.env.IMAGE_API_KEY || context.env.VIDEO_API_KEY) },
    { id: 'google', name: 'Google Business read-only implementation', configured: configured('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'PROVIDER_TOKEN_ENCRYPTION_KEY', 'SUPABASE_SERVICE_ROLE_KEY'), enabled: context.env.GOOGLE_CONNECT_ENABLED === 'true' },
    { id: 'ga4', name: 'Google Analytics 4 read-only', configured: configured('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GA4_REDIRECT_URI', 'PROVIDER_TOKEN_ENCRYPTION_KEY', 'SUPABASE_SERVICE_ROLE_KEY'), enabled: context.env.GA4_CONNECT_ENABLED === 'true' },
    { id: 'meta', name: 'Meta Facebook + Instagram publishing', configured: configured('META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI', 'META_TOKEN_ENCRYPTION_KEY', 'SUPABASE_SERVICE_ROLE_KEY'), enabled: context.env.META_CONNECT_ENABLED === 'true' },
    { id: 'youtube', name: 'YouTube video publishing', configured: configured('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'YOUTUBE_REDIRECT_URI', 'PROVIDER_TOKEN_ENCRYPTION_KEY', 'SUPABASE_SERVICE_ROLE_KEY'), enabled: context.env.YOUTUBE_CONNECT_ENABLED === 'true' },
    { id: 'capture', name: 'Public lead capture', configured: configured('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MARKETINGMIND_WORKSPACE_ID', 'LEAD_FORM_ORIGIN', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY') }
  ];

  return Response.json({
    ok: true,
    configured: integrations.filter(item => item.configured).length,
    total: integrations.length,
    integrations
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

