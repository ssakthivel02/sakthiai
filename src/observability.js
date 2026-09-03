function enabled(env,name){return String(env?.[name]||'').toLowerCase()==='true';}
function cleanPath(value){try{return new URL(String(value||'https://invalid/')).pathname.slice(0,240)||'/';}catch{return '/';}}
function traceFromHeader(request){
  const value=String(request?.headers?.get?.('traceparent')||'').trim().toLowerCase();
  const match=/^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/.exec(value);
  return match?.[1]||null;
}
function generatedTraceId(){return crypto.randomUUID().replaceAll('-','').slice(0,32);}

export function createTraceContext(request,requestId){
  const inherited=traceFromHeader(request);
  return {
    requestId:String(requestId||`sai_${Date.now()}_${crypto.randomUUID().slice(0,8)}`),
    traceId:inherited||generatedTraceId(),
    traceSource:inherited?'w3c':'generated',
    method:String(request?.method||'GET').toUpperCase().slice(0,12),
    route:cleanPath(request?.url),
    startedAtMs:Date.now()
  };
}

export function readinessSnapshot(env={}){
  const guards={
    paidProvidersOff:!enabled(env,'PAID_PROVIDERS_ENABLED'),
    aiRuntimeOff:!enabled(env,'AI_RUNTIME_ENABLED'),
    persistenceOff:!enabled(env,'PERSISTENCE_ENABLED'),
    identityRuntimeOff:!enabled(env,'IDENTITY_RUNTIME_ENABLED'),
    quotaRuntimeOff:!enabled(env,'QUOTA_RUNTIME_ENABLED'),
    agentControlOff:!enabled(env,'AGENT_CONTROL_ENABLED'),
    executorBindingsOff:!enabled(env,'AGENT_EXECUTOR_BINDINGS_ENABLED'),
    externalActionsOff:!enabled(env,'AGENT_EXTERNAL_ACTIONS_ENABLED'),
    verifierRuntimeOff:!enabled(env,'AGENT_VERIFIER_RUNTIME_ENABLED'),
    previewDeployOff:!enabled(env,'PREVIEW_DEPLOY_ENABLED'),
    d1Unbound:!env.DB,
    r2Unbound:!env.R2,
    aiSearchUnbound:!env.AI_SEARCH
  };
  const previewSafeConfiguration=Object.values(guards).every(Boolean);
  return {
    phase:'SAI-V6_SOURCE_PREVIEW_READINESS',
    state:previewSafeConfiguration?'SOURCE_PREVIEW_SAFE':'PREVIEW_GUARD_FAILED',
    previewSafeConfiguration,
    productionReady:false,
    deploymentPerformed:false,
    browserQaPerformed:false,
    guards,
    unresolvedExternalGates:['protected_main','real_access_configuration','controlled_preview_browser_qa','explicit_d1_approval']
  };
}

export function costBoundarySnapshot(env={}){
  const int=(value,fallback)=>{const n=Number.parseInt(String(value??''),10);return Number.isFinite(n)?n:fallback;};
  return {
    mode:'FREE_FIRST_FAIL_CLOSED',
    paidProvidersEnabled:enabled(env,'PAID_PROVIDERS_ENABLED'),
    paidOverageAllowed:false,
    aiRuntimeEnabled:enabled(env,'AI_RUNTIME_ENABLED'),
    quotaRuntimeEnabled:enabled(env,'QUOTA_RUNTIME_ENABLED'),
    quotaDefaults:{
      windowSeconds:int(env.QUOTA_WINDOW_SECONDS,60),
      requestsPerWindow:int(env.QUOTA_REQUESTS_PER_WINDOW,30),
      dailyAiRequests:int(env.QUOTA_DAILY_AI_REQUESTS,100)
    },
    resourceBindings:{d1:Boolean(env.DB),r2:Boolean(env.R2),aiSearch:Boolean(env.AI_SEARCH)},
    publicUsageTotalsExposed:false,
    tenantUsageDetailsExposed:false
  };
}

export function observabilitySnapshot(env={}){return {
  phase:'SAI-V6_OBSERVABILITY_CONTRACT',
  runtimeLoggingEnabled:enabled(env,'OBSERVABILITY_RUNTIME_ENABLED'),
  requestCorrelation:true,
  responseRequestIdHeader:true,
  responseTraceIdHeader:true,
  serverTimingHeader:true,
  publicTelemetryMode:'CONFIGURATION_ONLY',
  safeEventFields:['requestId','traceId','method','route','status','durationMs','outcomeCode'],
  forbiddenPublicFields:['prompt','messageBody','email','accessToken','authorization','cookie','jwt','tenantUsage','userIdentity','rawAuditPayload'],
  rawPromptLogging:false,
  rawIdentityLogging:false,
  rawSecretLogging:false
};}

function safeOutcome(response){
  const status=Number(response?.status||0);
  if(status>=500)return 'SERVER_ERROR';
  if(status>=400)return 'REQUEST_REJECTED';
  if(status>=300)return 'REDIRECT';
  return 'OK';
}

export function finalizeResponse(response,context,env={}){
  const durationMs=Math.max(0,Date.now()-Number(context?.startedAtMs||Date.now()));
  const headers=new Headers(response.headers);
  headers.set('x-sakthiai-request-id',context.requestId);
  headers.set('x-sakthiai-trace-id',context.traceId);
  headers.set('server-timing',`sakthiai;dur=${durationMs}`);
  headers.set('timing-allow-origin','same-origin');
  if(enabled(env,'OBSERVABILITY_RUNTIME_ENABLED')){
    console.log(JSON.stringify({
      type:'sakthiai_request',
      requestId:context.requestId,
      traceId:context.traceId,
      method:context.method,
      route:context.route,
      status:Number(response.status||0),
      durationMs,
      outcomeCode:safeOutcome(response)
    }));
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
