export async function onRequestGet(context) {
  const payload = {
    ok: true,
    app: 'MarketingMind AI',
    version: '1.0.0-mvp',
    runtime: 'Cloudflare Pages Functions',
    environment: context.env.ENVIRONMENT || 'production',
    timestamp: new Date().toISOString()
  };

  return Response.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

