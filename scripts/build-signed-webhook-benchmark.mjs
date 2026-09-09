import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createSignedAgentWebhookSignature,evaluateSignedAgentWebhook} from '../src/signed-agent-webhook.js';
import {createFakeWebhookReplayDb} from './test-helpers/fake-webhook-replay-db.mjs';

const TRIALS=30;
const SECRET='benchmark-only-shared-secret-0123456789abcdef';
const AGENT='benchmark-fixture-agent';
const TENANT='benchmark-tenant';
const NOW=Date.UTC(2026,8,9,11,30,0);
const TS=String(Math.floor(NOW/1000));
const ENDPOINT='https://sakthiai.test/api/v1/agents/external-proposals/evaluate';
const db=createFakeWebhookReplayDb();
const env={
  AGENT_WEBHOOK_ENABLED:'true',
  AGENT_WEBHOOK_SHARED_SECRET:SECRET,
  AGENT_WEBHOOK_MAX_SKEW_SECONDS:'300',
  AGENT_WEBHOOK_ALLOWED_AGENTS:AGENT,
  AGENT_WEBHOOK_ALLOWED_TENANTS:TENANT,
  AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED:'true',
  AGENT_WEBHOOK_NONCE_RETENTION_SECONDS:'3600',
  DB:db
};

function pct(values,p){
  const sorted=[...values].sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const idx=Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1));
  return Number(sorted[idx].toFixed(3));
}
async function makeRequest(i){
  const nonce=`bench-nonce-${String(i).padStart(3,'0')}`;
  const runId=`bench-run-${String(i).padStart(3,'0')}`;
  const body=JSON.stringify({
    taskId:`tsk_bench_${i}`,
    actionClass:'read_only',
    action:`Inspect benchmark fixture ${i} and return a read-only evidence summary.`,
    rationale:'Deterministic CI benchmark for signed proposal authentication, replay rejection and evidence generation.',
    target:{system:'fixture',resource:`resource-${i}`},
    requestedExecution:'dry_run'
  });
  const signature=await createSignedAgentWebhookSignature(SECRET,{timestamp:TS,agentId:AGENT,runId,tenantId:TENANT,nonce,body});
  return new Request(ENDPOINT,{method:'POST',headers:{
    'content-type':'application/json',
    'x-sakthiai-agent-id':AGENT,
    'x-sakthiai-agent-run-id':runId,
    'x-sakthiai-tenant':TENANT,
    'x-sakthiai-timestamp':TS,
    'x-sakthiai-nonce':nonce,
    'x-sakthiai-signature':signature
  },body});
}

const acceptanceLatencyMs=[];
const replayLatencyMs=[];
const runs=[];
let accepted=0,replayRejected=0;
for(let i=1;i<=TRIALS;i++){
  const start=performance.now();
  const first=await evaluateSignedAgentWebhook(await makeRequest(i),env,NOW);
  const acceptLatency=performance.now()-start;
  acceptanceLatencyMs.push(acceptLatency);
  if(first.ok&&first.code==='AGENT_WEBHOOK_EVALUATED'&&first.replayProtection?.durableNonceStore===true&&first.externalSideEffects===false)accepted++;

  const replayStart=performance.now();
  const second=await evaluateSignedAgentWebhook(await makeRequest(i),env,NOW);
  const replayLatency=performance.now()-replayStart;
  replayLatencyMs.push(replayLatency);
  if(!second.ok&&second.status===409&&second.code==='AGENT_WEBHOOK_REPLAY_DETECTED'&&second.externalSideEffects===false)replayRejected++;

  runs.push({
    trial:i,
    accepted:first.ok===true,
    firstCode:first.code,
    firstDecision:first.evaluation?.decision||null,
    evidenceHash:first.evaluation?.evidenceHash||null,
    replayRejected:second.code==='AGENT_WEBHOOK_REPLAY_DETECTED',
    replayCode:second.code,
    acceptLatencyMs:Number(acceptLatency.toFixed(3)),
    replayLatencyMs:Number(replayLatency.toFixed(3)),
    sideEffects:false
  });
}

if(accepted!==TRIALS)throw new Error(`BENCHMARK_ACCEPTANCE_INCOMPLETE:${accepted}/${TRIALS}`);
if(replayRejected!==TRIALS)throw new Error(`BENCHMARK_REPLAY_REJECTION_INCOMPLETE:${replayRejected}/${TRIALS}`);
if(new Set(runs.map(x=>x.evidenceHash)).size!==TRIALS)throw new Error('BENCHMARK_EVIDENCE_HASH_COLLISION');

const result={
  schema:'sakthiai.funding-readiness.signed-webhook-benchmark.v1',
  generatedAt:new Date().toISOString(),
  benchmarkMode:'CI_DETERMINISTIC_TRANSPORT',
  realExternalAgentRuns:false,
  providerSpecificAdapter:false,
  durableReplayStore:'FAKE_D1_CONTRACT_MATCHING_INSERT_OR_IGNORE',
  trials:TRIALS,
  uniqueAccepted:accepted,
  replayAttempts:TRIALS,
  replayRejected,
  acceptanceRate:accepted/TRIALS,
  replayRejectionRate:replayRejected/TRIALS,
  metrics:{
    acceptanceLatencyMs:{p50:pct(acceptanceLatencyMs,50),p95:pct(acceptanceLatencyMs,95),max:Number(Math.max(...acceptanceLatencyMs).toFixed(3))},
    replayLatencyMs:{p50:pct(replayLatencyMs,50),p95:pct(replayLatencyMs,95),max:Number(Math.max(...replayLatencyMs).toFixed(3))}
  },
  externalSideEffects:false,
  executorBound:false,
  productionReady:false,
  limitations:[
    'CI timings are not production latency benchmarks.',
    'The benchmark uses a deterministic fake D1 adapter implementing the same atomic INSERT OR IGNORE contract; migration tests separately validate the SQLite uniqueness constraint.',
    'No live Codex, Claude Code, Gemini or other vendor-specific external agent is used.',
    'No repository, cloud, messaging, deployment or destructive side effect is enabled.'
  ],
  runs
};

await fs.mkdir('evidence/funding-readiness',{recursive:true});
await fs.writeFile('evidence/funding-readiness/signed-webhook-p2-benchmark.json',JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify({
  marker:'SAKTHIAI_SIGNED_WEBHOOK_P2_BENCHMARK_PASS',
  trials:TRIALS,
  uniqueAccepted:accepted,
  replayRejected,
  realExternalAgentRuns:false,
  externalSideEffects:false,
  artifact:'evidence/funding-readiness/signed-webhook-p2-benchmark.json'
},null,2));
