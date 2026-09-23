const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}});

export async function onRequestPost(context){
  const origin=context.request.headers.get('origin');
  if(origin&&origin!==new URL(context.request.url).origin)return json({error:'invalid_origin'},403);
  if(!context.env.AI)return json({error:'not_configured',message:'Add a Workers AI binding named AI in Cloudflare Pages, then redeploy.'},503);
  let body;
  try{body=await context.request.json()}catch{return json({error:'invalid_json'},400)}
  const prompt=String(body.prompt||'').trim(),style=String(body.style||'').trim(),brand=String(body.brand||'').trim();
  if(!prompt||prompt.length>1200)return json({error:'invalid_prompt',message:'Prompt must be between 1 and 1200 characters.'},400);
  const fullPrompt=[prompt,style&&`${style} visual style`,brand&&`subtle brand colour ${brand}`].filter(Boolean).join('. ');
  try{
    const model=context.env.IMAGE_MODEL||'@cf/black-forest-labs/flux-1-schnell';
    const output=await context.env.AI.run(model,{prompt:fullPrompt,seed:Math.floor(Math.random()*1000000)});
    if(!output?.image)return json({error:'empty_output',message:'The image provider returned no image.'},502);
    let image=`data:image/jpeg;base64,${output.image}`,publicUrl='';
    if(context.env.MEDIA_BUCKET){
      try{
        const key=`generated/${Date.now()}-${crypto.randomUUID()}.jpg`,bytes=Uint8Array.from(atob(output.image),c=>c.charCodeAt(0));
        await context.env.MEDIA_BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg',cacheControl:'public, max-age=31536000'}});
        const base=String(context.env.MEDIA_PUBLIC_BASE_URL||'').replace(/\/$/,'');
        if(base)publicUrl=`${base}/${key}`;
      }catch(error){console.error('media_store_failed',error)}
    }
    return json({image,publicUrl,provider:'Cloudflare Workers AI',model});
  }catch(error){return json({error:'generation_failed',message:error?.message||'Image generation failed.'},502)}
}

export function onRequest(){return json({error:'method_not_allowed'},405)}

