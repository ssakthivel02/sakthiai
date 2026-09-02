import assert from 'node:assert/strict';
import {executorContractRegistry,contractForAction,validateExecutionEnvelope,buildDryRunReceipt} from '../src/executor-contracts.js';

const registry=executorContractRegistry();
assert.equal(registry.phase,'SAI-V5_CONTRACT_ONLY');
assert.equal(registry.externalExecutionImplemented,false);
assert.equal(registry.contracts.length,6);
assert.ok(registry.contracts.every(contract=>contract.state==='NO_EXECUTOR_BOUND'));
assert.equal(registry.globalRequirements.idempotencyRequired,true);
assert.equal(registry.globalRequirements.approvalRequiredForConsequentialActions,true);
assert.equal(registry.globalRequirements.verifierRequired,true);
assert.equal(registry.globalRequirements.rollbackOrCompensationPlanRequired,true);
assert.equal(registry.globalRequirements.paidProviderAllowed,false);
assert.equal(registry.globalRequirements.directMainWriteAllowed,false);
assert.equal(registry.globalRequirements.forcePushAllowed,false);
assert.deepEqual(registry.lifecycle,['prepare','authorize','dry_run','execute','verify','commit_or_rollback']);

assert.equal(contractForAction('repository_write')?.id,'repository');
assert.equal(contractForAction('deploy')?.id,'deployment');
assert.equal(contractForAction('destructive')?.id,'destructive');
assert.equal(contractForAction('unknown'),null);

const base={
  taskId:'tsk_test',tenantId:'ten_test',idempotencyKey:'idem_001',verifierId:'ver_test',
  evidenceRequirements:['command_output','artifact_checksum'],rollbackPlan:'Restore the pre-action checkpoint.',dryRun:true
};

const readOnly=validateExecutionEnvelope({...base,actionClass:'read_only',externalActionsEnabled:false});
assert.equal(readOnly.ok,true);
assert.equal(readOnly.envelope.executorContractId,'sandbox_code');
assert.equal(readOnly.envelope.dryRun,true);

const noIdempotency=validateExecutionEnvelope({...base,idempotencyKey:'',actionClass:'read_only',externalActionsEnabled:false});
assert.equal(noIdempotency.code,'EXECUTOR_IDEMPOTENCY_REQUIRED');

const missingApproval=validateExecutionEnvelope({...base,actionClass:'repository_write',externalActionsEnabled:false});
assert.equal(missingApproval.code,'EXECUTOR_APPROVAL_REQUIRED');

const unapproved=validateExecutionEnvelope({...base,actionClass:'repository_write',approvalId:'apr_test',approvalState:'pending',externalActionsEnabled:false});
assert.equal(unapproved.code,'EXECUTOR_APPROVAL_NOT_APPROVED');

const externalLocked=validateExecutionEnvelope({...base,actionClass:'repository_write',approvalId:'apr_test',approvalState:'approved',externalActionsEnabled:false});
assert.equal(externalLocked.code,'EXTERNAL_ACTIONS_DISABLED');

const contractOnlyExternal=validateExecutionEnvelope({...base,actionClass:'repository_write',approvalId:'apr_test',approvalState:'approved',externalActionsEnabled:true});
assert.equal(contractOnlyExternal.ok,true);
assert.equal(contractOnlyExternal.envelope.executorContractId,'repository');
assert.equal(contractOnlyExternal.envelope.dryRun,true);

const bindingGateOff=validateExecutionEnvelope({...base,actionClass:'read_only',dryRun:false,externalActionsEnabled:false,executorBindingEnabled:false,executorBound:false});
assert.equal(bindingGateOff.code,'EXECUTOR_BINDING_GATE_DISABLED');

const noConcreteBinding=validateExecutionEnvelope({...base,actionClass:'read_only',dryRun:false,externalActionsEnabled:false,executorBindingEnabled:true,executorBound:false});
assert.equal(noConcreteBinding.code,'EXECUTOR_NOT_BOUND');

const contractEnvelopeOnly=validateExecutionEnvelope({...base,actionClass:'read_only',dryRun:false,externalActionsEnabled:false,executorBindingEnabled:true,executorBound:true});
assert.equal(contractEnvelopeOnly.ok,true);
assert.equal(contractEnvelopeOnly.envelope.dryRun,false);

const dryRun=buildDryRunReceipt({...base,actionClass:'deploy',approvalId:'apr_deploy',approvalState:'approved',externalActionsEnabled:true});
assert.equal(dryRun.ok,true);
assert.equal(dryRun.receipt.status,'DRY_RUN_CONTRACT_VALIDATED');
assert.equal(dryRun.receipt.executed,false);
assert.equal(dryRun.receipt.sideEffects,false);
assert.equal(dryRun.receipt.executorBound,false);

console.log('SAKTHIAI_EXECUTOR_CONTRACT_TEST_PASS');
