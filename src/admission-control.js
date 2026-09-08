function bool(value){return String(value??'').toLowerCase()==='true';}
function int(value,fallback,min,max){const n=Number.parseInt(String(value??''),10);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}

export function admissionPolicy(env={}){
  const hardLimit=int(env.ADMISSION_GLOBAL_CONCURRENCY_LIMIT,32,1,100000);
  const degradePercent=int(env.ADMISSION_DEGRADE_AT_PERCENT,75,1,100);
  return {
    enabled:bool(env.ADMISSION_CONTROL_ENABLED),
    hardLimit,
    degradeAt:Math.max(1,Math.floor(hardLimit*degradePercent/100)),
    defaultDecision:'ADMIT',
    unknownCapacityBehavior:'FAIL_CLOSED_WHEN_ENABLED',
    paidFallback:false
  };
}

export function evaluateAdmission(env={},input={}){
  const policy=admissionPolicy(env);
  if(!policy.enabled)return {ok:true,decision:'ADMIT',code:'ADMISSION_CONTROL_DISABLED',policy};

  const active=Number(input.activeRequests);
  if(!Number.isFinite(active)||active<0)return {ok:false,decision:'REJECT',code:'CAPACITY_SIGNAL_REQUIRED',policy};

  const priority=String(input.priority||'normal').toLowerCase();
  const requestClass=String(input.requestClass||'interactive').toLowerCase();
  const cacheable=Boolean(input.cacheable);

  if(active>=policy.hardLimit){
    if(requestClass==='batch'||priority==='low')return {ok:false,decision:'QUEUE',code:'GLOBAL_CAPACITY_EXHAUSTED',policy,retryAfterSeconds:30};
    return {ok:false,decision:'REJECT',code:'GLOBAL_CAPACITY_EXHAUSTED',policy,retryAfterSeconds:15};
  }

  if(active>=policy.degradeAt){
    if(requestClass==='batch')return {ok:false,decision:'QUEUE',code:'CAPACITY_PRESSURE_BATCH_DEFERRED',policy,retryAfterSeconds:20};
    return {ok:true,decision:'DEGRADE',code:'CAPACITY_PRESSURE',policy,degradation:{preferCache:cacheable,maxOutputScale:0.5,disableOptionalTools:true}};
  }

  return {ok:true,decision:'ADMIT',code:'CAPACITY_AVAILABLE',policy};
}
