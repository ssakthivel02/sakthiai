(function(){
  const capabilities=window.SAKTHIAI_CAPABILITIES||[];
  let active=capabilities[0]||null;
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];

  const menu=$('#menuButton'),nav=$('#primaryNav');
  menu?.addEventListener('click',()=>{const open=nav?.classList.toggle('open')||false;menu.setAttribute('aria-expanded',String(open));});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu?.setAttribute('aria-expanded','false');}));

  const rail=$('#workspaceRail'),grid=$('#capabilityGrid');
  const symbol={chat:'AI',research:'R',code:'</>',agents:'A',automation:'⌁',webapp:'◫',image:'◈',video:'▶',voice:'≈',artifacts:'▤',knowledge:'K',developer:'{ }'};

  function effectiveStatus(capability){return capability?.runtimeStatus||capability?.status||'UNKNOWN';}
  function statusClass(status){if(status==='RUNTIME_AVAILABLE'||status==='RUNTIME_CONNECTED')return'runtime';if(String(status).includes('BUILD')||String(status).includes('ENGINE')||String(status).includes('RUNTIME')||String(status).includes('PERSISTENCE')||String(status).includes('CONTROL_PLANE'))return'building';return'';}
  function pretty(status){return String(status||'UNKNOWN').replaceAll('_',' ');}

  function renderRegistry(){
    if(rail)rail.innerHTML=capabilities.map(c=>`<button class="rail-button ${active?.id===c.id?'active':''}" type="button" data-capability="${c.id}"><span>${symbol[c.id]||c.icon}</span><span>${c.title}</span></button>`).join('');
    if(grid)grid.innerHTML=capabilities.map(c=>`<article class="capability-card" tabindex="0" role="button" data-capability="${c.id}" aria-label="Open ${c.title}"><span class="icon">${c.icon}</span><h3>${c.title}</h3><p>${c.description}</p><span class="card-status">${pretty(effectiveStatus(c))}</span></article>`).join('');
  }

  function setMode(id,scroll=false){
    const c=capabilities.find(x=>x.id===id);if(!c)return;active=c;
    $$('.rail-button').forEach(b=>b.classList.toggle('active',b.dataset.capability===id));
    $('#modeCategory').textContent=c.category.toUpperCase();
    $('#modeTitle').textContent=c.title;
    const status=effectiveStatus(c);
    $('#modeStatus').textContent=pretty(status);
    $('#modeStatus').className='truth-badge '+statusClass(status);
    $('#modeDescription').textContent=c.description;
    $('#promptExample').textContent=c.prompt;
    $('#commandInput').placeholder=`Ask SakthiAI ${c.title}…`;
    updateComposerNote();
    if(scroll)$('#workspace')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function toast(message){
    let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.appendChild(el);}el.textContent=message;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3600);
  }

  function updateComposerNote(){
    const note=$('#composerNote');if(!note)return;
    const runtime=window.SakthiRuntime?.state;
    if(!runtime?.apiConnected){note.textContent=runtime?.mode==='unavailable'?'Control-plane probe failed. SakthiAI remains fail-closed; no paid fallback is attempted.':'Preview safety: commands are not sent anywhere until a verified SakthiAI control plane is connected.';return;}
    const state=window.SakthiRuntime.capabilityState(active?.id||'chat');
    note.textContent=state==='RUNTIME_AVAILABLE'?`${active.title} runtime is verified available for this control plane.`:`Control plane online; ${active.title} is ${pretty(state)}. Commands for this mode stay blocked.`;
  }

  function applyServerCapabilities(registry){
    for(const c of capabilities)c.runtimeStatus=registry?.[c.id]?.state||null;
    renderRegistry();setMode(active?.id||capabilities[0]?.id||'chat');
  }

  renderRegistry();setMode(active?.id||'chat');
  rail?.addEventListener('click',e=>{const b=e.target.closest('[data-capability]');if(b)setMode(b.dataset.capability);});
  grid?.addEventListener('click',e=>{const c=e.target.closest('[data-capability]');if(c)setMode(c.dataset.capability,true);});
  grid?.addEventListener('keydown',e=>{const c=e.target.closest('[data-capability]');if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setMode(c.dataset.capability,true);}});

  $$('.composer-tools button').forEach(button=>button.addEventListener('click',()=>toast('This control activates only when its specific SakthiAI backend capability is verified available.')));

  const input=$('#commandInput'),send=$('#sendCommand');
  async function submit(){
    const prompt=input?.value.trim();if(!prompt){toast('Enter a command first.');return;}
    const runtime=window.SakthiRuntime;
    if(!runtime?.state?.apiConnected){toast('Flagship preview is fail-closed: no SakthiAI control plane is connected, so your command was not transmitted.');return;}
    const capState=runtime.capabilityState(active?.id||'chat');
    if(capState!=='RUNTIME_AVAILABLE'){toast(`${active?.title||'This capability'} is ${pretty(capState)}. Nothing was transmitted.`);return;}
    send.disabled=true;const original=send.textContent;send.textContent='…';$('#composerNote').textContent=`${active.title} runtime verified — processing through SakthiAI.`;
    try{
      const data=await runtime.execute(prompt,active?.id||'chat');
      let text=data?.answer||data?.response||data?.content||data?.message||'';
      if(!text&&data?.plan)text=JSON.stringify(data.plan,null,2);
      if(!text)text='The verified runtime completed without a displayable answer or plan field.';
      $('#promptExample').textContent=prompt;$('#modeDescription').textContent=String(text).slice(0,2000);input.value='';
    }catch(error){toast('Runtime request failed safely: '+(error?.message||'unknown error'));}
    finally{send.disabled=false;send.textContent=original;updateComposerNote();}
  }
  send?.addEventListener('click',submit);input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit();}});

  window.addEventListener('sakthiai:runtime',event=>{
    const state=event.detail||{};const pill=$('#runtimeStatus'),label=$('#runtimeLabel');if(!pill)return;
    pill.className='status-pill '+(state.apiConnected?'online':state.mode==='preview'?'preview':'error');
    if(state.apiConnected){
      pill.innerHTML='<span></span> Control plane online';
      label.textContent='Runtime: capability-aware SakthiAI API';
      applyServerCapabilities(state.capabilities||{});
    }else if(state.mode==='preview'){
      pill.innerHTML='<span></span> Preview mode';label.textContent='Runtime: not connected on preview host';
    }else{
      pill.innerHTML='<span></span> Control plane unavailable';label.textContent='Runtime: unavailable';
    }
    updateComposerNote();
  });

  const clock=$('#consoleClock');setInterval(()=>{if(clock)clock.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});},1000);
  import('./agent-control-ui.js').catch(()=>{});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
