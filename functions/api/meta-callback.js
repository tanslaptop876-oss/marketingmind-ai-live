const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff',...headers}});
const cookies=request=>Object.fromEntries(String(request.headers.get('cookie')||'').split(';').map(value=>value.trim().split(/=(.*)/s)).filter(parts=>parts[0]));

export async function onRequestGet(context){
  const url=new URL(context.request.url),saved=cookies(context.request).mm_meta_state,state=url.searchParams.get('state'),code=url.searchParams.get('code'),error=url.searchParams.get('error');
  const clear='mm_meta_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  if(!saved||!state||saved!==state)return json({ok:false,error:'invalid_oauth_state'},403,{'set-cookie':clear});
  if(error)return json({ok:false,error:'authorization_declined'},400,{'set-cookie':clear});
  if(!code)return json({ok:false,error:'missing_authorization_code'},400,{'set-cookie':clear});
  // Deliberately do not exchange the code until encrypted, per-workspace token storage exists.
  return json({ok:false,error:'token_storage_not_ready',message:'Authorization was validated, but no token was requested or stored.'},503,{'set-cookie':clear});
}

export function onRequest(){return json({ok:false,error:'method_not_allowed'},405)}
