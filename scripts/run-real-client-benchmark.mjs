#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {sendSignedExternalProposal,sanitizedClientConfig} from './lib/signed-webhook-client.mjs';

function arg(name,fallback=null){const i=process.argv.indexOf(`--${name}`);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;}
function flag(name){return process.argv.includes(`--${name}`);}
function intArg(name,fallback,min,max){const n=Number(arg(name,fallback));return Number.isInteger(n)&&n>=min&&n<=max?n:Number(fallback);}
function percentile(values,p){const sorted=[...values].sort((a,b)=>a-b);if(!sorted.length)return null;const i=Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1));return Number(sorted[i].toFixed(3));}
function fail(code,message){console.error(JSON.stringify({ok:false,code,message,secretExposed:false,signatureExposed:false},null,2));process.exit(2);}

const endpoint=arg('endpoint',process.env.SAKTHIAI_WEBHOOK_ENDPOINT);
const secret=process.env.SAKTHIAI_WEBHOOK_SECRET;
const agentId=arg('agent-id',process.env.SAKTHIAI_WEBHOOK_AGENT_ID);
const tenantId=arg('tenant-id',process.env.SAKTHIAI_WEBHOOK_TENANT_ID);
const trials=intArg('trials',process.env.SAKTHIAI_WEBHOOK_TRIALS||20,20,200);
const timeoutMs=intArg('timeout-ms',process.env.SAKTHIAI_WEBHOOK_TIMEOUT_MS||15000,1000,120000);
const output=arg('output','evidence/funding-readiness/signed-webhook-p3-real-client.json');
const targetSystem=arg('target-system','external-http-client');
const targetResource=arg('target-resource','read-only-evidence');
const checkReplay=flag('check-replay');
const allowLocalhost=flag('allow-localhost');

if(!endpoint)fail('CLIENT_ENDPOINT_REQUIRED','Set --endpoint or SAKTHIAI_WEBHOOK_ENDPOINT.');
if(!secret)fail('CLIENT_SECRET_REQUIRED','Set SAKTHIAI_WEBHOOK_SECRET in the environment; never pass it on the command line.');
if(!agentId)fail('CLIENT_AGENT_ID_REQUIRED','Set --agent-id or SAKTHIAI_WEBHOOK_AGENT_ID.');
if(!tenantId)fail('CLIENT_TENANT_ID_REQUIRED','Set --tenant-id or SAKTHIAI_WEBHOOK_TENANT_ID.');

const config={endpoint,secret,agentId,tenantId,timeoutMs,allowLocalhost};
const runs=[];const acceptedLatency=[];const replayLatency=[];
let accepted=0,replayRejected=0,failed=0;
const overallStart=performance.now();
for(let i=1;i<=trials;i++){
  const nonce=`p3-${Date.now()}-${i}-${crypto.randomUUID()}`;
  const runId=`p3-run-${String(i).padStart(3,'0')}-${crypto.randomUUID().slice(0,8)}`;
  const taskId=`p3_task_${String(i).padStart(3,'0')}`;
  const proposal={
    taskId,
    action:`Read-only external-client evidence trial ${i}: inspect the named target and return policy evidence only.`,
    rationale:'P3 controlled external HTTP evidence trial; no external write, publish, message, deployment or destructive action is requested.',
    target:{system:targetSystem,resource:targetResource}
  };
  const first=await sendSignedExternalProposal(config,proposal,{runId,nonce,allowLocalhost});
  if(first.ok&&first.code==='AGENT_WEBHOOK_EVALUATED'&&first.response?.evaluation?.decision==='DRY_RUN_READY'&&first.response?.externalSideEffects===false){accepted++;acceptedLatency.push(first.latencyMs);}else failed++;
  const row={trial:i,taskId,runId,accepted:first.ok===true,status:first.status,code:first.code,decision:first.response?.evaluation?.decision||null,evidenceHash:first.response?.evaluation?.evidenceHash||null,latencyMs:first.latencyMs??null,replayChecked:checkReplay,replayRejected:null,replayStatus:null,replayCode:null,externalSideEffects:first.response?.externalSideEffects??null};
  if(checkReplay){
    const replay=await sendSignedExternalProposal(config,proposal,{runId,nonce,allowLocalhost});
    row.replayRejected=replay.status===409&&replay.code==='AGENT_WEBHOOK_REPLAY_DETECTED';
    row.replayStatus=replay.status;row.replayCode=replay.code;
    if(row.replayRejected){replayRejected++;if(Number.isFinite(replay.latencyMs))replayLatency.push(replay.latencyMs);}
  }
  runs.push(row);
}
const wallClockMs=performance.now()-overallStart;
const uniqueEvidenceHashes=new Set(runs.map(x=>x.evidenceHash).filter(Boolean)).size;
const report={
  schema:'sakthiai.funding-readiness.real-client-benchmark.v1',
  generatedAt:new Date().toISOString(),
  evidenceMode:allowLocalhost?'LOCAL_HTTP_TEST_CLIENT':'EXTERNAL_HTTPS_CLIENT',
  client:sanitizedClientConfig(config),
  trials,
  accepted,
  failed,
  acceptanceRate:accepted/trials,
  checkReplay,
  replayAttempts:checkReplay?trials:0,
  replayRejected:checkReplay?replayRejected:null,
  replayRejectionRate:checkReplay?replayRejected/trials:null,
  uniqueEvidenceHashes,
  metrics:{acceptedLatencyMs:{p50:percentile(acceptedLatency,50),p95:percentile(acceptedLatency,95),max:acceptedLatency.length?Number(Math.max(...acceptedLatency).toFixed(3)):null},replayLatencyMs:checkReplay?{p50:percentile(replayLatency,50),p95:percentile(replayLatency,95),max:replayLatency.length?Number(Math.max(...replayLatency).toFixed(3)):null}:null,wallClockMs:Number(wallClockMs.toFixed(3))},
  externalSideEffectsExpected:false,
  executorBoundExpected:false,
  productionReadyClaim:false,
  claimGate:{
    qualifiesAsRealExternalClientEvidence:!allowLocalhost&&accepted===trials&&uniqueEvidenceHashes===trials,
    qualifiesAsDurableReplayEvidence:!allowLocalhost&&checkReplay&&replayRejected===trials,
    vendorSpecificAgentClaim:false
  },
  limitations:[
    'This runner proves only what the configured endpoint actually returns; it does not infer production readiness.',
    'A generic signed HTTP client is not a vendor-specific Codex, Claude Code, Gemini or Manus integration.',
    'External writes remain outside the P3 scope.',
    'Latency is environment-specific and should be reported with endpoint/environment context.'
  ],
  runs
};
const serialized=JSON.stringify(report,null,2)+'\n';
if(serialized.includes(secret))fail('CLIENT_SECRET_LEAK_GUARD','Refusing to write benchmark because the configured secret appeared in the report.');
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,serialized,'utf8');
process.stdout.write(JSON.stringify({marker:'SAKTHIAI_P3_REAL_CLIENT_RUN_COMPLETE',output,trials,accepted,replayRejected:checkReplay?replayRejected:null,qualifiesAsRealExternalClientEvidence:report.claimGate.qualifiesAsRealExternalClientEvidence,qualifiesAsDurableReplayEvidence:report.claimGate.qualifiesAsDurableReplayEvidence,externalSideEffectsExpected:false},null,2)+'\n');
if(accepted!==trials||(checkReplay&&replayRejected!==trials))process.exitCode=1;
