import {persistenceState} from './persistence.js';

function enabled(env,name){return String(env[name]||'').toLowerCase()==='true';}
function dbFor(env){
  if(!enabled(env,'AGENT_CONTROL_ENABLED'))throw new Error('AGENT_CONTROL_DISABLED');
  const state=persistenceState(env);
  if(state.state!=='AVAILABLE')throw new Error(state.state);
  if(!env.DB)throw new Error('BINDING_MISSING');
  return env.DB;
}
function ttl(value){const n=Number(value||120);return Math.max(30,Math.min(900,Number.isFinite(n)?n:120));}

export async function getLatestCheckpoint(env,tenantId,taskId){
  const db=dbFor(env);
  return db.prepare(`SELECT id,sequence_no,state,checkpoint_json,created_by_type,created_by,created_at FROM task_checkpoints WHERE tenant_id=? AND task_id=? ORDER BY sequence_no DESC LIMIT 1`).bind(tenantId,taskId).first();
}

export async function acquireWorkerLease(env,{tenantId,taskId,workerId,ttlSeconds=120}){
  const db=dbFor(env);
  const worker=String(workerId||'').trim();if(!worker||worker.length>200)throw new Error('WORKER_ID_INVALID');
  const seconds=ttl(ttlSeconds);
  const now=Date.now();
  const expiresAt=new Date(now+seconds*1000).toISOString();
  await db.prepare(`DELETE FROM worker_leases WHERE tenant_id=? AND task_id=? AND expires_at<=?`).bind(tenantId,taskId,new Date(now).toISOString()).run();
  const existing=await db.prepare(`SELECT worker_id,expires_at FROM worker_leases WHERE tenant_id=? AND task_id=? LIMIT 1`).bind(tenantId,taskId).first();
  if(existing)throw new Error('TASK_LEASE_HELD');
  const leaseToken=`lease_${crypto.randomUUID()}`;
  await db.prepare(`INSERT INTO worker_leases(task_id,tenant_id,worker_id,lease_token,expires_at) VALUES(?,?,?,?,?)`).bind(taskId,tenantId,worker,leaseToken,expiresAt).run();
  return {taskId,workerId:worker,leaseToken,expiresAt,ttlSeconds:seconds};
}

export async function heartbeatWorkerLease(env,{tenantId,taskId,leaseToken,ttlSeconds=120}){
  const db=dbFor(env);
  const token=String(leaseToken||'').trim();if(!token)throw new Error('LEASE_TOKEN_REQUIRED');
  const seconds=ttl(ttlSeconds),expiresAt=new Date(Date.now()+seconds*1000).toISOString();
  const result=await db.prepare(`UPDATE worker_leases SET heartbeat_at=CURRENT_TIMESTAMP,expires_at=? WHERE tenant_id=? AND task_id=? AND lease_token=?`).bind(expiresAt,tenantId,taskId,token).run();
  if(Number(result?.meta?.changes||0)!==1)throw new Error('LEASE_NOT_FOUND');
  return {taskId,expiresAt,ttlSeconds:seconds};
}

export async function releaseWorkerLease(env,{tenantId,taskId,leaseToken}){
  const db=dbFor(env);
  const token=String(leaseToken||'').trim();if(!token)throw new Error('LEASE_TOKEN_REQUIRED');
  const result=await db.prepare(`DELETE FROM worker_leases WHERE tenant_id=? AND task_id=? AND lease_token=?`).bind(tenantId,taskId,token).run();
  if(Number(result?.meta?.changes||0)!==1)throw new Error('LEASE_NOT_FOUND');
  return {taskId,released:true};
}
