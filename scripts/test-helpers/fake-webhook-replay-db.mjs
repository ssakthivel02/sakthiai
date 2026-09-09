export function createFakeWebhookReplayDb({failWrites=false}={}){
  const rows=new Map();
  const keyOf=(tenantId,agentId,nonceSha256)=>`${tenantId}\u0000${agentId}\u0000${nonceSha256}`;
  return {
    rows,
    prepare(sql){
      const statement=String(sql||'').trim();
      return {
        bind(...args){
          return {
            async run(){
              if(failWrites)throw new Error('FAKE_D1_WRITE_FAILURE');
              if(statement.startsWith('INSERT OR IGNORE INTO agent_webhook_nonces')){
                const [id,tenantId,agentId,runId,nonceSha256,requestTimestamp,bodySha256,expiresAt]=args;
                const key=keyOf(tenantId,agentId,nonceSha256);
                if(rows.has(key))return {success:true,meta:{changes:0}};
                rows.set(key,{id,tenantId,agentId,runId,nonceSha256,requestTimestamp,bodySha256,expiresAt,consumedAt:new Date().toISOString()});
                return {success:true,meta:{changes:1}};
              }
              if(statement.startsWith('DELETE FROM agent_webhook_nonces WHERE expires_at < ?')){
                const [cutoff]=args;let changes=0;
                for(const [key,row] of rows){if(Number(row.expiresAt)<Number(cutoff)){rows.delete(key);changes++;}}
                return {success:true,meta:{changes}};
              }
              throw new Error(`FAKE_D1_UNSUPPORTED_SQL:${statement.slice(0,80)}`);
            }
          };
        }
      };
    }
  };
}
