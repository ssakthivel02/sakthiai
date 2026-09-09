import assert from 'node:assert/strict';
import {validateP3NonprodInputs,checkP3NonprodReadiness,P3_NONPROD_ACK} from './lib/p3-nonprod-preflight.mjs';

const base={endpoint:'https://p3-preview.example.com/api/v1/agents/external-proposals/evaluate',secret:'test-only-secret-0123456789abcdef',agentId:'p3-agent',tenantId:'p3-tenant',environment:'p3-preview',ack:P3_NONPROD_ACK};

assert.equal(validateP3NonprodInputs({...base,ack:''}).code,'P3_NONPROD_ACK_REQUIRED');
assert.equal(validateP3NonprodInputs({...base,environment:'production'}).code,'P3_PRODUCTION_ENVIRONMENT_FORBIDDEN');
assert.equal(validateP3NonprodInputs({...base,endpoint:'http://p3-preview.example.com/api/v1/agents/external-proposals/evaluate'}).code,'P3_HTTPS_REQUIRED');
assert.equal(validateP3NonprodInputs({...base,endpoint:'https://localhost/api/v1/agents/external-proposals/evaluate'}).code,'P3_LOCALHOST_NOT_REAL_EVIDENCE');
assert.equal(validateP3NonprodInputs({...base,secret:'short'}).code,'P3_SECRET_MISSING_OR_WEAK');
assert.equal(validateP3NonprodInputs(base).ok,true);

const goodContract={ok:true,contract:{version:'SAI-P2',phase:'P2_SIGNED_READ_ONLY_PROPOSAL_WITH_OPTIONAL_DURABLE_REPLAY',enabled:true,scopeConfigured:true,durableReplayStore:true,replayStoreState:'AVAILABLE',allowedActionClasses:['read_only'],requestedExecution:'dry_run',externalSideEffects:false,executorBound:false,allowedAgentCount:1,allowedTenantCount:1,nonceRetentionSeconds:3600}};
const fakeFetch=async()=>new Response(JSON.stringify(goodContract),{status:200,headers:{'content-type':'application/json'}});
let result=await checkP3NonprodReadiness(base,fakeFetch);
assert.equal(result.ok,true);
assert.equal(result.code,'P3_NONPROD_PREFLIGHT_PASS');
assert.equal(result.failed.length,0);
assert.equal(result.secretExposed,false);
assert.equal(JSON.stringify(result).includes(base.secret),false);
assert.equal(result.externalWritesPermitted,false);
assert.equal(result.productionReadyClaim,false);

for(const [field,value] of [['enabled',false],['scopeConfigured',false],['durableReplayStore',false],['replayStoreState','BINDING_MISSING'],['allowedActionClasses',['read_only','repository_write']],['requestedExecution','execute'],['externalSideEffects',true],['executorBound',true]]){
  const contract={...goodContract.contract,[field]:value};
  result=await checkP3NonprodReadiness(base,async()=>new Response(JSON.stringify({ok:true,contract}),{status:200,headers:{'content-type':'application/json'}}));
  assert.equal(result.ok,false,field);
  assert.equal(result.code,'P3_NONPROD_PREFLIGHT_FAILED',field);
  assert.ok(result.failed.length>=1,field);
}

result=await checkP3NonprodReadiness(base,async()=>new Response('{}',{status:503}));
assert.equal(result.code,'P3_CONTRACT_ENDPOINT_UNAVAILABLE');

console.log(JSON.stringify({marker:'SAKTHIAI_P3_NONPROD_PREFLIGHT_TEST_PASS',productionLabelBlocked:true,httpsRequired:true,localhostBlocked:true,durableReplayRequired:true,readOnlyDryRunRequired:true,executorMustBeUnbound:true,secretExposed:false},null,2));
