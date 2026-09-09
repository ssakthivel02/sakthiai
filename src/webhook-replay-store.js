const VERSION='SAI-P2-WEBHOOK-REPLAY-1';

function enabled(env,name){return String(env?.[name]||'').toLowerCase()==='true';}
function text(value,max){const out=String(value??'').trim();return out&&out.length<=max?out:null;}
function retentionSeconds(env){
  const n=Number(env?.AGENT_WEBHOOK_NONCE_RETENTION_SECONDS||3600);
  return Number.isFinite(n)&&n>=300&&n<=86400?Math.floor(n):3600;
}
function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function sha256Hex(value){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value??'')));
  return hex(digest);
}

export function webhookReplayStoreState(env={}){
  const gate=enabled(env,'AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED');
  const bound=Boolean(env?.DB);
  return {
    version:VERSION,
    enabled:gate,
    state:!gate?'DISABLED':(bound?'AVAILABLE':'BINDING_MISSING'),
    binding:'DB',
    durable:gate&&bound,
    retentionSeconds:retentionSeconds(env),
    uniqueness:'tenant_id + agent_id + nonce_sha256',
    storesRawNonce:false,
    storesRawBody:false
  };
}

export async function consumeWebhookNonce(env,{tenantId,agentId,runId,nonce,requestTimestamp,rawBody,nowMs=Date.now()}){
  const state=webhookReplayStoreState(env);
  if(state.state==='DISABLED')return {ok:false,status:503,code:'AGENT_WEBHOOK_REPLAY_STORE_DISABLED',state};
  if(state.state==='BINDING_MISSING')return {ok:false,status:503,code:'AGENT_WEBHOOK_REPLAY_STORE_BINDING_MISSING',state};
  const safeTenant=text(tenantId,160),safeAgent=text(agentId,120),safeRun=text(runId,200),safeNonce=text(nonce,160);
  const ts=Number(requestTimestamp);
  if(!safeTenant||!safeAgent||!safeRun||!safeNonce||!Number.isFinite(ts)||ts<=0||typeof rawBody!=='string'){
    return {ok:false,status:400,code:'AGENT_WEBHOOK_REPLAY_INPUT_INVALID',state};
  }
  const nonceHash=await sha256Hex(safeNonce);
  const bodyHash=await sha256Hex(rawBody);
  const expiresAt=Math.floor(nowMs/1000)+state.retentionSeconds;
  const id=`awn_${crypto.randomUUID()}`;
  try{
    const result=await env.DB.prepare(`INSERT OR IGNORE INTO agent_webhook_nonces(id,tenant_id,agent_id,run_id,nonce_sha256,request_timestamp,body_sha256,expires_at) VALUES(?,?,?,?,?,?,?,?)`)
      .bind(id,safeTenant,safeAgent,safeRun,nonceHash,Math.floor(ts),bodyHash,expiresAt).run();
    const changes=Number(result?.meta?.changes??0);
    if(changes!==1){
      return {ok:false,status:409,code:'AGENT_WEBHOOK_REPLAY_DETECTED',state,durable:true,nonceSha256:nonceHash,bodySha256:bodyHash,expiresAt};
    }
    return {ok:true,status:201,code:'AGENT_WEBHOOK_NONCE_CONSUMED',state,durable:true,id,nonceSha256:nonceHash,bodySha256:bodyHash,expiresAt};
  }catch(error){
    return {ok:false,status:503,code:'AGENT_WEBHOOK_REPLAY_STORE_ERROR',state,message:'Durable replay ledger write failed safely.'};
  }
}

export async function purgeExpiredWebhookNonces(env,nowMs=Date.now()){
  const state=webhookReplayStoreState(env);
  if(state.state!=='AVAILABLE')return {ok:false,code:state.state==='DISABLED'?'AGENT_WEBHOOK_REPLAY_STORE_DISABLED':'AGENT_WEBHOOK_REPLAY_STORE_BINDING_MISSING',state};
  try{
    const result=await env.DB.prepare(`DELETE FROM agent_webhook_nonces WHERE expires_at < ?`).bind(Math.floor(nowMs/1000)).run();
    return {ok:true,deleted:Number(result?.meta?.changes??0),state};
  }catch{
    return {ok:false,code:'AGENT_WEBHOOK_REPLAY_STORE_ERROR',state};
  }
}
