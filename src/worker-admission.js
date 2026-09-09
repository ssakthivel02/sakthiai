import baseWorker from './worker.js';
import {authenticateRequest} from './auth.js';
import {authorizeTenant} from './rbac.js';
import {enforceQuota,recordUsage} from './quota.js';
import {runChatModel} from './chat-runtime.js';
import {capacitySignal} from './capacity-signal.js';
import {admissionPolicy} from './admission-control.js';
import {createTraceContext,finalizeResponse} from './observability.js';

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{...JSON_HEADERS,...extra}});}
function bool(value){return String(value||'').toLowerCase()==='true';}
function requestId(){return `sai_${Date.now()}_${crypto.randomUUID().slice(0,8)}`;}
function tenantSelector(request){return String(request.headers.get('x-sakthiai-tenant')||'').trim();}
function securityStatus(code){
  if(['RATE_LIMITED','DAILY_AI_QUOTA_EXCEEDED'].includes(code))return 429;
  if(['RBAC_FORBIDDEN','TENANT_MEMBERSHIP_REQUIRED','TENANT_ACCESS_INACTIVE'].includes(code))return 403;
  if(String(code||'').startsWith('ACCESS_JWT_')||code==='IDENTITY_REQUIRED')return 401;
  return 503;
}
export function admissionHttpStatus(decision){
  if(decision==='QUEUE')return 503;
  if(decision==='REJECT')return 429;
  return 200;
}
export function admissionHeaders(result){
  const retry=Number(result?.admission?.retryAfterSeconds||0);
  return retry>0?{'retry-after':String(retry)}:{};
}
export function admissionStatus(env={}){
  const signal=capacitySignal(env);
  return {policy:admissionPolicy(env),signal:{ok:signal.ok,code:signal.code,scope:signal.scope||'worker-isolate',activeRequests:signal.activeRequests??null,hardLimit:signal.hardLimit??null,globallyAuthoritative:false}};
}
async function readJson(request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('CONTENT_TYPE_REQUIRED');
  const length=Number(request.headers.get('content-length')||0);
  if(length>65536)throw new Error('PAYLOAD_TOO_LARGE');
  return request.json();
}
async function securityContext(request,env){
  const identity=await authenticateRequest(request,env);
  if(!identity.ok)return {ok:false,code:identity.code};
  const tenantId=tenantSelector(request);
  if(!tenantId)return {ok:false,code:'TENANT_REQUIRED'};
  const access=await authorizeTenant(env,identity,tenantId,'ai_use');
  if(!access.ok)return access;
  const quota=await enforceQuota(env,{tenantId:access.tenantId,userId:access.userId,capability:'chat'});
  if(!quota.ok)return quota;
  return {ok:true,identity,access,quota};
}
async function handleChat(request,env,id){
  if(!bool(env.AI_RUNTIME_ENABLED))return json({ok:false,code:'RUNTIME_DISABLED',message:'SakthiAI AI runtime is disabled by owner cost policy.',requestId:id},503);
  if(!env.AI)return json({ok:false,code:'AI_BINDING_MISSING',message:'Workers AI binding is not configured.',requestId:id},503);
  const security=await securityContext(request,env);
  if(!security.ok)return json({ok:false,code:security.code,message:'Verified identity, tenant access and quota controls are required before SakthiAI AI execution.',requestId:id},securityStatus(security.code),security.retryAfter?{'retry-after':String(security.retryAfter)}:{});
  let body;try{body=await readJson(request);}catch(error){const code=error.message;return json({ok:false,code,requestId:id},code==='PAYLOAD_TOO_LARGE'?413:400);}
  const prompt=String(body?.prompt||'').trim();
  if(!prompt)return json({ok:false,code:'PROMPT_REQUIRED',requestId:id},400);
  if(prompt.length>12000)return json({ok:false,code:'PROMPT_TOO_LARGE',requestId:id},413);
  const model=env.AI_MODEL||'@cf/meta/llama-3.1-8b-instruct-fp8-fast';
  const started=Date.now();
  const messages=[
    {role:'system',content:'You are SakthiAI. Be accurate, concise, transparent about uncertainty, never claim external actions you did not perform, and never request or expose secrets.'},
    {role:'user',content:prompt}
  ];
  try{
    const execution=await runChatModel(env,{model,messages,maxTokens:700,temperature:0.3,cacheable:false});
    if(!execution.ok){
      const status=admissionHttpStatus(execution.admission?.decision);
      return json({ok:false,code:execution.code,decision:execution.admission?.decision||'REJECT',message:'SakthiAI capacity policy did not admit this execution. No paid fallback was attempted.',requestId:id},status,admissionHeaders(execution));
    }
    const result=execution.result;
    const answer=result?.response||result?.result?.response||result?.text||'';
    if(!answer)return json({ok:false,code:'EMPTY_MODEL_RESPONSE',requestId:id,model},502);
    await recordUsage(env,{tenantId:security.access.tenantId,userId:security.access.userId,requestId:id,capability:'chat',provider:'cloudflare-workers-ai',model,costClass:'free',inputUnits:prompt.length,outputUnits:String(answer).length,latencyMs:Date.now()-started});
    return json({ok:true,answer,provider:'cloudflare-workers-ai',model,costPolicy:'free-first-fail-closed',admission:{decision:execution.admission?.decision,code:execution.admission?.code,maxTokens:execution.maxTokens,capacityScope:execution.capacityScope,globallyAuthoritative:false},requestId:id});
  }catch(error){
    await recordUsage(env,{tenantId:security.access.tenantId,userId:security.access.userId,requestId:id,capability:'chat',provider:'cloudflare-workers-ai',model,costClass:'free',inputUnits:prompt.length,outputUnits:0,latencyMs:Date.now()-started}).catch(()=>{});
    return json({ok:false,code:'AI_RUNTIME_ERROR',message:'The configured free-first runtime failed. No paid fallback was attempted.',requestId:id},502);
  }
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/api/v1/admission/status'){
      const id=requestId();const trace=createTraceContext(request,id);
      return finalizeResponse(json({ok:true,admission:admissionStatus(env),requestId:id}),trace,env);
    }
    if(request.method==='POST'&&url.pathname==='/api/v1/chat'){
      const id=requestId();const trace=createTraceContext(request,id);
      return finalizeResponse(await handleChat(request,env,id),trace,env);
    }
    return baseWorker.fetch(request,env,ctx);
  }
};
