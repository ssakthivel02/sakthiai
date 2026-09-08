function bool(value){return String(value??'').toLowerCase()==='true';}
function limit(value){
  const n=Number.parseInt(String(value??''),10);
  return Number.isFinite(n)&&n>0?Math.min(n,100000):null;
}

let activeRequests=0;

export function capacitySignal(env={}){
  const enabled=bool(env.ADMISSION_CONTROL_ENABLED);
  const configuredLimit=limit(env.ADMISSION_GLOBAL_CONCURRENCY_LIMIT);
  if(!enabled)return {
    ok:true,
    code:'ADMISSION_CONTROL_DISABLED',
    scope:'worker-isolate',
    globallyAuthoritative:false,
    activeRequests,
    configuredLimit
  };
  if(configuredLimit===null)return {
    ok:false,
    code:'CAPACITY_LIMIT_REQUIRED',
    scope:'worker-isolate',
    globallyAuthoritative:false,
    activeRequests:null,
    configuredLimit:null
  };
  return {
    ok:true,
    code:'LOCAL_ACTIVE_REQUEST_SIGNAL',
    scope:'worker-isolate',
    globallyAuthoritative:false,
    activeRequests,
    configuredLimit
  };
}

export function reserveCapacity(env={}){
  const signal=capacitySignal(env);
  if(!signal.ok)return {...signal,reserved:false,release() {}};
  if(!bool(env.ADMISSION_CONTROL_ENABLED))return {...signal,reserved:false,release() {}};
  if(activeRequests>=signal.configuredLimit)return {...signal,ok:false,code:'LOCAL_CAPACITY_EXHAUSTED',reserved:false,release() {}};
  activeRequests+=1;
  let released=false;
  return {
    ...signal,
    reserved:true,
    activeRequests,
    release(){
      if(released)return;
      released=true;
      activeRequests=Math.max(0,activeRequests-1);
    }
  };
}

export function capacitySignalStateForTest(){return {activeRequests};}
