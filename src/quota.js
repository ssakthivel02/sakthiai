function enabled(env,name){return String(env?.[name]||'').toLowerCase()==='true';}
function int(value,fallback,min,max){const n=Number.parseInt(String(value??''),10);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}

export function quotaPolicy(env){return {
  enabled:enabled(env,'QUOTA_RUNTIME_ENABLED'),
  windowSeconds:int(env.QUOTA_WINDOW_SECONDS,60,10,3600),
  requestsPerWindow:int(env.QUOTA_REQUESTS_PER_WINDOW,30,1,1000),
  dailyAiRequests:int(env.QUOTA_DAILY_AI_REQUESTS,100,1,100000),
  paidOverage:false,
  behavior:'FAIL_CLOSED'
};}

export async function enforceQuota(env,{tenantId,userId,capability='api'}){
  const policy=quotaPolicy(env);
  if(!policy.enabled)return {ok:false,code:'QUOTA_RUNTIME_DISABLED',policy};
  if(!env.DB)return {ok:false,code:'QUOTA_STORE_UNAVAILABLE',policy};
  const now=new Date();
  const windowStart=new Date(Math.floor(now.getTime()/(policy.windowSeconds*1000))*policy.windowSeconds*1000).toISOString();
  const day=now.toISOString().slice(0,10);
  const windowCount=await env.DB.prepare(`SELECT COUNT(*) AS n FROM usage_ledger WHERE tenant_id=? AND user_id=? AND capability=? AND created_at>=?`).bind(tenantId,userId,capability,windowStart).first();
  if(Number(windowCount?.n||0)>=policy.requestsPerWindow)return {ok:false,code:'RATE_LIMITED',policy,retryAfter:policy.windowSeconds};
  if(capability==='chat'||capability==='research'||capability==='code'||capability==='agents'){
    const daily=await env.DB.prepare(`SELECT COUNT(*) AS n FROM usage_ledger WHERE tenant_id=? AND user_id=? AND capability IN ('chat','research','code','agents') AND substr(created_at,1,10)=?`).bind(tenantId,userId,day).first();
    if(Number(daily?.n||0)>=policy.dailyAiRequests)return {ok:false,code:'DAILY_AI_QUOTA_EXCEEDED',policy};
  }
  return {ok:true,policy};
}

export async function recordUsage(env,{tenantId,userId,requestId,capability,provider=null,model=null,costClass='free',inputUnits=0,outputUnits=0,latencyMs=null}){
  if(!env.DB||!enabled(env,'PERSISTENCE_ENABLED'))return {recorded:false};
  await env.DB.prepare(`INSERT INTO usage_ledger(id,tenant_id,user_id,request_id,capability,provider,model,cost_class,input_units,output_units,latency_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(`use_${crypto.randomUUID()}`,tenantId,userId,requestId,capability,provider,model,costClass,inputUnits,outputUnits,latencyMs).run();
  return {recorded:true};
}
