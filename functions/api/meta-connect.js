const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const scopes=['pages_show_list','pages_read_engagement','pages_manage_posts','instagram_basic','instagram_content_publish'];
import {authenticated} from '../_shared/supabase.js';
import {seal} from '../_shared/provider-crypto.js';

export async function onRequestGet(context){
  const {META_APP_ID,META_APP_SECRET,META_REDIRECT_URI,META_CONNECT_ENABLED,META_TOKEN_ENCRYPTION_KEY}=context.env;
  const configured=Boolean(META_APP_ID&&META_APP_SECRET&&META_REDIRECT_URI&&META_TOKEN_ENCRYPTION_KEY);
  if(new URL(context.request.url).searchParams.get('action')==='status')return json({ok:true,configured,enabled:META_CONNECT_ENABLED==='true',connected:false,permissions:scopes});
  if(!configured)return json({ok:false,error:'not_configured'},503);
  if(META_CONNECT_ENABLED!=='true')return json({ok:false,error:'connection_disabled',message:'Set META_CONNECT_ENABLED=true only after app review, redirect verification and encrypted token storage are ready.'},503);
  const session=await authenticated(context);if(!session.user)return json({ok:false,error:'sign_in_required'},401);
  const bytes=crypto.getRandomValues(new Uint8Array(24)),state=btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g,''),oauth=await seal({state,userId:session.user.id,exp:Date.now()+600000},META_TOKEN_ENCRYPTION_KEY);
  const version=context.env.META_GRAPH_VERSION||'v23.0',params=new URLSearchParams({client_id:META_APP_ID,redirect_uri:META_REDIRECT_URI,state,scope:scopes.join(','),response_type:'code'});
  const headers=new Headers({'cache-control':'private, no-store'});
  headers.append('set-cookie',`mm_meta_oauth=${encodeURIComponent(oauth)}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  headers.set('location',`https://www.facebook.com/${version}/dialog/oauth?${params}`);
  return new Response(null,{status:302,headers});
}

export function onRequest(){return json({ok:false,error:'method_not_allowed'},405)}
