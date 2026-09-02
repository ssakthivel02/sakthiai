export const TASK_STATES=Object.freeze(['planned','queued','running','waiting_approval','paused','completed','failed','cancelled']);
export const AUTONOMY_CLASSES=Object.freeze(['green','amber','red']);
export const ACTION_CLASSES=Object.freeze(['read_only','internal_write','repository_write','external_write','publish','message','deploy','destructive']);

const TRANSITIONS=Object.freeze({
  planned:['queued','cancelled'],
  queued:['running','paused','cancelled'],
  running:['waiting_approval','paused','completed','failed','cancelled'],
  waiting_approval:['queued','paused','cancelled'],
  paused:['queued','cancelled'],
  failed:['queued','cancelled'],
  completed:[],
  cancelled:[]
});

const ACTION_RISK=Object.freeze({
  read_only:'green',
  internal_write:'green',
  repository_write:'amber',
  external_write:'amber',
  publish:'amber',
  message:'amber',
  deploy:'red',
  destructive:'red'
});

function rank(value){return {green:0,amber:1,red:2}[value]??2;}

export function requiredAutonomyForAction(actionClass){return ACTION_RISK[actionClass]||'red';}

export function classifyAction({taskAutonomy='green',actionClass='read_only'}={}){
  const required=requiredAutonomyForAction(actionClass);
  const effective=rank(taskAutonomy)>=rank(required)?taskAutonomy:required;
  return {
    actionClass,
    requiredAutonomy:required,
    effectiveAutonomy:effective,
    approvalRequired:effective!=='green',
    externalAction:['repository_write','external_write','publish','message','deploy','destructive'].includes(actionClass),
    destructive:actionClass==='destructive'
  };
}

export function canTransition(task,to,{approvalState=null,verifierState=null,externalActionsEnabled=false}={}){
  if(!task||!TASK_STATES.includes(task.state))return {ok:false,code:'TASK_STATE_INVALID'};
  if(!TASK_STATES.includes(to))return {ok:false,code:'TARGET_STATE_INVALID'};
  if(!TRANSITIONS[task.state].includes(to))return {ok:false,code:'TASK_TRANSITION_FORBIDDEN'};

  if(task.state==='failed'&&to==='queued'&&Number(task.retryCount||0)>=Number(task.maxRetries??2)){
    return {ok:false,code:'TASK_RETRY_LIMIT_REACHED'};
  }

  if(task.state==='waiting_approval'&&to==='queued'&&approvalState!=='approved'){
    return {ok:false,code:'APPROVAL_REQUIRED'};
  }

  if(to==='completed'&&verifierState!=='passed'){
    return {ok:false,code:'VERIFIER_REQUIRED'};
  }

  const risk=classifyAction({taskAutonomy:task.autonomyClass,actionClass:task.actionClass||'read_only'});
  if(to==='running'&&risk.approvalRequired&&approvalState!=='approved'){
    return {ok:false,code:'APPROVAL_REQUIRED'};
  }
  if(to==='running'&&risk.externalAction&&!externalActionsEnabled){
    return {ok:false,code:'EXTERNAL_ACTIONS_DISABLED'};
  }

  return {ok:true,from:task.state,to,risk};
}

export function nextStateAfterApproval(decision){
  if(decision==='approved')return 'queued';
  if(decision==='rejected')return 'paused';
  throw new Error('APPROVAL_DECISION_INVALID');
}

export function taskStateContract(){return {states:TASK_STATES,autonomyClasses:AUTONOMY_CLASSES,actionClasses:ACTION_CLASSES,transitions:TRANSITIONS,actionRisk:ACTION_RISK};}
