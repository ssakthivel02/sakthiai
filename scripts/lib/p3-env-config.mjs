const PROD_RE=/(^|[-_.])(prod|production|live)([-_.]|$)/i;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID_RE=/^[A-Za-z0-9._:-]{1,160}$/;

function required(value,name){const v=String(value??'').trim();if(!v)throw new Error(`${name}_REQUIRED`);return v;}
function slug(value){return String(value).toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);}

export function buildP3EvidenceConfig(input={}){
  const ack=required(input.ack,'P3_NONPROD_ACK');
  if(ack!=='NON_PRODUCTION_ONLY')throw new Error('P3_NONPROD_ACK_INVALID');
  const environment=required(input.environment,'P3_ENVIRONMENT');
  if(PROD_RE.test(environment))throw new Error('P3_PRODUCTION_LABEL_REJECTED');
  const databaseName=required(input.databaseName,'P3_D1_DATABASE_NAME');
  const databaseId=required(input.databaseId,'P3_D1_DATABASE_ID');
  if(!UUID_RE.test(databaseId))throw new Error('P3_D1_DATABASE_ID_INVALID');
  const agentId=required(input.agentId,'P3_AGENT_ID');
  const tenantId=required(input.tenantId,'P3_TENANT_ID');
  if(!ID_RE.test(agentId)||!ID_RE.test(tenantId))throw new Error('P3_SCOPE_ID_INVALID');
  const envSlug=slug(environment);if(!envSlug)throw new Error('P3_ENVIRONMENT_INVALID');
  const workerBase=slug(input.workerBase||'sakthiai-flagship-api-p3-evidence');
  const config={
    $schema:'node_modules/wrangler/config-schema.json',
    name:`${workerBase}-${envSlug}`.slice(0,63),
    main:'src/worker.js',
    compatibility_date:'2026-09-01',
    compatibility_flags:['nodejs_compat'],
    workers_dev:true,
    preview_urls:true,
    vars:{
      AI_RUNTIME_ENABLED:'false',PAID_PROVIDERS_ENABLED:'false',LEGACY_RUNTIME_IMPORT:'false',
      PERSISTENCE_ENABLED:'false',IDENTITY_RUNTIME_ENABLED:'false',ALLOW_BEARER_ACCESS_JWT:'false',
      QUOTA_RUNTIME_ENABLED:'false',RESEARCH_RUNTIME_ENABLED:'false',CODE_RUNTIME_ENABLED:'false',
      AGENT_RUNTIME_ENABLED:'false',AGENT_CONTROL_ENABLED:'false',AGENT_EXECUTOR_BINDINGS_ENABLED:'false',
      AGENT_EXTERNAL_ACTIONS_ENABLED:'false',AGENT_VERIFIER_RUNTIME_ENABLED:'false',
      AGENT_WEBHOOK_ENABLED:'true',AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED:'true',
      AGENT_WEBHOOK_MAX_SKEW_SECONDS:'300',AGENT_WEBHOOK_ALLOWED_AGENTS:agentId,
      AGENT_WEBHOOK_ALLOWED_TENANTS:tenantId,AUTOMATION_RUNTIME_ENABLED:'false',
      KNOWLEDGE_RUNTIME_ENABLED:'false',IMAGE_RUNTIME_ENABLED:'false',VIDEO_RUNTIME_ENABLED:'false',
      VOICE_RUNTIME_ENABLED:'false',ARTIFACT_RUNTIME_ENABLED:'false',DEVELOPER_RUNTIME_ENABLED:'false',
      OBSERVABILITY_RUNTIME_ENABLED:'false',PREVIEW_DEPLOY_ENABLED:'false',
      SAKTHIAI_EVIDENCE_ENVIRONMENT:environment
    },
    d1_databases:[{binding:'DB',database_name:databaseName,database_id:databaseId,migrations_dir:'migrations'}],
    observability:{enabled:true}
  };
  return {config,summary:{environment,workerName:config.name,databaseName,databaseIdConfigured:true,agentId,tenantId,secretEmbedded:false,externalWritesEnabled:false,executorBindingsEnabled:false}};
}

export function p3WranglerCommands({databaseName,configPath='wrangler.p3-evidence.generated.jsonc'}={}){
  const db=required(databaseName,'P3_D1_DATABASE_NAME');
  return [
    `npx wrangler d1 migrations list ${db} --remote --config ${configPath}`,
    `npx wrangler d1 migrations apply ${db} --remote --config ${configPath}`,
    `npx wrangler secret put AGENT_WEBHOOK_SHARED_SECRET --config ${configPath}`,
    `npx wrangler deploy --config ${configPath}`,
    `npm run preflight:p3`,
    `npm run benchmark:real-client -- --trials 20 --check-replay --output evidence/funding-readiness/signed-webhook-p3-real-client.json`,
    `npm run validate:p3-evidence -- evidence/funding-readiness/signed-webhook-p3-real-client.json`
  ];
}
