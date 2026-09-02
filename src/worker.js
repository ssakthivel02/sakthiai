import {persistenceState,listProjects,createProject,listTasks,createPlannedTask} from './persistence.js';
import {researchContract,codeContract,agentContract,knowledgeContract} from './execution-contracts.js';

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};

function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{...JSON_HEADERS,...extra}});}
function requestId(){return `sai_${Date.now()}_${crypto.randomUUID().slice(0,8)}`;}
function bool(value){return String(value||'').toLowerCase()==='true';}
function feature(env,name){return bool(env[name]);}
function policy(env){return {
  product:'SakthiAI',
  runtimeMode:bool(env.AI_RUNTIME_ENABLED)?'free-first-enabled':'disabled',
  persistence:persistenceState(env).state,
  identity:feature(env,'IDENTITY_RUNTIME_ENABLED')?'enabled':'disabled',
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
    automation:feature(env,'AUTOMATION_RUNTIME_ENABLED'),
    knowledge:feature(env,'KNOWLEDGE_RUNTIME_ENABLED'),
    image:feature(env,'IMAGE_RUNTIME_ENABLED'),
    video:feature(env,'VIDEO_RUNTIME_ENABLED'),
    voice:feature(env,'VOICE_RUNTIME_ENABLED')
  }
};}
function capabilityRegistry(env){const runtime=bool(env.AI_RUNTIME_ENABLED)&&Boolean(env.AI);const persistence=persistenceState(env).state;return [
  {id:'chat',state:runtime?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED',contract:true},
  {id:'research',state:feature(env,'RESEARCH_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED',contract:true,evidenceRequired:true},
  {id:'code',state:feature(env,'CODE_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED',contract:true,sandboxRequired:true},
  {id:'agents',state:feature(env,'AGENT_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED',contract:true,approvalGated:true},
  {id:'automation',state:feature(env,'AUTOMATION_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED',contract:true,approvalGated:true},
  {id:'webapp',state:'FRONTEND_READY',contract:true},
  {id:'image',state:feature(env,'IMAGE_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'ENGINE_REQUIRED',contract:true},
  {id:'video',state:feature(env,'VIDEO_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'ENGINE_REQUIRED',contract:true},
  {id:'voice',state:feature(env,'VOICE_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':'ENGINE_REQUIRED',contract:true},
  {id:'artifacts',state:'FRONTEND_READY',contract:true},
  {id:'knowledge',state:feature(env,'KNOWLEDGE_RUNTIME_ENABLED')?'RUNTIME_AVAILABLE':(persistence==='AVAILABLE'?'RUNTIME_DISABLED':'PERSISTENCE_DISABLED'),contract:true,provenanceRequired:true},
  {id:'developer',state:'CONTRACT_READY',contract:true}
];}

async function readJson(request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('CONTENT_TYPE_REQUIRED');
  const length=Number(request.headers.get('content-length')||0);
  if(length>65536)throw new Error('PAYLOAD_TOO_LARGE');
  return request.json();
}

function identityContext(request,env){
  if(!feature(env,'IDENTITY_RUNTIME_ENABLED'))return {ok:false,code:'IDENTITY_RUNTIME_DISABLED'};
  // Temporary contract only. Production must replace these headers with verified Access/OIDC JWT claims.
  const tenantId=(request.headers.get('x-sakthiai-tenant')||'').trim();
  const userId=(request.headers.get('x-sakthiai-user')||'').trim();
  if(!tenantId||!userId)return {ok:false,code:'IDENTITY_REQUIRED'};
  return {ok:true,tenantId,userId};
}

async function handleChat(request,env,id){
  if(!bool(env.AI_RUNTIME_ENABLED))return json({ok:false,code:'RUNTIME_DISABLED',message:'SakthiAI AI runtime is disabled by owner cost policy.',requestId:id},503);
  if(!env.AI)return json({ok:false,code:'AI_BINDING_MISSING',message:'Workers AI binding is not configured.',requestId:id},503);
  let body;try{body=await readJson(request);}catch(error){const code=error.message;return json({ok:false,code,requestId:id},code==='PAYLOAD_TOO_LARGE'?413:400);}
  const prompt=String(body?.prompt||'').trim();
  if(!prompt)return json({ok:false,code:'PROMPT_REQUIRED',requestId:id},400);
  if(prompt.length>12000)return json({ok:false,code:'PROMPT_TOO_LARGE',requestId:id},413);
  const model=env.AI_MODEL||'@cf/meta/llama-3.1-8b-instruct-fp8-fast';
  try{
    const result=await env.AI.run(model,{messages:[
      {role:'system',content:'You are SakthiAI. Be accurate, concise, transparent about uncertainty, never claim external actions you did not perform, and never request or expose secrets.'},
      {role:'user',content:prompt}
    ],max_tokens:700,temperature:0.3});
    const answer=result?.response||result?.result?.response||result?.text||'';
    if(!answer)return json({ok:false,code:'EMPTY_MODEL_RESPONSE',requestId:id,model},502);
    return json({ok:true,answer,provider:'cloudflare-workers-ai',model,costPolicy:'free-first-fail-closed',requestId:id});
  }catch(error){
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
  const identity=identityContext(request,env);
  if(!identity.ok)return json({ok:false,code:identity.code,message:'Verified SakthiAI identity is required before durable tenant data can be accessed.',requestId:id},401);
  try{
    if(operation==='projects-list')return json({ok:true,projects:await listProjects(env,identity.tenantId),requestId:id});
    if(operation==='projects-create'){
      const body=await readJson(request);
      return json({ok:true,project:await createProject(env,{...body,tenantId:identity.tenantId,userId:identity.userId}),requestId:id},201);
    }
    if(operation==='tasks-list')return json({ok:true,tasks:await listTasks(env,identity.tenantId),requestId:id});
    if(operation==='tasks-create'){
      const body=await readJson(request);
      return json({ok:true,task:await createPlannedTask(env,{...body,tenantId:identity.tenantId,userId:identity.userId}),execution:'NOT_STARTED',requestId:id},201);
    }
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
    if(request.method==='GET'&&(url.pathname==='/api/health'||url.pathname==='/health'))return json({ok:true,status:'ok',product:'SakthiAI',runtime:bool(env.AI_RUNTIME_ENABLED)?'enabled':'disabled',persistence:persistenceState(env).state,requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/status')return json({ok:true,status:'ok',release:'flagship-hi-tech-v2-foundation',policy:policy(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/policy')return json({ok:true,policy:policy(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/capabilities')return json({ok:true,capabilities:capabilityRegistry(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/persistence/status')return json({ok:true,persistence:persistenceState(env),identity:feature(env,'IDENTITY_RUNTIME_ENABLED')?'enabled':'disabled',requestId:id});
    if(request.method==='POST'&&url.pathname==='/api/v1/chat')return handleChat(request,env,id);
    if(request.method==='POST'&&url.pathname==='/api/v1/research/plan')return contractResponse(request,env,id,'research');
    if(request.method==='POST'&&url.pathname==='/api/v1/code/plan')return contractResponse(request,env,id,'code');
    if(request.method==='POST'&&url.pathname==='/api/v1/agents/plan')return contractResponse(request,env,id,'agents');
    if(request.method==='POST'&&url.pathname==='/api/v1/knowledge/query')return contractResponse(request,env,id,'knowledge');
    if(request.method==='GET'&&url.pathname==='/api/v1/projects')return persistenceResponse(request,env,id,'projects-list');
    if(request.method==='POST'&&url.pathname==='/api/v1/projects')return persistenceResponse(request,env,id,'projects-create');
    if(request.method==='GET'&&url.pathname==='/api/v1/tasks')return persistenceResponse(request,env,id,'tasks-list');
    if(request.method==='POST'&&url.pathname==='/api/v1/tasks')return persistenceResponse(request,env,id,'tasks-create');
    if(url.pathname.startsWith('/api/'))return json({ok:false,code:'NOT_FOUND',requestId:id},404);
    if(env.ASSETS)return env.ASSETS.fetch(request);
    return json({ok:false,code:'ASSET_BINDING_MISSING',requestId:id},503);
  }
};
