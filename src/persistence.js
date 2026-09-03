function enabled(env){return String(env.PERSISTENCE_ENABLED||'').toLowerCase()==='true';}

export function persistenceState(env){
  if(!enabled(env))return {state:'PERSISTENCE_DISABLED',reason:'Owner runtime policy keeps durable persistence disabled.'};
  if(!env.DB)return {state:'BINDING_MISSING',reason:'D1 binding DB is not configured.'};
  return {state:'AVAILABLE'};
}

function requireDb(env){
  const state=persistenceState(env);
  if(state.state!=='AVAILABLE'){
    const error=new Error(state.state);
    error.persistence=state;
    throw error;
  }
  return env.DB;
}

function cleanText(value,max){
  const text=String(value??'').trim();
  if(!text||text.length>max)return null;
  return text;
}

export async function listProjects(env,tenantId){
  const db=requireDb(env);
  const {results=[]}=await db.prepare(`SELECT id,name,description,status,created_at,updated_at FROM projects WHERE tenant_id=? AND status!='deleted' ORDER BY updated_at DESC LIMIT 100`).bind(tenantId).all();
  return results;
}

export async function createProject(env,{tenantId,userId,name,description}){
  const db=requireDb(env);
  const safeName=cleanText(name,160);
  if(!safeName)throw new Error('PROJECT_NAME_INVALID');
  const safeDescription=description==null?null:String(description).trim().slice(0,4000);
  const id=`prj_${crypto.randomUUID()}`;
  await db.prepare(`INSERT INTO projects(id,tenant_id,owner_user_id,name,description,status) VALUES(?,?,?,?,?,'active')`).bind(id,tenantId,userId,safeName,safeDescription).run();
  return {id,name:safeName,description:safeDescription,status:'active'};
}

export async function listTasks(env,tenantId){
  const db=requireDb(env);
  const {results=[]}=await db.prepare(`SELECT id,project_id,task_type,title,objective,state,autonomy_class,approval_required,retry_count,max_retries,created_at,updated_at FROM tasks WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 100`).bind(tenantId).all();
  return results;
}

export async function createPlannedTask(env,{tenantId,userId,projectId,taskType,title,objective,autonomyClass='green'}){
  const db=requireDb(env);
  const safeType=cleanText(taskType,80);
  const safeTitle=cleanText(title,200);
  const safeObjective=cleanText(objective,12000);
  if(!safeType||!safeTitle||!safeObjective)throw new Error('TASK_INPUT_INVALID');
  if(!['green','amber','red'].includes(autonomyClass))throw new Error('AUTONOMY_CLASS_INVALID');
  const id=`tsk_${crypto.randomUUID()}`;
  const approvalRequired=autonomyClass==='green'?0:1;
  await db.prepare(`INSERT INTO tasks(id,tenant_id,project_id,created_by,task_type,title,objective,state,autonomy_class,approval_required) VALUES(?,?,?,?,?,?,?,'planned',?,?)`).bind(id,tenantId,projectId||null,userId,safeType,safeTitle,safeObjective,autonomyClass,approvalRequired).run();
  return {id,projectId:projectId||null,taskType:safeType,title:safeTitle,objective:safeObjective,state:'planned',autonomyClass,approvalRequired:Boolean(approvalRequired)};
}
