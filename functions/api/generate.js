const json=(payload,status=200)=>Response.json(payload,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const clean=value=>String(value||'').trim();

function promptFor(body){
  const topic=clean(body.topic).slice(0,600),type=clean(body.type).slice(0,80),goal=clean(body.goal).slice(0,100),language=clean(body.language).slice(0,40)||'English',business=clean(body.business).slice(0,160)||'the business',tone=clean(body.tone).slice(0,160)||'clear, helpful and trustworthy';
  if(!topic||!type||!goal)return null;
  return `Create accurate, concise local-business marketing copy. Never invent prices, discounts, awards, reviews, guarantees, availability, or regulated claims. Return only the finished draft.\n\nBusiness: ${business}\nContent type: ${type}\nGoal: ${goal}\nLanguage: ${language}\nTone: ${tone}\nTopic and verified offer details: ${topic}`;
}

async function workersAi(env,prompt){
  if(!env.AI)return null;
  const model=env.CLOUDFLARE_AI_MODEL||'@cf/meta/llama-3.1-8b-instruct',result=await env.AI.run(model,{messages:[{role:'user',content:prompt}],max_tokens:700});
  return {text:clean(result?.response),model,provider:'Cloudflare Workers AI'};
}
async function gemini(env,prompt){
  if(!env.GEMINI_API_KEY)return null;
  const model=env.GEMINI_MODEL||'gemini-2.5-flash-lite',response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:700,temperature:.7}})}),data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('gemini_error');
  return {text:clean(data.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('')),model,provider:'Google Gemini'};
}
async function groq(env,prompt){
  if(!env.GROQ_API_KEY)return null;
  const model=env.GROQ_MODEL||'llama-3.1-8b-instant',response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${env.GROQ_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:prompt}],max_tokens:700,temperature:.7})}),data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('groq_error');
  return {text:clean(data.choices?.[0]?.message?.content),model,provider:'Groq'};
}
async function openai(env,prompt){
  if(!env.OPENAI_API_KEY)return null;
  const model=env.OPENAI_MODEL||'gpt-5.4-mini',response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model,store:false,max_output_tokens:700,input:prompt})}),data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('openai_error');
  return {text:clean(data.output_text||data.output?.flatMap(item=>item.content||[]).map(item=>item.text||'').join('')),model,provider:'OpenAI',usage:data.usage};
}

export async function onRequestPost(context){
  if(Number(context.request.headers.get('content-length')||0)>20_000)return json({ok:false,error:'request_too_large'},413);
  let body;try{body=await context.request.json()}catch{return json({ok:false,error:'invalid_json'},400)}
  const prompt=promptFor(body);if(!prompt)return json({ok:false,error:'topic_type_goal_required'},400);
  const providers=[workersAi,gemini,groq,openai],errors=[];
  for(const provider of providers){try{const result=await provider(context.env,prompt);if(result?.text)return json({ok:true,...result})}catch(error){errors.push(error.message)}}
  return json({ok:false,error:'not_configured',fallback:'local_generator',attempted:errors.length},503);
}

