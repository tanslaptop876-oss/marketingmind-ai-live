const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const text=value=>String(value||'').replace(/\s+/g,' ').trim();
const decode=value=>text(value).replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');

function safeUrl(value){
  let url;try{url=new URL(String(value||'').trim())}catch{return null}
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||!host.includes('.')||host==='localhost'||host.endsWith('.local')||host.includes(':'))return null;
  if(/^\d{1,3}(\.\d{1,3}){3}$/.test(host))return null;
  return url;
}
function attrs(tag){const result={};for(const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))result[match[1].toLowerCase()]=decode(match[2]??match[3]??match[4]??'');return result}
async function limitedHtml(response,limit=1_500_000){
  if(!response.body)return '';
  const reader=response.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('page_too_large')}chunks.push(value)}
  const merged=new Uint8Array(size);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength}return new TextDecoder().decode(merged)
}
async function fetchPage(initial){
  let url=initial;
  for(let hop=0;hop<4;hop++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);let response;
    try{response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{accept:'text/html,application/xhtml+xml','user-agent':'MarketingMind-SEO-Audit/1.0'}})}finally{clearTimeout(timer)}
    if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)throw new Error('redirect_missing');const next=safeUrl(new URL(location,url).href);if(!next)throw new Error('unsafe_redirect');url=next;continue}
    if(!response.ok)throw new Error(`site_status_${response.status}`);
    if(!String(response.headers.get('content-type')||'').toLowerCase().includes('text/html'))throw new Error('not_html');
    const declared=Number(response.headers.get('content-length')||0);if(declared>1_500_000)throw new Error('page_too_large');
    return {url:url.href,html:await limitedHtml(response)}
  }
  throw new Error('too_many_redirects')
}
function analyze(html,url){
  const title=decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),tags=[...html.matchAll(/<meta\b[^>]*>/gi)].map(match=>attrs(match[0])),links=[...html.matchAll(/<link\b[^>]*>/gi)].map(match=>attrs(match[0]));
  const description=tags.find(tag=>tag.name?.toLowerCase()==='description')?.content||'',viewport=tags.find(tag=>tag.name?.toLowerCase()==='viewport')?.content||'',robots=(tags.find(tag=>tag.name?.toLowerCase()==='robots')?.content||'').toLowerCase(),canonical=links.find(tag=>(tag.rel||'').toLowerCase().split(/\s+/).includes('canonical'))?.href||'';
  const h1Count=(html.match(/<h1\b[^>]*>/gi)||[]).length,images=[...html.matchAll(/<img\b[^>]*>/gi)].map(match=>attrs(match[0])),withAlt=images.filter(image=>typeof image.alt==='string'&&image.alt.trim()).length,altCoverage=images.length?Math.round(withAlt/images.length*100):100,schemaCount=(html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/gi)||[]).length,lang=attrs(html.match(/<html\b[^>]*>/i)?.[0]||'').lang||'';
  const checks=[
    ['Title tag',title.length>=10&&title.length<=60,title?`${title.length} characters · ${title}`:'Missing title tag',15],
    ['Meta description',description.length>=50&&description.length<=160,description?`${description.length} characters`:'Missing meta description',15],
    ['Single H1',h1Count===1,`${h1Count} H1 element${h1Count===1?'':'s'} found`,15],
    ['Mobile viewport',Boolean(viewport),viewport||'Missing viewport meta tag',10],
    ['Canonical URL',Boolean(canonical),canonical||'Missing canonical link',10],
    ['Image ALT text',altCoverage===100,images.length?`${withAlt}/${images.length} images have descriptive ALT text`:'No images found',15],
    ['JSON-LD schema',schemaCount>0,`${schemaCount} JSON-LD block${schemaCount===1?'':'s'} found`,10],
    ['Indexability',!robots.includes('noindex'),robots||'No noindex directive found',5],
    ['HTML language',Boolean(lang),lang?`Language set to ${lang}`:'Missing lang attribute',5]
  ];
  const score=checks.reduce((sum,[,ok,,weight])=>sum+(ok?weight:0),0);
  return {score,checks:checks.map(([name,ok,detail])=>[name,ok,detail]),summary:{title,descriptionLength:description.length,h1Count,imageCount:images.length,altCoverage,schemaCount,canonical,lang},url}
}

export async function onRequestPost(context){
  const requestOrigin=context.request.headers.get('origin'),ownOrigin=new URL(context.request.url).origin;
  if(requestOrigin!==ownOrigin)return json({ok:false,error:'origin_not_allowed'},403);
  const length=Number(context.request.headers.get('content-length')||0);if(length>4000)return json({ok:false,error:'payload_too_large'},413);
  let input;try{input=await context.request.json()}catch{return json({ok:false,error:'invalid_json'},400)}
  const target=safeUrl(input.url);if(!target)return json({ok:false,error:'invalid_url'},400);
  try{const page=await fetchPage(target),audit=analyze(page.html,page.url);return json({ok:true,audit})}
  catch(error){const allowed=['page_too_large','not_html','too_many_redirects','unsafe_redirect'];const code=allowed.includes(error.message)?error.message:error.message.startsWith('site_status_')?error.message:'fetch_failed';return json({ok:false,error:code},422)}
}

