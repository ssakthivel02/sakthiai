import fs from 'node:fs';

const required=[
  'index.html','assets/styles.css','assets/app.js','assets/capabilities.js','assets/runtime.js',
  'config/runtime-policy.json','config/capability-contracts.json','src/worker.js','src/persistence.js',
  'src/execution-contracts.js','openapi/sakthiai-v1.yaml','openapi/sakthiai-v2.yaml',
  'migrations/0001_foundation.sql','manifest.webmanifest','sw.js','offline.html','wrangler.jsonc'
];
for(const file of required){if(!fs.existsSync(file))throw new Error(`Missing required file: ${file}`);}

const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/styles.css','utf8');
const app=fs.readFileSync('assets/app.js','utf8');
const caps=fs.readFileSync('assets/capabilities.js','utf8');
const runtime=fs.readFileSync('assets/runtime.js','utf8');
const worker=fs.readFileSync('src/worker.js','utf8');
const persistence=fs.readFileSync('src/persistence.js','utf8');
const execution=fs.readFileSync('src/execution-contracts.js','utf8');
const migration=fs.readFileSync('migrations/0001_foundation.sql','utf8');
const openapiV2=fs.readFileSync('openapi/sakthiai-v2.yaml','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const policy=JSON.parse(fs.readFileSync('config/runtime-policy.json','utf8'));
const capabilityContracts=JSON.parse(fs.readFileSync('config/capability-contracts.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));

const must=(condition,message)=>{if(!condition)throw new Error(message);};
must(html.includes('SakthiAI'),'SakthiAI identity missing');
must(html.includes('No hidden autonomous writes'),'autonomous-write safety copy missing');
must(css.includes('prefers-reduced-motion'),'reduced-motion support missing');
must(app.includes('serviceWorker'),'service worker registration missing');
must(caps.match(/id:'/g)?.length===12,'expected exactly 12 flagship capabilities');
must(capabilityContracts.capabilities.length===12,'expected exactly 12 machine-readable capability contracts');
must(capabilityContracts.capabilities.every(c=>c.paidProviderAllowed===false),'all capability contracts must deny paid providers');
must(policy.paidProviders.enabled===false,'paid providers must remain disabled');
must(policy.paidProviders.silentFallback===false,'silent paid fallback must remain disabled');
must(policy.legacyRuntimeImport===false,'legacy runtime import must remain disabled');
must(policy.frontend.saravanaiDataDependency===false,'SaravanAI data dependency must remain disabled');
must(policy.frontend.saravanaiRuntimeDependency===false,'SaravanAI runtime dependency must remain disabled');
must(Object.values(policy.runtimeGates).every(v=>v===false),'every V2 runtime gate must default disabled');
must(policy.cloudResources.d1.bindingPresentInWrangler===false,'D1 must not be activated in preview');
must(policy.cloudResources.r2.bindingPresentInWrangler===false,'R2 must not be activated in preview');
must(policy.cloudResources.aiSearch.bindingPresentInWrangler===false,'AI Search must not be activated in preview');

for(const gate of ['AI_RUNTIME_ENABLED','PERSISTENCE_ENABLED','IDENTITY_RUNTIME_ENABLED','RESEARCH_RUNTIME_ENABLED','CODE_RUNTIME_ENABLED','AGENT_RUNTIME_ENABLED','AUTOMATION_RUNTIME_ENABLED','KNOWLEDGE_RUNTIME_ENABLED','IMAGE_RUNTIME_ENABLED','VIDEO_RUNTIME_ENABLED','VOICE_RUNTIME_ENABLED','ARTIFACT_RUNTIME_ENABLED','DEVELOPER_RUNTIME_ENABLED']){
  must(wrangler.includes(`"${gate}": "false"`),`${gate} must default disabled`);
}
must(wrangler.includes('"PAID_PROVIDERS_ENABLED": "false"'),'Wrangler paid-provider gate must default disabled');
must(!wrangler.includes('custom_domain'),'Flagship development Worker must not claim a production custom domain');
must(!wrangler.includes('d1_databases'),'D1 binding must remain unprovisioned in preview');
must(!wrangler.includes('r2_buckets'),'R2 binding must remain unprovisioned in preview');
must(worker.includes("code:'RUNTIME_DISABLED'"),'Worker must fail closed when AI runtime is disabled');
must(worker.includes("code:'IDENTITY_RUNTIME_DISABLED'"),'Worker must fail closed before identity runtime is enabled');
must(worker.includes('No paid fallback was attempted'),'Worker must explicitly avoid paid fallback');
must(persistence.includes("state:'PERSISTENCE_DISABLED'"),'Persistence adapter must fail closed');
for(const code of ['RESEARCH_RUNTIME_DISABLED','CODE_RUNTIME_DISABLED','AGENT_RUNTIME_DISABLED','KNOWLEDGE_RUNTIME_DISABLED'])must(execution.includes(code),`missing fail-closed execution state: ${code}`);

for(const table of ['tenants','users','memberships','projects','conversations','messages','tasks','task_events','approvals','knowledge_sources','artifacts','usage_ledger','audit_events']){
  must(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`),`D1 schema missing ${table}`);
}
must(migration.includes('PRAGMA foreign_keys = ON'),'D1 foreign-key enforcement contract missing');
must(migration.includes('tenant_id TEXT NOT NULL'),'tenant isolation key missing from D1 schema');
must(openapiV2.includes('/api/v1/projects:'),'V2 OpenAPI projects contract missing');
must(openapiV2.includes('/api/v1/tasks:'),'V2 OpenAPI task ledger contract missing');
must(openapiV2.includes('/api/v1/research/plan:'),'V2 research contract missing');
must(openapiV2.includes('/api/v1/code/plan:'),'V2 code contract missing');
must(openapiV2.includes('/api/v1/agents/plan:'),'V2 agent contract missing');
must(openapiV2.includes('/api/v1/knowledge/query:'),'V2 knowledge contract missing');

must(runtime.includes("location.hostname==='sakthiai.omsaravanabhava.org'"),'frontend runtime domain gate missing');
must(runtime.includes("fetchJson('/api/v1/capabilities'"),'frontend must verify per-capability runtime states');
must(runtime.includes("capState!=='RUNTIME_AVAILABLE'"),'runtime adapter must block unavailable capabilities');
must(app.includes("capState!=='RUNTIME_AVAILABLE'"),'composer must block unavailable capabilities');
must(app.includes('Control plane online'),'frontend must distinguish control-plane health from capability availability');
must(!app.includes("$('#modeStatus').textContent='RUNTIME CONNECTED'"),'frontend must not mark every mode connected from health alone');
must(!runtime.includes('saravanai.omsaravanabhava.org'),'frontend must not call SaravanAI runtime');
must(sw.includes("url.pathname.startsWith('/api/')"),'service worker must exclude API responses from cache');
must(manifest.name.includes('SakthiAI'),'PWA identity incorrect');

const scanned=[html,app,caps,runtime,worker,persistence,execution,wrangler,sw,migration].join('\n');
for(const marker of ['sk-','AIza','xoxb-','xoxp-','ghp_','github_pat_'])must(!scanned.includes(marker),`secret-shaped marker found: ${marker}`);
must(!scanned.includes('Access-Control-Allow-Origin: *'),'wildcard CORS must not be introduced');

console.log('SAKTHIAI_FLAGSHIP_V2_VALIDATION_PASS');
console.log(JSON.stringify({capabilities:12,paidProviders:false,silentPaidFallback:false,legacyRuntimeImport:false,capabilityAwareFrontend:true,apiCache:false,workerDefault:'disabled',persistenceDefault:'disabled',identityDefault:'disabled',d1Binding:false,r2Binding:false,aiSearchBinding:false},null,2));
