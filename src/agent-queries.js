import {persistenceState} from './persistence.js';

function enabled(env,name){return String(env[name]||'').toLowerCase()==='true';}
function dbFor(env){
  if(!enabled(env,'AGENT_CONTROL_ENABLED'))throw new Error('AGENT_CONTROL_DISABLED');
  const state=persistenceState(env);
  if(state.state!=='AVAILABLE')throw new Error(state.state);
  return env.DB;
}
function bounded(value,fallback=100,max=200){const n=Number.parseInt(String(value??''),10);return Number.isFinite(n)?Math.max(1,Math.min(max,n)):fallback;}

export async function listApprovalQueue(env,tenantId,{state='pending',limit=100}={}){
  const db=dbFor(env);
  const allowed=['pending','approved','rejected','expired','cancelled'];
  const safeState=allowed.includes(state)?state:'pending';
  const {results=[]}=await db.prepare(`SELECT a.id,a.task_id,a.requested_by,a.action_class,a.action_summary,a.state,a.decided_by,a.decision_note,a.created_at,a.decided_at,t.title AS task_title,t.autonomy_class FROM approvals a JOIN tasks t ON t.id=a.task_id AND t.tenant_id=a.tenant_id WHERE a.tenant_id=? AND a.state=? ORDER BY a.created_at ASC LIMIT ?`).bind(tenantId,safeState,bounded(limit)).all();
  return results;
}

export async function listTaskEvents(env,tenantId,taskId,{limit=100}={}){
  const db=dbFor(env);
  const {results=[]}=await db.prepare(`SELECT id,event_type,actor_type,actor_id,payload_json,created_at FROM task_events WHERE tenant_id=? AND task_id=? ORDER BY created_at ASC LIMIT ?`).bind(tenantId,taskId,bounded(limit)).all();
  return results;
}

export async function listVerifierRuns(env,tenantId,taskId,{limit=50}={}){
  const db=dbFor(env);
  const {results=[]}=await db.prepare(`SELECT id,verifier_type,state,summary,evidence_count,started_at,completed_at,created_at FROM verifier_runs WHERE tenant_id=? AND task_id=? ORDER BY created_at DESC LIMIT ?`).bind(tenantId,taskId,bounded(limit,50,100)).all();
  return results;
}
