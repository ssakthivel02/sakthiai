(function(){
  const state={mode:'preview',connected:false,base:'',health:null,error:null};
  const meta=document.querySelector('meta[name="sakthiai-api-base"]');
  const explicit=(meta?.content||'').trim().replace(/\/$/,'');
  const sameOriginAllowed=location.hostname==='sakthiai.omsaravanabhava.org';
  const base=explicit || (sameOriginAllowed ? location.origin : '');
  state.base=base;

  function announce(next){Object.assign(state,next);window.dispatchEvent(new CustomEvent('sakthiai:runtime',{detail:{...state}}));}

  async function probe(){
    if(!base){announce({mode:'preview',connected:false,error:null});return state;}
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),4500);
      const response=await fetch(base+'/api/health',{method:'GET',headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store',signal:controller.signal});
      clearTimeout(timer);
      if(!response.ok)throw new Error('HTTP_'+response.status);
      const json=await response.json();
      const healthy=json?.status==='ok'||json?.ok===true||json?.healthy===true;
      if(!healthy)throw new Error('HEALTH_UNVERIFIED');
      announce({mode:'runtime',connected:true,health:json,error:null});
    }catch(error){announce({mode:'unavailable',connected:false,health:null,error:error?.message||'RUNTIME_UNAVAILABLE'});}
    return state;
  }

  async function sendCommand(prompt,mode){
    if(!state.connected||!state.base)throw new Error('SAKTHIAI_RUNTIME_NOT_CONNECTED');
    if(!prompt?.trim())throw new Error('EMPTY_PROMPT');
    const response=await fetch(state.base+'/api/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify({prompt:prompt.trim(),mode:mode||'chat',provider:'auto',budget:'economy'})});
    if(!response.ok)throw new Error('CHAT_HTTP_'+response.status);
    return response.json();
  }

  window.SakthiRuntime={state,probe,sendCommand};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',probe,{once:true});else probe();
})();
