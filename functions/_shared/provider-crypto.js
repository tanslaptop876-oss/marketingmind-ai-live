const encoder=new TextEncoder(),decoder=new TextDecoder();
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromB64url=value=>Uint8Array.from(atob(String(value).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),char=>char.charCodeAt(0));
async function key(secret){
  if(!secret||secret.length<32)throw new Error('encryption_key_not_configured');
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(secret));
  return crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt','decrypt']);
}
export async function seal(value,secret){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(secret),encoder.encode(JSON.stringify(value)));return `${b64url(iv)}.${b64url(new Uint8Array(cipher))}`}
export async function open(value,secret){const [iv,cipher]=String(value||'').split('.');if(!iv||!cipher)throw new Error('invalid_encrypted_value');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64url(iv)},await key(secret),fromB64url(cipher));return JSON.parse(decoder.decode(plain))}
