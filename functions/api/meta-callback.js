const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff',...headers}});
const cookies=request=>Object.fromEntries(String(request.headers.get('cookie')||'').split(';').map(value=>value.trim().split(/=(.*)/s)).filter(parts=>parts[0]));
import {apiHeaders,baseUrl} from '../_shared/supabase.js';
import {open,seal} from '../_shared/provider-crypto.js';

export async function onRequestGet(context){
  const url=new URL(context.request.url),saved=decodeURIComponent(cookies(context.request).mm_meta_oauth||''),state=url.searchParams.get('state'),code=url.searchParams.get('code'),error=url.searchParams.get('error'),clear='mm_meta_oauth=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  let oauth;try{oauth=await open(saved,context.env.META_TOKEN_ENCRYPTION_KEY)}catch{return json({ok:false,error:'invalid_oauth_state'},403,{'set-cookie':clear})}
  if(!state||oauth.state!==state||oauth.exp<Date.now())return json({ok:false,error:'invalid_oauth_state'},403,{'set-cookie':clear});
  if(error)return json({ok:false,error:'authorization_declined'},400,{'set-cookie':clear});
  if(!code)return json({ok:false,error:'missing_authorization_code'},400,{'set-cookie':clear});
  const version=context.env.META_GRAPH_VERSION||'v23.0',tokenUrl=new URL(`https://graph.facebook.com/${version}/oauth/access_token`);tokenUrl.search=new URLSearchParams({client_id:context.env.META_APP_ID,client_secret:context.env.META_APP_SECRET,redirect_uri:context.env.META_REDIRECT_URI,code});
  try{
    const tokenResponse=await fetch(tokenUrl,{headers:{accept:'application/json'}}),token=await tokenResponse.json();if(!tokenResponse.ok||!token.access_token)throw new Error('token_exchange_failed');
    const accountsResponse=await fetch(`https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100`,{headers:{authorization:`Bearer ${token.access_token}`}}),accounts=await accountsResponse.json();if(!accountsResponse.ok)throw new Error('account_discovery_failed');
    const pages=(accounts.data||[]).map(page=>({id:page.id,name:page.name,accessToken:page.access_token,instagram:page.instagram_business_account||null}));
    const encrypted=await seal({pages,connectedAt:new Date().toISOString()},context.env.META_TOKEN_ENCRYPTION_KEY);
    const response=await fetch(`${baseUrl(context.env)}/rest/v1/mm_provider_connections?on_conflict=owner_id,provider`,{method:'POST',headers:{...apiHeaders({SUPABASE_ANON_KEY:context.env.SUPABASE_SERVICE_ROLE_KEY},context.env.SUPABASE_SERVICE_ROLE_KEY),prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({owner_id:oauth.userId,provider:'meta',encrypted_credentials:encrypted,account_summary:pages.map(page=>({id:page.id,name:page.name,instagram:page.instagram})),updated_at:new Date().toISOString()})});
    if(!response.ok)throw new Error('secure_storage_failed');
    return new Response(null,{status:302,headers:{location:'/#settings','cache-control':'private, no-store','set-cookie':clear}});
  }catch(error){return json({ok:false,error:error.message||'meta_connection_failed'},502,{'set-cookie':clear})}
}

export function onRequest(){return json({ok:false,error:'method_not_allowed'},405)}
