import fs from 'node:fs';

const must=(condition,message)=>{if(!condition)throw new Error(message);};
const devWrangler=fs.readFileSync('wrangler.jsonc','utf8');
const liveWrangler=fs.readFileSync('wrangler.live.jsonc','utf8');
const index=fs.readFileSync('index.html','utf8');
const runtime=fs.readFileSync('assets/runtime.js','utf8');
const build=fs.readFileSync('scripts/build-static.mjs','utf8');

must(index.includes('Clean hi-tech rebuild'),'clean flagship marker missing');
must(index.includes('SakthiAI Flagship'),'flagship identity missing');
must(!index.includes('Owner data is locked'),'legacy owner-lock UI must not enter flagship release');
must(!index.includes('Private evidence ingestion'),'legacy files UI must not enter flagship release');
must(!index.includes('Private AI Workspace'),'legacy private-workspace shell must not enter flagship release');
must(!index.includes('<strong>SaravanAI</strong>'),'legacy SaravanAI brand header must not enter flagship release');

must(!devWrangler.includes('custom_domain'),'development Wrangler must stay custom-domain free');
must(liveWrangler.includes('"name": "sakthiai-flagship"'),'live flagship Worker name missing');
must(liveWrangler.includes('"pattern": "sakthiai.omsaravanabhava.org"'),'flagship web custom domain missing');
must(liveWrangler.includes('"pattern": "api-sakthiai.omsaravanabhava.org"'),'flagship API custom domain missing');
must(liveWrangler.includes('"directory": "./dist"'),'safe static dist binding missing');
must(liveWrangler.includes('"binding": "ASSETS"'),'static asset binding missing');
for(const gate of ['AI_RUNTIME_ENABLED','PAID_PROVIDERS_ENABLED','PERSISTENCE_ENABLED','IDENTITY_RUNTIME_ENABLED','QUOTA_RUNTIME_ENABLED','AGENT_CONTROL_ENABLED','AGENT_EXECUTOR_BINDINGS_ENABLED','AGENT_EXTERNAL_ACTIONS_ENABLED','AGENT_VERIFIER_RUNTIME_ENABLED','OBSERVABILITY_RUNTIME_ENABLED','PREVIEW_DEPLOY_ENABLED']){
  must(liveWrangler.includes(`"${gate}": "false"`),`${gate} must remain false during UI cutover`);
}
must(!liveWrangler.includes('d1_databases'),'D1 must remain unbound');
must(!liveWrangler.includes('r2_buckets'),'R2 must remain unbound');
must(!liveWrangler.includes('AI_SEARCH'),'AI Search binding must remain absent');
must(!runtime.includes('saravanai.omsaravanabhava.org'),'flagship frontend must not call legacy SaravanAI runtime');

for(const token of ["'index.html'","'manifest.webmanifest'","'offline.html'","'sw.js'","fs.cpSync('assets'"])must(build.includes(token),`safe site build missing ${token}`);
for(const name of ['src','config','migrations','scripts','.github','wrangler.jsonc','README.md','package.json'])must(build.includes(`'${name}'`),`deployment leak guard missing ${name}`);

console.log('SAKTHIAI_LIVE_RELEASE_VALIDATION_PASS');
