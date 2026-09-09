#!/usr/bin/env node
import fs from 'node:fs/promises';
import {buildP3EvidenceConfig,p3WranglerCommands} from './lib/p3-env-config.mjs';

const output=process.env.SAKTHIAI_P3_CONFIG_PATH||'wrangler.p3-evidence.generated.jsonc';
const input={
  ack:process.env.SAKTHIAI_EVIDENCE_NONPROD_ACK,
  environment:process.env.SAKTHIAI_EVIDENCE_ENVIRONMENT,
  databaseName:process.env.SAKTHIAI_P3_D1_DATABASE_NAME,
  databaseId:process.env.SAKTHIAI_P3_D1_DATABASE_ID,
  agentId:process.env.SAKTHIAI_WEBHOOK_AGENT_ID,
  tenantId:process.env.SAKTHIAI_WEBHOOK_TENANT_ID,
  workerBase:process.env.SAKTHIAI_P3_WORKER_BASE
};
try{
  const {config,summary}=buildP3EvidenceConfig(input);
  await fs.writeFile(output,JSON.stringify(config,null,2)+'\n','utf8');
  const result={ok:true,marker:'SAKTHIAI_P3_NONPROD_CONFIG_READY',output,summary,commands:p3WranglerCommands({databaseName:input.databaseName,configPath:output}),secretInstruction:'Set AGENT_WEBHOOK_SHARED_SECRET with `wrangler secret put`; it is intentionally absent from the generated file.'};
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}catch(error){
  process.stderr.write(JSON.stringify({ok:false,code:error?.message||'P3_CONFIG_PREPARE_FAILED',secretExposed:false},null,2)+'\n');
  process.exitCode=1;
}
