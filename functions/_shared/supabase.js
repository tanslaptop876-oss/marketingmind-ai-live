const cookieNames={access:'mm_access',refresh:'mm_refresh'};

export const json=(body,status=200,headers=new Headers())=>{
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','private, no-store');
  headers.set('pragma','no-cache');
  headers.set('x-content-type-options','nosniff');
  return new Response(JSON.stringify(body),{status,headers});
};

export const configured=env=>Boolean(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY);
export const baseUrl=env=>String(env.SUPABASE_URL||'').replace(/\/$/,'');
export const apiHeaders=(env,token)=>({apikey:env.SUPABASE_ANON_KEY,authorization:`Bearer ${token||env.SUPABASE_ANON_KEY}`,'content-type':'application/json'});
export const sameOrigin=request=>request.headers.get('origin')===new URL(request.url).origin;

const cookies=request=>Object.fromEntries(String(request.headers.get('cookie')||'').split(';').map(item=>item.trim().split(/=(.*)/s)).filter(parts=>parts[0]).map(([key,value])=>[key,decodeURIComponent(value||'')]));
const cookie=(name,value,maxAge)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export function storeSession(headers,session){
  headers.append('set-cookie',cookie(cookieNames.access,session.access_token,Math.max(60,Number(session.expires_in)||3600)));
  headers.append('set-cookie',cookie(cookieNames.refresh,session.refresh_token,31536000));
}
export function clearSession(headers){headers.append('set-cookie',cookie(cookieNames.access,'',0));headers.append('set-cookie',cookie(cookieNames.refresh,'',0))}

async function fetchUser(env,token){
  if(!token)return null;
  const response=await fetch(`${baseUrl(env)}/auth/v1/user`,{headers:apiHeaders(env,token)});
  return response.ok?response.json():null;
}

export async function authenticated(context){
  const headers=new Headers(),saved=cookies(context.request);
  let access=saved[cookieNames.access],user=await fetchUser(context.env,access);
  if(!user&&saved[cookieNames.refresh]){
    const response=await fetch(`${baseUrl(context.env)}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:apiHeaders(context.env),body:JSON.stringify({refresh_token:saved[cookieNames.refresh]})});
    const session=await response.json().catch(()=>null);
    if(response.ok&&session?.access_token){access=session.access_token;storeSession(headers,session);user=await fetchUser(context.env,access)}
  }
  if(!user&&access)clearSession(headers);
  return {headers,user,access};
}

