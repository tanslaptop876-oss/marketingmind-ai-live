export async function onRequestGet(context) {
  const payload = {
    ok: true,
    app: 'MarketingMind AI',
    version: '1.1.0-media',
    features: {
      videoEditorV2: true,
      publicMediaStorage: Boolean(context.env.MEDIA_BUCKET && context.env.MEDIA_PUBLIC_BASE_URL),
      imageGeneration: Boolean(context.env.AI || context.env.IMAGE_API_KEY),
      transcription: Boolean(context.env.OPENAI_API_KEY),
      metaPublishing: Boolean(context.env.META_APP_ID && context.env.META_APP_SECRET && context.env.META_REDIRECT_URI)
    },
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

