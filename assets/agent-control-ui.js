(function(){
  const STYLE_ID='sakthiai-agent-control-style';
  const SECTION_ID='agent-control-center';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function addStyle(){if(document.getElementById(STYLE_ID))return;const link=document.createElement('link');link.id=STYLE_ID;link.rel='stylesheet';link.href='assets/agent-control.css';document.head.appendChild(link);}
  function addNav(){
    const nav=document.getElementById('primaryNav');if(!nav||nav.querySelector('a[href="#agent-control-center"]'))return;
    const link=document.createElement('a');link.href='#agent-control-center';link.textContent='Control Center';
    link.addEventListener('click',()=>{nav.classList.remove('open');const menu=document.getElementById('menuButton');menu?.setAttribute('aria-expanded','false');});
    const trust=nav.querySelector('a[href="#trust"]');nav.insertBefore(link,trust||null);
  }
  function shell(){
    if(document.getElementById(SECTION_ID))return document.getElementById(SECTION_ID);
    const anchor=document.getElementById('agents');if(!anchor)return null;
    const section=document.createElement('section');section.id=SECTION_ID;section.className='agent-control-center shell';
    section.innerHTML=`
      <div class="agent-control-shell">
        <div class="agent-control-top">
          <div><p class="eyebrow">SAI-V5 Agent Control Center</p><h2>See every gate before any action.</h2><p>Durable orchestration, approvals, evidence, verifier state and executor contracts are separated from external execution. This surface renders verified control-plane truth only; tenant task data stays empty until authenticated durable runtime is deliberately activated.</p></div>
          <div class="agent-control-status" aria-live="polite">
            <span>Control plane <b id="accControl">LOCKED</b></span>
            <span>External actions <b id="accExternal">LOCKED</b></span>
            <span>Trusted verifier <b id="accVerifier">LOCKED</b></span>
            <span>Executor binding <b id="accExecutor">LOCKED / NONE</b></span>
          </div>
        </div>
        <div class="agent-control-grid">
          <div class="agent-control-main">
            <div class="agent-metric-grid">
              <div class="agent-metric"><span>Active tasks</span><strong>—</strong></div>
              <div class="agent-metric"><span>Waiting approval</span><strong>—</strong></div>
              <div class="agent-metric"><span>Verifier passed</span><strong>—</strong></div>
              <div class="agent-metric"><span>External executions</span><strong>0</strong></div>
            </div>
            <div class="agent-panel">
              <div class="agent-panel-head"><strong>Durable task graph</strong><span>Tenant data not loaded</span></div>
              <div class="agent-job-board">
                <div class="agent-job-column"><span>PLANNED / QUEUED</span><p>No verified tenant task feed is connected.</p></div>
                <div class="agent-job-column"><span>RUNNING / PAUSED</span><p>Worker execution remains unavailable in this foundation.</p></div>
                <div class="agent-job-column"><span>APPROVAL</span><p>Approval queue stays protected behind verified identity and owner/admin RBAC.</p></div>
                <div class="agent-job-column"><span>VERIFY / COMPLETE</span><p>Completion requires trusted verifier PASS; self-certification is prohibited.</p></div>
              </div>
            </div>
            <div class="agent-panel">
              <div class="agent-panel-head"><strong>Executor lifecycle contract</strong><span id="accLifecycleState">CONTRACT ONLY</span></div>
              <div class="agent-lifecycle" id="accLifecycle"><span>Prepare</span><span>Authorize</span><span>Dry run</span><span>Execute</span><span>Verify</span><span>Commit / rollback</span></div>
            </div>
            <div class="agent-control-actions"><button type="button" id="accRefresh">Refresh verified state</button><button type="button" id="accOpenAgents">Open Agents workspace</button></div>
            <p class="agent-control-note" id="accNote">No external action endpoint is exposed. Refresh reads public contract/status metadata only and does not execute a task.</p>
          </div>
          <aside class="agent-control-side">
            <div class="agent-panel" style="margin-top:0"><div class="agent-panel-head"><strong>Provider-neutral executor contracts</strong><span id="accContractCount">0 bound</span></div><div class="agent-contract-list" id="accContracts"><div class="agent-empty">Waiting for verified SakthiAI contract metadata. No executor is assumed.</div></div></div>
            <div class="agent-panel"><div class="agent-panel-head"><strong>Safety interlocks</strong><span>Default deny</span></div><div class="agent-safety-stack"><div class="agent-safety-row"><span>Idempotency key</span><b>REQUIRED</b></div><div class="agent-safety-row"><span>Consequential approval</span><b>REQUIRED</b></div><div class="agent-safety-row"><span>Evidence + verifier</span><b>REQUIRED</b></div><div class="agent-safety-row"><span>Rollback / compensation</span><b>REQUIRED</b></div><div class="agent-safety-row"><span>Paid providers</span><b>OFF</b></div><div class="agent-safety-row"><span>Direct main / force push</span><b>DENIED</b></div></div></div>
          </aside>
        </div>
      </div>`;
    anchor.insertAdjacentElement('afterend',section);return section;
  }
  function setBadge(id,value,ok=false){const el=document.getElementById(id);if(!el)return;el.textContent=value;el.classList.toggle('ok',Boolean(ok));}
  function renderContracts(body){
    const registry=body?.registry||{};const root=document.getElementById('accContracts');if(!root)return;
    const contracts=Array.isArray(registry?.contracts)?registry.contracts:[];const bound=contracts.filter(x=>x.state!=='NO_EXECUTOR_BOUND').length;
    document.getElementById('accContractCount').textContent=`${bound} bound / ${contracts.length} contracts`;
    if(!contracts.length){root.innerHTML='<div class="agent-empty">No verified executor contract registry was returned. External execution remains unavailable.</div>';setBadge('accExecutor','LOCKED / NONE',false);return;}
    root.innerHTML=contracts.map(item=>`<article class="agent-contract-card"><div><strong>${esc(item.label||item.id)}</strong><b>${esc(item.state||'UNKNOWN')}</b></div><p>${esc((item.actionClasses||[]).join(' · '))}</p></article>`).join('');
    setBadge('accExecutor',body?.bindingGateEnabled?(bound?'BOUND':'ENABLED / NONE'):'LOCKED / NONE',false);
    const lifecycle=Array.isArray(registry?.lifecycle)?registry.lifecycle:[];
    if(lifecycle.length){document.getElementById('accLifecycle').innerHTML=lifecycle.map(x=>`<span>${esc(String(x).replaceAll('_',' '))}</span>`).join('');}
  }
  async function getJson(path){
    const runtime=window.SakthiRuntime;if(!runtime?.state?.apiConnected||!runtime.state.base)throw new Error('CONTROL_PLANE_NOT_CONNECTED');
    const response=await fetch(runtime.state.base+path,{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store'});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.code||`HTTP_${response.status}`);return data;
  }
  async function refresh(){
    const note=document.getElementById('accNote');if(note)note.textContent='Reading verified control-plane status and executor contracts only…';
    try{
      const [control,contracts]=await Promise.all([getJson('/api/v1/agents/control/status'),getJson('/api/v1/agents/executors/contracts')]);
      const state=control?.control||{};
      setBadge('accControl',state.state==='AVAILABLE'?'AVAILABLE':String(state.state||'LOCKED').replaceAll('_',' '),state.state==='AVAILABLE');
      setBadge('accExternal',state.externalActions==='enabled'?'ENABLED':'LOCKED',false);
      setBadge('accVerifier',state.verifierRuntime==='enabled'?'ENABLED':'LOCKED',false);
      renderContracts(contracts);
      document.getElementById('accLifecycleState').textContent=contracts?.registry?.externalExecutionImplemented?'EXECUTION IMPLEMENTED':'CONTRACT ONLY';
      if(note)note.textContent='Verified control-plane metadata loaded. No tenant tasks, credentials or external actions were requested.';
    }catch(error){
      setBadge('accControl','LOCKED',false);setBadge('accExternal','LOCKED',false);setBadge('accVerifier','LOCKED',false);setBadge('accExecutor','LOCKED / NONE',false);
      if(note)note.textContent='Control-plane metadata is unavailable on this host. The Agent Control Center remains fail-closed and no action was attempted.';
    }
  }
  function init(){addStyle();addNav();if(!shell())return;document.getElementById('accRefresh')?.addEventListener('click',refresh);document.getElementById('accOpenAgents')?.addEventListener('click',()=>{document.querySelector('[data-capability="agents"]')?.click();document.getElementById('workspace')?.scrollIntoView({behavior:'smooth',block:'start'});});window.addEventListener('sakthiai:runtime',()=>refresh());if(window.SakthiRuntime?.state?.apiConnected)refresh();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
