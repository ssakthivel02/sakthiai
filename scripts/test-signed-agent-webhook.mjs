import assert from 'node:assert/strict';
import {signedAgentWebhookContract,createSignedAgentWebhookSignature,evaluateSignedAgentWebhook} from '../src/signed-agent-webhook.js';
import {handleAgentApi} from '../src/agent-api.js';

const SECRET='test-only-shared-secret-0123456789abcdef';
const AGENT='external-agent-fixture';
const TENANT='tenant-fixture';
const NOW=Date.UTC(2026,8,9,10,30,0);
const TS=String(Math.floor(NOW/1000));
const URL='https://sakthiai.test/api/v1/agents/external-proposals/evaluate';

const env={
  AGENT_WEBHOOK_ENABLED:'true',
  AGENT_WEBHOOK_SHARED_SECRET:SECRET,
  AGENT_WEBHOOK_MAX_SKEW_SECONDS:'300',
  AGENT_WEBHOOK_ALLOWED_AGENTS:AGENT,
  AGENT_WEBHOOK_ALLOWED_TENANTS:TENANT
};
const proposal={
  taskId:'tsk_external_fixture',
  actionClass:'read_only',
  action:'Inspect the repository metadata and return a read-only evidence summary.',
  rationale:'Funding-readiness proof needs a signed external proposal without any write or external side effect.',
  target:{system:'github',resource:'ssakthivel02/sakthiai'},
  requestedExecution:'dry_run'
};

function bodyOf(value=proposal){return JSON.stringify(value);}
async function signedRequest({body=bodyOf(),timestamp=TS,agentId=AGENT,tenantId=TENANT,runId='run_ext_001',nonce='nonce_001',secret=SECRET,signatureOverride=null}={}){
  const signature=signatureOverride||await createSignedAgentWebhookSignature(secret,{timestamp,agentId,runId,tenantId,nonce,body});
  return {request:new Request(URL,{method:'POST',headers:{
    'content-type':'application/json',
    'x-sakthiai-agent-id':agentId,
    'x-sakthiai-agent-run-id':runId,
    'x-sakthiai-tenant':tenantId,
    'x-sakthiai-timestamp':timestamp,
    'x-sakthiai-nonce':nonce,
    'x-sakthiai-signature':signature
  },body}),signature};
}
async function req(options={}){return (await signedRequest(options)).request;}

const disabledContract=signedAgentWebhookContract({});
assert.equal(disabledContract.enabled,false);
assert.equal(disabledContract.scopeConfigured,false);
assert.deepEqual(disabledContract.allowedActionClasses,['read_only']);
assert.equal(disabledContract.externalSideEffects,false);
assert.equal(disabledContract.executorBound,false);
assert.equal(disabledContract.durableReplayStore,false);

let result=await evaluateSignedAgentWebhook(await req(),{...env,AGENT_WEBHOOK_ENABLED:'false'},NOW);
assert.equal(result.code,'AGENT_WEBHOOK_DISABLED');
assert.equal(result.status,503);

result=await evaluateSignedAgentWebhook(await req(),{...env,AGENT_WEBHOOK_SHARED_SECRET:'short'},NOW);
assert.equal(result.code,'AGENT_WEBHOOK_SECRET_MISSING_OR_WEAK');

result=await evaluateSignedAgentWebhook(await req(),{...env,AGENT_WEBHOOK_ALLOWED_AGENTS:''},NOW);
assert.equal(result.code,'AGENT_WEBHOOK_SCOPE_NOT_CONFIGURED');

result=await evaluateSignedAgentWebhook(new Request(URL,{method:'POST',headers:{'content-type':'application/json'},body:bodyOf()}),env,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_HEADERS_REQUIRED');
assert.equal(result.status,401);

result=await evaluateSignedAgentWebhook(await req({agentId:'not-allowed'}),env,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_AGENT_NOT_ALLOWED');
assert.equal(result.status,403);

result=await evaluateSignedAgentWebhook(await req({tenantId:'tenant-not-allowed'}),env,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_TENANT_NOT_ALLOWED');
assert.equal(result.status,403);

const stale=String(Math.floor(NOW/1000)-301);
result=await evaluateSignedAgentWebhook(await req({timestamp:stale}),env,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_TIMESTAMP_STALE');
assert.equal(result.status,401);

result=await evaluateSignedAgentWebhook(await req({signatureOverride:'v1='+'0'.repeat(64)}),env,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_SIGNATURE_INVALID');

const originalBody=bodyOf();
const originalSignature=await createSignedAgentWebhookSignature(SECRET,{timestamp:TS,agentId:AGENT,runId:'run_tamper',tenantId:TENANT,nonce:'nonce_tamper',body:originalBody});
const tamperedBody=bodyOf({...proposal,action:'Tampered after signing'});
result=await evaluateSignedAgentWebhook(await req({body:tamperedBody,runId:'run_tamper',nonce:'nonce_tamper',signatureOverride:originalSignature}),env,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_SIGNATURE_INVALID');

const validSigned=await signedRequest();
const valid=await evaluateSignedAgentWebhook(validSigned.request,env,NOW);
assert.equal(valid.ok,true);
assert.equal(valid.status,200);
assert.equal(valid.code,'AGENT_WEBHOOK_EVALUATED');
assert.equal(valid.transport.authenticated,true);
assert.equal(valid.transport.agentAllowed,true);
assert.equal(valid.transport.tenantAllowed,true);
assert.equal(valid.transport.signatureExposed,false);
assert.equal(valid.transport.secretExposed,false);
assert.equal(valid.externalSideEffects,false);
assert.equal(valid.executorBound,false);
assert.equal(valid.evaluation.decision,'DRY_RUN_READY');
assert.equal(valid.evaluation.executed,false);
assert.equal(valid.evaluation.sideEffects,false);
assert.equal(valid.evaluation.executorContract.id,'sandbox_code');
assert.equal(valid.evaluation.evidenceHash.length,64);
assert.equal(valid.replayProtection.durableNonceStore,false);
assert.equal(valid.replayProtection.idempotencyKey,`webhook:${AGENT}:nonce_001`);
const serializedValid=JSON.stringify(valid);
assert.equal(serializedValid.includes(SECRET),false);
assert.equal(serializedValid.includes(validSigned.signature),false);

// The same nonce within the freshness window produces the same deterministic evidence record.
// P1 truthfully reports that it does NOT yet persist used nonces to reject transport replay.
const replay=await evaluateSignedAgentWebhook(await req(),env,NOW);
assert.equal(replay.ok,true);
assert.equal(replay.replayProtection.durableNonceStore,false);
assert.equal(replay.replayProtection.idempotencyKey,valid.replayProtection.idempotencyKey);
assert.equal(replay.evaluation.evidenceHash,valid.evaluation.evidenceHash);

const writeBody=bodyOf({...proposal,actionClass:'repository_write'});
result=await evaluateSignedAgentWebhook(await req({body:writeBody,runId:'run_write',nonce:'nonce_write'}),env,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_P1_READ_ONLY_REQUIRED');
assert.equal(result.status,403);

const executeBody=bodyOf({...proposal,requestedExecution:'execute'});
result=await evaluateSignedAgentWebhook(await req({body:executeBody,runId:'run_execute',nonce:'nonce_execute'}),env,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_P1_EXECUTION_FORBIDDEN');
assert.equal(result.status,403);

// Route-level contract is public and exposes no secret.
let url=new URL('https://sakthiai.test/api/v1/agents/external-proposals/contract');
let response=await handleAgentApi(new Request(url),env,url,'req_contract');
assert.equal(response.status,200);
let routeBody=await response.json();
assert.equal(routeBody.ok,true);
assert.equal(routeBody.contract.phase,'P1_SIGNED_READ_ONLY_PROPOSAL_INTAKE');
assert.equal(routeBody.contract.scopeConfigured,true);
assert.equal(JSON.stringify(routeBody).includes(SECRET),false);

// Route-level valid signed request bypasses human Access-JWT by design but is HMAC + scope authenticated.
url=new URL(URL);
const routeTimestamp=String(Math.floor(Date.now()/1000));
const routeSigned=await signedRequest({timestamp:routeTimestamp,runId:'run_route',nonce:'nonce_route'});
response=await handleAgentApi(routeSigned.request,env,url,'req_eval');
assert.equal(response.status,200);
routeBody=await response.json();
assert.equal(routeBody.ok,true);
assert.equal(routeBody.code,'AGENT_WEBHOOK_EVALUATED');
assert.equal(routeBody.evaluation.decision,'DRY_RUN_READY');
assert.equal(routeBody.externalSideEffects,false);
assert.equal(routeBody.requestId,'req_eval');
const serializedRoute=JSON.stringify(routeBody);
assert.equal(serializedRoute.includes(SECRET),false);
assert.equal(serializedRoute.includes(routeSigned.signature),false);

console.log(JSON.stringify({
  marker:'SAKTHIAI_SIGNED_AGENT_WEBHOOK_P1_PASS',
  authentication:'HMAC_SHA256',
  scopeAllowlist:true,
  actionClass:'read_only',
  requestedExecution:'dry_run',
  validExternalHttpProposal:true,
  durableReplayStore:false,
  externalSideEffects:false,
  executorBound:false,
  decision:'P1_SIGNED_READ_ONLY_EXTERNAL_PROPOSAL_READY'
},null,2));
