const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};

function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{...JSON_HEADERS,...extra}});}
function requestId(){return `sai_${Date.now()}_${crypto.randomUUID().slice(0,8)}`;}
function bool(value){return String(value||'').toLowerCase()==='true';}
function policy(env){return {
  product:'SakthiAI',
  runtimeMode:bool(env.AI_RUNTIME_ENABLED)?'free-first-enabled':'disabled',
  paidProvidersEnabled:false,
  silentPaidFallback:false,
  legacyRuntimeImport:false,
  externalWrites:'approval_required',
  browserSecrets:false,
  model:env.AI_MODEL||'@cf/meta/llama-3.1-8b-instruct-fp8-fast'
};}
function capabilityRegistry(env){const runtime=bool(env.AI_RUNTIME_ENABLED)&&Boolean(env.AI);return [
  {id:'chat',state:runtime?'RUNTIME_AVAILABLE':'RUNTIME_DISABLED'},
  {id:'research',state:'NOT_WIRED'},
  {id:'code',state:'NOT_WIRED'},
  {id:'agents',state:'NOT_WIRED'},
  {id:'automation',state:'NOT_WIRED'},
  {id:'webapp',state:'FRONTEND_READY'},
  {id:'image',state:'ENGINE_REQUIRED'},
  {id:'video',state:'ENGINE_REQUIRED'},
  {id:'voice',state:'ENGINE_REQUIRED'},
  {id:'artifacts',state:'FRONTEND_READY'},
  {id:'knowledge',state:'PERSISTENCE_REQUIRED'},
  {id:'developer',state:'FOUNDATION_READY'}
];}

async function readJson(request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('CONTENT_TYPE_REQUIRED');
  const length=Number(request.headers.get('content-length')||0);
  if(length>65536)throw new Error('PAYLOAD_TOO_LARGE');
  return request.json();
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

export default {
  async fetch(request,env){
    const url=new URL(request.url);const id=requestId();
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'allow':'GET, POST, OPTIONS','cache-control':'no-store'}});
    if(request.method==='GET'&&(url.pathname==='/api/health'||url.pathname==='/health'))return json({ok:true,status:'ok',product:'SakthiAI',runtime:bool(env.AI_RUNTIME_ENABLED)?'enabled':'disabled',requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/status')return json({ok:true,status:'ok',release:'flagship-hi-tech-v1',policy:policy(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/policy')return json({ok:true,policy:policy(env),requestId:id});
    if(request.method==='GET'&&url.pathname==='/api/v1/capabilities')return json({ok:true,capabilities:capabilityRegistry(env),requestId:id});
    if(request.method==='POST'&&url.pathname==='/api/v1/chat')return handleChat(request,env,id);
    if(url.pathname.startsWith('/api/'))return json({ok:false,code:'NOT_FOUND',requestId:id},404);
    if(env.ASSETS)return env.ASSETS.fetch(request);
    return json({ok:false,code:'ASSET_BINDING_MISSING',requestId:id},503);
  }
};
