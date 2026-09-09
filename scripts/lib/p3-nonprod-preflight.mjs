const ACK='NON_PRODUCTION_ONLY';

function text(value,max){const out=String(value??'').trim();return out&&out.length<=max?out:null;}
function isProdLabel(value){return /(^|[-_\s])(prod|production|live)([-_\s]|$)/i.test(String(value||''));}
function contractUrl(endpoint){const u=new URL(endpoint);u.pathname=u.pathname.replace(/\/evaluate\/?$/,'/contract');u.search='';u.hash='';return u.toString();}

export function validateP3NonprodInputs(input={}){
  const endpoint=text(input.endpoint,2000),environment=text(input.environment,120),ack=text(input.ack,80);
  const secret=text(input.secret,4096),agentId=text(input.agentId,120),tenantId=text(input.tenantId,160);
  if(ack!==ACK)return {ok:false,code:'P3_NONPROD_ACK_REQUIRED'};
  if(!environment)return {ok:false,code:'P3_ENVIRONMENT_NAME_REQUIRED'};
  if(isProdLabel(environment))return {ok:false,code:'P3_PRODUCTION_ENVIRONMENT_FORBIDDEN'};
  if(!endpoint)return {ok:false,code:'P3_ENDPOINT_REQUIRED'};
  let url;try{url=new URL(endpoint);}catch{return {ok:false,code:'P3_ENDPOINT_INVALID'};}
  if(url.protocol!=='https:')return {ok:false,code:'P3_HTTPS_REQUIRED'};
  if(['localhost','127.0.0.1','::1'].includes(url.hostname.toLowerCase()))return {ok:false,code:'P3_LOCALHOST_NOT_REAL_EVIDENCE'};
  if(!url.pathname.endsWith('/api/v1/agents/external-proposals/evaluate'))return {ok:false,code:'P3_ENDPOINT_PATH_INVALID'};
  if(!secret||secret.length<32)return {ok:false,code:'P3_SECRET_MISSING_OR_WEAK'};
  if(!agentId)return {ok:false,code:'P3_AGENT_ID_REQUIRED'};
  if(!tenantId)return {ok:false,code:'P3_TENANT_ID_REQUIRED'};
  return {ok:true,config:{endpoint:url.toString(),contractEndpoint:contractUrl(url.toString()),environment,agentId,tenantId,secretConfigured:true,secretExposed:false}};
}

export async function checkP3NonprodReadiness(input={},fetchImpl=fetch){
  const checked=validateP3NonprodInputs(input);
  if(!checked.ok)return checked;
  const {config}=checked;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetchImpl(config.contractEndpoint,{headers:{accept:'application/json'},signal:controller.signal});
    if(!response.ok)return {ok:false,code:'P3_CONTRACT_ENDPOINT_UNAVAILABLE',status:response.status,config:{...config,secretConfigured:true}};
    const payload=await response.json();const c=payload?.contract;
    if(!payload?.ok||!c)return {ok:false,code:'P3_CONTRACT_INVALID',config};
    const checks={
      webhookEnabled:c.enabled===true,
      scopeConfigured:c.scopeConfigured===true,
      durableReplayStore:c.durableReplayStore===true,
      replayStoreAvailable:c.replayStoreState==='AVAILABLE',
      readOnlyOnly:Array.isArray(c.allowedActionClasses)&&c.allowedActionClasses.length===1&&c.allowedActionClasses[0]==='read_only',
      dryRunOnly:c.requestedExecution==='dry_run',
      externalSideEffectsDisabled:c.externalSideEffects===false,
      executorUnbound:c.executorBound===false
    };
    const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
    return {
      ok:failed.length===0,
      code:failed.length?'P3_NONPROD_PREFLIGHT_FAILED':'P3_NONPROD_PREFLIGHT_PASS',
      environment:config.environment,
      endpoint:config.endpoint,
      contractEndpoint:config.contractEndpoint,
      agentId:config.agentId,
      tenantId:config.tenantId,
      secretConfigured:true,
      secretExposed:false,
      checks,
      failed,
      contractSummary:{phase:c.phase||null,version:c.version||null,allowedAgentCount:c.allowedAgentCount??null,allowedTenantCount:c.allowedTenantCount??null,nonceRetentionSeconds:c.nonceRetentionSeconds??null},
      externalWritesPermitted:false,
      productionReadyClaim:false
    };
  }catch(error){return {ok:false,code:error?.name==='AbortError'?'P3_PREFLIGHT_TIMEOUT':'P3_PREFLIGHT_NETWORK_ERROR',message:String(error?.message||error),environment:config.environment,endpoint:config.endpoint,secretConfigured:true,secretExposed:false};}
  finally{clearTimeout(timer);}
}

export const P3_NONPROD_ACK=ACK;
