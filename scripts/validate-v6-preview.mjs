import fs from 'node:fs';

const must=(condition,message)=>{if(!condition)throw new Error(message);};
const required=[
  'src/observability.js','config/observability-policy.json','config/preview-release-contract.json',
  'assets/observability-ui.js','assets/observability.css','openapi/sakthiai-v6.yaml',
  'scripts/test-preview-readiness.mjs','scripts/test-static-ui.mjs','scripts/build-preview-evidence.mjs'
];
for(const file of required)must(fs.existsSync(file),`Missing V6 file: ${file}`);

const worker=fs.readFileSync('src/worker.js','utf8');
const source=fs.readFileSync('src/observability.js','utf8');
const ui=fs.readFileSync('assets/observability-ui.js','utf8');
const css=fs.readFileSync('assets/observability.css','utf8');
const app=fs.readFileSync('assets/app.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const workflow=fs.readFileSync('.github/workflows/validate.yml','utf8');
const openapi=fs.readFileSync('openapi/sakthiai-v6.yaml','utf8');
const evidenceBuilder=fs.readFileSync('scripts/build-preview-evidence.mjs','utf8');
const policy=JSON.parse(fs.readFileSync('config/runtime-policy.json','utf8'));
const obsPolicy=JSON.parse(fs.readFileSync('config/observability-policy.json','utf8'));
const preview=JSON.parse(fs.readFileSync('config/preview-release-contract.json','utf8'));

must(policy.previewReadiness?.productionReady===false,'core policy must not claim production ready');
must(policy.previewReadiness?.deploymentPerformed===false,'core policy must not claim preview deployment');
must(policy.previewReadiness?.browserQaPerformed===false,'core policy must not claim browser QA');
must(policy.runtimeGates.observability===false,'observability runtime must default off');
must(policy.runtimeGates.previewDeploy===false,'preview deployment gate must default off');
must(policy.frontend.observabilityFakeMetrics===false,'observability UI fake metrics must be prohibited');

must(obsPolicy.phase==='SAI-V6_OBSERVABILITY_CONTRACT','observability policy phase invalid');
must(obsPolicy.runtimeLoggingEnabledByDefault===false,'runtime logging must default off');
must(obsPolicy.publicTelemetryMode==='CONFIGURATION_ONLY','public telemetry must be configuration-only');
must(obsPolicy.rawPromptLogging===false&&obsPolicy.rawIdentityLogging===false&&obsPolicy.rawSecretLogging===false,'raw sensitive logging must remain disabled');
must(obsPolicy.tenantUsageDetailsPublic===false,'tenant usage details must remain private');
for(const field of ['prompt','authorization','cookie','jwt','tenantUsage','userIdentity','rawAuditPayload'])must(obsPolicy.forbiddenPublicFields.includes(field),`missing forbidden public field ${field}`);

must(preview.phase==='SAI-V6_PREVIEW_EVIDENCE_ONLY','preview release phase invalid');
must(preview.deployment.implemented===false,'preview deployment must remain unimplemented');
must(preview.deployment.automaticDeploy===false,'automatic preview deployment must remain off');
must(preview.deployment.productionDeployAllowed===false,'production deploy must be forbidden');
must(preview.deployment.productionDnsChangeAllowed===false,'production DNS changes must be forbidden');
must(preview.browserQaStatus==='NOT_RUN_REQUIRES_CONTROLLED_PREVIEW','browser QA truth must remain explicit');
must(preview.productionReady===false,'preview contract must not claim production ready');
must(Object.values(preview.cloudBindings).every(v=>v===false),'V6 preview contract must not activate cloud bindings');
must(Object.values(preview.runtimeActivation).every(v=>v===false),'V6 preview contract must not activate runtimes');

must(wrangler.includes('"OBSERVABILITY_RUNTIME_ENABLED": "false"'),'Wrangler observability gate must default false');
must(wrangler.includes('"PREVIEW_DEPLOY_ENABLED": "false"'),'Wrangler preview deploy gate must default false');
must(!wrangler.includes('d1_databases'),'D1 binding must remain absent');
must(!wrangler.includes('r2_buckets'),'R2 binding must remain absent');
must(!wrangler.includes('custom_domain'),'production custom domain must remain absent');

must(worker.includes("release:'flagship-hi-tech-v6-preview-observability-foundation'"),'Worker release marker must be V6');
for(const route of ['/api/v1/readiness','/api/v1/observability/status','/api/v1/cost/status'])must(worker.includes(route),`missing V6 route ${route}`);
must(worker.includes('createTraceContext'),'Worker request correlation integration missing');
must(worker.includes('finalizeResponse'),'Worker response correlation finalizer missing');
must(worker.includes("observability:feature(env,'OBSERVABILITY_RUNTIME_ENABLED')"),'Worker observability gate truth missing');
must(worker.includes("previewDeploy:feature(env,'PREVIEW_DEPLOY_ENABLED')"),'Worker preview-deploy gate truth missing');
must(!worker.includes('/api/v1/deploy'),'V6 must expose no deploy endpoint');
must(!worker.includes("url.pathname==='/api/v1/agents/execute'"),'V6 must expose no agent execute endpoint');

must(source.includes("safeEventFields"),'safe observability allowlist missing');
must(source.includes("publicUsageTotalsExposed:false"),'public usage totals must remain hidden');
must(source.includes("tenantUsageDetailsExposed:false"),'tenant usage details must remain hidden');
must(source.includes("route:cleanPath(request?.url)"),'trace route must strip query strings');
must(!source.includes('request.text('),'observability must not read request body text');
must(!source.includes('request.json('),'observability must not read request JSON');
must(!source.includes('request.headers.entries'),'observability must not enumerate request headers');

must(app.includes("import('./observability-ui.js')"),'V6 observability UI loader missing');
must(ui.includes("method:'GET'"),'observability UI must use explicit GET reads');
must(!ui.includes("method:'POST'"),'observability UI must remain read-only');
must(!ui.includes('/execute'),'observability UI must expose no execution route');
must(ui.includes('<strong id="obsReadyState">—</strong>'),'unknown readiness must render unknown, not fake data');
must(css.includes('@media(max-width:1080px)')&&css.includes('@media(max-width:720px)')&&css.includes('@media(max-width:480px)'),'V6 responsive breakpoints missing');
must(sw.includes("'./assets/observability-ui.js'"),'PWA must cache observability UI JS');
must(sw.includes("'./assets/observability.css'"),'PWA must cache observability CSS');
must(sw.includes("url.pathname.startsWith('/api/')"),'PWA must continue excluding API responses');

for(const route of ['/api/v1/readiness:','/api/v1/observability/status:','/api/v1/cost/status:'])must(openapi.includes(route),`V6 OpenAPI missing ${route}`);
must(openapi.includes('productionReady: { type: boolean, const: false }'),'OpenAPI must deny production-ready claim');
must(openapi.includes('rawPromptLogging: { type: boolean, const: false }'),'OpenAPI must deny raw prompt logging');
must(!openapi.includes('/api/v1/deploy'),'V6 OpenAPI must expose no deploy endpoint');

must(evidenceBuilder.includes("evidenceScope:'REPOSITORY_ONLY'"),'evidence artifact must be repository-only');
must(evidenceBuilder.includes('productionActivation:false'),'evidence artifact must deny production activation');
must(evidenceBuilder.includes('browserQaPerformed:false'),'evidence artifact must not claim browser QA');
must(!workflow.includes('wrangler deploy'),'validation workflow must not deploy');

console.log('SAKTHIAI_V6_PREVIEW_OBSERVABILITY_VALIDATION_PASS');
console.log(JSON.stringify({productionReady:false,deploymentPerformed:false,browserQaPerformed:false,observabilityRuntimeDefault:false,previewDeployDefault:false,publicTelemetry:'configuration-only',tenantUsagePublic:false,d1Binding:false,r2Binding:false,executorBindings:0},null,2));
