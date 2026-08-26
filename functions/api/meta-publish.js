import {apiHeaders,authenticated,baseUrl,sameOrigin} from '../_shared/supabase.js';
import {open} from '../_shared/provider-crypto.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const safeHttps=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}};
async function connection(env,ownerId){const response=await fetch(`${baseUrl(env)}/rest/v1/mm_provider_connections?owner_id=eq.${encodeURIComponent(ownerId)}&provider=eq.meta&select=encrypted_credentials,account_summary&limit=1`,{headers:apiHeaders({SUPABASE_ANON_KEY:env.SUPABASE_SERVICE_ROLE_KEY},env.SUPABASE_SERVICE_ROLE_KEY)});if(!response.ok)throw new Error('connection_lookup_failed');return (await response.json())[0]||null}

export async function onRequestPost(context){
  if(!sameOrigin(context.request))return json({ok:false,error:'invalid_origin'},403);
  if(Number(context.request.headers.get('content-length')||0)>20_000)return json({ok:false,error:'payload_too_large'},413);
  const session=await authenticated(context);if(!session.user)return json({ok:false,error:'sign_in_required'},401);
  let input;try{input=await context.request.json()}catch{return json({ok:false,error:'invalid_json'},400)}
  const channel=String(input.channel||''),pageId=String(input.pageId||''),message=String(input.message||'').trim();
  if(input.confirm!==true)return json({ok:false,error:'explicit_confirmation_required'},400);
  if(!['facebook','instagram'].includes(channel)||!pageId||!message||message.length>5000)return json({ok:false,error:'invalid_publish_request'},400);
  try{
    const saved=await connection(context.env,session.user.id);if(!saved)return json({ok:false,error:'meta_not_connected'},409);
    const credentials=await open(saved.encrypted_credentials,context.env.META_TOKEN_ENCRYPTION_KEY),page=credentials.pages?.find(item=>item.id===pageId);if(!page)return json({ok:false,error:'page_not_authorized'},403);
    const version=context.env.META_GRAPH_VERSION||'v23.0';
    if(channel==='facebook'){
      const response=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(page.id)}/feed`,{method:'POST',headers:{authorization:`Bearer ${page.accessToken}`,'content-type':'application/json'},body:JSON.stringify({message})}),data=await response.json();
      if(!response.ok)throw new Error(data.error?.message||'facebook_publish_failed');return json({ok:true,channel,id:data.id});
    }
    if(!page.instagram?.id)return json({ok:false,error:'instagram_account_not_connected'},409);
    const imageUrl=safeHttps(input.imageUrl);if(!imageUrl)return json({ok:false,error:'public_https_image_required'},400);
    const create=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(page.instagram.id)}/media`,{method:'POST',headers:{authorization:`Bearer ${page.accessToken}`,'content-type':'application/json'},body:JSON.stringify({image_url:imageUrl,caption:message})}),container=await create.json();if(!create.ok||!container.id)throw new Error(container.error?.message||'instagram_container_failed');
    const publish=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(page.instagram.id)}/media_publish`,{method:'POST',headers:{authorization:`Bearer ${page.accessToken}`,'content-type':'application/json'},body:JSON.stringify({creation_id:container.id})}),result=await publish.json();if(!publish.ok)throw new Error(result.error?.message||'instagram_publish_failed');return json({ok:true,channel,id:result.id});
  }catch(error){return json({ok:false,error:'meta_publish_failed',message:String(error.message||'Publishing failed').slice(0,180)},502)}
}
export function onRequest(){return json({ok:false,error:'method_not_allowed'},405)}
