import assert from 'node:assert/strict';
import {trustedActionGatewayContract,normalizeTrustedActionProposal,evaluateTrustedActionProposal} from '../src/trusted-action-gateway.js';

const contract=trustedActionGatewayContract();
assert.equal(contract.phase,'P0_PROVIDER_NEUTRAL_POLICY_AND_DRY_RUN_PROOF');
assert.equal(contract.externalAgentBindingImplemented,false);
assert.equal(contract.externalSideEffectExecutionImplemented,false);
assert.equal(contract.invariants.directMainWriteAllowed,false);
assert.equal(contract.invariants.forcePushAllowed,false);
assert.equal(contract.invariants.dryRunOnly,true);
assert.equal(contract.invariants.sideEffects,false);

const base={
  sourceAgent:'fixture-agent',sourceRunId:'run_fixture_001',taskId:'tsk_fixture',tenantId:'ten_fixture',
  actionClass:'read_only',action:'Inspect repository status and return evidence.',rationale:'Collect read-only evidence before any change.',
  idempotencyKey:'idem_fixture_001',verifierId:'ver_fixture',verifierState:'passed',evidenceRequirements:['result','checksum'],
  rollbackPlan:'No side effect is expected; discard the read-only result if verification fails.',requestedExecution:'dry_run',target:{system:'repository',resource:'ssakthivel02/sakthiai'}
};

assert.equal(normalizeTrustedActionProposal({...base,sourceAgent:''}).code,'TRUSTED_ACTION_SOURCE_AGENT_REQUIRED');
assert.equal(normalizeTrustedActionProposal({...base,actionClass:'unknown'}).code,'TRUSTED_ACTION_CLASS_INVALID');
assert.equal(normalizeTrustedActionProposal({...base,idempotencyKey:''}).code,'TRUSTED_ACTION_IDEMPOTENCY_REQUIRED');
assert.equal(normalizeTrustedActionProposal({...base,evidenceRequirements:[]}).code,'TRUSTED_ACTION_EVIDENCE_REQUIRED');
assert.equal(normalizeTrustedActionProposal({...base,rollbackPlan:''}).code,'TRUSTED_ACTION_ROLLBACK_REQUIRED');

const readOnly=await evaluateTrustedActionProposal(base,{externalActionsEnabled:false,executorBindingEnabled:false,executorBound:false});
assert.equal(readOnly.decision,'DRY_RUN_READY');
assert.equal(readOnly.dryRun.status,'DRY_RUN_CONTRACT_VALIDATED');
assert.equal(readOnly.executed,false);
assert.equal(readOnly.sideEffects,false);
assert.equal(readOnly.evidenceHash.length,64);
assert.equal(readOnly.executorContract.id,'sandbox_code');

const verifierPending=await evaluateTrustedActionProposal({...base,verifierState:'pending'},{});
assert.equal(verifierPending.decision,'VERIFIER_REQUIRED');
const verifierFailed=await evaluateTrustedActionProposal({...base,verifierState:'failed'},{});
assert.equal(verifierFailed.decision,'BLOCKED');
assert.equal(verifierFailed.code,'TRUSTED_ACTION_VERIFIER_FAILED');

const repoBase={...base,sourceAgent:'codex-adapter-fixture',sourceRunId:'run_repo_001',actionClass:'repository_write',action:'Prepare a code change on an isolated feature branch.',rationale:'The proposed change is required by the approved task.',target:{system:'github',resource:'ssakthivel02/sakthiai',branch:'funding-readiness/demo'},idempotencyKey:'idem_repo_001',rollbackPlan:'Delete or revert the isolated branch commit; never rewrite main.'};
const repoNeedsApproval=await evaluateTrustedActionProposal(repoBase,{externalActionsEnabled:true});
assert.equal(repoNeedsApproval.decision,'APPROVAL_REQUIRED');
const repoMain=await evaluateTrustedActionProposal({...repoBase,target:{...repoBase.target,branch:'main'},approvalId:'apr_repo',approvalState:'approved'},{externalActionsEnabled:true});
assert.equal(repoMain.decision,'BLOCKED');
assert.equal(repoMain.code,'TRUSTED_ACTION_DIRECT_MAIN_WRITE_FORBIDDEN');
const repoForce=await evaluateTrustedActionProposal({...repoBase,forcePush:true,approvalId:'apr_repo',approvalState:'approved'},{externalActionsEnabled:true});
assert.equal(repoForce.decision,'BLOCKED');
assert.equal(repoForce.code,'TRUSTED_ACTION_FORCE_PUSH_FORBIDDEN');
const repoGateOff=await evaluateTrustedActionProposal({...repoBase,approvalId:'apr_repo',approvalState:'approved'},{externalActionsEnabled:false});
assert.equal(repoGateOff.decision,'EXTERNAL_GATE_DISABLED');
const repoReady=await evaluateTrustedActionProposal({...repoBase,approvalId:'apr_repo',approvalState:'approved'},{externalActionsEnabled:true});
assert.equal(repoReady.decision,'DRY_RUN_READY');
assert.equal(repoReady.executorContract.id,'repository');
assert.equal(repoReady.dryRun.sideEffects,false);

const actionClasses=['read_only','internal_write','repository_write','external_write','publish','message','deploy','destructive'];
const providers=['codex-fixture','claude-code-fixture','gemini-fixture'];
const matrix=[];
let i=0;
for(const sourceAgent of providers){
  for(const actionClass of actionClasses){
    i++;
    const consequential=!['read_only','internal_write'].includes(actionClass);
    const input={
      ...base,sourceAgent,sourceRunId:`run_matrix_${i}`,taskId:`tsk_matrix_${i}`,actionClass,
      action:`Matrix policy proposal ${i}: ${actionClass}.`,rationale:'Deterministic P0 policy harness fixture; not a live external-agent integration.',
      idempotencyKey:`idem_matrix_${i}`,approvalId:consequential?`apr_matrix_${i}`:null,approvalState:consequential?'approved':'pending',
      target:actionClass==='repository_write'?{system:'github',resource:'ssakthivel02/sakthiai',branch:`funding-readiness/matrix-${i}`}:{system:'fixture',resource:`resource-${i}`}
    };
    const result=await evaluateTrustedActionProposal(input,{externalActionsEnabled:consequential,executorBindingEnabled:false,executorBound:false});
    assert.equal(result.decision,'DRY_RUN_READY');
    assert.equal(result.executed,false);
    assert.equal(result.sideEffects,false);
    assert.equal(result.externalAgentBindingImplemented,false);
    assert.equal(result.externalSideEffectExecutionImplemented,false);
    assert.equal(result.evidenceHash.length,64);
    matrix.push({sourceAgent,actionClass,decision:result.decision,evidenceHash:result.evidenceHash});
  }
}
assert.equal(matrix.length,24);
assert.equal(new Set(matrix.map(x=>x.evidenceHash)).size,24);

console.log(JSON.stringify({
  marker:'SAKTHIAI_TRUSTED_ACTION_GATEWAY_P0_PASS',
  policyCases:24,
  liveExternalAgentIntegration:false,
  externalSideEffects:false,
  decision:'P0_POLICY_AND_DRY_RUN_PROOF_READY'
},null,2));
