import assert from 'node:assert/strict';
import {webhookReplayStoreState,consumeWebhookNonce,purgeExpiredWebhookNonces} from '../src/webhook-replay-store.js';
import {createSignedAgentWebhookSignature,evaluateSignedAgentWebhook,signedAgentWebhookContract} from '../src/signed-agent-webhook.js';
import {createFakeWebhookReplayDb} from './test-helpers/fake-webhook-replay-db.mjs';

const SECRET='test-only-shared-secret-0123456789abcdef';
const AGENT='external-agent-fixture';
const TENANT='tenant-fixture';
const NOW=Date.UTC(2026,8,9,11,0,0);
const TS=String(Math.floor(NOW/1000));
const ENDPOINT='https://sakthiai.test/api/v1/agents/external-proposals/evaluate';

const baseEnv={
  AGENT_WEBHOOK_ENABLED:'true',
  AGENT_WEBHOOK_SHARED_SECRET:SECRET,
  AGENT_WEBHOOK_MAX_SKEW_SECONDS:'300',
  AGENT_WEBHOOK_ALLOWED_AGENTS:AGENT,
  AGENT_WEBHOOK_ALLOWED_TENANTS:TENANT,
  AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED:'true',
  AGENT_WEBHOOK_NONCE_RETENTION_SECONDS:'3600'
};

const proposal={
  taskId:'tsk_replay_fixture',
  actionClass:'read_only',
  action:'Inspect repository metadata and return read-only evidence.',
  rationale:'Validate durable replay protection without external side effects.',
  target:{system:'github',resource:'ssakthivel02/sakthiai'},
  requestedExecution:'dry_run'
};

async function signedRequest({nonce='nonce-001',runId='run-001',body=JSON.stringify(proposal),timestamp=TS,agentId=AGENT,tenantId=TENANT,secret=SECRET,signatureOverride=null}={}){
  const signature=signatureOverride||await createSignedAgentWebhookSignature(secret,{timestamp,agentId,runId,tenantId,nonce,body});
  return new Request(ENDPOINT,{method:'POST',headers:{
    'content-type':'application/json',
    'x-sakthiai-agent-id':agentId,
    'x-sakthiai-agent-run-id':runId,
    'x-sakthiai-tenant':tenantId,
    'x-sakthiai-timestamp':timestamp,
    'x-sakthiai-nonce':nonce,
    'x-sakthiai-signature':signature
  },body});
}

const disabled=webhookReplayStoreState({});
assert.equal(disabled.state,'DISABLED');
assert.equal(disabled.durable,false);
const missing=webhookReplayStoreState({AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED:'true'});
assert.equal(missing.state,'BINDING_MISSING');

const db=createFakeWebhookReplayDb();
const env={...baseEnv,DB:db};
const available=webhookReplayStoreState(env);
assert.equal(available.state,'AVAILABLE');
assert.equal(available.durable,true);
assert.equal(available.storesRawNonce,false);
assert.equal(available.storesRawBody,false);

let direct=await consumeWebhookNonce(env,{tenantId:TENANT,agentId:AGENT,runId:'direct-1',nonce:'nonce-direct',requestTimestamp:TS,rawBody:'{"x":1}',nowMs:NOW});
assert.equal(direct.ok,true);
assert.equal(direct.code,'AGENT_WEBHOOK_NONCE_CONSUMED');
assert.equal(direct.nonceSha256.length,64);
assert.equal(direct.bodySha256.length,64);
assert.equal([...db.rows.values()][0].nonceSha256,'undefined'===typeof direct.nonceSha256?null:direct.nonceSha256);
assert.equal(JSON.stringify([...db.rows.values()]).includes('nonce-direct'),false);
assert.equal(JSON.stringify([...db.rows.values()]).includes('{"x":1}'),false);

direct=await consumeWebhookNonce(env,{tenantId:TENANT,agentId:AGENT,runId:'direct-2',nonce:'nonce-direct',requestTimestamp:TS,rawBody:'{"x":1}',nowMs:NOW});
assert.equal(direct.ok,false);
assert.equal(direct.status,409);
assert.equal(direct.code,'AGENT_WEBHOOK_REPLAY_DETECTED');

// Same nonce is allowed for a different tenant because uniqueness is tenant scoped.
const otherTenantDb=createFakeWebhookReplayDb();
const otherEnv={...baseEnv,AGENT_WEBHOOK_ALLOWED_TENANTS:`${TENANT},tenant-two`,DB:otherTenantDb};
let other=await consumeWebhookNonce(otherEnv,{tenantId:TENANT,agentId:AGENT,runId:'a',nonce:'shared',requestTimestamp:TS,rawBody:'{}',nowMs:NOW});
assert.equal(other.ok,true);
other=await consumeWebhookNonce(otherEnv,{tenantId:'tenant-two',agentId:AGENT,runId:'b',nonce:'shared',requestTimestamp:TS,rawBody:'{}',nowMs:NOW});
assert.equal(other.ok,true);
assert.equal(otherTenantDb.rows.size,2);

// Durable store failure is fail-closed.
const failingEnv={...baseEnv,DB:createFakeWebhookReplayDb({failWrites:true})};
const failedStore=await consumeWebhookNonce(failingEnv,{tenantId:TENANT,agentId:AGENT,runId:'fail',nonce:'nonce-fail',requestTimestamp:TS,rawBody:'{}',nowMs:NOW});
assert.equal(failedStore.ok,false);
assert.equal(failedStore.code,'AGENT_WEBHOOK_REPLAY_STORE_ERROR');

// Route-level signed request is accepted once and replayed request is rejected before gateway evaluation.
const routeDb=createFakeWebhookReplayDb();
const routeEnv={...baseEnv,DB:routeDb};
let result=await evaluateSignedAgentWebhook(await signedRequest({nonce:'route-once',runId:'route-1'}),routeEnv,NOW);
assert.equal(result.ok,true);
assert.equal(result.code,'AGENT_WEBHOOK_EVALUATED');
assert.equal(result.replayProtection.durableNonceStore,true);
assert.equal(result.replayProtection.replayStoreState,'AVAILABLE');
assert.equal(result.replayProtection.consumed,true);
assert.equal(result.evaluation.decision,'DRY_RUN_READY');
assert.equal(result.externalSideEffects,false);
assert.equal(result.executorBound,false);

result=await evaluateSignedAgentWebhook(await signedRequest({nonce:'route-once',runId:'route-1'}),routeEnv,NOW);
assert.equal(result.ok,false);
assert.equal(result.status,409);
assert.equal(result.code,'AGENT_WEBHOOK_REPLAY_DETECTED');
assert.equal(result.replayProtection.durableNonceStore,true);
assert.equal(result.replayProtection.replayDetected,true);
assert.equal(result.externalSideEffects,false);

// Invalid signature never consumes a nonce.
const invalidDb=createFakeWebhookReplayDb();
const invalidEnv={...baseEnv,DB:invalidDb};
result=await evaluateSignedAgentWebhook(await signedRequest({nonce:'bad-sig',signatureOverride:'v1='+'0'.repeat(64)}),invalidEnv,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_SIGNATURE_INVALID');
assert.equal(invalidDb.rows.size,0);

// Write/execute proposals are rejected before nonce consumption.
const writeDb=createFakeWebhookReplayDb();
const writeEnv={...baseEnv,DB:writeDb};
const writeBody=JSON.stringify({...proposal,actionClass:'repository_write'});
result=await evaluateSignedAgentWebhook(await signedRequest({nonce:'write-no-consume',body:writeBody,runId:'write'}),writeEnv,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_P1_READ_ONLY_REQUIRED');
assert.equal(writeDb.rows.size,0);
const executeBody=JSON.stringify({...proposal,requestedExecution:'execute'});
result=await evaluateSignedAgentWebhook(await signedRequest({nonce:'execute-no-consume',body:executeBody,runId:'execute'}),writeEnv,NOW);
assert.equal(result.code,'AGENT_WEBHOOK_P1_EXECUTION_FORBIDDEN');
assert.equal(writeDb.rows.size,0);

// If durable replay is deliberately enabled without a DB binding, evaluation fails closed.
const noDbEnv={...baseEnv};
result=await evaluateSignedAgentWebhook(await signedRequest({nonce:'missing-db',runId:'missing-db'}),noDbEnv,NOW);
assert.equal(result.ok,false);
assert.equal(result.code,'AGENT_WEBHOOK_REPLAY_STORE_BINDING_MISSING');
assert.equal(result.status,503);

// Purge removes only expired nonce rows.
const purgeDb=createFakeWebhookReplayDb();
const purgeEnv={...baseEnv,AGENT_WEBHOOK_NONCE_RETENTION_SECONDS:'300',DB:purgeDb};
await consumeWebhookNonce(purgeEnv,{tenantId:TENANT,agentId:AGENT,runId:'old',nonce:'old',requestTimestamp:TS,rawBody:'{}',nowMs:NOW-600000});
await consumeWebhookNonce(purgeEnv,{tenantId:TENANT,agentId:AGENT,runId:'fresh',nonce:'fresh',requestTimestamp:TS,rawBody:'{}',nowMs:NOW});
const purged=await purgeExpiredWebhookNonces(purgeEnv,NOW);
assert.equal(purged.ok,true);
assert.equal(purged.deleted,1);
assert.equal(purgeDb.rows.size,1);

const contract=signedAgentWebhookContract(routeEnv);
assert.equal(contract.durableReplayStore,true);
assert.equal(contract.replayStoreState,'AVAILABLE');
assert.equal(contract.externalSideEffects,false);
assert.equal(contract.executorBound,false);

console.log(JSON.stringify({
  marker:'SAKTHIAI_WEBHOOK_DURABLE_REPLAY_P2_PASS',
  replayStore:'D1_CONTRACT',
  singleUseNonce:true,
  duplicateRejected:true,
  failClosedWithoutBinding:true,
  rawNonceStored:false,
  rawBodyStored:false,
  externalSideEffects:false,
  executorBound:false,
  productionReady:false
},null,2));
