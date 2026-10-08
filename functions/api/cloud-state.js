import {apiHeaders,authenticated,baseUrl,configured,json,sameOrigin} from '../_shared/supabase.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const url=(env,userId,id)=>`${baseUrl(env)}/rest/v1/mm_workspaces?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&select=id,snapshot,updated_at`;
const unavailable=()=>json({ok:false,error:'cloud_unavailable'},502);

export async function onRequestGet(context){
  if(!configured(context.env))return json({ok:false,error:'not_configured'},503);
  const session=await authenticated(context);
  if(!session.user)return json({ok:false,error:'sign_in_required'},401,session.headers);
  const workspaceId=new URL(context.request.url).searchParams.get('workspaceId');
  if(!uuid.test(workspaceId||''))return json({ok:false,error:'workspace_required'},400);
  try{
    const response=await fetch(url(context.env,session.user.id,workspaceId),{headers:apiHeaders(context.env,session.access)});
    if(!response.ok)return unavailable();
    const [workspace]=await response.json();
    return workspace?json({ok:true,state:workspace.snapshot,savedAt:workspace.updated_at},200,session.headers):json({ok:false,error:'workspace_not_found'},404);
  }catch{return unavailable()}
}

export async function onRequestPut(context){
  if(!configured(context.env))return json({ok:false,error:'not_configured'},503);
  if(!sameOrigin(context.request))return json({ok:false,error:'invalid_origin'},403);
  const session=await authenticated(context);
  if(!session.user)return json({ok:false,error:'sign_in_required'},401,session.headers);
  let input;
  try{const raw=await context.request.text();if(raw.length>500000)return json({ok:false,error:'payload_too_large'},413);input=JSON.parse(raw)}catch{return json({ok:false,error:'invalid_json'},400)}
  if(!uuid.test(input.workspaceId||'')||!input.state||typeof input.state!=='object'||Array.isArray(input.state)||!input.state.business||typeof input.state.business!=='object')return json({ok:false,error:'invalid_workspace_state'},400);
  try{
    const response=await fetch(url(context.env,session.user.id,input.workspaceId),{method:'PATCH',headers:{...apiHeaders(context.env,session.access),prefer:'return=representation'},body:JSON.stringify({snapshot:input.state,updated_at:new Date().toISOString()})});
    if(!response.ok)return unavailable();
    const [workspace]=await response.json();
    return workspace?json({ok:true,savedAt:workspace.updated_at},200,session.headers):json({ok:false,error:'workspace_not_found'},404);
  }catch{return unavailable()}
}

export function onRequest(){return json({ok:false,error:'method_not_allowed'},405)}
