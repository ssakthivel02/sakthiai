import fs from 'node:fs';

const required=[
  'index.html','assets/styles.css','assets/app.js','assets/capabilities.js','assets/runtime.js','assets/agent-control.css','assets/agent-control-ui.js',
  'config/runtime-policy.json','config/capability-contracts.json','config/executor-contracts.json','src/worker.js','src/persistence.js',
  'src/execution-contracts.js','src/auth.js','src/rbac.js','src/quota.js','src/agent-state.js',
  'src/agent-control.js','src/agent-api.js','src/agent-leases.js','src/agent-queries.js','src/executor-contracts.js',
  'openapi/sakthiai-v1.yaml','openapi/sakthiai-v2.yaml','openapi/sakthiai-v3.yaml','openapi/sakthiai-v4.yaml','openapi/sakthiai-v5.yaml',
  'migrations/0001_foundation.sql','migrations/0002_agent_control.sql',
  'scripts/test-auth.mjs','scripts/test-agent-state.mjs','scripts/test-executor-contracts.mjs','scripts/test_d1_migration.py',
  'manifest.webmanifest','sw.js','offline.html','wrangler.jsonc'
];
for(const file of required){if(!fs.existsSync(file))throw new Error(`Missing required file: ${file}`);}

const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/styles.css','utf8');
const app=fs.readFileSync('assets/app.js','utf8');
const caps=fs.readFileSync('assets/capabilities.js','utf8');
const runtime=fs.readFileSync('assets/runtime.js','utf8');
const agentUi=fs.readFileSync('assets/agent-control-ui.js','utf8');
const agentUiCss=fs.readFileSync('assets/agent-control.css','utf8');
const worker=fs.readFileSync('src/worker.js','utf8');
const persistence=fs.readFileSync('src/persistence.js','utf8');
const execution=fs.readFileSync('src/execution-contracts.js','utf8');
const auth=fs.readFileSync('src/auth.js','utf8');
const rbac=fs.readFileSync('src/rbac.js','utf8');
const quota=fs.readFileSync('src/quota.js','utf8');
const agentState=fs.readFileSync('src/agent-state.js','utf8');
const agentControl=fs.readFileSync('src/agent-control.js','utf8');
const agentApi=fs.readFileSync('src/agent-api.js','utf8');
const agentLeases=fs.readFileSync('src/agent-leases.js','utf8');
const agentQueries=fs.readFileSync('src/agent-queries.js','utf8');
const executorSource=fs.readFileSync('src/executor-contracts.js','utf8');
const migration1=fs.readFileSync('migrations/0001_foundation.sql','utf8');
const migration2=fs.readFileSync('migrations/0002_agent_control.sql','utf8');
const openapiV2=fs.readFileSync('openapi/sakthiai-v2.yaml','utf8');
const openapiV3=fs.readFileSync('openapi/sakthiai-v3.yaml','utf8');
const openapiV4=fs.readFileSync('openapi/sakthiai-v4.yaml','utf8');
const openapiV5=fs.readFileSync('openapi/sakthiai-v5.yaml','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const policy=JSON.parse(fs.readFileSync('config/runtime-policy.json','utf8'));
const capabilityContracts=JSON.parse(fs.readFileSync('config/capability-contracts.json','utf8'));
const executorContracts=JSON.parse(fs.readFileSync('config/executor-contracts.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));

const must=(condition,message)=>{if(!condition)throw new Error(message);};
must(html.includes('SakthiAI'),'SakthiAI identity missing');
must(html.includes('No hidden autonomous writes'),'autonomous-write safety copy missing');
must(css.includes('prefers-reduced-motion'),'reduced-motion support missing');
must(app.includes('serviceWorker'),'service worker registration missing');
must(app.includes("import('./agent-control-ui.js')"),'V5 Agent Control Center loader missing');
must(agentUi.includes('SAI-V5 Agent Control Center'),'V5 Agent Control Center UI missing');
must(agentUi.includes('/api/v1/agents/executors/contracts'),'V5 UI must read verified executor contract metadata');
must(!agentUi.includes("method:'POST'"),'V5 control-center module must remain read-only');
must(!agentUi.includes('/execute'),'V5 UI must not expose an execute route');
must(agentUi.includes('<strong>—</strong>'),'tenant-scoped task metrics must render unknown instead of fake counts');
must(agentUiCss.includes('.agent-control-center'),'V5 control-center styling missing');

must(caps.match(/id:'/g)?.length===12,'expected exactly 12 flagship capabilities');
must(capabilityContracts.capabilities.length===12,'expected exactly 12 machine-readable capability contracts');
must(capabilityContracts.capabilities.every(c=>c.paidProviderAllowed===false),'all capability contracts must deny paid providers');
must(capabilityContracts.truthStates.includes('CONTROL_PLANE_READY'),'agent control truth state missing');
const agentCapability=capabilityContracts.capabilities.find(c=>c.id==='agents');
must(agentCapability?.executionImplemented===false,'agent external execution must remain unimplemented');
must(agentCapability?.controlGate==='AGENT_CONTROL_ENABLED','agent control gate contract missing');
must(agentCapability?.externalActionGate==='AGENT_EXTERNAL_ACTIONS_ENABLED','agent external-action gate contract missing');

must(policy.schemaVersion==='5.0','runtime policy must be SAI-V5');
must(policy.paidProviders.enabled===false,'paid providers must remain disabled');
must(policy.paidProviders.silentFallback===false,'silent paid fallback must remain disabled');
must(policy.legacyRuntimeImport===false,'legacy runtime import must remain disabled');
must(policy.frontend.saravanaiDataDependency===false,'SaravanAI data dependency must remain disabled');
must(policy.frontend.saravanaiRuntimeDependency===false,'SaravanAI runtime dependency must remain disabled');
must(policy.frontend.agentControlFakeMetrics===false,'agent control center must not use fake tenant metrics');
must(Object.values(policy.runtimeGates).every(v=>v===false),'every V5 runtime gate must default disabled');
must(policy.agentControl.externalActionsEnabled===false,'agent external actions must default disabled');
must(policy.agentControl.publicVerifierWrites===false,'public verifier writes must remain disabled');
must(policy.agentControl.trustedVerifierRuntimeEnabled===false,'trusted verifier runtime must default disabled');
must(policy.agentControl.completionRequiresVerifierPass===true,'task completion must require verifier pass');
must(policy.executorContracts.bindingGateEnabled===false,'executor binding gate must default disabled');
must(policy.executorContracts.externalExecutionImplemented===false,'external executor implementation must remain false');
must(policy.executorContracts.boundExecutors===0,'no executor may be bound in V5');
must(policy.executorContracts.idempotencyRequired===true,'executor idempotency must be required');
must(policy.executorContracts.approvalRequiredForConsequentialActions===true,'executor consequential approval must be required');
must(policy.executorContracts.evidenceRequired===true&&policy.executorContracts.verifierRequired===true,'executor evidence/verifier requirements missing');
must(policy.executorContracts.rollbackOrCompensationPlanRequired===true,'executor rollback/compensation requirement missing');
must(policy.executorContracts.paidProviderAllowed===false,'executor contracts must prohibit paid providers');
must(policy.executorContracts.directMainWriteAllowed===false&&policy.executorContracts.forcePushAllowed===false,'unsafe Git executor behavior must remain prohibited');
must(policy.identity.rawIdentityHeadersAccepted===false,'raw identity headers must not be accepted');
must(policy.identity.signatureValidationRequired===true,'JWT signature validation must remain required');
must(policy.identity.audienceValidationRequired===true,'JWT audience validation must remain required');
must(policy.identity.tenantIsolationRequired===true,'tenant isolation must remain required');
must(policy.quota.enabled===false&&policy.quota.paidOverage===false,'quota must default off with no paid overage');
must(policy.cloudResources.d1.bindingPresentInWrangler===false,'D1 must not be activated in preview');
must(policy.cloudResources.r2.bindingPresentInWrangler===false,'R2 must not be activated in preview');
must(policy.cloudResources.aiSearch.bindingPresentInWrangler===false,'AI Search must not be activated in preview');

for(const gate of ['AI_RUNTIME_ENABLED','PERSISTENCE_ENABLED','IDENTITY_RUNTIME_ENABLED','ALLOW_BEARER_ACCESS_JWT','QUOTA_RUNTIME_ENABLED','RESEARCH_RUNTIME_ENABLED','CODE_RUNTIME_ENABLED','AGENT_RUNTIME_ENABLED','AGENT_CONTROL_ENABLED','AGENT_EXECUTOR_BINDINGS_ENABLED','AGENT_EXTERNAL_ACTIONS_ENABLED','AGENT_VERIFIER_RUNTIME_ENABLED','AUTOMATION_RUNTIME_ENABLED','KNOWLEDGE_RUNTIME_ENABLED','IMAGE_RUNTIME_ENABLED','VIDEO_RUNTIME_ENABLED','VOICE_RUNTIME_ENABLED','ARTIFACT_RUNTIME_ENABLED','DEVELOPER_RUNTIME_ENABLED']){
  must(wrangler.includes(`"${gate}": "false"`),`${gate} must default disabled`);
}
must(wrangler.includes('"PAID_PROVIDERS_ENABLED": "false"'),'Wrangler paid-provider gate must default disabled');
must(!wrangler.includes('custom_domain'),'Flagship development Worker must not claim a production custom domain');
must(!wrangler.includes('d1_databases'),'D1 binding must remain unprovisioned in preview');
must(!wrangler.includes('r2_buckets'),'R2 binding must remain unprovisioned in preview');
must(!wrangler.includes('ACCESS_TEAM_DOMAIN'),'Access team domain must be supplied only at controlled runtime configuration');
must(!wrangler.includes('ACCESS_AUD'),'Access audience must be supplied only at controlled runtime configuration');

must(worker.includes("release:'flagship-hi-tech-v5-control-center-contracts'"),'Worker release marker must be V5');
must(worker.includes('authenticateRequest'),'Worker must authenticate protected execution');
must(worker.includes('authorizeTenant'),'Worker must enforce server-side tenant RBAC');
must(worker.includes('enforceQuota'),'Worker must enforce fail-closed quotas');
must(worker.includes('handleAgentApi'),'Worker must integrate guarded agent-control routing');
must(worker.includes('executorContractRegistry'),'Worker must expose executor contract metadata');
must(worker.includes("url.pathname==='/api/v1/agents/executors/contracts'"),'V5 read-only executor contract route missing');
must(worker.includes("state:control.state==='AVAILABLE'?'CONTROL_PLANE_READY':'RUNTIME_DISABLED'"),'agent capability truth must distinguish control plane from runtime execution');
must(worker.includes('executionImplemented:false'),'Worker must disclose that agent execution is not implemented');
must(!worker.includes("url.pathname==='/api/v1/agents/execute'"),'Worker must not expose agent execute endpoint');
must(worker.includes("code:'RUNTIME_DISABLED'"),'Worker must fail closed when AI runtime is disabled');
must(worker.includes('No paid fallback was attempted'),'Worker must explicitly avoid paid fallback');
must(persistence.includes("state:'PERSISTENCE_DISABLED'"),'Persistence adapter must fail closed');
for(const code of ['RESEARCH_RUNTIME_DISABLED','CODE_RUNTIME_DISABLED','AGENT_RUNTIME_DISABLED','KNOWLEDGE_RUNTIME_DISABLED'])must(execution.includes(code),`missing fail-closed execution state: ${code}`);

must(auth.includes("header?.alg!=='RS256'"),'Access JWT algorithm pinning missing');
must(auth.includes("/cdn-cgi/access/certs"),'Cloudflare Access JWKS endpoint missing');
must(auth.includes('crypto.subtle.verify'),'cryptographic JWT signature verification missing');
must(auth.includes('ACCESS_JWT_ISSUER_MISMATCH'),'issuer validation missing');
must(auth.includes('ACCESS_JWT_AUDIENCE_MISMATCH'),'audience validation missing');
must(auth.includes('ACCESS_JWT_EXPIRED'),'expiry validation missing');
must(auth.includes("endsWith('.cloudflareaccess.com')"),'JWKS hostname restriction missing');
must(rbac.includes('JOIN memberships'),'RBAC membership lookup missing');
must(rbac.includes('JOIN tenants'),'RBAC tenant-state lookup missing');
must(rbac.includes("agents_approve:['owner','admin']"),'agent approval decision roles must remain owner/admin only');
must(quota.includes("code:'QUOTA_RUNTIME_DISABLED'"),'quota must fail closed when disabled');
must(quota.includes("code:'RATE_LIMITED'"),'rate limiting contract missing');
must(quota.includes("code:'DAILY_AI_QUOTA_EXCEEDED'"),'daily AI quota contract missing');

for(const token of ['TASK_STATES','AUTONOMY_CLASSES','ACTION_CLASSES','APPROVAL_REQUIRED','VERIFIER_REQUIRED','EXTERNAL_ACTIONS_DISABLED','TASK_RETRY_LIMIT_REACHED'])must(agentState.includes(token),`agent state contract missing ${token}`);
must(agentState.includes("deploy:'red'"),'deploy must classify red');
must(agentState.includes("repository_write:'amber'"),'repository writes must classify amber');
must(agentState.includes("read_only:'green'"),'read-only actions must classify green');
must(agentControl.includes("AGENT_CONTROL_ENABLED"),'agent repository must require agent-control gate');
must(agentControl.includes("AGENT_EXTERNAL_ACTIONS_ENABLED"),'agent transitions must require external-action gate');
must(agentControl.includes("AGENT_VERIFIER_RUNTIME_ENABLED"),'trusted verifier mutation must have separate gate');
must(agentControl.includes("throw new Error('VERIFIER_RUNTIME_DISABLED')"),'verifier runtime must fail closed');
must(agentControl.includes('task_execution_policy'),'agent task risk policy persistence missing');
must(agentControl.includes('task_events'),'agent event persistence missing');
must(agentControl.includes('audit_events'),'agent audit persistence missing');
must(agentControl.includes("APPROVAL_ALREADY_PENDING"),'duplicate pending approval guard missing');
must(agentLeases.includes('acquireWorkerLease'),'worker lease acquisition contract missing');
must(agentLeases.includes('heartbeatWorkerLease'),'worker lease heartbeat contract missing');
must(agentLeases.includes('releaseWorkerLease'),'worker lease release contract missing');
must(agentLeases.includes('getLatestCheckpoint'),'checkpoint resume lookup missing');
must(agentQueries.includes('listApprovalQueue'),'approval queue query missing');
must(agentQueries.includes('listTaskEvents'),'agent event history query missing');
must(agentQueries.includes('listVerifierRuns'),'verifier history query missing');
must(agentApi.includes('publicVerifierWrites:false'),'public API must disclose verifier writes are unavailable');
must(!agentApi.includes('recordVerifier'),'public agent API must not expose verifier mutation');
must(!agentApi.includes('/execute'),'public agent API must not expose external execution');

must(executorContracts.schemaVersion==='1.0','executor registry schema version invalid');
must(executorContracts.externalExecutionImplemented===false,'machine-readable executor registry must deny execution');
must(executorContracts.defaultExecutorState==='NO_EXECUTOR_BOUND','executor default state must be unbound');
must(executorContracts.contracts.length===6,'expected six provider-neutral executor classes');
must(executorContracts.contracts.every(c=>c.state==='NO_EXECUTOR_BOUND'),'all V5 executor classes must remain unbound');
must(executorContracts.globalRequirements.idempotencyRequired===true,'machine-readable idempotency requirement missing');
must(executorContracts.globalRequirements.approvalRequiredForConsequentialActions===true,'machine-readable approval requirement missing');
must(executorContracts.globalRequirements.verifierRequired===true,'machine-readable verifier requirement missing');
must(executorContracts.globalRequirements.rollbackOrCompensationPlanRequired===true,'machine-readable rollback requirement missing');
must(executorContracts.globalRequirements.paidProviderAllowed===false,'machine-readable paid provider denial missing');
must(executorSource.includes('validateExecutionEnvelope'),'executor envelope validator missing');
must(executorSource.includes('EXECUTOR_IDEMPOTENCY_REQUIRED'),'executor idempotency guard missing');
must(executorSource.includes('EXECUTOR_APPROVAL_REQUIRED'),'executor approval guard missing');
must(executorSource.includes('EXECUTOR_VERIFIER_REQUIRED'),'executor verifier guard missing');
must(executorSource.includes('EXECUTOR_ROLLBACK_PLAN_REQUIRED'),'executor rollback guard missing');
must(executorSource.includes('EXTERNAL_ACTIONS_DISABLED'),'executor external-action gate missing');
must(executorSource.includes("executed:false,sideEffects:false,executorBound:false"),'dry-run receipt must explicitly deny execution/side effects/binding');
must(!executorSource.includes('fetch('),'executor contract module must not perform network calls');

for(const table of ['tenants','users','memberships','projects','conversations','messages','tasks','task_events','approvals','knowledge_sources','artifacts','usage_ledger','audit_events']){
  must(migration1.includes(`CREATE TABLE IF NOT EXISTS ${table}`),`D1 foundation schema missing ${table}`);
}
for(const table of ['task_execution_policy','task_checkpoints','worker_leases','verifier_runs','evidence_records']){
  must(migration2.includes(`CREATE TABLE IF NOT EXISTS ${table}`),`D1 V4 schema missing ${table}`);
}
must(migration1.includes('PRAGMA foreign_keys = ON'),'D1 foreign-key enforcement contract missing');
must(migration2.includes('FOREIGN KEY (tenant_id,task_id) REFERENCES tasks(tenant_id,id)'),'V4 composite tenant/task FK missing');
must(migration2.includes("VALUES ('schema_version','2'"),'V4 schema version marker missing');
must(openapiV2.includes('/api/v1/projects:'),'V2 OpenAPI projects contract missing');
must(openapiV2.includes('/api/v1/agents/plan:'),'V2 agent contract missing');
must(openapiV3.includes('CloudflareAccessJwt:'),'V3 Access JWT security scheme missing');
must(openapiV3.includes('/api/v1/security/status:'),'V3 security status contract missing');
must(openapiV3.includes('X-SakthiAI-Tenant'),'V3 tenant selector contract missing');
must(openapiV4.includes('/api/v1/agents/tasks/{taskId}/transitions:'),'V4 task transition API missing');
must(openapiV4.includes('/api/v1/agents/approvals/{approvalId}/decision:'),'V4 approval decision API missing');
must(openapiV4.includes('Trusted verifier writes and'),'V4 verifier internal-only disclosure missing');
must(!openapiV4.includes('recordVerifierRun'),'V4 public OpenAPI must not expose verifier mutation');
must(!openapiV4.includes('/execute'),'V4 public OpenAPI must not expose agent execution');
must(openapiV5.includes('/api/v1/agents/executors/contracts:'),'V5 executor registry path missing');
must(openapiV5.includes('NO_EXECUTOR_BOUND'),'V5 OpenAPI executor binding truth missing');
must(openapiV5.includes('externalExecutionImplemented'),'V5 OpenAPI execution truth missing');
must(openapiV5.includes('ExecutionEnvelope:'),'V5 internal envelope schema missing');
must(!openapiV5.includes('/api/v1/agents/execute'),'V5 OpenAPI must not expose execute endpoint');

must(runtime.includes("location.hostname==='sakthiai.omsaravanabhava.org'"),'frontend runtime domain gate missing');
must(runtime.includes("fetchJson('/api/v1/capabilities'"),'frontend must verify per-capability runtime states');
must(runtime.includes("capState!=='RUNTIME_AVAILABLE'"),'runtime adapter must block unavailable capabilities');
must(app.includes("capState!=='RUNTIME_AVAILABLE'"),'composer must block unavailable capabilities');
must(app.includes('Control plane online'),'frontend must distinguish control-plane health from capability availability');
must(!app.includes("$('#modeStatus').textContent='RUNTIME CONNECTED'"),'frontend must not mark every mode connected from health alone');
must(!runtime.includes('saravanai.omsaravanabhava.org'),'frontend must not call SaravanAI runtime');
must(sw.includes("url.pathname.startsWith('/api/')"),'service worker must exclude API responses from cache');
must(manifest.name.includes('SakthiAI'),'PWA identity incorrect');

const scanned=[html,app,caps,runtime,agentUi,agentUiCss,worker,persistence,execution,auth,rbac,quota,agentState,agentControl,agentApi,agentLeases,agentQueries,executorSource,wrangler,sw,migration1,migration2,openapiV5,JSON.stringify(executorContracts)].join('\n');
for(const marker of ['sk-','AIza','xoxb-','xoxp-','ghp_','github_pat_'])must(!scanned.includes(marker),`secret-shaped marker found: ${marker}`);
must(!scanned.includes('Access-Control-Allow-Origin: *'),'wildcard CORS must not be introduced');

console.log('SAKTHIAI_FLAGSHIP_V5_VALIDATION_PASS');
console.log(JSON.stringify({capabilities:12,paidProviders:false,silentPaidFallback:false,legacyRuntimeImport:false,verifiedAccessJwt:true,tenantRbac:true,quotaDefault:'disabled',agentControlDefault:'disabled',executorBindingDefault:'disabled',agentExternalActionsDefault:'disabled',trustedVerifierDefault:'disabled',publicVerifierWrites:false,agentExecutionImplemented:false,boundExecutors:0,controlCenterFakeMetrics:false,d1Binding:false,r2Binding:false,aiSearchBinding:false},null,2));
