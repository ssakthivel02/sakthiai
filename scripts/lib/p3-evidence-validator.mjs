import {URL} from 'node:url';

function fail(code,details={}){return {ok:false,code,...details};}
function isLocalhost(host){return host==='localhost'||host==='127.0.0.1'||host==='::1'||host.endsWith('.localhost');}

export function validateP3Evidence(report){
  if(!report||report.schema!=='sakthiai.funding-readiness.real-client-benchmark.v1')return fail('P3_EVIDENCE_SCHEMA_INVALID');
  const endpoint=String(report?.client?.endpoint||'');
  let url;try{url=new URL(endpoint);}catch{return fail('P3_EVIDENCE_ENDPOINT_INVALID');}
  if(url.protocol!=='https:')return fail('P3_EVIDENCE_HTTPS_REQUIRED');
  if(isLocalhost(url.hostname))return fail('P3_EVIDENCE_LOCALHOST_REJECTED');
  if(report.evidenceMode!=='EXTERNAL_HTTPS_CLIENT')return fail('P3_EVIDENCE_MODE_INVALID');
  const trials=Number(report.trials||0),accepted=Number(report.accepted||0),failed=Number(report.failed||0);
  const replayAttempts=Number(report.replayAttempts||0),replayRejected=Number(report.replayRejected||0),hashes=Number(report.uniqueEvidenceHashes||0);
  if(!Number.isInteger(trials)||trials<20)return fail('P3_EVIDENCE_MINIMUM_TRIALS_NOT_MET',{trials});
  if(accepted!==trials||failed!==0)return fail('P3_EVIDENCE_ACCEPTANCE_GATE_FAILED',{trials,accepted,failed});
  if(report.checkReplay!==true||replayAttempts!==trials||replayRejected!==trials)return fail('P3_EVIDENCE_REPLAY_GATE_FAILED',{trials,replayAttempts,replayRejected});
  if(hashes!==trials)return fail('P3_EVIDENCE_HASH_UNIQUENESS_FAILED',{trials,uniqueEvidenceHashes:hashes});
  if(report.externalSideEffectsExpected!==false||report.executorBoundExpected!==false||report.productionReadyClaim!==false)return fail('P3_EVIDENCE_SAFETY_BOUNDARY_INVALID');
  if(report?.claimGate?.qualifiesAsRealExternalClientEvidence!==true)return fail('P3_REAL_EXTERNAL_CLIENT_CLAIM_GATE_FALSE');
  if(report?.claimGate?.qualifiesAsDurableReplayEvidence!==true)return fail('P3_DURABLE_REPLAY_CLAIM_GATE_FALSE');
  if(report?.claimGate?.vendorSpecificAgentClaim!==false)return fail('P3_VENDOR_SPECIFIC_CLAIM_FORBIDDEN');
  const runs=Array.isArray(report.runs)?report.runs:[];
  if(runs.length!==trials)return fail('P3_EVIDENCE_RUN_LEDGER_INCOMPLETE',{trials,runRows:runs.length});
  const seen=new Set();
  for(const row of runs){
    if(row.accepted!==true||row.status!==200||row.code!=='AGENT_WEBHOOK_EVALUATED'||row.decision!=='DRY_RUN_READY')return fail('P3_EVIDENCE_RUN_FAILED',{trial:row.trial});
    if(row.replayChecked!==true||row.replayRejected!==true||row.replayStatus!==409||row.replayCode!=='AGENT_WEBHOOK_REPLAY_DETECTED')return fail('P3_EVIDENCE_RUN_REPLAY_FAILED',{trial:row.trial});
    if(row.externalSideEffects!==false)return fail('P3_EVIDENCE_RUN_SIDE_EFFECT_FLAG_INVALID',{trial:row.trial});
    if(typeof row.evidenceHash!=='string'||!/^[0-9a-f]{64}$/i.test(row.evidenceHash)||seen.has(row.evidenceHash))return fail('P3_EVIDENCE_RUN_HASH_INVALID',{trial:row.trial});
    seen.add(row.evidenceHash);
  }
  const claim=`SakthiAI accepted ${trials} signed proposals from an external client over HTTPS in a controlled non-production environment, produced ${hashes} distinct verifier/policy evidence receipts, and rejected ${replayRejected}/${replayAttempts} immediate replay attempts through the durable nonce gate while external side effects remained disabled.`;
  return {ok:true,marker:'SAKTHIAI_P3_REAL_EVIDENCE_VALIDATED',trials,accepted,replayRejected,uniqueEvidenceHashes:hashes,endpointOrigin:url.origin,productionReady:false,vendorSpecificAgentClaim:false,truthfulFundingClaim:claim};
}
