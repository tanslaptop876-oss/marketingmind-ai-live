const {test}=require('node:test');
const assert=require('node:assert/strict');

const user='11111111-1111-4111-8111-111111111111';
const owned='22222222-2222-4222-8222-222222222222';
const foreign='33333333-3333-4333-8333-333333333333';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public-test-key'};
const origin='https://marketingmind.example';
const context=(path,method='GET',body)=>({env,request:new Request(origin+path,{method,headers:{origin,cookie:'mm_access=test-access',...(body?{'content-type':'application/json'}:{})},body:body&&JSON.stringify(body)})});

test('workspace APIs scope reads and writes to the authenticated owner',async()=>{
  const {onRequestGet,onRequestPut}=await import('../functions/api/cloud-state.js');
  const {onRequestPost}=await import('../functions/api/workspaces.js');
  const original=global.fetch,requests=[];
  global.fetch=async (address,options={})=>{
    requests.push({address:String(address),options});
    if(String(address).endsWith('/auth/v1/user'))return Response.json({id:user,email:'client@example.com'});
    if(String(address).includes('/rest/v1/mm_workspaces')){
      if(options.method==='POST')return Response.json([{id:owned,name:'New client'}]);
      if(options.method==='PATCH')return Response.json([]); // RLS/owner filter denied another client's ID
      return Response.json([]);
    }
    throw Error('Unexpected request');
  };
  try{
    const denied=await onRequestPut(context('/api/cloud-state','PUT',{workspaceId:foreign,state:{business:{name:'Wrong client'}}}));
    assert.equal(denied.status,404);
    const patch=requests.find(item=>item.options.method==='PATCH');
    assert.match(patch.address,new RegExp(`id=eq\\.${foreign}`));
    assert.match(patch.address,new RegExp(`owner_id=eq\\.${user}`));
    assert.equal(patch.options.headers.authorization,'Bearer test-access');
    const created=await onRequestPost(context('/api/workspaces','POST',{name:'New client',owner_id:foreign}));
    assert.equal(created.status,201);
    const insert=requests.find(item=>item.options.method==='POST');
    assert.equal(JSON.parse(insert.options.body).owner_id,user);
    const read=await onRequestGet(context(`/api/cloud-state?workspaceId=${foreign}`));
    assert.equal(read.status,404);
  }finally{global.fetch=original}
});
