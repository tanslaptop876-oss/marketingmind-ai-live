const json = (payload, status = 200) => Response.json(payload, {
  status,
  headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

export async function onRequestPost(context) {
  if (!context.env.OPENAI_API_KEY) {
    return json({ ok: false, error: 'not_configured', fallback: 'local_generator' }, 503);
  }

  const contentLength = Number(context.request.headers.get('content-length') || 0);
  if (contentLength > 20_000) return json({ ok: false, error: 'request_too_large' }, 413);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const clean = value => String(value || '').trim();
  const topic = clean(body.topic).slice(0, 600);
  const type = clean(body.type).slice(0, 80);
  const goal = clean(body.goal).slice(0, 100);
  const language = clean(body.language).slice(0, 40) || 'English';
  const business = clean(body.business).slice(0, 160) || 'the business';
  const tone = clean(body.tone).slice(0, 160) || 'clear, helpful and trustworthy';

  if (!topic || !type || !goal) {
    return json({ ok: false, error: 'topic_type_goal_required' }, 400);
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: context.env.OPENAI_MODEL || 'gpt-5.4-mini',
      store: false,
      max_output_tokens: 700,
      instructions: 'You create accurate, concise local-business marketing copy. Never invent prices, discounts, awards, reviews, guarantees, availability, or regulated claims. Return only the finished draft.',
      input: `Business: ${business}\nContent type: ${type}\nGoal: ${goal}\nLanguage: ${language}\nTone: ${tone}\nTopic and verified offer details: ${topic}`
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({ ok: false, error: 'provider_error', fallback: 'local_generator' }, response.status >= 500 ? 502 : 400);
  }

  const text = (data.output || [])
    .filter(item => item.type === 'message')
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text)
    .join('\n')
    .trim();

  if (!text) return json({ ok: false, error: 'empty_response', fallback: 'local_generator' }, 502);

  return json({
    ok: true,
    text,
    model: data.model,
    usage: data.usage ? {
      input_tokens: data.usage.input_tokens || 0,
      output_tokens: data.usage.output_tokens || 0,
      total_tokens: data.usage.total_tokens || 0
    } : null
  });
}

export function onRequestGet() {
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}

