import {persistenceState} from './persistence.js';
import {canTransition,classifyAction,nextStateAfterApproval} from './agent-state.js';

function enabled(env,name){return String(env[name]||'').toLowerCase()==='true';}
function dbFor(env){
  if(!enabled(env,'AGENT_CONTROL_ENABLED'))throw new Error('AGENT_CONTROL_DISABLED');
  const persistence=persistenceState(env);
  if(persistence.state!=='AVAILABLE')throw new Error(persistence.state);
  if(!env.DB)throw new Error('BINDING_MISSING');
  return env.DB;
}
function text(value,max){const v=String(value??'').trim();return v&&v.length<=max?v:null;}
function jsonText(value,max=32000){
  const out=JSON.stringify(value??{});
  if(out.length>max)throw new Error('AGENT_PAYLOAD_TOO_LARGE');
  return out;
}
function normalizeActionClass(value){
  const action=String(value||'read_only').trim();
  if(!['read_only','internal_write','repository_write','external_write','publish','message','deploy','destructive'].includes(action))throw new Error('ACTION_CLASS_INVALID');
  return action;
}

export function agentControlState(env){return {
  state:enabled(env,'AGENT_CONTROL_ENABLED')?(persistenceState(env).state==='AVAILABLE'?'AVAILABLE':persistenceState(env).state):'AGENT_CONTROL_DISABLED',
  externalActions:enabled(env,'AGENT_EXTERNAL_ACTIONS_ENABLED')?'enabled':'disabled'
};}

export async function createAgentTask(env,{tenantId,userId,projectId=null,title,objective,taskType='agent',autonomyClass='green',actionClass='read_only'}){
  const db=dbFor(env);
  const safeTitle=text(title,200),safeObjective=text(objective,12000),safeType=text(taskType,80);
  if(!safeTitle||!safeObjective||!safeType)throw new Error('TASK_INPUT_INVALID');
  if(!['green','amber','red'].includes(autonomyClass))throw new Error('AUTONOMY_CLASS_INVALID');
  const safeAction=normalizeActionClass(actionClass);
  const risk=classifyAction({taskAutonomy:autonomyClass,actionClass:safeAction});
  const taskId=`tsk_${crypto.randomUUID()}`;
  const policyId=`pol_${crypto.randomUUID()}`;
  const eventId=`evt_${crypto.randomUUID()}`;
  const auditId=`aud_${crypto.randomUUID()}`;
  const statements=[
    db.prepare(`INSERT INTO tasks(id,tenant_id,project_id,created_by,task_type,title,objective,state,autonomy_class,approval_required) VALUES(?,?,?,?,?,?,?,'planned',?,?)`).bind(taskId,tenantId,projectId||null,userId,safeType,safeTitle,safeObjective,risk.effectiveAutonomy,risk.approvalRequired?1:0),
    db.prepare(`INSERT INTO task_execution_policy(id,tenant_id,task_id,action_class,external_action,destructive_action) VALUES(?,?,?,?,?,?)`).bind(policyId,tenantId,taskId,safeAction,risk.externalAction?1:0,risk.destructive?1:0),
    db.prepare(`INSERT INTO task_events(id,tenant_id,task_id,event_type,actor_type,actor_id,payload_json) VALUES(?,?,?,'task_created','user',?,?)`).bind(eventId,tenantId,taskId,userId,jsonText({autonomyClass:risk.effectiveAutonomy,actionClass:safeAction})),
    db.prepare(`INSERT INTO audit_events(id,tenant_id,user_id,action,resource_type,resource_id,outcome,metadata_json) VALUES(?,?,?,'agent_task_create','task',?,'success',?)`).bind(auditId,tenantId,userId,taskId,jsonText({autonomyClass:risk.effectiveAutonomy,actionClass:safeAction}))
  ];
  await db.batch(statements);
  return {id:taskId,projectId,title:safeTitle,objective:safeObjective,taskType:safeType,state:'planned',autonomyClass:risk.effectiveAutonomy,actionClass:safeAction,approvalRequired:risk.approvalRequired,externalAction:risk.externalAction};
}

export async function getAgentTask(env,tenantId,taskId){
  const db=dbFor(env);
  return db.prepare(`SELECT t.id,t.project_id,t.task_type,t.title,t.objective,t.state,t.autonomy_class,t.approval_required,t.retry_count,t.max_retries,t.created_at,t.updated_at,COALESCE(p.action_class,'read_only') AS action_class,COALESCE(p.external_action,0) AS external_action,COALESCE(p.destructive_action,0) AS destructive_action FROM tasks t LEFT JOIN task_execution_policy p ON p.task_id=t.id AND p.tenant_id=t.tenant_id WHERE t.tenant_id=? AND t.id=? LIMIT 1`).bind(tenantId,taskId).first();
}

async function latestApprovalState(db,tenantId,taskId){
  const row=await db.prepare(`SELECT state FROM approvals WHERE tenant_id=? AND task_id=? ORDER BY created_at DESC LIMIT 1`).bind(tenantId,taskId).first();
  return row?.state||null;
}
async function latestVerifierState(db,tenantId,taskId){
  const row=await db.prepare(`SELECT state FROM verifier_runs WHERE tenant_id=? AND task_id=? ORDER BY created_at DESC LIMIT 1`).bind(tenantId,taskId).first();
  return row?.state||null;
}

export async function transitionAgentTask(env,{tenantId,userId,taskId,to,reason=null}){
  const db=dbFor(env);
  const task=await getAgentTask(env,tenantId,taskId);
  if(!task)throw new Error('TASK_NOT_FOUND');
  const approvalState=await latestApprovalState(db,tenantId,taskId);
  const verifierState=await latestVerifierState(db,tenantId,taskId);
  const check=canTransition({state:task.state,retryCount:task.retry_count,maxRetries:task.max_retries,autonomyClass:task.autonomy_class,actionClass:task.action_class},to,{approvalState,verifierState,externalActionsEnabled:enabled(env,'AGENT_EXTERNAL_ACTIONS_ENABLED')});
  if(!check.ok)throw new Error(check.code);
  const eventId=`evt_${crypto.randomUUID()}`;
  const auditId=`aud_${crypto.randomUUID()}`;
  const update=db.prepare(`UPDATE tasks SET state=?,updated_at=CURRENT_TIMESTAMP,retry_count=CASE WHEN state='failed' AND ?='queued' THEN retry_count+1 ELSE retry_count END WHERE tenant_id=? AND id=? AND state=?`).bind(to,to,tenantId,taskId,task.state);
  const event=db.prepare(`INSERT INTO task_events(id,tenant_id,task_id,event_type,actor_type,actor_id,payload_json) VALUES(?,?,?,'state_transition','user',?,?)`).bind(eventId,tenantId,taskId,userId,jsonText({from:task.state,to,reason}));
  const audit=db.prepare(`INSERT INTO audit_events(id,tenant_id,user_id,action,resource_type,resource_id,outcome,metadata_json) VALUES(?,?,?,'agent_task_transition','task',?,'success',?)`).bind(auditId,tenantId,userId,taskId,jsonText({from:task.state,to,reason}));
  const results=await db.batch([update,event,audit]);
  const changes=Number(results?.[0]?.meta?.changes??1);
  if(changes!==1)throw new Error('TASK_STATE_CONFLICT');
  return {taskId,from:task.state,to,approvalState,verifierState};
}

export async function createCheckpoint(env,{tenantId,userId,taskId,state,checkpoint}){
  const db=dbFor(env);
  const task=await getAgentTask(env,tenantId,taskId);
  if(!task)throw new Error('TASK_NOT_FOUND');
  const row=await db.prepare(`SELECT COALESCE(MAX(sequence_no),-1) AS seq FROM task_checkpoints WHERE tenant_id=? AND task_id=?`).bind(tenantId,taskId).first();
  const sequenceNo=Number(row?.seq??-1)+1;
  const id=`chk_${crypto.randomUUID()}`;
  const eventId=`evt_${crypto.randomUUID()}`;
  await db.batch([
    db.prepare(`INSERT INTO task_checkpoints(id,tenant_id,task_id,sequence_no,state,checkpoint_json,created_by_type,created_by) VALUES(?,?,?,?,?,?,'user',?)`).bind(id,tenantId,taskId,sequenceNo,text(state,80)||task.state,jsonText(checkpoint),userId),
    db.prepare(`INSERT INTO task_events(id,tenant_id,task_id,event_type,actor_type,actor_id,payload_json) VALUES(?,?,?,'checkpoint_created','user',?,?)`).bind(eventId,tenantId,taskId,userId,jsonText({checkpointId:id,sequenceNo}))
  ]);
  return {id,taskId,sequenceNo,state:text(state,80)||task.state};
}

export async function requestApproval(env,{tenantId,userId,taskId,actionClass,summary}){
  const db=dbFor(env);
  const task=await getAgentTask(env,tenantId,taskId);
  if(!task)throw new Error('TASK_NOT_FOUND');
  const safeSummary=text(summary,4000);if(!safeSummary)throw new Error('APPROVAL_SUMMARY_INVALID');
  const safeAction=normalizeActionClass(actionClass||task.action_class);
  const approvalId=`apr_${crypto.randomUUID()}`;
  const eventId=`evt_${crypto.randomUUID()}`;
  await db.batch([
    db.prepare(`INSERT INTO approvals(id,tenant_id,task_id,requested_by,action_class,action_summary,state) VALUES(?,?,?,?,?,?,'pending')`).bind(approvalId,tenantId,taskId,userId,safeAction,safeSummary),
    db.prepare(`UPDATE tasks SET state='waiting_approval',approval_required=1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND state IN ('planned','queued','running','paused')`).bind(tenantId,taskId),
    db.prepare(`INSERT INTO task_events(id,tenant_id,task_id,event_type,actor_type,actor_id,payload_json) VALUES(?,?,?,'approval_requested','user',?,?)`).bind(eventId,tenantId,taskId,userId,jsonText({approvalId,actionClass:safeAction}))
  ]);
  return {id:approvalId,taskId,state:'pending',actionClass:safeAction};
}

export async function decideApproval(env,{tenantId,userId,approvalId,decision,note=null}){
  const db=dbFor(env);
  if(!['approved','rejected'].includes(decision))throw new Error('APPROVAL_DECISION_INVALID');
  const approval=await db.prepare(`SELECT id,task_id,state FROM approvals WHERE tenant_id=? AND id=? LIMIT 1`).bind(tenantId,approvalId).first();
  if(!approval)throw new Error('APPROVAL_NOT_FOUND');
  if(approval.state!=='pending')throw new Error('APPROVAL_ALREADY_DECIDED');
  const nextState=nextStateAfterApproval(decision);
  const eventId=`evt_${crypto.randomUUID()}`;
  const auditId=`aud_${crypto.randomUUID()}`;
  await db.batch([
    db.prepare(`UPDATE approvals SET state=?,decided_by=?,decision_note=?,decided_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND state='pending'`).bind(decision,userId,note?String(note).slice(0,4000):null,tenantId,approvalId),
    db.prepare(`UPDATE tasks SET state=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND state='waiting_approval'`).bind(nextState,tenantId,approval.task_id),
    db.prepare(`INSERT INTO task_events(id,tenant_id,task_id,event_type,actor_type,actor_id,payload_json) VALUES(?,?,?,'approval_decided','user',?,?)`).bind(eventId,tenantId,approval.task_id,userId,jsonText({approvalId,decision,nextState})),
    db.prepare(`INSERT INTO audit_events(id,tenant_id,user_id,action,resource_type,resource_id,outcome,metadata_json) VALUES(?,?,?,'agent_approval_decide','approval',?,'success',?)`).bind(auditId,tenantId,userId,approvalId,jsonText({decision,taskId:approval.task_id}))
  ]);
  return {approvalId,taskId:approval.task_id,decision,nextState};
}

export async function recordVerifier(env,{tenantId,userId,taskId,verifierType='policy',state,summary=null,evidence=[]}){
  const db=dbFor(env);
  if(!['pending','running','passed','failed','inconclusive'].includes(state))throw new Error('VERIFIER_STATE_INVALID');
  const task=await getAgentTask(env,tenantId,taskId);if(!task)throw new Error('TASK_NOT_FOUND');
  const verifierId=`ver_${crypto.randomUUID()}`;
  const statements=[db.prepare(`INSERT INTO verifier_runs(id,tenant_id,task_id,verifier_type,state,summary,evidence_count,completed_at) VALUES(?,?,?,?,?,?,?,CASE WHEN ? IN ('passed','failed','inconclusive') THEN CURRENT_TIMESTAMP ELSE NULL END)`).bind(verifierId,tenantId,taskId,text(verifierType,80)||'policy',state,summary?String(summary).slice(0,4000):null,Array.isArray(evidence)?evidence.length:0,state)];
  for(const item of Array.isArray(evidence)?evidence.slice(0,50):[]){
    statements.push(db.prepare(`INSERT INTO evidence_records(id,tenant_id,task_id,verifier_run_id,evidence_type,source_ref,checksum_sha256,claim,evidence_json) VALUES(?,?,?,?,?,?,?,?,?)`).bind(`evd_${crypto.randomUUID()}`,tenantId,taskId,verifierId,text(item.type,80)||'unspecified',item.sourceRef?String(item.sourceRef).slice(0,2000):null,item.checksum?String(item.checksum).slice(0,128):null,item.claim?String(item.claim).slice(0,4000):null,jsonText(item.data||{})));
  }
  statements.push(db.prepare(`INSERT INTO task_events(id,tenant_id,task_id,event_type,actor_type,actor_id,payload_json) VALUES(?,?,?,'verifier_recorded','verifier',?,?)`).bind(`evt_${crypto.randomUUID()}`,tenantId,taskId,userId,jsonText({verifierId,state,evidenceCount:Array.isArray(evidence)?evidence.length:0})));
  await db.batch(statements);
  return {id:verifierId,taskId,state,evidenceCount:Array.isArray(evidence)?evidence.length:0};
}
