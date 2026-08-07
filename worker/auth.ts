import type { Env, SessionPayload } from './types';

const COOKIE = 'yvie_session';
const encoder = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(value: string) {
  const base64=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');
  const binary=atob(base64); return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function hmac(secret:string,data:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(data)))}
async function secureEqual(a:string,b:string){const [ha,hb]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(a)),crypto.subtle.digest('SHA-256',encoder.encode(b))]);const aa=new Uint8Array(ha),bb=new Uint8Array(hb);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0}
export async function passwordMatches(input:string,env:Env){return secureEqual(input,env.YVIE_ADMIN_PASSWORD)}
export async function createSession(env:Env){const payload:SessionPayload={exp:Date.now()+1000*60*60*12};const body=b64url(encoder.encode(JSON.stringify(payload)));const sig=b64url(await hmac(env.YVIE_SESSION_SECRET,body));return `${body}.${sig}`}
export async function verifySession(request:Request,env:Env){const cookie=request.headers.get('Cookie')||'';const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);if(!token)return false;const [body,sig]=token.split('.');if(!body||!sig)return false;const expected=await hmac(env.YVIE_SESSION_SECRET,body);const actual=fromB64url(sig);if(actual.length!==expected.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];if(diff!==0)return false;try{const payload=JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload;return payload.exp>Date.now()}catch{return false}}
export function sessionCookie(token:string,request:Request){const secure=new URL(request.url).protocol==='https:'?'; Secure':'';return `${COOKIE}=${token}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=43200`}
export function clearSessionCookie(request:Request){const secure=new URL(request.url).protocol==='https:'?'; Secure':'';return `${COOKIE}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`}
