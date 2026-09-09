#!/usr/bin/env node
import fs from 'node:fs/promises';
import {sendSignedExternalProposal,sanitizedClientConfig} from './lib/signed-webhook-client.mjs';

function arg(name,fallback=null){const i=process.argv.indexOf(`--${name}`);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;}
function flag(name){return process.argv.includes(`--${name}`);}
function fail(code,message){console.error(JSON.stringify({ok:false,code,message,secretExposed:false,signatureExposed:false},null,2));process.exit(2);}

const endpoint=arg('endpoint',process.env.SAKTHIAI_WEBHOOK_ENDPOINT);
const secret=process.env.SAKTHIAI_WEBHOOK_SECRET;
const agentId=arg('agent-id',process.env.SAKTHIAI_WEBHOOK_AGENT_ID);
const tenantId=arg('tenant-id',process.env.SAKTHIAI_WEBHOOK_TENANT_ID);
const taskId=arg('task-id',`client_${Date.now()}`);
const action=arg('action','Inspect the configured read-only target and return evidence only.');
const rationale=arg('rationale','Controlled SakthiAI P3 read-only external-client evidence run.');
const targetSystem=arg('target-system','external-client');
const targetResource=arg('target-resource','read-only-evidence');
const output=arg('output',null);
const timeoutMs=Number(arg('timeout-ms',process.env.SAKTHIAI_WEBHOOK_TIMEOUT_MS||15000));
const allowLocalhost=flag('allow-localhost');

if(!endpoint)fail('CLIENT_ENDPOINT_REQUIRED','Set --endpoint or SAKTHIAI_WEBHOOK_ENDPOINT.');
if(!secret)fail('CLIENT_SECRET_REQUIRED','Set SAKTHIAI_WEBHOOK_SECRET in the process environment. Never pass it on the command line.');
if(!agentId)fail('CLIENT_AGENT_ID_REQUIRED','Set --agent-id or SAKTHIAI_WEBHOOK_AGENT_ID.');
if(!tenantId)fail('CLIENT_TENANT_ID_REQUIRED','Set --tenant-id or SAKTHIAI_WEBHOOK_TENANT_ID.');

const config={endpoint,secret,agentId,tenantId,timeoutMs,allowLocalhost};
const proposal={taskId,action,rationale,target:{system:targetSystem,resource:targetResource}};
const result=await sendSignedExternalProposal(config,proposal,{allowLocalhost});
const report={
  schema:'sakthiai.external-client.single-run.v1',
  generatedAt:new Date().toISOString(),
  client:sanitizedClientConfig(config),
  proposal:{taskId,actionClass:'read_only',requestedExecution:'dry_run',target:proposal.target},
  outcome:result,
  evidenceBoundary:{realHttpClient:true,externalSideEffectsExpected:false,repositoryWriteRequested:false,productionReadyClaim:false}
};
const serialized=JSON.stringify(report,null,2)+'\n';
if(serialized.includes(secret))fail('CLIENT_SECRET_LEAK_GUARD','Refusing to emit output because the configured secret appeared in the serialized report.');
if(output){await fs.mkdir(new URL('.',`file://${process.cwd()}/${output}`).pathname,{recursive:true}).catch(()=>{});await fs.writeFile(output,serialized,'utf8');}
process.stdout.write(serialized);
if(!result.ok)process.exitCode=1;
