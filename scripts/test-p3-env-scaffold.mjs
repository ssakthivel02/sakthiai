import assert from 'node:assert/strict';
import {buildP3EvidenceConfig,p3WranglerCommands} from './lib/p3-env-config.mjs';
import {validateP3Evidence} from './lib/p3-evidence-validator.mjs';

const base={ack:'NON_PRODUCTION_ONLY',environment:'funding-evidence-staging',databaseName:'sakthiai-p3-evidence-db',databaseId:'123e4567-e89b-42d3-a456-426614174000',agentId:'funding-evidence-client',tenantId:'tenant-funding-evidence'};
const built=buildP3EvidenceConfig(base);
assert.equal(built.config.vars.AGENT_WEBHOOK_ENABLED,'true');
assert.equal(built.config.vars.AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED,'true');
assert.equal(built.config.vars.AGENT_EXECUTOR_BINDINGS_ENABLED,'false');
assert.equal(built.config.vars.AGENT_EXTERNAL_ACTIONS_ENABLED,'false');
assert.equal(built.config.vars.PREVIEW_DEPLOY_ENABLED,'false');
assert.equal(built.config.d1_databases[0].binding,'DB');
assert.equal(built.config.d1_databases[0].migrations_dir,'migrations');
assert.equal(JSON.stringify(built.config).includes('AGENT_WEBHOOK_SHARED_SECRET'),false);
assert.equal(built.summary.secretEmbedded,false);
assert.equal(p3WranglerCommands({databaseName:base.databaseName}).length,7);

for(const bad of ['prod','production','live','p3-production-evidence']){
  assert.throws(()=>buildP3EvidenceConfig({...base,environment:bad}),/P3_PRODUCTION_LABEL_REJECTED/);
}
assert.throws(()=>buildP3EvidenceConfig({...base,ack:'YES'}),/P3_NONPROD_ACK_INVALID/);
assert.throws(()=>buildP3EvidenceConfig({...base,databaseId:'not-a-uuid'}),/P3_D1_DATABASE_ID_INVALID/);

function hash(i){return i.toString(16).padStart(64,'0');}
const trials=20;
const report={
  schema:'sakthiai.funding-readiness.real-client-benchmark.v1',
  evidenceMode:'EXTERNAL_HTTPS_CLIENT',
  client:{endpoint:'https://sakthiai-p3-evidence.example.workers.dev/api/v1/agents/external-proposals/evaluate'},
  trials,accepted:trials,failed:0,checkReplay:true,replayAttempts:trials,replayRejected:trials,uniqueEvidenceHashes:trials,
  externalSideEffectsExpected:false,executorBoundExpected:false,productionReadyClaim:false,
  claimGate:{qualifiesAsRealExternalClientEvidence:true,qualifiesAsDurableReplayEvidence:true,vendorSpecificAgentClaim:false},
  runs:Array.from({length:trials},(_,x)=>({trial:x+1,accepted:true,status:200,code:'AGENT_WEBHOOK_EVALUATED',decision:'DRY_RUN_READY',evidenceHash:hash(x+1),replayChecked:true,replayRejected:true,replayStatus:409,replayCode:'AGENT_WEBHOOK_REPLAY_DETECTED',externalSideEffects:false}))
};
const validated=validateP3Evidence(report);
assert.equal(validated.ok,true);
assert.equal(validated.trials,20);
assert.equal(validated.productionReady,false);
assert.match(validated.truthfulFundingClaim,/20 signed proposals/);

assert.equal(validateP3Evidence({...report,client:{endpoint:'http://127.0.0.1:8787/x'}}).code,'P3_EVIDENCE_HTTPS_REQUIRED');
assert.equal(validateP3Evidence({...report,client:{endpoint:'https://localhost/x'}}).code,'P3_EVIDENCE_LOCALHOST_REJECTED');
assert.equal(validateP3Evidence({...report,replayRejected:19}).code,'P3_EVIDENCE_REPLAY_GATE_FAILED');
assert.equal(validateP3Evidence({...report,claimGate:{...report.claimGate,vendorSpecificAgentClaim:true}}).code,'P3_VENDOR_SPECIFIC_CLAIM_FORBIDDEN');
assert.equal(validateP3Evidence({...report,productionReadyClaim:true}).code,'P3_EVIDENCE_SAFETY_BOUNDARY_INVALID');

console.log(JSON.stringify({marker:'SAKTHIAI_P3_ENV_SCAFFOLD_TEST_PASS',configSecretEmbedded:false,externalWritesEnabled:false,evidenceClaimGate:true,productionReady:false},null,2));
