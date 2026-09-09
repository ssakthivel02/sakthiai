#!/usr/bin/env node
import {checkP3NonprodReadiness} from './lib/p3-nonprod-preflight.mjs';

const input={
  endpoint:process.env.SAKTHIAI_WEBHOOK_ENDPOINT,
  secret:process.env.SAKTHIAI_WEBHOOK_SECRET,
  agentId:process.env.SAKTHIAI_WEBHOOK_AGENT_ID,
  tenantId:process.env.SAKTHIAI_WEBHOOK_TENANT_ID,
  environment:process.env.SAKTHIAI_EVIDENCE_ENVIRONMENT,
  ack:process.env.SAKTHIAI_EVIDENCE_NONPROD_ACK
};
const result=await checkP3NonprodReadiness(input);
const serialized=JSON.stringify(result,null,2)+'\n';
if(input.secret&&serialized.includes(input.secret)){
  console.error(JSON.stringify({ok:false,code:'P3_SECRET_LEAK_GUARD'},null,2));
  process.exit(2);
}
process.stdout.write(serialized);
if(!result.ok)process.exitCode=1;
