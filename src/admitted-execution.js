import {evaluateAdmission} from './admission-control.js';
import {capacitySignal,reserveCapacity} from './capacity-signal.js';
function queued(input={}){const requestClass=String(input.requestClass||'interactive').toLowerCase();const priority=String(input.priority||'normal').toLowerCase();return requestClass==='batch'||priority==='low';}
export async function executeWithAdmission(env={},input={},run){
  if(typeof run!=='function')throw new TypeError('RUN_FUNCTION_REQUIRED');
  const signal=capacitySignal(env);
  const admission=evaluateAdmission(env,{...input,activeRequests:signal.activeRequests});
  if(!admission.ok)return {ok:false,executed:false,admission,signal};
  const reservation=reserveCapacity(env);
  if(!reservation.ok){const shouldQueue=queued(input);return {ok:false,executed:false,signal:reservation,admission:{...admission,ok:false,decision:shouldQueue?'QUEUE':'REJECT',code:reservation.code||'CAPACITY_RESERVATION_FAILED',retryAfterSeconds:shouldQueue?20:15}};}
  try{return {ok:true,executed:true,value:await run(admission),admission,signal:reservation};}
  finally{reservation.release();}
}
