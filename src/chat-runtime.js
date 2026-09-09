import {executeWithAdmission} from './admitted-execution.js';
function boundedTokens(base,admission){const requested=Math.max(1,Number.parseInt(String(base??700),10)||700);const scale=Number(admission?.degradation?.maxOutputScale??1);if(!Number.isFinite(scale)||scale<=0||scale>=1)return requested;return Math.max(1,Math.floor(requested*scale));}
export async function runChatModel(env={},options={}){
  if(!env.AI||typeof env.AI.run!=='function')return {ok:false,executed:false,code:'AI_BINDING_MISSING'};
  const model=String(options.model||env.AI_MODEL||'@cf/meta/llama-3.1-8b-instruct-fp8-fast');
  const messages=Array.isArray(options.messages)?options.messages:[];
  const baseMaxTokens=Math.max(1,Number.parseInt(String(options.maxTokens??700),10)||700);
  const temperature=Number.isFinite(Number(options.temperature))?Number(options.temperature):0.3;
  const execution=await executeWithAdmission(env,{requestClass:'interactive',priority:'normal',cacheable:Boolean(options.cacheable)},async admission=>{const maxTokens=boundedTokens(baseMaxTokens,admission);const result=await env.AI.run(model,{messages,max_tokens:maxTokens,temperature});return {result,maxTokens};});
  if(!execution.ok)return {...execution,code:execution.admission?.code||execution.signal?.code||'ADMISSION_REJECTED',model};
  return {ok:true,executed:true,model,result:execution.value.result,maxTokens:execution.value.maxTokens,admission:execution.admission,capacityScope:execution.signal?.scope||'worker-isolate',globallyAuthoritative:false};
}
