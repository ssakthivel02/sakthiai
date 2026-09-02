import fs from 'node:fs';

const required=['index.html','assets/styles.css','assets/app.js','assets/capabilities.js','assets/runtime.js','config/runtime-policy.json','src/worker.js','openapi/sakthiai-v1.yaml','manifest.webmanifest','sw.js','offline.html','wrangler.jsonc'];
for(const file of required){if(!fs.existsSync(file))throw new Error(`Missing required file: ${file}`);}

const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/styles.css','utf8');
const app=fs.readFileSync('assets/app.js','utf8');
const caps=fs.readFileSync('assets/capabilities.js','utf8');
const runtime=fs.readFileSync('assets/runtime.js','utf8');
const worker=fs.readFileSync('src/worker.js','utf8');
const wrangler=fs.readFileSync('wrangler.jsonc','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const policy=JSON.parse(fs.readFileSync('config/runtime-policy.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));

const must=(condition,message)=>{if(!condition)throw new Error(message);};
must(html.includes('SakthiAI'),'SakthiAI identity missing');
must(html.includes('No hidden autonomous writes'),'autonomous-write safety copy missing');
must(css.includes('prefers-reduced-motion'),'reduced-motion support missing');
must(app.includes('serviceWorker'),'service worker registration missing');
must(caps.match(/id:'/g)?.length===12,'expected exactly 12 flagship capabilities');
must(policy.paidProviders.enabled===false,'paid providers must remain disabled');
must(policy.paidProviders.silentFallback===false,'silent paid fallback must remain disabled');
must(policy.legacyRuntimeImport===false,'legacy runtime import must remain disabled');
must(policy.frontend.saravanaiDataDependency===false,'SaravanAI data dependency must remain disabled');
must(policy.frontend.saravanaiRuntimeDependency===false,'SaravanAI runtime dependency must remain disabled');
must(wrangler.includes('"AI_RUNTIME_ENABLED": "false"'),'AI runtime must default disabled');
must(wrangler.includes('"PAID_PROVIDERS_ENABLED": "false"'),'Wrangler paid-provider gate must default disabled');
must(!wrangler.includes('custom_domain'),'Flagship development Worker must not claim a production custom domain');
must(worker.includes("code:'RUNTIME_DISABLED'"),'Worker must fail closed when AI runtime is disabled');
must(worker.includes('No paid fallback was attempted'),'Worker must explicitly avoid paid fallback');
must(runtime.includes("location.hostname==='sakthiai.omsaravanabhava.org'"),'frontend runtime domain gate missing');
must(!runtime.includes('saravanai.omsaravanabhava.org'),'frontend must not call SaravanAI runtime');
must(sw.includes("url.pathname.startsWith('/api/')"),'service worker must exclude API responses from cache');
must(manifest.name.includes('SakthiAI'),'PWA identity incorrect');

const scanned=[html,app,caps,runtime,worker,wrangler,sw].join('\n');
for(const marker of ['sk-','AIza','xoxb-','xoxp-','ghp_','github_pat_'])must(!scanned.includes(marker),`secret-shaped marker found: ${marker}`);
must(!scanned.includes('Access-Control-Allow-Origin: *'),'wildcard CORS must not be introduced');

console.log('SAKTHIAI_FLAGSHIP_VALIDATION_PASS');
console.log(JSON.stringify({capabilities:12,paidProviders:false,silentPaidFallback:false,legacyRuntimeImport:false,apiCache:false,workerDefault:'disabled'},null,2));
