import fs from 'node:fs';
import path from 'node:path';

const outDir='artifacts';
fs.mkdirSync(outDir,{recursive:true});
const manifest={
  schemaVersion:'1.0',
  product:'SakthiAI',
  phase:'SAI-V6_PREVIEW_EVIDENCE',
  generatedAt:new Date().toISOString(),
  repository:process.env.GITHUB_REPOSITORY||'local',
  commitSha:process.env.GITHUB_SHA||'local-uncommitted',
  workflowRun:process.env.GITHUB_RUN_NUMBER||'local',
  evidenceScope:'REPOSITORY_ONLY',
  productionActivation:false,
  deploymentPerformed:false,
  cloudResourcesProvisioned:false,
  executorBound:false,
  paidProvidersEnabled:false,
  browserQaPerformed:false,
  controlledPreviewStillRequired:true,
  checks:[
    'structural_safety',
    'javascript_syntax',
    'v5_policy_executor_ledger',
    'v6_preview_observability_policy',
    'cloudflare_access_crypto',
    'agent_state_machine',
    'executor_contract_safety',
    'd1_migrations_0001_0002_0003',
    'static_accessibility_responsive_contract'
  ],
  unresolvedExternalGates:[
    'main_branch_protection',
    'required_ci_status_rule',
    'real_access_controlled_preview',
    'controlled_preview_browser_qa',
    'explicit_d1_owner_approval',
    'preview_d1_backup_restore',
    'preview_quota_concurrency',
    'namespace_separation_reconfirmation'
  ]
};
const output=path.join(outDir,'preview-evidence.json');
fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(`SAKTHIAI_V6_PREVIEW_EVIDENCE_WRITTEN:${output}`);
