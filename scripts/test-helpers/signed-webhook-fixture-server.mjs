import http from 'node:http';
import {evaluateSignedAgentWebhook,signedAgentWebhookContract} from '../../src/signed-agent-webhook.js';
import {createFakeWebhookReplayDb} from './fake-webhook-replay-db.mjs';

const port=Number(process.env.SAKTHIAI_FIXTURE_PORT||8877);
const secret=process.env.SAKTHIAI_FIXTURE_SECRET||'fixture-only-shared-secret-0123456789abcdef';
const agentId=process.env.SAKTHIAI_FIXTURE_AGENT||'fixture-client-agent';
const tenantId=process.env.SAKTHIAI_FIXTURE_TENANT||'fixture-client-tenant';
const db=createFakeWebhookReplayDb();
const env={
  AGENT_WEBHOOK_ENABLED:'true',
  AGENT_WEBHOOK_SHARED_SECRET:secret,
  AGENT_WEBHOOK_MAX_SKEW_SECONDS:'300',
  AGENT_WEBHOOK_ALLOWED_AGENTS:agentId,
  AGENT_WEBHOOK_ALLOWED_TENANTS:tenantId,
  AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED:'true',
  AGENT_WEBHOOK_NONCE_RETENTION_SECONDS:'3600',
  DB:db
};

function json(res,status,body){const raw=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','content-length':Buffer.byteLength(raw)});res.end(raw);}
function collect(req){return new Promise((resolve,reject)=>{const chunks=[];let size=0;req.on('data',chunk=>{size+=chunk.length;if(size>65536){reject(new Error('PAYLOAD_TOO_LARGE'));req.destroy();return;}chunks.push(chunk);});req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));req.on('error',reject);});}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,fixture:true,replayStoreRows:db.rows.size});
    if(req.method==='GET'&&url.pathname==='/api/v1/agents/external-proposals/contract')return json(res,200,{ok:true,contract:signedAgentWebhookContract(env)});
    if(req.method!=='POST'||url.pathname!=='/api/v1/agents/external-proposals/evaluate')return json(res,404,{ok:false,code:'NOT_FOUND'});
    const raw=await collect(req);
    const headers=new Headers();for(const [k,v] of Object.entries(req.headers)){if(Array.isArray(v))for(const x of v)headers.append(k,x);else if(v!=null)headers.set(k,String(v));}
    const request=new Request(`http://127.0.0.1:${port}${url.pathname}`,{method:'POST',headers,body:raw});
    const result=await evaluateSignedAgentWebhook(request,env,Date.now());
    return json(res,result.status||200,{...result,requestId:`fixture_${crypto.randomUUID().slice(0,8)}`});
  }catch(error){return json(res,500,{ok:false,code:'FIXTURE_ERROR',message:String(error?.message||error)});}
});

server.listen(port,'127.0.0.1',()=>console.log(`SAKTHIAI_FIXTURE_SERVER_READY http://127.0.0.1:${port}`));
const close=()=>server.close(()=>process.exit(0));
process.on('SIGTERM',close);process.on('SIGINT',close);
