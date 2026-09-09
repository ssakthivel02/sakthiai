import {evaluateTrustedActionProposal} from './trusted-action-gateway.js';
import {webhookReplayStoreState,consumeWebhookNonce} from './webhook-replay-store.js';

const VERSION='SAI-P2-SIGNED-AGENT-WEBHOOK-2';
const MAX_BODY_BYTES=65536;

function enabled(env,name){return String(env?.[name]||'').toLowerCase()==='true';}
function text(value,max){const out=String(value??'').trim();return out&&out.length<=max?out:null;}
function list(value,maxItems=100){return String(value||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,maxItems);}
function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function constantTimeEqualHex(a,b){
  const aa=String(a||'').toLowerCase(),bb=String(b||'').toLowerCase();
  if(aa.length!==bb.length||aa.length===0)return false;
  let diff=0;for(let i=0;i<aa.length;i++)diff|=aa.charCodeAt(i)^bb.charCodeAt(i);return diff===0;
}
async function hmacHex(secret,message){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)));
}
function signatureBase({timestamp,agentId,runId,tenantId,nonce,body}){
  return `${timestamp}\n${agentId}\n${runId}\n${tenantId}\n${nonce}\n${body}`;
}
function maxSkewSeconds(env){const n=Number(env?.AGENT_WEBHOOK_MAX_SKEW_SECONDS||300);return Number.isFinite(n)&&n>=30&&n<=900?Math.floor(n):300;}
function scope(env){return {agents:list(env?.AGENT_WEBHOOK_ALLOWED_AGENTS),tenants:list(env?.AGENT_WEBHOOK_ALLOWED_TENANTS)};}

export function signedAgentWebhookContract(env={}){
  const allowed=scope(env);
  const replay=webhookReplayStoreState(env);
  return {
    version:VERSION,
    enabled:enabled(env,'AGENT_WEBHOOK_ENABLED'),
    phase:'P2_SIGNED_READ_ONLY_PROPOSAL_WITH_OPTIONAL_DURABLE_REPLAY',
    authentication:'HMAC_SHA256_SHARED_SECRET',
    secretBinding:'AGENT_WEBHOOK_SHARED_SECRET',
    scopeBindings:['AGENT_WEBHOOK_ALLOWED_AGENTS','AGENT_WEBHOOK_ALLOWED_TENANTS'],
    scopeConfigured:allowed.agents.length>0&&allowed.tenants.length>0,
    allowedAgentCount:allowed.agents.length,
    allowedTenantCount:allowed.tenants.length,
    requiredHeaders:['x-sakthiai-agent-id','x-sakthiai-agent-run-id','x-sakthiai-tenant','x-sakthiai-timestamp','x-sakthiai-nonce','x-sakthiai-signature'],
    signatureFormat:'v1=<hex-hmac-sha256>',
    signatureInput:'timestamp\\nagentId\\nrunId\\ntenantId\\nnonce\\nrawBody',
    maxSkewSeconds:maxSkewSeconds(env),
    allowedActionClasses:['read_only'],
    requestedExecution:'dry_run',
    externalSideEffects:false,
    executorBound:false,
    durableReplayStore:replay.durable,
    replayStoreState:replay.state,
    replayStoreBinding:replay.binding,
    nonceRetentionSeconds:replay.retentionSeconds,
    replayBoundary:replay.durable?'Single-use nonce is enforced durably by the D1 replay ledger before gateway evaluation.':'Timestamp + nonce + deterministic idempotency are enforced, but durable nonce consumption is disabled.'
  };
}

export async function createSignedAgentWebhookSignature(secret,{timestamp,agentId,runId,tenantId,nonce,body}){
  const safeSecret=text(secret,4096);if(!safeSecret||safeSecret.length<32)throw new Error('AGENT_WEBHOOK_SECRET_WEAK');
  return `v1=${await hmacHex(safeSecret,signatureBase({timestamp,agentId,runId,tenantId,nonce,body}))}`;
}

export async function evaluateSignedAgentWebhook(request,env={},nowMs=Date.now()){
  if(!enabled(env,'AGENT_WEBHOOK_ENABLED'))return {ok:false,status:503,code:'AGENT_WEBHOOK_DISABLED'};
  const secret=text(env.AGENT_WEBHOOK_SHARED_SECRET,4096);
  if(!secret||secret.length<32)return {ok:false,status:503,code:'AGENT_WEBHOOK_SECRET_MISSING_OR_WEAK'};
  const allowed=scope(env);
  if(!allowed.agents.length||!allowed.tenants.length)return {ok:false,status:503,code:'AGENT_WEBHOOK_SCOPE_NOT_CONFIGURED'};
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))return {ok:false,status:400,code:'CONTENT_TYPE_REQUIRED'};
  const length=Number(request.headers.get('content-length')||0);
  if(length>MAX_BODY_BYTES)return {ok:false,status:413,code:'PAYLOAD_TOO_LARGE'};

  const agentId=text(request.headers.get('x-sakthiai-agent-id'),120);
  const runId=text(request.headers.get('x-sakthiai-agent-run-id'),200);
  const tenantId=text(request.headers.get('x-sakthiai-tenant'),160);
  const timestampRaw=text(request.headers.get('x-sakthiai-timestamp'),32);
  const nonce=text(request.headers.get('x-sakthiai-nonce'),160);
  const signature=text(request.headers.get('x-sakthiai-signature'),80);
  if(!agentId||!runId||!tenantId||!timestampRaw||!nonce||!signature)return {ok:false,status:401,code:'AGENT_WEBHOOK_HEADERS_REQUIRED'};
  if(!allowed.agents.includes(agentId))return {ok:false,status:403,code:'AGENT_WEBHOOK_AGENT_NOT_ALLOWED'};
  if(!allowed.tenants.includes(tenantId))return {ok:false,status:403,code:'AGENT_WEBHOOK_TENANT_NOT_ALLOWED'};
  if(!/^v1=[0-9a-fA-F]{64}$/.test(signature))return {ok:false,status:401,code:'AGENT_WEBHOOK_SIGNATURE_FORMAT_INVALID'};
  const timestamp=Number(timestampRaw);
  if(!Number.isFinite(timestamp)||timestamp<=0)return {ok:false,status:401,code:'AGENT_WEBHOOK_TIMESTAMP_INVALID'};
  const skew=Math.abs(Math.floor(nowMs/1000)-Math.floor(timestamp));
  if(skew>maxSkewSeconds(env))return {ok:false,status:401,code:'AGENT_WEBHOOK_TIMESTAMP_STALE',skewSeconds:skew};

  let rawBody;
  try{rawBody=await request.text();}catch{return {ok:false,status:400,code:'AGENT_WEBHOOK_BODY_READ_FAILED'};}
  if(!rawBody||new TextEncoder().encode(rawBody).length>MAX_BODY_BYTES)return {ok:false,status:rawBody?413:400,code:rawBody?'PAYLOAD_TOO_LARGE':'AGENT_WEBHOOK_BODY_REQUIRED'};
  const expected=await createSignedAgentWebhookSignature(secret,{timestamp:timestampRaw,agentId,runId,tenantId,nonce,body:rawBody});
  if(!constantTimeEqualHex(signature.slice(3),expected.slice(3)))return {ok:false,status:401,code:'AGENT_WEBHOOK_SIGNATURE_INVALID'};

  let body;
  try{body=JSON.parse(rawBody);}catch{return {ok:false,status:400,code:'AGENT_WEBHOOK_JSON_INVALID'};}
  const actionClass=String(body?.actionClass||'read_only').trim().toLowerCase();
  if(actionClass!=='read_only')return {ok:false,status:403,code:'AGENT_WEBHOOK_P1_READ_ONLY_REQUIRED'};
  if(String(body?.requestedExecution||'dry_run').trim().toLowerCase()!=='dry_run')return {ok:false,status:403,code:'AGENT_WEBHOOK_P1_EXECUTION_FORBIDDEN'};

  const replayState=webhookReplayStoreState(env);
  let nonceReceipt=null;
  if(replayState.enabled){
    nonceReceipt=await consumeWebhookNonce(env,{tenantId,agentId,runId,nonce,requestTimestamp:timestampRaw,rawBody,nowMs});
    if(!nonceReceipt.ok){
      return {
        ok:false,status:nonceReceipt.status||503,code:nonceReceipt.code,version:VERSION,
        transport:{authenticated:true,scheme:'HMAC_SHA256',agentId,runId,tenantId,timestamp:Number(timestampRaw),skewSeconds:skew,agentAllowed:true,tenantAllowed:true,signatureExposed:false,secretExposed:false},
        replayProtection:{durableNonceStore:replayState.durable,replayStoreState:replayState.state,replayDetected:nonceReceipt.code==='AGENT_WEBHOOK_REPLAY_DETECTED',nonceSha256:nonceReceipt.nonceSha256||null,bodySha256:nonceReceipt.bodySha256||null,expiresAt:nonceReceipt.expiresAt||null},
        externalSideEffects:false,
        executorBound:false
      };
    }
  }

  const evaluation=await evaluateTrustedActionProposal({
    sourceAgent:agentId,
    sourceRunId:runId,
    taskId:body?.taskId,
    tenantId,
    actionClass:'read_only',
    action:body?.action,
    rationale:body?.rationale,
    target:body?.target,
    idempotencyKey:`webhook:${agentId}:${nonce}`,
    verifierId:'signed-webhook-transport-v1',
    verifierState:'passed',
    evidenceRequirements:['signed_request','transport_headers','proposal_payload','policy_decision'],
    rollbackPlan:'Read-only signed webhook performs no external write. Discard the evaluation/evidence receipt if verification fails.',
    requestedExecution:'dry_run'
  },{externalActionsEnabled:false,executorBindingEnabled:false,executorBound:false});

  return {
    ok:true,status:200,code:'AGENT_WEBHOOK_EVALUATED',version:VERSION,
    transport:{authenticated:true,scheme:'HMAC_SHA256',agentId,runId,tenantId,timestamp:Number(timestampRaw),skewSeconds:skew,agentAllowed:true,tenantAllowed:true,signatureExposed:false,secretExposed:false},
    replayProtection:{
      durableNonceStore:replayState.durable,
      replayStoreState:replayState.state,
      consumed:Boolean(nonceReceipt?.ok),
      nonceSha256:nonceReceipt?.nonceSha256||null,
      bodySha256:nonceReceipt?.bodySha256||null,
      expiresAt:nonceReceipt?.expiresAt||null,
      idempotencyKey:`webhook:${agentId}:${nonce}`,
      note:replayState.durable?'Nonce consumed once in durable D1 replay ledger before evaluation.':'Durable replay ledger is disabled; timestamp and nonce-derived idempotency remain transport-only controls.'
    },
    evaluation,
    externalSideEffects:false,
    executorBound:false
  };
}
