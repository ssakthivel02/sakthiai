import {persistenceState,listProjects,createProject,listTasks,createPlannedTask} from './persistence.js';
import {researchContract,codeContract,agentContract,knowledgeContract} from './execution-contracts.js';
import {authenticateRequest,identityState} from './auth.js';
import {authorizeTenant} from './rbac.js';
import {quotaPolicy,enforceQuota,recordUsage} from './quota.js';
import {agentControlState} from './agent-control.js';
import {handleAgentApi} from './agent-api.js';
import {executorContractRegistry} from './executor-contracts.js';

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};

function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{...JSON_HEADERS,...extra}});}
function requestId(){return `sai_${Date.now()}_${crypto.randomUUID().slice(0,8)}`;}
function bool(value){return String(value||'').toLowerCase()==='true';}
function feature(env,name){return bool(env[name]);}
function tenantSelector(request){return String(request.headers.get('x-sakthiai-tenant')||'').trim();}
function securityStatus(code){
  if(['RATE_LIMITED','DAILY_AI_QUOTA_EXCEEDED'].includes(code))return 429;
  if(['RBAC_FORBIDDEN','TENANT_MEMBERSHIP_REQUIRED','TENANT_ACCESS_INACTIVE'].includes(code))return 403;
  if(String(code||'').startsWith('ACCESS_JWT_')||code==='IDENTITY_REQUIRED')return 401;
  return 503;
}
function policy(env){const executors=executorContractRegistry();return {
  product:'SakthiAI',
  runtimeMode:bool(env.AI_RUNTIME_ENABLED)?'free-first-enabled':'disabled',
  persistence:persistenceState(env).state,
  identity:identityState(env).state,
  quota:quotaPolicy(env),
  agentControl:agentControlState(env),
  executorContracts:{phase:executors.phase,externalExecutionImplemented:false,boundExecutors:0,contractCount:executors.contracts.length},
  paidProvidersEnabled:false,
  silentPaidFallback:false,
  legacyRuntimeImport:false,
  externalWrites:'approval_required',
  browserSecrets:false,
  model:env.AI_MODEL||'@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  featureGates:{
    research:feature(env,'RESEARCH_RUNTIME_ENABLED'),
    code:feature(env,'CODE_RUNTIME_ENABLED'),
    agents:feature(env,'AGENT_RUNTIME_ENABLED'),
    agentControl:feature(env,'AGENT_CONTROL_ENABLED'),
    agentExternalActions:feature(env,'AGENT_EXTERNAL_ACTIONS_ENABLED'),
    agentVerifier:feature(env,'AGENT_VERIFIER_RUNTIME_ENABLED'),
    automation:feature(env,'AUTOMATION_RUNTIME_ENABLED'),
    knowledge:feature(env,'KNOWLEDGE_RUNTIME_ENABLED'),
    image:feature(env,'IMAGE_RUNTIME_ENABLED'),
    video:feature(env,'VIDEO_RUNTIME_ENABLED'),
    voice:feature(env,'VOICE_RUNTIME_ENABLED')
  }
};}
function capabilityRegistry(env){
  const runtime=bool(env.AI_RUNTIME_ENABLED)&&Boolean(env.AI);
  const persistence=persistenceState(env).state;
  const control=agentControlState(env);
  return [
    {id:'chat',state:runtime?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED',contract:true,identityRequired:true,quotaRequired:true},
    {id:'research',state:feature(env,'RESEARCH_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED',contract:true,evidenceRequired:true,identityRequired:true,quotaRequired:true},
    {id:'code',state:feature(env,'CODE_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED',contract:true,sandboxRequired:true,identityRequired:true,quotaRequired:true},
    {id:'agents',state:control.state==='AVAILABLE'?'CONTROL_PLANE_READY':'RUNTIME_DISABLED',contract:true,controlPlane:control.state,externalActions:control.externalActions,verifierRuntime:control.verifierRuntime,executorContracts:'CONTRACT_ONLY',executionImplemented:false,approvalGated:true,identityRequired:true,quotaRequired:true},
    {id:'automation',state:feature(env,'AUTOMATION_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED',contract:true,approvalGated:true,identityRequired:true},
    {id:'webapp',state:'FRONTEND_READY',contract:true},
    {id:'image',state:feature(env,'IMAGE_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'ENGINE_REQUIRED',contract:true},
    {id:'video',state:feature(env,'VIDEO_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'ENGINE_REQUIRED',contract:true},
    {id:'voice',state:feature(env,'VOICE_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'ENGINE_REQUIRED',contract:true},
    {id:'artifacts',state:'FRONTEND_READY',contract:true},
    {id:'knowledge',state:feature(env,'KNOWLEDGE_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':(persistence==='AVAILABLE'?'RUNTIME_DISABLED':'PERSISTENCE_DISABLED'),contract:true,provenanceRequired:true,identityRequired:true},
    {id:'developer',state:'CONTRACT_READY',contract:true}
  ];
}

async function readJson(request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('CONTENT_TYPE_REQUIRED');
  const length=Number(request.headers.get('content-length')||0);
  if(length>65536)throw new Error('PAYLOAD_TOO_LARGE');
  return request.json();
}

async function securityContext(request,env,permission,capability){
  const identity=await authenticateRequest(request,env);
  if(!identity.ok)return {ok:false,code:identity.code};
  const tenantId=tenantSelector(request);
  if(!tenantId)return {ok:false,code:'TENANT_REQUIRED'};
  const access=await authorizeTenant(env,identity,tenantId,permission);
  if(!access.ok)return access;
  const quota=await enforceQuota(env,{tenantId:access.tenantId,userId:access.userId,capability});
  if(!quota.ok)return quota;
  return {ok:true,identity,access,quota};
}

async function handleChat(request,env,id){
  if(!bool(env.AI_RUNTIME_ENABLED))return json({ok:false,code:'RUNTIME_DISABLED',message:'SakthiAI AI runtime is disabled by owner cost policy.',requestId:id},503);
  if(!env.AI)return json({ok:false,code:'AI_BINDING_MISSING',message:'Workers AI binding is not configured.',requestId:id},503);
  const security=await securityContext(request,env,'ai_use','chat');
  if(!security.ok)return json({ok:false,code:security.code,message:'Verified identity, tenant access and quota controls are required before SakthiAI AI execution.',requestId:id},securityStatus(security.code),security.retryAfter?{'retry-after':String(security.retryAfter)}:{});
  let body;try{body=await readJson(request);}catch(error){const code=error.message;return json({ok:false,code,requestId:id},code==='PAYLOAD_TOO_LARGE'?413:400);}
  const prompt=String(body?.prompt||'').trim();
  if(!prompt)return json({ok:false,code:'PROMPT_REQUIRED',requestId:id},400);
  if(prompt.length>12000)return json({ok:false,code:'PROMPT_TOO_LARGE',requestId:id},413);
  const model=env.AI_MODEL||'@cf/meta/llama-3.1-8b-instruct-fp8-fast';
  const started=Date.now();
  try{
    const result=await env.AI.run(model,{messages:[
      {role:'system',content:'You are SakthiAI. Be accurate, concise, transparent about uncertainty, never claim external actions you did not perform, and never request or expose secrets.'},
      {role:'user',content:prompt}
    ],max_tokens:700,temperature:0.3});
    const answer=result?.response||result?.result?.response||result?.text||'';
    if(!answer)return json({ok:false,code:'EMPTY_MODEL_RESPONSE',requestId:id,model},502);
    await recordUsage(env,{tenantId:security.access.tenantId,userId:security.access.userId,requestId:id,capability:'chat',provider:'cloudflare-workers-ai',model,costClass:'free',inputUnits:prompt.length,outputUnits:String(answer).length,latencyMs:Date.now()-started});
    return json({ok:true,answer,provider:'cloudflare-workers-ai',model,costPolicy:'free-first-fail-closed',requestId:id});
  }catch(error){
    await recordUsage(env,{tenantId:security.access.tenantId,userId:security.access.userId,requestId:id,capability:'chat',provider:'cloudflare-workers-ai',model,costClass:'free',inputUnits:prompt.length,outputUnits:0,latencyMs:Date.now()-started}).catch(()=>{});
    return json({ok:false,code:'AI_RUNTIME_ERROR',message:'The configured free-first runtime failed. No paid fallback was attempted.',requestId:id},502);
  }
}

async function contractResponse(request,env,id,kind){
  let body;try{body=await readJson(request);}catch(error){const code=error.message;return json({ok:false,code,requestId:id},code==='PAYLOAD_TOO_LARGE'?413:400);}
  const fn={research:researchContract,code:codeContract,agents:agentContract,knowledge:knowledgeContract}[kind];
  const result=fn(env,body);
  return json({...result,requestId:id},result.status||200);
}

async function persistenceResponse(request,env,id,operation){
  const state=persistenceState(env);
  if(state.state!=='AVAILABLE')return json({ok:false,code:state.state,message:state.reason,requestId:id},503);
  const permission=operation.endsWith('list')?(operation.startsWith('projects')?'projects_read':'tasks_read'):(operation.startsWith('projects')?'projects_write':'tasks_write');
  const capability=operation.startsWith('projects')?'projects':'tasks';
  const security=await securityContext(request,env,permission,capability);
  if(!security.ok)return json({ok:false,code:security.code,message:'Verified identity, active tenant membership, RBAC permission and quota controls are required.',requestId:id},securityStatus(security.code),security.retryAfter?{'retry-after':String(security.retryAfter)}:{});
  try{
    let payload;
    if(operation==='projects-list')payload={ok:true,projects:await listProjects(env,security.access.tenantId),requestId:id};
    if(operation==='projects-create'){
      const body=await readJson(request);
      payload={ok:true,project:await createProject(env,{...body,tenantId:security.access.tenantId,userId:security.access.userId}),requestId:id};
    }
    if(operation==='tasks-list')payload={ok:true,tasks:await listTasks(env,security.access.tenantId),requestId:id};
    if(operation==='tasks-create'){
      const body=await readJson(request);
      payload={ok:true,task:await createPlannedTask(env,{...body,tenantId:security.access.tenantId,userId:security.access.userId}),execution:'NOT_STARTED',requestId:id};
    }
    await recordUsage(env,{tenantId:security.access.tenantId,userId:security.access.userId,requestId:id,capability,costClass:'free'});
    return json(payload,operation.endsWith('create')?201:200);
  }catch(error){
    const code=error.message||'PERSISTENCE_ERROR';
    const status=code.includes('INVALID')?400:(code==='PAYLOAD_TOO_LARGE'?413:500);
    return json({ok:false,code,message:status===500?'Durable operation failed safely.':undefined,requestId:id},status);
  }
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);const id=requestId();
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'allow':'GET, POST, OPTIONS','cache-control':'no-store'}});
    if(request.method==='GET'&&(url.pathname==='/api/health'||url.pathname==='/health'))return json({ok:true,status:'ok',product:'SakthiAI',runtime:bool(env.AI_RUNTIME_ENABLED)?'enabled':'disabled',persistence:persistenceState(env).state,identity:identityState(env).state,quota:quotaPolicy(env).enabled?'enabled':'disabled',agentControl:agentControlState(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/status')return json({ok:true,status:'ok',release:'flagship-hi-tech-v5-control-center-contracts',policy:policy(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/policy')return json({ok:true,policy:policy(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/capabilities')return json({ok:true,capabilities:capabilityRegistry(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/security/status')return json({ok:true,identity:identityState(env),quota:quotaPolicy(env),persistence:persistenceState(env),agentControl:agentControlState(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/persistence/status')return json({ok:true,persistence:persistenceState(env),identity:identityState(env),quota:quotaPolicy(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/agents/executors/contracts')return json({ok:true,registry:executorContractRegistry(),requestId:id});
    if(request.method==='POST'&&url.pathname==='/api/v1/chat')return handleChat(request,env,id);
    if(request.method==='POST'&&url.pathname==='/api/v1/research/plan')return contractResponse(request,env,id,'research');
    if(request.method==='POST'&&url.pathname==='/api/v1/code/plan')return contractResponse(request,env,id,'code');
    if(request.method==='POST'&&url.pathname==='/api/v1/agents/plan')return contractResponse(request,env,id,'agents');
    if(request.method==='POST'&&url.pathname==='/api/v1/knowledge/query')return contractResponse(request,env,id,'knowledge');
    const agentResponse=await handleAgentApi(request,env,url,id);
    if(agentResponse)return agentResponse;
    if(request.method==='GET'&&url.pathname==='/api/v1/projects')return persistenceResponse(request,env,id,'projects-list');
    if(request.method==='POST'&&url.pathname==='/api/v1/projects')return persistenceResponse(request,env,id,'projects-create');
    if(request.method==='GET'&&url.pathname==='/api/v1/tasks')return persistenceResponse(request,env,id,'tasks-list');
    if(request.method==='POST'&&url.pathname==='/api/v1/tasks')return persistenceResponse(request,env,id,'tasks-create');
    if(url.pathname.startsWith('/api/'))return json({ok:false,code:'NOT_FOUND',requestId:id},404);
    if(env.ASSETS)return env.ASSETS.fetch(request);
    return json({ok:false,code:'ASSET_BINDING_MISSING',requestId:id},503);
  }
};
