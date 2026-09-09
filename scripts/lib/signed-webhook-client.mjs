import {createSignedAgentWebhookSignature} from '../../src/signed-agent-webhook.js';

const DEFAULT_TIMEOUT_MS=15000;

function text(value,max){const out=String(value??'').trim();return out&&out.length<=max?out:null;}
function boundedTimeout(value){const n=Number(value||DEFAULT_TIMEOUT_MS);return Number.isFinite(n)&&n>=1000&&n<=120000?Math.floor(n):DEFAULT_TIMEOUT_MS;}
function isLocalhost(hostname){return ['localhost','127.0.0.1','::1'].includes(String(hostname||'').toLowerCase());}

export function validateExternalClientConfig(input={}){
  const endpoint=text(input.endpoint,2000);
  const secret=text(input.secret,4096);
  const agentId=text(input.agentId,120);
  const tenantId=text(input.tenantId,160);
  if(!endpoint)return {ok:false,code:'CLIENT_ENDPOINT_REQUIRED'};
  let url;try{url=new URL(endpoint);}catch{return {ok:false,code:'CLIENT_ENDPOINT_INVALID'};}
  if(url.protocol!=='https:'&&!(input.allowLocalhost===true&&url.protocol==='http:'&&isLocalhost(url.hostname)))return {ok:false,code:'CLIENT_HTTPS_REQUIRED'};
  if(!url.pathname.endsWith('/api/v1/agents/external-proposals/evaluate'))return {ok:false,code:'CLIENT_ENDPOINT_PATH_INVALID'};
  if(!secret||secret.length<32)return {ok:false,code:'CLIENT_SECRET_MISSING_OR_WEAK'};
  if(!agentId)return {ok:false,code:'CLIENT_AGENT_ID_REQUIRED'};
  if(!tenantId)return {ok:false,code:'CLIENT_TENANT_ID_REQUIRED'};
  return {ok:true,config:{endpoint:url.toString(),secret,agentId,tenantId,timeoutMs:boundedTimeout(input.timeoutMs),allowLocalhost:input.allowLocalhost===true}};
}

export function buildReadOnlyProposal(input={}){
  const taskId=text(input.taskId,160);
  const action=text(input.action,4000);
  const rationale=text(input.rationale,8000);
  if(!taskId)return {ok:false,code:'CLIENT_TASK_ID_REQUIRED'};
  if(!action)return {ok:false,code:'CLIENT_ACTION_REQUIRED'};
  if(!rationale)return {ok:false,code:'CLIENT_RATIONALE_REQUIRED'};
  const target=input.target&&typeof input.target==='object'?{
    system:text(input.target.system,160),
    resource:text(input.target.resource,1000),
    branch:text(input.target.branch,240),
    environment:text(input.target.environment,120),
    destination:text(input.target.destination,1000)
  }:{};
  return {ok:true,proposal:{taskId,actionClass:'read_only',action,rationale,target,requestedExecution:'dry_run'}};
}

export async function createSignedExternalProposalRequest(configInput,proposalInput,{runId,nonce,timestamp,allowLocalhost=false}={}){
  const checked=validateExternalClientConfig({...configInput,allowLocalhost:allowLocalhost||configInput?.allowLocalhost});
  if(!checked.ok)return checked;
  const proposal=buildReadOnlyProposal(proposalInput);
  if(!proposal.ok)return proposal;
  const config=checked.config;
  const safeRun=text(runId,200)||`run_${crypto.randomUUID()}`;
  const safeNonce=text(nonce,160)||crypto.randomUUID();
  const safeTimestamp=text(timestamp,32)||String(Math.floor(Date.now()/1000));
  if(!/^\d{9,12}$/.test(safeTimestamp))return {ok:false,code:'CLIENT_TIMESTAMP_INVALID'};
  const body=JSON.stringify(proposal.proposal);
  const signature=await createSignedAgentWebhookSignature(config.secret,{timestamp:safeTimestamp,agentId:config.agentId,runId:safeRun,tenantId:config.tenantId,nonce:safeNonce,body});
  const headers={
    'content-type':'application/json',
    'x-sakthiai-agent-id':config.agentId,
    'x-sakthiai-agent-run-id':safeRun,
    'x-sakthiai-tenant':config.tenantId,
    'x-sakthiai-timestamp':safeTimestamp,
    'x-sakthiai-nonce':safeNonce,
    'x-sakthiai-signature':signature
  };
  return {
    ok:true,
    request:new Request(config.endpoint,{method:'POST',headers,body}),
    metadata:{endpoint:config.endpoint,agentId:config.agentId,tenantId:config.tenantId,runId:safeRun,nonce:safeNonce,timestamp:Number(safeTimestamp),taskId:proposal.proposal.taskId,actionClass:'read_only',requestedExecution:'dry_run'},
    secretExposed:false,
    signatureExposed:false,
    _private:{timeoutMs:config.timeoutMs}
  };
}

export async function sendSignedExternalProposal(configInput,proposalInput,options={}){
  const built=await createSignedExternalProposalRequest(configInput,proposalInput,options);
  if(!built.ok)return built;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('timeout'),built._private.timeoutMs);
  const started=performance.now();
  try{
    const source=built.request;
    const response=await fetch(source,{signal:controller.signal});
    const latencyMs=performance.now()-started;
    let payload=null,raw='';
    try{raw=await response.text();payload=raw?JSON.parse(raw):null;}catch{payload=null;}
    return {
      ok:response.ok,
      status:response.status,
      code:payload?.code||null,
      requestId:payload?.requestId||null,
      latencyMs:Number(latencyMs.toFixed(3)),
      metadata:built.metadata,
      response:payload,
      responseWasJson:payload!==null,
      rawResponseLength:raw.length,
      secretExposed:false,
      signatureExposed:false
    };
  }catch(error){
    return {ok:false,status:0,code:error?.name==='AbortError'?'CLIENT_TIMEOUT':'CLIENT_NETWORK_ERROR',message:String(error?.message||error),metadata:built.metadata,secretExposed:false,signatureExposed:false};
  }finally{clearTimeout(timer);}
}

export function sanitizedClientConfig(configInput={}){
  let endpoint=null;try{endpoint=configInput.endpoint?new URL(configInput.endpoint).toString():null}catch{}
  return {endpoint,agentId:text(configInput.agentId,120),tenantId:text(configInput.tenantId,160),timeoutMs:boundedTimeout(configInput.timeoutMs),secretConfigured:Boolean(text(configInput.secret,4096)),secretExposed:false};
}
