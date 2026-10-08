import {apiHeaders,authenticated,baseUrl,configured,json,sameOrigin} from '../_shared/supabase.js';

const endpoint=env=>`${baseUrl(env)}/rest/v1/mm_workspaces`;
const fail=()=>json({ok:false,error:'workspace_unavailable'},502);

export async function onRequestGet(context){
  if(!configured(context.env))return json({ok:false,error:'not_configured'},503);
  try{
    const session=await authenticated(context);
    if(!session.user)return json({ok:false,error:'sign_in_required'},401,session.headers);
    const url=`${endpoint(context.env)}?owner_id=eq.${encodeURIComponent(session.user.id)}&select=id,name,category,updated_at&order=created_at.asc`;
    const response=await fetch(url,{headers:apiHeaders(context.env,session.access)});
    if(!response.ok)return fail();
    return json({ok:true,workspaces:await response.json()},200,session.headers);
  }catch{return fail()}
}

export async function onRequestPost(context){
  if(!configured(context.env))return json({ok:false,error:'not_configured'},503);
  if(!sameOrigin(context.request))return json({ok:false,error:'invalid_origin'},403);
  const session=await authenticated(context);
  if(!session.user)return json({ok:false,error:'sign_in_required'},401,session.headers);
  let input;
  try{const raw=await context.request.text();if(raw.length>4000)return json({ok:false,error:'payload_too_large'},413);input=JSON.parse(raw)}catch{return json({ok:false,error:'invalid_json'},400)}
  const name=String(input.name||'').trim(),category=String(input.category||'').trim();
  if(name.length<2||name.length>100||category.length>100)return json({ok:false,error:'invalid_workspace'},400);
  try{
    const response=await fetch(`${endpoint(context.env)}?select=id,name,category,updated_at`,{method:'POST',headers:{...apiHeaders(context.env,session.access),prefer:'return=representation'},body:JSON.stringify({owner_id:session.user.id,name,category})});
    if(!response.ok)return fail();
    const [workspace]=await response.json();
    return workspace?json({ok:true,workspace},201,session.headers):fail();
  }catch{return fail()}
}

export function onRequest(){return json({ok:false,error:'method_not_allowed'},405)}
