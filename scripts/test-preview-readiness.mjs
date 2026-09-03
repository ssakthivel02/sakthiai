import assert from 'node:assert/strict';
import {createTraceContext,readinessSnapshot,costBoundarySnapshot,observabilitySnapshot,finalizeResponse} from '../src/observability.js';

const safeEnv={
  PAID_PROVIDERS_ENABLED:'false',AI_RUNTIME_ENABLED:'false',PERSISTENCE_ENABLED:'false',IDENTITY_RUNTIME_ENABLED:'false',QUOTA_RUNTIME_ENABLED:'false',
  AGENT_CONTROL_ENABLED:'false',AGENT_EXECUTOR_BINDINGS_ENABLED:'false',AGENT_EXTERNAL_ACTIONS_ENABLED:'false',AGENT_VERIFIER_RUNTIME_ENABLED:'false',
  PREVIEW_DEPLOY_ENABLED:'false',OBSERVABILITY_RUNTIME_ENABLED:'false',QUOTA_WINDOW_SECONDS:'60',QUOTA_REQUESTS_PER_WINDOW:'30',QUOTA_DAILY_AI_REQUESTS:'100'
};
const readiness=readinessSnapshot(safeEnv);
assert.equal(readiness.state,'SOURCE_PREVIEW_SAFE');
assert.equal(readiness.previewSafeConfiguration,true);
assert.equal(readiness.productionReady,false);
assert.equal(readiness.deploymentPerformed,false);
assert.equal(readiness.browserQaPerformed,false);
assert.ok(Object.values(readiness.guards).every(Boolean));

assert.equal(readinessSnapshot({...safeEnv,PAID_PROVIDERS_ENABLED:'true'}).previewSafeConfiguration,false);
assert.equal(readinessSnapshot({...safeEnv,AGENT_EXTERNAL_ACTIONS_ENABLED:'true'}).previewSafeConfiguration,false);
assert.equal(readinessSnapshot({...safeEnv,AGENT_EXECUTOR_BINDINGS_ENABLED:'true'}).previewSafeConfiguration,false);
assert.equal(readinessSnapshot({...safeEnv,PREVIEW_DEPLOY_ENABLED:'true'}).previewSafeConfiguration,false);
assert.equal(readinessSnapshot({...safeEnv,DB:{}}).previewSafeConfiguration,false);

const cost=costBoundarySnapshot(safeEnv);
assert.equal(cost.mode,'FREE_FIRST_FAIL_CLOSED');
assert.equal(cost.paidProvidersEnabled,false);
assert.equal(cost.paidOverageAllowed,false);
assert.equal(cost.publicUsageTotalsExposed,false);
assert.equal(cost.tenantUsageDetailsExposed,false);
assert.deepEqual(cost.resourceBindings,{d1:false,r2:false,aiSearch:false});
assert.equal(cost.quotaDefaults.requestsPerWindow,30);

const obs=observabilitySnapshot(safeEnv);
assert.equal(obs.runtimeLoggingEnabled,false);
assert.equal(obs.requestCorrelation,true);
assert.equal(obs.rawPromptLogging,false);
assert.equal(obs.rawIdentityLogging,false);
assert.equal(obs.rawSecretLogging,false);
for(const forbidden of ['prompt','authorization','cookie','jwt','tenantUsage','userIdentity'])assert.ok(obs.forbiddenPublicFields.includes(forbidden));

const request=new Request('https://sakthiai.example/api/v1/readiness?secret=must-not-appear',{headers:{traceparent:'00-0123456789abcdef0123456789abcdef-0123456789abcdef-01'}});
const ctx=createTraceContext(request,'sai_test_request');
assert.equal(ctx.traceId,'0123456789abcdef0123456789abcdef');
assert.equal(ctx.route,'/api/v1/readiness');
assert.equal(ctx.route.includes('secret'),false);
const finalized=finalizeResponse(new Response('{"ok":true}',{status:200,headers:{'content-type':'application/json'}}),ctx,safeEnv);
assert.equal(finalized.headers.get('x-sakthiai-request-id'),'sai_test_request');
assert.equal(finalized.headers.get('x-sakthiai-trace-id'),ctx.traceId);
assert.match(finalized.headers.get('server-timing')||'',/^sakthiai;dur=\d+$/);

console.log('SAKTHIAI_V6_PREVIEW_READINESS_TEST_PASS');
