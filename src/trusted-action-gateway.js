import {contractForAction,buildDryRunReceipt} from './executor-contracts.js';

const VERSION='SAI-P0-TRUSTED-ACTION-GATEWAY-1';
const CONSEQUENTIAL=new Set(['repository_write','external_write','publish','message','deploy','destructive']);
const ACTIONS=new Set(['read_only','internal_write','repository_write','external_write','publish','message','deploy','destructive']);

function text(value,max){const out=String(value??'').trim();return out&&out.length<=max?out:null;}
function bool(value){return value===true;}
function lower(value){return String(value??'').trim().toLowerCase();}
function normalizeBranch(value){return lower(value).replace(/^refs\/heads\//,'');}
function riskFor(actionClass){
  if(actionClass==='destructive')return {level:'red',approvalRequired:true,consequential:true};
  if(CONSEQUENTIAL.has(actionClass))return {level:'amber',approvalRequired:true,consequential:true};
  return {level:'green',approvalRequired:false,consequential:false};
}
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
async function sha256(value){
  const bytes=new TextEncoder().encode(JSON.stringify(stable(value)));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

export function trustedActionGatewayContract(){
  return {
    version:VERSION,
    phase:'P0_PROVIDER_NEUTRAL_POLICY_AND_DRY_RUN_PROOF',
    externalAgentBindingImplemented:false,
    externalSideEffectExecutionImplemented:false,
    accepts:['sourceAgent','sourceRunId','taskId','tenantId','actionClass','action','target','rationale','idempotencyKey','verifierId','verifierState','approvalId','approvalState','evidenceRequirements','rollbackPlan'],
    decisions:['INVALID','BLOCKED','VERIFIER_REQUIRED','APPROVAL_REQUIRED','EXTERNAL_GATE_DISABLED','DRY_RUN_READY'],
    invariants:{
      verifierRequired:true,
      approvalRequiredForConsequentialActions:true,
      directMainWriteAllowed:false,
      forcePushAllowed:false,
      dryRunOnly:true,
      evidenceRequired:true,
      rollbackOrCompensationPlanRequired:true,
      sideEffects:false
    }
  };
}

export function normalizeTrustedActionProposal(input={}){
  const sourceAgent=text(input.sourceAgent,120);
  const sourceRunId=text(input.sourceRunId,200);
  const taskId=text(input.taskId,160);
  const tenantId=text(input.tenantId,160);
  const actionClass=lower(input.actionClass||'read_only');
  const action=text(input.action,4000);
  const rationale=text(input.rationale,8000);
  const idempotencyKey=text(input.idempotencyKey,200);
  const verifierId=text(input.verifierId,160);
  const evidenceRequirements=Array.isArray(input.evidenceRequirements)?input.evidenceRequirements.map(x=>text(x,160)).filter(Boolean).slice(0,50):[];
  const rollbackPlan=text(input.rollbackPlan,8000);
  const target=input.target&&typeof input.target==='object'?{
    system:text(input.target.system,160),
    resource:text(input.target.resource,1000),
    branch:text(input.target.branch,240),
    environment:text(input.target.environment,120),
    destination:text(input.target.destination,1000)
  }:{};
  if(!sourceAgent)return {ok:false,code:'TRUSTED_ACTION_SOURCE_AGENT_REQUIRED'};
  if(!sourceRunId)return {ok:false,code:'TRUSTED_ACTION_SOURCE_RUN_REQUIRED'};
  if(!taskId)return {ok:false,code:'TRUSTED_ACTION_TASK_REQUIRED'};
  if(!tenantId)return {ok:false,code:'TRUSTED_ACTION_TENANT_REQUIRED'};
  if(!ACTIONS.has(actionClass))return {ok:false,code:'TRUSTED_ACTION_CLASS_INVALID'};
  if(!action)return {ok:false,code:'TRUSTED_ACTION_DESCRIPTION_REQUIRED'};
  if(!rationale)return {ok:false,code:'TRUSTED_ACTION_RATIONALE_REQUIRED'};
  if(!idempotencyKey)return {ok:false,code:'TRUSTED_ACTION_IDEMPOTENCY_REQUIRED'};
  if(!verifierId)return {ok:false,code:'TRUSTED_ACTION_VERIFIER_REQUIRED'};
  if(!evidenceRequirements.length)return {ok:false,code:'TRUSTED_ACTION_EVIDENCE_REQUIRED'};
  if(!rollbackPlan)return {ok:false,code:'TRUSTED_ACTION_ROLLBACK_REQUIRED'};
  return {ok:true,proposal:{
    sourceAgent,sourceRunId,taskId,tenantId,actionClass,action,rationale,idempotencyKey,verifierId,evidenceRequirements,rollbackPlan,target,
    verifierState:lower(input.verifierState||'pending'),approvalId:text(input.approvalId,160),approvalState:lower(input.approvalState||'pending'),
    forcePush:bool(input.forcePush),requestedExecution:lower(input.requestedExecution||'dry_run')
  }};
}

function policyDecision(proposal,runtime={}){
  const contract=contractForAction(proposal.actionClass);
  if(!contract)return {decision:'INVALID',code:'TRUSTED_ACTION_CONTRACT_NOT_FOUND'};
  const risk=riskFor(proposal.actionClass);
  const branch=normalizeBranch(proposal.target?.branch);
  if(proposal.forcePush)return {decision:'BLOCKED',code:'TRUSTED_ACTION_FORCE_PUSH_FORBIDDEN',risk,contract};
  if(proposal.actionClass==='repository_write'&&['main','master'].includes(branch))return {decision:'BLOCKED',code:'TRUSTED_ACTION_DIRECT_MAIN_WRITE_FORBIDDEN',risk,contract};
  if(proposal.verifierState==='failed')return {decision:'BLOCKED',code:'TRUSTED_ACTION_VERIFIER_FAILED',risk,contract};
  if(proposal.verifierState!=='passed')return {decision:'VERIFIER_REQUIRED',code:'TRUSTED_ACTION_VERIFIER_NOT_PASSED',risk,contract};
  if(risk.approvalRequired&&(!proposal.approvalId||proposal.approvalState!=='approved'))return {decision:'APPROVAL_REQUIRED',code:'TRUSTED_ACTION_APPROVAL_REQUIRED',risk,contract};
  if(risk.consequential&&runtime.externalActionsEnabled!==true)return {decision:'EXTERNAL_GATE_DISABLED',code:'EXTERNAL_ACTIONS_DISABLED',risk,contract};
  return {decision:'DRY_RUN_READY',code:'TRUSTED_ACTION_DRY_RUN_READY',risk,contract};
}

export async function evaluateTrustedActionProposal(input={},runtime={}){
  const normalized=normalizeTrustedActionProposal(input);
  if(!normalized.ok)return {ok:false,version:VERSION,decision:'INVALID',code:normalized.code,executed:false,sideEffects:false};
  const proposal=normalized.proposal;
  const policy=policyDecision(proposal,runtime);
  const base={
    ok:policy.decision!=='INVALID',version:VERSION,decision:policy.decision,code:policy.code,
    executed:false,sideEffects:false,externalAgentBindingImplemented:false,externalSideEffectExecutionImplemented:false,
    proposal:{...proposal,target:{...proposal.target}},
    policy:{riskLevel:policy.risk?.level||null,approvalRequired:policy.risk?.approvalRequired??null,consequential:policy.risk?.consequential??null,directMainWriteAllowed:false,forcePushAllowed:false,dryRunOnly:true},
    executorContract:policy.contract?{id:policy.contract.id,label:policy.contract.label,state:policy.contract.state,requiredControls:[...policy.contract.requiredControls]}:null,
    runtime:{externalActionsEnabled:runtime.externalActionsEnabled===true,executorBindingEnabled:runtime.executorBindingEnabled===true,executorBound:runtime.executorBound===true}
  };

  if(policy.decision==='DRY_RUN_READY'){
    const receipt=buildDryRunReceipt({
      taskId:proposal.taskId,tenantId:proposal.tenantId,actionClass:proposal.actionClass,idempotencyKey:proposal.idempotencyKey,
      verifierId:proposal.verifierId,evidenceRequirements:proposal.evidenceRequirements,rollbackPlan:proposal.rollbackPlan,
      approvalId:proposal.approvalId,approvalState:proposal.approvalState,externalActionsEnabled:runtime.externalActionsEnabled===true
    });
    if(!receipt.ok)return {...base,decision:'BLOCKED',code:receipt.code,dryRun:null,evidenceHash:null};
    base.dryRun=receipt.receipt;
  } else base.dryRun=null;

  const evidenceCore={
    gatewayVersion:VERSION,sourceAgent:proposal.sourceAgent,sourceRunId:proposal.sourceRunId,taskId:proposal.taskId,tenantId:proposal.tenantId,
    actionClass:proposal.actionClass,action:proposal.action,target:proposal.target,decision:base.decision,code:base.code,
    verifierId:proposal.verifierId,verifierState:proposal.verifierState,approvalId:proposal.approvalId||null,approvalState:proposal.approvalState,
    idempotencyKey:proposal.idempotencyKey,evidenceRequirements:proposal.evidenceRequirements,rollbackPlan:proposal.rollbackPlan,
    executorContractId:base.executorContract?.id||null,executed:false,sideEffects:false
  };
  base.evidenceHash=await sha256(evidenceCore);
  base.evidence={...evidenceCore,sha256:base.evidenceHash};
  return base;
}
