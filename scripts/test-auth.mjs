import {authenticateRequest,identityState} from '../src/auth.js';

const enc=new TextEncoder();
const b64url=bytes=>Buffer.from(bytes).toString('base64url');
const jsonPart=value=>b64url(enc.encode(JSON.stringify(value)));

const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',publicKey);jwk.kid='test-kid';jwk.alg='RS256';jwk.use='sig';
const team='sakthiai-test.cloudflareaccess.com';
const aud='sakthiai-audience';

async function token(overrides={}){
  const header=jsonPart({alg:'RS256',typ:'JWT',kid:'test-kid'});
  const claims=jsonPart({iss:`https://${team}`,aud,sub:'subject-001',email:'owner@example.invalid',exp:Math.floor(Date.now()/1000)+300,...overrides});
  const input=`${header}.${claims}`;
  const signature=await crypto.subtle.sign({name:'RSASSA-PKCS1-v1_5'},privateKey,enc.encode(input));
  return `${input}.${b64url(new Uint8Array(signature))}`;
}

globalThis.fetch=async url=>{
  if(String(url)!==`https://${team}/cdn-cgi/access/certs`)throw new Error('UNEXPECTED_JWKS_URL');
  return new Response(JSON.stringify({keys:[jwk]}),{status:200,headers:{'content-type':'application/json'}});
};

const env={IDENTITY_RUNTIME_ENABLED:'true',ACCESS_TEAM_DOMAIN:team,ACCESS_AUD:aud,ALLOW_BEARER_ACCESS_JWT:'false'};
if(identityState(env).state!=='CONFIGURED')throw new Error('IDENTITY_STATE_NOT_CONFIGURED');
const good=await authenticateRequest(new Request('https://example.invalid',{headers:{'cf-access-jwt-assertion':await token()}}),env);
if(!good.ok||good.subject!=='subject-001')throw new Error(`VALID_TOKEN_REJECTED:${good.code||'unknown'}`);
const badAud=await authenticateRequest(new Request('https://example.invalid',{headers:{'cf-access-jwt-assertion':await token({aud:'wrong'})}}),env);
if(badAud.ok||badAud.code!=='ACCESS_JWT_AUDIENCE_MISMATCH')throw new Error('AUDIENCE_MISMATCH_NOT_REJECTED');
const expired=await authenticateRequest(new Request('https://example.invalid',{headers:{'cf-access-jwt-assertion':await token({exp:Math.floor(Date.now()/1000)-10})}}),env);
if(expired.ok||expired.code!=='ACCESS_JWT_EXPIRED')throw new Error('EXPIRED_TOKEN_NOT_REJECTED');
const unsigned=await authenticateRequest(new Request('https://example.invalid',{headers:{'cf-access-jwt-assertion':'a.b.c'}}),env);
if(unsigned.ok)throw new Error('MALFORMED_TOKEN_NOT_REJECTED');
console.log('SAKTHIAI_ACCESS_JWT_TEST_PASS');
