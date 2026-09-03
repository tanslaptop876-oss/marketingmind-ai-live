import {apiHeaders,authenticated,baseUrl,clearSession,configured,json,sameOrigin,storeSession} from '../_shared/supabase.js';

export async function onRequestGet(context){
  if(!configured(context.env))return json({ok:false,error:'not_configured'},503);
  try{const session=await authenticated(context);return json({ok:true,user:session.user?{id:session.user.id,email:session.user.email}:null},200,session.headers)}catch{return json({ok:false,error:'auth_unavailable'},503)}
}

export async function onRequestPost(context){
  if(!configured(context.env))return json({ok:false,error:'not_configured'},503);
  if(!sameOrigin(context.request))return json({ok:false,error:'invalid_origin'},403);
  if(Number(context.request.headers.get('content-length')||0)>12_000)return json({ok:false,error:'payload_too_large'},413);
  let input;try{const raw=await context.request.text();if(raw.length>12_000)return json({ok:false,error:'payload_too_large'},413);input=JSON.parse(raw)}catch{return json({ok:false,error:'invalid_json'},400)}
  const action=String(input.action||''),headers=new Headers();
  if(action==='signout'){
    try{const session=await authenticated(context);if(session.access)await fetch(`${baseUrl(context.env)}/auth/v1/logout`,{method:'POST',headers:apiHeaders(context.env,session.access)})}catch{}
    clearSession(headers);return json({ok:true,user:null},200,headers);
  }
  const email=String(input.email||'').trim().toLowerCase(),password=String(input.password||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>128)return json({ok:false,error:'invalid_credentials_format'},400);
  const endpoint=action==='signup'?'/auth/v1/signup':action==='signin'?'/auth/v1/token?grant_type=password':'';
  if(!endpoint)return json({ok:false,error:'invalid_action'},400);
  try{
    const response=await fetch(`${baseUrl(context.env)}${endpoint}`,{method:'POST',headers:apiHeaders(context.env),body:JSON.stringify({email,password})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return json({ok:false,error:data.error_code||'authentication_failed',message:String(data.msg||data.message||'Authentication failed').slice(0,180)},response.status===429?429:400);
    if(data.access_token&&data.refresh_token)storeSession(headers,data);
    const user=data.user?{id:data.user.id,email:data.user.email}:null;
    return json({ok:true,user,needsConfirmation:action==='signup'&&!data.access_token},200,headers);
  }catch{return json({ok:false,error:'auth_unavailable'},503)}
}
