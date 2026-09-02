import {authenticateRequest} from './auth.js';
import {authorizeTenant} from './rbac.js';
import {enforceQuota,recordUsage} from './quota.js';
import {taskStateContract} from './agent-state.js';
import {agentControlState,createAgentTask,getAgentTask,transitionAgentTask,createCheckpoint,requestApproval,decideApproval,recordVerifier} from './agent-control.js';
import {getLatestCheckpoint} from './agent-leases.js';
import {listApprovalQueue,listTaskEvents,listVerifierRuns} from './agent-queries.js';

const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{...HEADERS,...extra}});}
function tenantSelector(request){return String(request.headers.get('x-sakthiai-tenant')||'').trim();}
async function readJson(request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('CONTENT_TYPE_REQUIRED');
  const length=Number(request.headers.get('content-length')||0);
  if(length>65536)throw new Error('PAYLOAD_TOO_LARGE');
  return request.json();
}
function statusFor(code){
  if(['RATE_LIMITED','DAILY_AI_QUOTA_EXCEEDED'].includes(code))return 429;
  if(['RBAC_FORBIDDEN','TENANT_MEMBERSHIP_REQUIRED','TENANT_ACCESS_INACTIVE'].includes(code))return 403;
  if(String(code||'').startsWith('ACCESS_JWT_')||code==='IDENTITY_REQUIRED')return 401;
  if(['TASK_NOT_FOUND','APPROVAL_NOT_FOUND','LEASE_NOT_FOUND'].includes(code))return 404;
  if(['CONTENT_TYPE_REQUIRED','PAYLOAD_TOO_LARGE','TASK_INPUT_INVALID','AUTONOMY_CLASS_INVALID','ACTION_CLASS_INVALID','APPROVAL_SUMMARY_INVALID','APPROVAL_DECISION_INVALID','VERIFIER_STATE_INVALID','TARGET_STATE_INVALID','TASK_STATE_INVALID'].includes(code))return code==='PAYLOAD_TOO_LARGE'?413:400;
  if(['APPROVAL_REQUIRED','APPROVAL_ALREADY_DECIDED','TASK_TRANSITION_FORBIDDEN','TASK_RETRY_LIMIT_REACHED','TASK_STATE_CONFLICT','TASK_LEASE_HELD'].includes(code))return 409;
  return 503;
}
async function security(request,env,permission){
  const identity=await authenticateRequest(request,env);
  if(!identity.ok)return identity;
  const tenantId=tenantSelector(request);if(!tenantId)return {ok:false,code:'TENANT_REQUIRED'};
  const access=await authorizeTenant(env,identity,tenantId,permission);
  if(!access.ok)return access;
  const quota=await enforceQuota(env,{tenantId:access.tenantId,userId:access.userId,capability:'agents-control'});
  if(!quota.ok)return quota;
  return {ok:true,identity,access,quota};
}
function controlReady(env){const state=agentControlState(env);return state.state==='AVAILABLE'?{ok:true,state}:{ok:false,state};}
async function secured(request,env,id,permission,operation){
  const ready=controlReady(env);
  if(!ready.ok)return json({ok:false,code:ready.state.state,message:'Agent control plane remains disabled or its durable store is unavailable.',control:ready.state,requestId:id},503);
  const sec=await security(request,env,permission);
  if(!sec.ok)return json({ok:false,code:sec.code,message:'Verified identity, active tenant membership, RBAC and quota controls are required.',requestId:id},statusFor(sec.code),sec.retryAfter?{'retry-after':String(sec.retryAfter)}:{});
  try{
    const result=await operation(sec.access,sec.identity);
    await recordUsage(env,{tenantId:sec.access.tenantId,userId:sec.access.userId,requestId:id,capability:'agents-control',costClass:'free'});
    return json({ok:true,...result,requestId:id},result?._status||200);
  }catch(error){
    const code=error?.message||'AGENT_CONTROL_ERROR';
    return json({ok:false,code,requestId:id},statusFor(code));
  }
}

export async function handleAgentApi(request,env,url,id){
  const path=url.pathname;
  if(request.method==='GET'&&path==='/api/v1/agents/control/status')return json({ok:true,control:agentControlState(env),externalExecutionImplemented:false,requestId:id});
  if(request.method==='GET'&&path==='/api/v1/agents/state-contract')return json({ok:true,contract:taskStateContract(),requestId:id});

  if(request.method==='POST'&&path==='/api/v1/agents/tasks')return secured(request,env,id,'agents_write',async access=>{
    const body=await readJson(request);
    const task=await createAgentTask(env,{...body,tenantId:access.tenantId,userId:access.userId});
    return {task,execution:'NOT_STARTED',_status:201};
  });

  const taskMatch=path.match(/^\/api\/v1\/agents\/tasks\/([^/]+)$/);
  if(request.method==='GET'&&taskMatch)return secured(request,env,id,'agents_read',async access=>{
    const task=await getAgentTask(env,access.tenantId,taskMatch[1]);
    if(!task)throw new Error('TASK_NOT_FOUND');
    const checkpoint=await getLatestCheckpoint(env,access.tenantId,taskMatch[1]);
    return {task,latestCheckpoint:checkpoint||null};
  });

  const transitionMatch=path.match(/^\/api\/v1\/agents\/tasks\/([^/]+)\/transitions$/);
  if(request.method==='POST'&&transitionMatch)return secured(request,env,id,'agents_write',async access=>{
    const body=await readJson(request);
    return {transition:await transitionAgentTask(env,{tenantId:access.tenantId,userId:access.userId,taskId:transitionMatch[1],to:body?.to,reason:body?.reason})};
  });

  const checkpointMatch=path.match(/^\/api\/v1\/agents\/tasks\/([^/]+)\/checkpoints$/);
  if(request.method==='POST'&&checkpointMatch)return secured(request,env,id,'agents_write',async access=>{
    const body=await readJson(request);
    return {checkpoint:await createCheckpoint(env,{tenantId:access.tenantId,userId:access.userId,taskId:checkpointMatch[1],state:body?.state,checkpoint:body?.checkpoint}) ,_status:201};
  });

  const approvalRequestMatch=path.match(/^\/api\/v1\/agents\/tasks\/([^/]+)\/approvals$/);
  if(request.method==='POST'&&approvalRequestMatch)return secured(request,env,id,'agents_write',async access=>{
    const body=await readJson(request);
    return {approval:await requestApproval(env,{tenantId:access.tenantId,userId:access.userId,taskId:approvalRequestMatch[1],actionClass:body?.actionClass,summary:body?.summary}),_status:201};
  });

  if(request.method==='GET'&&path==='/api/v1/agents/approvals')return secured(request,env,id,'agents_approve',async access=>({approvals:await listApprovalQueue(env,access.tenantId,{state:url.searchParams.get('state')||'pending',limit:url.searchParams.get('limit')||100})}));

  const approvalDecisionMatch=path.match(/^\/api\/v1\/agents\/approvals\/([^/]+)\/decision$/);
  if(request.method==='POST'&&approvalDecisionMatch)return secured(request,env,id,'agents_approve',async access=>{
    const body=await readJson(request);
    return {decision:await decideApproval(env,{tenantId:access.tenantId,userId:access.userId,approvalId:approvalDecisionMatch[1],decision:body?.decision,note:body?.note})};
  });

  const verifierMatch=path.match(/^\/api\/v1\/agents\/tasks\/([^/]+)\/verifiers$/);
  if(request.method==='POST'&&verifierMatch)return secured(request,env,id,'agents_verify',async access=>{
    const body=await readJson(request);
    return {verifier:await recordVerifier(env,{tenantId:access.tenantId,userId:access.userId,taskId:verifierMatch[1],verifierType:body?.verifierType,state:body?.state,summary:body?.summary,evidence:body?.evidence}),_status:201};
  });

  const eventsMatch=path.match(/^\/api\/v1\/agents\/tasks\/([^/]+)\/events$/);
  if(request.method==='GET'&&eventsMatch)return secured(request,env,id,'agents_read',async access=>({events:await listTaskEvents(env,access.tenantId,eventsMatch[1],{limit:url.searchParams.get('limit')||100})}));

  const verifierListMatch=path.match(/^\/api\/v1\/agents\/tasks\/([^/]+)\/verifiers$/);
  if(request.method==='GET'&&verifierListMatch)return secured(request,env,id,'agents_read',async access=>({verifiers:await listVerifierRuns(env,access.tenantId,verifierListMatch[1],{limit:url.searchParams.get('limit')||50})}));

  return null;
}
