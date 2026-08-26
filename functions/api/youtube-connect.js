import {authenticated} from '../_shared/supabase.js';
import {seal} from '../_shared/provider-crypto.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
export async function onRequestGet(context){
  const configured=Boolean(context.env.GOOGLE_CLIENT_ID&&context.env.GOOGLE_CLIENT_SECRET&&context.env.YOUTUBE_REDIRECT_URI&&context.env.PROVIDER_TOKEN_ENCRYPTION_KEY&&context.env.SUPABASE_SERVICE_ROLE_KEY),enabled=context.env.YOUTUBE_CONNECT_ENABLED==='true';
  if(new URL(context.request.url).searchParams.get('action')==='status')return json({ok:true,configured,enabled,connected:false,mode:'explicit_upload',scopes:['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly']});
  if(!configured)return json({ok:false,error:'not_configured'},503);if(!enabled)return json({ok:false,error:'connection_disabled'},503);
  const session=await authenticated(context);if(!session.user)return json({ok:false,error:'sign_in_required'},401);
  const state=crypto.randomUUID(),oauth=await seal({state,userId:session.user.id,exp:Date.now()+600000},context.env.PROVIDER_TOKEN_ENCRYPTION_KEY),params=new URLSearchParams({client_id:context.env.GOOGLE_CLIENT_ID,redirect_uri:context.env.YOUTUBE_REDIRECT_URI,response_type:'code',scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',access_type:'offline',prompt:'consent',include_granted_scopes:'true',state});
  return new Response(null,{status:302,headers:{location:`https://accounts.google.com/o/oauth2/v2/auth?${params}`,'cache-control':'private, no-store','set-cookie':`mm_youtube_oauth=${encodeURIComponent(oauth)}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`}});
}
export function onRequest(){return json({ok:false,error:'method_not_allowed'},405)}

