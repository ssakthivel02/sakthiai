const jwksCache=new Map();

function enabled(env,name){return String(env?.[name]||'').toLowerCase()==='true';}
function decodeBase64Url(value){
  const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function decodeJsonPart(value){
  const bytes=decodeBase64Url(value);
  return JSON.parse(new TextDecoder().decode(bytes));
}
function teamDomain(env){
  const raw=String(env.ACCESS_TEAM_DOMAIN||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/$/,'');
  if(!raw||raw.includes('/')||!raw.endsWith('.cloudflareaccess.com'))throw new Error('ACCESS_TEAM_DOMAIN_INVALID');
  return raw;
}
function expectedAudiences(env){
  const values=String(env.ACCESS_AUD||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!values.length)throw new Error('ACCESS_AUD_MISSING');
  return values;
}
function audienceMatches(actual,expected){
  const values=Array.isArray(actual)?actual:[actual];
  return values.some(value=>expected.includes(String(value)));
}
async function getJwks(domain){
  const cached=jwksCache.get(domain);
  if(cached&&cached.expiresAt>Date.now())return cached.keys;
  const response=await fetch(`https://${domain}/cdn-cgi/access/certs`,{headers:{accept:'application/json'},cf:{cacheTtl:300}});
  if(!response.ok)throw new Error('ACCESS_JWKS_FETCH_FAILED');
  const body=await response.json();
  const keys=Array.isArray(body?.keys)?body.keys:[];
  if(!keys.length)throw new Error('ACCESS_JWKS_EMPTY');
  jwksCache.set(domain,{keys,expiresAt:Date.now()+300000});
  return keys;
}
async function verifyRs256(signingInput,signature,jwk){
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,signature,new TextEncoder().encode(signingInput));
}
function readToken(request,env){
  const accessHeader=String(request.headers.get('cf-access-jwt-assertion')||'').trim();
  if(accessHeader)return accessHeader;
  if(enabled(env,'ALLOW_BEARER_ACCESS_JWT')){
    const authorization=String(request.headers.get('authorization')||'').trim();
    if(/^Bearer\s+/i.test(authorization))return authorization.replace(/^Bearer\s+/i,'').trim();
  }
  return '';
}

export function identityState(env){
  if(!enabled(env,'IDENTITY_RUNTIME_ENABLED'))return {state:'IDENTITY_DISABLED'};
  try{
    teamDomain(env);expectedAudiences(env);
    return {state:'CONFIGURED'};
  }catch(error){return {state:error.message||'IDENTITY_CONFIG_INVALID'};}
}

export async function authenticateRequest(request,env){
  if(!enabled(env,'IDENTITY_RUNTIME_ENABLED'))return {ok:false,code:'IDENTITY_RUNTIME_DISABLED'};
  let domain,audiences;
  try{domain=teamDomain(env);audiences=expectedAudiences(env);}catch(error){return {ok:false,code:error.message||'IDENTITY_CONFIG_INVALID'};}
  const token=readToken(request,env);
  if(!token)return {ok:false,code:'ACCESS_JWT_REQUIRED'};
  const parts=token.split('.');
  if(parts.length!==3)return {ok:false,code:'ACCESS_JWT_MALFORMED'};
  let header,claims;
  try{header=decodeJsonPart(parts[0]);claims=decodeJsonPart(parts[1]);}catch{return {ok:false,code:'ACCESS_JWT_MALFORMED'};}
  if(header?.alg!=='RS256'||!header?.kid)return {ok:false,code:'ACCESS_JWT_ALGORITHM_REJECTED'};
  const now=Math.floor(Date.now()/1000);
  if(!Number.isFinite(claims?.exp)||claims.exp<=now)return {ok:false,code:'ACCESS_JWT_EXPIRED'};
  if(Number.isFinite(claims?.nbf)&&claims.nbf>now+30)return {ok:false,code:'ACCESS_JWT_NOT_ACTIVE'};
  if(String(claims?.iss||'')!==`https://${domain}`)return {ok:false,code:'ACCESS_JWT_ISSUER_MISMATCH'};
  if(!audienceMatches(claims?.aud,audiences))return {ok:false,code:'ACCESS_JWT_AUDIENCE_MISMATCH'};
  if(!claims?.sub)return {ok:false,code:'ACCESS_JWT_SUBJECT_MISSING'};
  try{
    const keys=await getJwks(domain);
    const jwk=keys.find(key=>key.kid===header.kid&&key.kty==='RSA');
    if(!jwk)return {ok:false,code:'ACCESS_JWT_KEY_NOT_FOUND'};
    const verified=await verifyRs256(`${parts[0]}.${parts[1]}`,decodeBase64Url(parts[2]),jwk);
    if(!verified)return {ok:false,code:'ACCESS_JWT_SIGNATURE_INVALID'};
  }catch(error){return {ok:false,code:error.message||'ACCESS_JWT_VERIFY_FAILED'};}
  return {ok:true,subject:String(claims.sub),email:claims.email?String(claims.email):null,claims:{sub:String(claims.sub),email:claims.email?String(claims.email):null,aud:claims.aud,iss:claims.iss,exp:claims.exp}};
}
