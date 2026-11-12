import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost,onRequest} from '../functions/api/generate.js';

const env={SUPABASE_URL:'https://auth.example',SUPABASE_ANON_KEY:'public-test',GEMINI_API_KEY:'private-test',GEMINI_MODEL:'gemini-test',AI_ALLOWED_EMAILS:'owner@example.com'};
const brief={topic:'Ayurvedic potli massage',type:'Instagram caption',goal:'Bookings',language:'English',business:'Test Spa',tone:'Calm'};
let identity=0;
function request(body=brief,headers={}){return new Request('https://app.example/api/generate',{method:'POST',headers:{origin:'https://app.example','content-type':'application/json',cookie:'mm_access=test',...headers},body:JSON.stringify(body)})}
async function mock(run,{email='owner@example.com',confirmed=true,provider,anonymous=false}={}){
  const original=globalThis.fetch,calls=[];const id=String(++identity);
  globalThis.fetch=async(url,init)=>{
    if(String(url).startsWith('https://auth.example'))return Response.json({id,email,email_confirmed_at:confirmed?'2026-01-01':null},{status:anonymous?401:200});
    calls.push({url,init});
    if(provider)return provider(url,init);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'Relax with our potli massage.'}]}}],usageMetadata:{totalTokenCount:80}});
  };
  try{await run(calls)}finally{globalThis.fetch=original}
}
test('rejects cross-origin and anonymous requests before Gemini',async()=>{
  await mock(async calls=>{
    assert.equal((await onRequestPost({request:request(brief,{origin:'https://evil.example'}),env})).status,403);
    assert.equal((await onRequestPost({request:request(brief,{cookie:''}),env})).status,401);
    assert.equal(calls.length,0);
  });
});
test('restricts generation to confirmed configured owner accounts',async()=>{
  for(const options of [{email:'other@example.com'},{confirmed:false}])await mock(async calls=>{
    assert.equal((await onRequestPost({request:request(),env})).status,403);assert.equal(calls.length,0);
  },options);
});
test('fails closed if key, model or owner configuration is missing',async()=>{
  await mock(async calls=>{
    for(const key of ['GEMINI_API_KEY','GEMINI_MODEL','AI_ALLOWED_EMAILS'])assert.equal((await onRequestPost({request:request(),env:{...env,[key]:''}})).status,503);
    assert.equal(calls.length,0);
  });
});
test('validates fields and enforces byte size without content-length',async()=>{
  await mock(async calls=>{
    for(const body of [null,[],{...brief,topic:'x'.repeat(601)},{...brief,goal:123}])assert.equal((await onRequestPost({request:request(body),env})).status,400);
    assert.equal((await onRequestPost({request:request({...brief,topic:'x'.repeat(21000)}),env})).status,413);
    assert.equal(calls.length,0);
  });
});
test('returns Gemini draft with usage and no secret in URL or output',async()=>{
  await mock(async calls=>{
    const result=await onRequestPost({request:request(),env});assert.equal(result.status,200);
    const data=await result.json();assert.equal(data.provider,'Google Gemini');assert.equal(data.usage.total_tokens,80);
    assert.ok(!JSON.stringify(data).includes(env.GEMINI_API_KEY));assert.ok(!calls[0].url.includes(env.GEMINI_API_KEY));
    assert.equal(calls[0].init.headers['x-goog-api-key'],env.GEMINI_API_KEY);
    assert.equal(JSON.parse(calls[0].init.body).generationConfig.maxOutputTokens,1200);
  });
});
test('does not silently retry or switch providers on failures',async()=>{
  await mock(async calls=>{
    const result=await onRequestPost({request:request(),env:{...env,OPENAI_API_KEY:'unused',AI:{run:()=>{throw Error('must not call')}}}});
    assert.equal(result.status,429);assert.equal(calls.length,1);assert.ok(!(await result.text()).includes('private details'));
  },{provider:()=>new Response('private details',{status:429})});
});
test('rejects blocked, truncated and empty drafts',async()=>{
  for(const candidate of [{finishReason:'SAFETY'},{finishReason:'MAX_TOKENS'},{finishReason:'STOP',content:{parts:[{text:''}]}}])await mock(async()=>{
    assert.equal((await onRequestPost({request:request(),env})).status,502);
  },{provider:()=>Response.json({candidates:[candidate]})});
});
test('limits repeated owner requests before making provider calls',async()=>{
  await mock(async calls=>{
    for(let i=0;i<5;i++)assert.equal((await onRequestPost({request:request(),env})).status,200);
    const limited=await onRequestPost({request:request(),env});assert.equal(limited.status,429);assert.equal(calls.length,5);
  });
});
test('rejects unsupported HTTP methods',()=>assert.equal(onRequest().status,405));


test('reports safe provider diagnosis without exposing upstream messages or keys',async()=>{
  for(const [status,reason,error] of [[400,'API_KEY_INVALID','provider_key_invalid'],[403,'','provider_access_denied'],[404,'','provider_model_unavailable'],[400,'','provider_request_invalid']]){
    await mock(async()=>{
      const response=await onRequestPost({request:request(),env});
      assert.equal(response.status,502);
      assert.deepEqual(await response.json(),{ok:false,error});
    },{provider:()=>Response.json({error:{message:'sensitive upstream data',details:[{reason}]}},{status})});
  }
});

test('routes explicit Grok requests to xAI and rejects unconfigured or unknown providers', async () => {
  const grokEnv = {...env, XAI_MODEL: 'grok-test', XAI_API_KEY: 'xai-test-secret'};
  await mock(async calls => {
    assert.equal((await onRequestPost({request: request({...brief, provider:'grok'}), env})).status, 503);
    assert.equal((await onRequestPost({request: request({...brief, provider:'other'}), env})).status, 400);
    assert.equal(calls.length, 0);
    const response = await onRequestPost({request: request({...brief, provider:'grok'}), env:grokEnv});
    assert.deepEqual(await response.json(), {ok:true, text:'Test Grok draft', model:'grok-test', provider:'Grok', usage:{total_tokens:12}});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.x.ai/v1/responses');
    assert.equal(calls[0].init.headers.authorization, 'Bearer xai-test-secret');
    assert.equal(JSON.parse(calls[0].init.body).store, false);
  }, {provider: () => Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Test Grok draft'}]}],usage:{total_tokens:12}})});
});

test('does not fall back to Gemini on a Grok authentication failure', async () => {
  await mock(async calls => {
    const response = await onRequestPost({request:request({...brief,provider:'grok'}),env:{...env,XAI_MODEL:'grok-test',XAI_API_KEY:'invalid'}});
    assert.equal(response.status,502);
    assert.deepEqual(await response.json(),{ok:false,error:'provider_key_invalid'});
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'https://api.x.ai/v1/responses');
  },{provider:()=>new Response('private provider details',{status:401})});
});
