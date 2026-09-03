(function(){
  const STYLE_ID='sakthiai-observability-style';
  const SECTION_ID='preview-observatory';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function addStyle(){if(document.getElementById(STYLE_ID))return;const link=document.createElement('link');link.id=STYLE_ID;link.rel='stylesheet';link.href='assets/observability.css';document.head.appendChild(link);}
  function addNav(){
    const nav=document.getElementById('primaryNav');if(!nav||nav.querySelector('a[href="#preview-observatory"]'))return;
    const link=document.createElement('a');link.href='#preview-observatory';link.textContent='Readiness';
    link.addEventListener('click',()=>{nav.classList.remove('open');document.getElementById('menuButton')?.setAttribute('aria-expanded','false');});
    const trust=nav.querySelector('a[href="#trust"]');nav.insertBefore(link,trust||null);
  }
  function shell(){
    if(document.getElementById(SECTION_ID))return document.getElementById(SECTION_ID);
    const anchor=document.getElementById('agent-control-center')||document.getElementById('agents');if(!anchor)return null;
    const section=document.createElement('section');section.id=SECTION_ID;section.className='preview-observatory shell';
    section.innerHTML=`
      <div class="obs-shell">
        <div class="obs-head">
          <div><p class="eyebrow">SAI-V6 Preview Readiness Observatory</p><h2>Prove readiness without pretending production is live.</h2><p>Read-only diagnostics show configuration safety, correlation, cost boundaries and unresolved release gates. No prompt, identity, tenant usage or raw audit payload is requested by this surface.</p></div>
          <div class="obs-status" aria-live="polite">
            <span>Production readiness <b id="obsProduction">NOT READY</b></span>
            <span>Preview deployment <b id="obsDeploy">LOCKED</b></span>
            <span>D1 binding <b id="obsD1">UNBOUND</b></span>
            <span>Paid providers <b id="obsPaid" class="ok">OFF</b></span>
          </div>
        </div>
        <div class="obs-grid">
          <div class="obs-main">
            <div class="obs-metrics">
              <article><span>Readiness state</span><strong id="obsReadyState">—</strong></article>
              <article><span>Request correlation</span><strong id="obsTrace">—</strong></article>
              <article><span>Runtime logging</span><strong id="obsLogging">—</strong></article>
              <article><span>Tenant usage</span><strong>PRIVATE</strong></article>
            </div>
            <div class="obs-panel"><div class="obs-panel-head"><strong>Preview safety guards</strong><span>Verified metadata only</span></div><div class="obs-guard-grid" id="obsGuards"><div class="obs-empty">No verified readiness response is connected.</div></div></div>
            <div class="obs-panel"><div class="obs-panel-head"><strong>Release evidence model</strong><span>Repository ≠ production</span></div><div class="obs-evidence"><span>Exact-head CI</span><span>Static a11y/responsive contract</span><span>Cryptographic identity tests</span><span>Tenant isolation</span><span>Cost boundary</span><span>Controlled browser QA later</span></div></div>
          </div>
          <aside class="obs-side">
            <div class="obs-panel" style="margin-top:0"><div class="obs-panel-head"><strong>Cost boundary</strong><span>Free-first fail-closed</span></div><div class="obs-cost" id="obsCost"><div class="obs-empty">No verified cost policy response is connected.</div></div></div>
            <div class="obs-panel"><div class="obs-panel-head"><strong>Privacy boundary</strong><span>Public diagnostics</span></div><ul class="obs-privacy"><li>Prompt/body logging: OFF</li><li>User identity logging: OFF</li><li>Secrets/JWT/cookies: FORBIDDEN</li><li>Tenant usage totals: PRIVATE</li><li>Raw audit payloads: PRIVATE</li></ul></div>
            <button type="button" class="obs-refresh" id="obsRefresh">Refresh verified diagnostics</button>
            <p class="obs-note" id="obsNote">This action performs GET-only configuration reads. It cannot deploy, provision D1, enable AI, bind an executor or change DNS.</p>
          </aside>
        </div>
      </div>`;
    anchor.insertAdjacentElement('afterend',section);return section;
  }
  function badge(id,value,ok=false){const el=document.getElementById(id);if(!el)return;el.textContent=value;el.classList.toggle('ok',Boolean(ok));}
  function pretty(value){return String(value??'UNKNOWN').replaceAll('_',' ');}
  function renderGuards(guards={}){
    const root=document.getElementById('obsGuards');if(!root)return;
    const entries=Object.entries(guards);
    root.innerHTML=entries.length?entries.map(([name,value])=>`<div class="obs-guard"><span>${esc(pretty(name))}</span><b class="${value?'ok':'bad'}">${value?'PASS':'BLOCK'}</b></div>`).join(''):'<div class="obs-empty">No readiness guards were returned.</div>';
  }
  function renderCost(cost={}){
    const root=document.getElementById('obsCost');if(!root)return;
    const q=cost.quotaDefaults||{};const bindings=cost.resourceBindings||{};
    root.innerHTML=`<div class="obs-cost-row"><span>Mode</span><b>${esc(pretty(cost.mode))}</b></div><div class="obs-cost-row"><span>Paid overage</span><b>${cost.paidOverageAllowed?'ALLOWED':'DENIED'}</b></div><div class="obs-cost-row"><span>Quota runtime</span><b>${cost.quotaRuntimeEnabled?'ON':'OFF'}</b></div><div class="obs-cost-row"><span>Default request window</span><b>${esc(q.requestsPerWindow??'—')} / ${esc(q.windowSeconds??'—')}s</b></div><div class="obs-cost-row"><span>Default daily AI</span><b>${esc(q.dailyAiRequests??'—')}</b></div><div class="obs-cost-row"><span>D1 / R2 / AI Search</span><b>${bindings.d1||bindings.r2||bindings.aiSearch?'BOUND':'UNBOUND'}</b></div>`;
  }
  async function getJson(path){
    const runtime=window.SakthiRuntime;if(!runtime?.state?.apiConnected||!runtime.state.base)throw new Error('CONTROL_PLANE_NOT_CONNECTED');
    const response=await fetch(runtime.state.base+path,{method:'GET',headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store'});
    const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.code||`HTTP_${response.status}`);return data;
  }
  async function refresh(){
    const note=document.getElementById('obsNote');if(note)note.textContent='Reading readiness, observability and cost configuration only…';
    try{
      const [ready,observability,cost]=await Promise.all([getJson('/api/v1/readiness'),getJson('/api/v1/observability/status'),getJson('/api/v1/cost/status')]);
      const r=ready?.readiness||{},o=observability?.observability||{},c=cost?.cost||{};
      badge('obsProduction',r.productionReady?'READY':'NOT READY',false);
      badge('obsDeploy',r.deploymentPerformed?'DEPLOYED':'LOCKED',false);
      badge('obsD1',c.resourceBindings?.d1?'BOUND':'UNBOUND',!c.resourceBindings?.d1);
      badge('obsPaid',c.paidProvidersEnabled?'ON':'OFF',!c.paidProvidersEnabled);
      document.getElementById('obsReadyState').textContent=pretty(r.state||'UNKNOWN');
      document.getElementById('obsTrace').textContent=o.requestCorrelation?'ENABLED':'UNAVAILABLE';
      document.getElementById('obsLogging').textContent=o.runtimeLoggingEnabled?'ON':'OFF';
      renderGuards(r.guards);renderCost(c);
      if(note)note.textContent='Verified configuration loaded. Production readiness remains a separate external evidence gate.';
    }catch(error){
      badge('obsProduction','NOT READY');badge('obsDeploy','LOCKED');badge('obsD1','UNBOUND',true);badge('obsPaid','OFF',true);
      document.getElementById('obsReadyState').textContent='—';document.getElementById('obsTrace').textContent='—';document.getElementById('obsLogging').textContent='—';
      if(note)note.textContent='Diagnostics are unavailable on this host. The preview remains fail-closed and no action was attempted.';
    }
  }
  function init(){addStyle();addNav();if(!shell())return;document.getElementById('obsRefresh')?.addEventListener('click',refresh);window.addEventListener('sakthiai:runtime',()=>refresh());if(window.SakthiRuntime?.state?.apiConnected)refresh();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
