import {apiHeaders,authenticated,baseUrl} from '../_shared/supabase.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
export async function onRequestGet(context){
  const session=await authenticated(context);if(!session.user)return json({ok:false,error:'sign_in_required'},401);
  const response=await fetch(`${baseUrl(context.env)}/rest/v1/mm_provider_connections?owner_id=eq.${encodeURIComponent(session.user.id)}&select=provider,account_summary,updated_at`,{headers:apiHeaders(context.env,session.access)});if(!response.ok)return json({ok:false,error:'status_unavailable'},502);
  const connections=await response.json();return json({ok:true,connections:connections.map(item=>({provider:item.provider,accounts:item.account_summary,updatedAt:item.updated_at}))});
}
export function onRequest(){return json({ok:false,error:'method_not_allowed'},405)}

