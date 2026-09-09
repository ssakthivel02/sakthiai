import assert from 'node:assert/strict';
import {runChatModel} from '../src/chat-runtime.js';
import {capacitySignalStateForTest} from '../src/capacity-signal.js';

const missing=await runChatModel({},{});
assert.equal(missing.ok,false);
assert.equal(missing.code,'AI_BINDING_MISSING');

const calls=[];
const env={
  ADMISSION_CONTROL_ENABLED:'true',
  ADMISSION_GLOBAL_CONCURRENCY_LIMIT:'2',
  ADMISSION_DEGRADE_AT_PERCENT:'50',
  AI:{run:async(model,input)=>{
    calls.push({model,input,active:capacitySignalStateForTest().activeRequests});
    return {response:'ok'};
  }}
};
const result=await runChatModel(env,{model:'test-model',messages:[{role:'user',content:'hello'}],maxTokens:700,temperature:0.2});
assert.equal(result.ok,true);
assert.equal(result.executed,true);
assert.equal(result.admission.decision,'DEGRADE');
assert.equal(result.maxTokens,350);
assert.equal(result.capacityScope,'worker-isolate');
assert.equal(result.globallyAuthoritative,false);
assert.equal(calls.length,1);
assert.equal(calls[0].active,1);
assert.equal(calls[0].input.max_tokens,350);
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

const failing={...env,AI:{run:async()=>{assert.equal(capacitySignalStateForTest().activeRequests,1);throw new Error('MODEL_FAIL');}}};
await assert.rejects(runChatModel(failing,{messages:[]}),/MODEL_FAIL/);
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

console.log('chat-runtime tests: PASS');
