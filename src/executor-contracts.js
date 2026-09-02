const ACTIONS=Object.freeze(['read_only','internal_write','repository_write','external_write','publish','message','deploy','destructive']);
const LIFECYCLE=Object.freeze(['prepare','authorize','dry_run','execute','verify','commit_or_rollback']);
const CONTRACTS=Object.freeze([
  {id:'sandbox_code',label:'Sandbox Code Executor',state:'NO_EXECUTOR_BOUND',actionClasses:['read_only','internal_write'],requiredControls:['isolated_sandbox','resource_limits','command_allowlist','artifact_capture','verifier']},
  {id:'repository',label:'Repository Executor',state:'NO_EXECUTOR_BOUND',actionClasses:['repository_write'],requiredControls:['isolated_branch','idempotency_key','approval','tests','diff_evidence','rollback_ref','no_force_push']},
  {id:'connector',label:'External Connector Executor',state:'NO_EXECUTOR_BOUND',actionClasses:['external_write'],requiredControls:['scoped_credentials','idempotency_key','approval','dry_run_or_preview','response_evidence','compensation_plan']},
  {id:'publisher_messenger',label:'Publish & Message Executor',state:'NO_EXECUTOR_BOUND',actionClasses:['publish','message'],requiredControls:['recipient_or_destination_scope','content_preview','approval','idempotency_key','delivery_evidence','retraction_or_compensation_plan']},
  {id:'deployment',label:'Deployment Executor',state:'NO_EXECUTOR_BOUND',actionClasses:['deploy'],requiredControls:['environment_allowlist','change_plan','approval','preflight','health_verification','rollback_plan','post_deploy_evidence']},
  {id:'destructive',label:'Destructive Action Executor',state:'NO_EXECUTOR_BOUND',actionClasses:['destructive'],requiredControls:['explicit_red_classification','owner_or_admin_approval','impact_preview','backup_or_recovery_evidence','two_phase_commit','post_action_verification']}
]);

function text(value,max){const out=String(value??'').trim();return out&&out.length<=max?out:null;}
export function executorContractRegistry(){return {
  phase:'SAI-V5_CONTRACT_ONLY',
  externalExecutionImplemented:false,
  lifecycle:[...LIFECYCLE],
  contracts:CONTRACTS.map(item=>({...item,actionClasses:[...item.actionClasses],requiredControls:[...item.requiredControls]})),
  globalRequirements:{tenantScoped:true,idempotencyRequired:true,approvalRequiredForConsequentialActions:true,dryRunRequiredWhenSupported:true,evidenceRequired:true,verifierRequired:true,rollbackOrCompensationPlanRequired:true,secretsServerSideOnly:true,boundedRetries:true,auditEventRequired:true,paidProviderAllowed:false,directMainWriteAllowed:false,forcePushAllowed:false}
};}

export function contractForAction(actionClass){
  const action=String(actionClass||'').trim();
  if(!ACTIONS.includes(action))return null;
  return CONTRACTS.find(contract=>contract.actionClasses.includes(action))||null;
}

export function validateExecutionEnvelope(input={}){
  const taskId=text(input.taskId,160);if(!taskId)return {ok:false,code:'EXECUTOR_TASK_ID_REQUIRED'};
  const tenantId=text(input.tenantId,160);if(!tenantId)return {ok:false,code:'EXECUTOR_TENANT_REQUIRED'};
  const actionClass=String(input.actionClass||'').trim();
  const contract=contractForAction(actionClass);if(!contract)return {ok:false,code:'EXECUTOR_ACTION_CLASS_INVALID'};
  const idempotencyKey=text(input.idempotencyKey,200);if(!idempotencyKey)return {ok:false,code:'EXECUTOR_IDEMPOTENCY_REQUIRED'};
  const verifierId=text(input.verifierId,160);if(!verifierId)return {ok:false,code:'EXECUTOR_VERIFIER_REQUIRED'};
  const evidenceRequirements=Array.isArray(input.evidenceRequirements)?input.evidenceRequirements.filter(Boolean).slice(0,50):[];
  if(!evidenceRequirements.length)return {ok:false,code:'EXECUTOR_EVIDENCE_REQUIREMENTS_REQUIRED'};
  const rollbackPlan=text(input.rollbackPlan,8000);if(!rollbackPlan)return {ok:false,code:'EXECUTOR_ROLLBACK_PLAN_REQUIRED'};
  const consequential=!['read_only','internal_write'].includes(actionClass);
  if(consequential&&!text(input.approvalId,160))return {ok:false,code:'EXECUTOR_APPROVAL_REQUIRED'};
  if(consequential&&input.approvalState!=='approved')return {ok:false,code:'EXECUTOR_APPROVAL_NOT_APPROVED'};
  if(input.externalActionsEnabled!==true&&contract.id!=='sandbox_code')return {ok:false,code:'EXTERNAL_ACTIONS_DISABLED'};
  const dryRun=input.dryRun!==false;
  if(!dryRun&&input.executorBindingEnabled!==true)return {ok:false,code:'EXECUTOR_BINDING_GATE_DISABLED'};
  if(!dryRun&&input.executorBound!==true)return {ok:false,code:'EXECUTOR_NOT_BOUND'};
  return {ok:true,envelope:{taskId,tenantId,actionClass,executorContractId:contract.id,idempotencyKey,approvalId:input.approvalId||null,verifierId,evidenceRequirements,rollbackPlan,dryRun,lifecycle:[...LIFECYCLE]},contract};
}

export function buildDryRunReceipt(input={}){
  const validation=validateExecutionEnvelope({...input,dryRun:true,externalActionsEnabled:input.externalActionsEnabled===true});
  if(!validation.ok)return validation;
  return {ok:true,receipt:{status:'DRY_RUN_CONTRACT_VALIDATED',executed:false,sideEffects:false,executorBound:false,envelope:validation.envelope,requiredControls:[...validation.contract.requiredControls]}};
}
