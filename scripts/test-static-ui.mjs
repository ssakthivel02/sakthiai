import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const baseCss=fs.readFileSync('assets/styles.css','utf8');
const app=fs.readFileSync('assets/app.js','utf8');
const agentUi=fs.readFileSync('assets/agent-control-ui.js','utf8');
const obsUi=fs.readFileSync('assets/observability-ui.js','utf8');
const obsCss=fs.readFileSync('assets/observability.css','utf8');

assert.ok(html.includes('<meta name="viewport"'));
assert.ok(html.includes('class="skip-link" href="#workspace"'));
assert.ok(html.includes('aria-label="Primary navigation"'));
assert.ok(html.includes('aria-expanded="false"'));
assert.ok(html.includes('aria-live="polite"'));
assert.ok(baseCss.includes('prefers-reduced-motion'));
assert.ok(app.includes("e.key==='Enter'||e.key===' '"));
assert.ok(agentUi.includes('aria-live="polite"'));
assert.ok(obsUi.includes('aria-live="polite"'));
assert.ok(obsUi.includes("method:'GET'"));
assert.equal(obsUi.includes("method:'POST'"),false);
assert.equal(obsUi.includes('/execute'),false);
assert.ok(obsUi.includes('<strong id="obsReadyState">—</strong>'));
assert.ok(obsCss.includes('@media(max-width:1080px)'));
assert.ok(obsCss.includes('@media(max-width:720px)'));
assert.ok(obsCss.includes('@media(max-width:480px)'));
assert.equal(/tabindex=["'](?:[1-9]\d*)["']/i.test(html+agentUi+obsUi),false);

for(const match of html.matchAll(/<img\b[^>]*>/gi))assert.match(match[0],/\balt\s*=/i,'Every img requires alt text');

console.log('SAKTHIAI_V6_STATIC_UI_CONTRACT_PASS');
console.log(JSON.stringify({realBrowserExecuted:false,controlledPreviewRequired:true,keyboardContract:true,reducedMotionContract:true,responsiveBreakpoints:[1080,720,480],positiveTabIndex:false},null,2));
