import assert from 'node:assert/strict';
import {evaluateAdmission} from '../src/admission-control.js';
import {capacitySignal,reserveCapacity,capacitySignalStateForTest} from '../src/capacity-signal.js';
import {executeWithAdmission} from '../src/admitted-execution.js';
import {runChatModel} from '../src/chat-runtime.js';

const env={ADMISSION_CONTROL_ENABLED:'true',ADMISSION_GLOBAL_CONCURRENCY_LIMIT:'2',ADMISSION_DEGRADE_AT_PERCENT:'50'};
assert.equal(capacitySignal(env).globallyAuthoritative,false);
assert.equal(evaluateAdmission(env,{activeRequests:0}).decision,'ADMIT');
assert.equal(evaluateAdmission(env,{activeRequests:1}).decision,'DEGRADE');
assert.equal(evaluateAdmission(env,{activeRequests:2}).decision,'REJECT');

const first=reserveCapacity(env);const second=reserveCapacity(env);const third=reserveCapacity(env);
assert.equal(first.ok,true);assert.equal(second.ok,true);assert.equal(third.ok,false);first.release();second.release();
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

await assert.rejects(executeWithAdmission(env,{},async()=>{throw new Error('MODEL_FAIL');}),/MODEL_FAIL/);
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

const pressure=reserveCapacity(env);
assert.equal(pressure.ok,true);
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:1});
const calls=[];
const runtime={...env,AI:{run:async(model,input)=>{calls.push({model,input});return {response:'ok'};}}};
const result=await runChatModel(runtime,{messages:[{role:'user',content:'hello'}],maxTokens:700});
assert.equal(result.ok,true);assert.equal(result.admission.decision,'DEGRADE');assert.equal(result.maxTokens,350);assert.equal(calls[0].input.max_tokens,350);
pressure.release();
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

console.log('admission reconciliation tests: PASS');
