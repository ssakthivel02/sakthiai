(function(){
  const state={mode:'preview',connected:false,apiConnected:false,base:'',health:null,policy:null,capabilities:{},error:null};
  const meta=document.querySelector('meta[name="sakthiai-api-base"]');
  const explicit=(meta?.content||'').trim().replace(/\/$/,'');
  const sameOriginAllowed=location.hostname==='sakthiai.omsaravanabhava.org';
  const base=explicit || (sameOriginAllowed ? location.origin : '');
  state.base=base;

  function announce(next){Object.assign(state,next);window.dispatchEvent(new CustomEvent('sakthiai:runtime',{detail:{...state,capabilities:{...state.capabilities}}}));}
  async function fetchJson(path,signal){
    const response=await fetch(base+path,{method:'GET',headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store',signal});
    const body=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(body?.code||('HTTP_'+response.status));
    return body;
  }
  function registryMap(items){return Object.fromEntries((Array.isArray(items)?items:[]).filter(x=>x?.id).map(x=>[x.id,x]));}

  async function probe(){
    if(!base){announce({mode:'preview',connected:false,apiConnected:false,error:null});return state;}
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),4500);
    try{
      const health=await fetchJson('/api/health',controller.signal);
      const healthy=health?.status==='ok'||health?.ok===true||health?.healthy===true;
      if(!healthy)throw new Error('HEALTH_UNVERIFIED');
      const [capabilityBody,policyBody]=await Promise.all([
        fetchJson('/api/v1/capabilities',controller.signal),
        fetchJson('/api/v1/policy',controller.signal)
      ]);
      announce({mode:'runtime',connected:true,apiConnected:true,health,policy:policyBody?.policy||null,capabilities:registryMap(capabilityBody?.capabilities),error:null});
    }catch(error){
      announce({mode:'unavailable',connected:false,apiConnected:false,health:null,policy:null,capabilities:{},error:error?.message||'RUNTIME_UNAVAILABLE'});
    }finally{clearTimeout(timer);}
    return state;
  }

  function capabilityState(id){return state.capabilities?.[id]?.state||'UNKNOWN';}

  async function execute(prompt,mode='chat'){
    if(!state.apiConnected||!state.base)throw new Error('SAKTHIAI_CONTROL_PLANE_NOT_CONNECTED');
    const clean=String(prompt||'').trim();
    if(!clean)throw new Error('EMPTY_PROMPT');
    const capability=mode||'chat';
    const capState=capabilityState(capability);
    if(capState!=='RUNTIME_AVAILABLE')throw new Error(`${capability.toUpperCase()}_NOT_AVAILABLE_${capState}`);
    const routes={
      chat:{path:'/api/v1/chat',body:{prompt:clean,mode:'chat',provider:'auto',budget:'economy'}},
      research:{path:'/api/v1/research/plan',body:{query:clean,freshness:'auto'}},
      code:{path:'/api/v1/code/plan',body:{objective:clean,scope:'repository'}},
      agents:{path:'/api/v1/agents/plan',body:{objective:clean,autonomyClass:'green'}},
      knowledge:{path:'/api/v1/knowledge/query',body:{query:clean}}
    };
    const route=routes[capability];
    if(!route)throw new Error('CAPABILITY_EXECUTION_NOT_WIRED');
    const response=await fetch(state.base+route.path,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify(route.body)});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.code||(`${capability.toUpperCase()}_HTTP_${response.status}`));
    return data;
  }

  window.SakthiRuntime={state,probe,execute,sendCommand:execute,capabilityState};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',probe,{once:true});else probe();
})();
