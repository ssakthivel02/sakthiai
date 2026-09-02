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

  function statusClass(status){if(status==='RUNTIME_CONNECTED')return'runtime';if(status.includes('BUILD')||status.includes('ENGINE')||status.includes('RUNTIME'))return'building';return'';}
  function pretty(status){return String(status||'UNKNOWN').replaceAll('_',' ');}

  function renderRegistry(){
    if(rail)rail.innerHTML=capabilities.map((c,i)=>`<button class="rail-button ${i===0?'active':''}" type="button" data-capability="${c.id}"><span>${symbol[c.id]||c.icon}</span><span>${c.title}</span></button>`).join('');
    if(grid)grid.innerHTML=capabilities.map(c=>`<article class="capability-card" tabindex="0" role="button" data-capability="${c.id}" aria-label="Open ${c.title}"><span class="icon">${c.icon}</span><h3>${c.title}</h3><p>${c.description}</p><span class="card-status">${pretty(c.status)}</span></article>`).join('');
  }

  function setMode(id,scroll=false){
    const c=capabilities.find(x=>x.id===id);if(!c)return;active=c;
    $$('.rail-button').forEach(b=>b.classList.toggle('active',b.dataset.capability===id));
    $('#modeCategory').textContent=c.category.toUpperCase();
    $('#modeTitle').textContent=c.title;
    $('#modeStatus').textContent=pretty(c.status);
    $('#modeStatus').className='truth-badge '+statusClass(c.status);
    $('#modeDescription').textContent=c.description;
    $('#promptExample').textContent=c.prompt;
    $('#commandInput').placeholder=`Ask SakthiAI ${c.title}…`;
    if(scroll)$('#workspace')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function toast(message){
    let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.appendChild(el);}el.textContent=message;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3000);
  }

  renderRegistry();
  rail?.addEventListener('click',e=>{const b=e.target.closest('[data-capability]');if(b)setMode(b.dataset.capability);});
  grid?.addEventListener('click',e=>{const c=e.target.closest('[data-capability]');if(c)setMode(c.dataset.capability,true);});
  grid?.addEventListener('keydown',e=>{const c=e.target.closest('[data-capability]');if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setMode(c.dataset.capability,true);}});

  $$('.composer-tools button').forEach(button=>button.addEventListener('click',()=>toast('This control is part of the new flagship UI. It will activate only with its verified SakthiAI backend contract.')));

  const input=$('#commandInput'),send=$('#sendCommand');
  async function submit(){
    const prompt=input?.value.trim();if(!prompt){toast('Enter a command first.');return;}
    if(!window.SakthiRuntime?.state?.connected){toast('Flagship preview is fail-closed: no AI runtime is connected on this host, so your command was not transmitted.');return;}
    send.disabled=true;const original=send.textContent;send.textContent='…';$('#composerNote').textContent='SakthiAI runtime connected — processing through the verified API.';
    try{
      const data=await window.SakthiRuntime.sendCommand(prompt,active?.id||'chat');
      const text=data?.answer||data?.response||data?.content||data?.message||'The runtime responded without a displayable answer field.';
      $('#promptExample').textContent=prompt;$('#modeDescription').textContent=String(text).slice(0,1600);input.value='';
    }catch(error){toast('Runtime request failed safely: '+(error?.message||'unknown error'));}
    finally{send.disabled=false;send.textContent=original;}
  }
  send?.addEventListener('click',submit);input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit();}});

  window.addEventListener('sakthiai:runtime',event=>{
    const state=event.detail||{};const pill=$('#runtimeStatus'),label=$('#runtimeLabel'),note=$('#composerNote');if(!pill)return;
    pill.className='status-pill '+(state.connected?'online':state.mode==='preview'?'preview':'error');
    if(state.connected){pill.innerHTML='<span></span> Runtime connected';label.textContent='Runtime: verified SakthiAI API';note.textContent='Connected runtime detected. Commands can be sent through the configured SakthiAI API.';$('#modeStatus').textContent='RUNTIME CONNECTED';$('#modeStatus').className='truth-badge runtime';}
    else if(state.mode==='preview'){pill.innerHTML='<span></span> Preview mode';label.textContent='Runtime: not connected on preview host';note.textContent='Preview safety: commands are not sent anywhere until a verified SakthiAI runtime is connected.';}
    else{pill.innerHTML='<span></span> Runtime unavailable';label.textContent='Runtime: unavailable';note.textContent='Runtime probe failed. SakthiAI remains fail-closed and did not fall back to a paid provider.';}
  });

  const clock=$('#consoleClock');setInterval(()=>{if(clock)clock.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});},1000);
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
