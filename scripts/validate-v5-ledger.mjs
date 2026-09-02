import fs from 'node:fs';

const must=(condition,message)=>{if(!condition)throw new Error(message);};
for(const file of ['migrations/0003_executor_control.sql','scripts/test-executor-contracts.mjs','config/executor-contracts.json','openapi/sakthiai-v5.yaml','assets/agent-control-ui.js','assets/agent-control.css']){
  must(fs.existsSync(file),`Missing V5 file: ${file}`);
}

const migration=fs.readFileSync('migrations/0003_executor_control.sql','utf8');
const migrationTest=fs.readFileSync('scripts/test_d1_migration.py','utf8');
const worker=fs.readFileSync('src/worker.js','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const app=fs.readFileSync('assets/app.js','utf8');
const ui=fs.readFileSync('assets/agent-control-ui.js','utf8');
const openapi=fs.readFileSync('openapi/sakthiai-v5.yaml','utf8');
const executorSource=fs.readFileSync('src/executor-contracts.js','utf8');
const executorConfig=JSON.parse(fs.readFileSync('config/executor-contracts.json','utf8'));
const policy=JSON.parse(fs.readFileSync('config/runtime-policy.json','utf8'));

must(policy.schemaVersion==='5.0','V5 runtime policy marker missing');
must(policy.runtimeGates.agentExecutorBindings===false,'executor binding runtime gate must default false');
must(policy.executorContracts.boundExecutors===0,'runtime policy must report zero bound executors');
must(policy.executorContracts.externalExecutionImplemented===false,'runtime policy must deny external execution implementation');
must(wrangler.includes('"AGENT_EXECUTOR_BINDINGS_ENABLED": "false"'),'Wrangler executor binding gate must default false');
must(worker.includes("agentExecutorBindings:feature(env,'AGENT_EXECUTOR_BINDINGS_ENABLED')"),'Worker policy must expose executor binding gate');
must(worker.includes("bindingGateEnabled:feature(env,'AGENT_EXECUTOR_BINDINGS_ENABLED')"),'executor registry response must expose binding gate truth');
must(worker.includes("executorBindings:feature(env,'AGENT_EXECUTOR_BINDINGS_ENABLED')?'ENABLED_NO_BINDINGS':'DISABLED'"),'agent capability must distinguish binding gate from actual bindings');
must(!worker.includes("url.pathname==='/api/v1/agents/execute'"),'public worker execute endpoint is forbidden in V5');

must(executorConfig.contracts.length===6,'V5 must define six executor contract classes');
must(executorConfig.contracts.every(item=>item.state==='NO_EXECUTOR_BOUND'),'all V5 executor contracts must remain unbound');
must(executorConfig.externalExecutionImplemented===false,'executor registry must deny execution');
must(executorSource.includes('validateExecutionEnvelope'),'executor envelope validation missing');
must(executorSource.includes('EXECUTOR_IDEMPOTENCY_REQUIRED'),'idempotency enforcement missing');
must(executorSource.includes('EXECUTOR_APPROVAL_REQUIRED'),'approval enforcement missing');
must(executorSource.includes('EXECUTOR_VERIFIER_REQUIRED'),'verifier enforcement missing');
must(executorSource.includes('EXECUTOR_ROLLBACK_PLAN_REQUIRED'),'rollback enforcement missing');
must(executorSource.includes("executed:false,sideEffects:false,executorBound:false"),'dry-run truth receipt missing');
must(!executorSource.includes('fetch('),'executor contracts must not call external services');

for(const table of ['execution_attempts','execution_receipts','rollback_records'])must(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`),`V5 migration missing ${table}`);
must(migration.includes("VALUES ('schema_version','3'"),'V5 D1 schema version marker missing');
must(migration.includes('UNIQUE(tenant_id,idempotency_key)'),'tenant-scoped idempotency uniqueness missing');
must(migration.includes('FOREIGN KEY (tenant_id,task_id) REFERENCES tasks(tenant_id,id)'),'tenant/task composite FK missing from executor ledger');
must(migration.includes('FOREIGN KEY (tenant_id,approval_id) REFERENCES approvals(tenant_id,id) ON DELETE RESTRICT'),'tenant/approval composite FK missing or unsafe');
must(migration.includes('FOREIGN KEY (tenant_id,verifier_run_id) REFERENCES verifier_runs(tenant_id,id) ON DELETE RESTRICT'),'tenant/verifier composite FK missing or unsafe');
must(migration.includes('side_effects INTEGER NOT NULL DEFAULT 0'),'side-effect truth field must default false');
must(migrationTest.includes("migrations/0003_executor_control.sql"),'D1 test must execute V5 migration');
must(migrationTest.includes('DUPLICATE_IDEMPOTENCY_ALLOWED'),'D1 test must reject duplicate idempotency');
must(migrationTest.includes('CROSS_TENANT_EXECUTION_TASK_ALLOWED'),'D1 test must reject cross-tenant execution task linkage');
must(migrationTest.includes('CROSS_TENANT_EXECUTION_APPROVAL_ALLOWED'),'D1 test must reject cross-tenant approval linkage');
must(migrationTest.includes('CROSS_TENANT_EXECUTION_VERIFIER_ALLOWED'),'D1 test must reject cross-tenant verifier linkage');
must(migrationTest.includes('CROSS_TENANT_EXECUTION_RECEIPT_ALLOWED'),'D1 test must reject cross-tenant receipts');
must(migrationTest.includes('CROSS_TENANT_ROLLBACK_ALLOWED'),'D1 test must reject cross-tenant rollback records');

must(app.includes("import('./agent-control-ui.js')"),'Agent Control Center module loader missing');
must(ui.includes("getJson('/api/v1/agents/control/status')"),'Control Center must read verified control status');
must(ui.includes("getJson('/api/v1/agents/executors/contracts')"),'Control Center must read executor registry');
must(!ui.includes("method:'POST'"),'Control Center must remain read-only');
must(!ui.includes('/execute'),'Control Center must not expose execute route');
must(sw.includes("'./assets/agent-control-ui.js'"),'PWA core cache must include Control Center JS');
must(sw.includes("'./assets/agent-control.css'"),'PWA core cache must include Control Center CSS');
must(sw.includes("url.pathname.startsWith('/api/')"),'PWA must continue excluding API responses from cache');
must(openapi.includes('/api/v1/agents/executors/contracts:'),'V5 OpenAPI contract route missing');
must(openapi.includes('NO_EXECUTOR_BOUND'),'V5 OpenAPI binding truth missing');
must(!openapi.includes('/api/v1/agents/execute'),'V5 OpenAPI must not expose execution endpoint');

console.log('SAKTHIAI_V5_EXECUTOR_LEDGER_VALIDATION_PASS');
console.log(JSON.stringify({executorContracts:6,boundExecutors:0,externalExecutionImplemented:false,bindingGateDefault:false,idempotencyUnique:true,rollbackLedger:true,controlCenterReadOnly:true,pwaControlCenterCached:true},null,2));
