import assert from 'node:assert/strict';
import {executeWithAdmission} from '../src/admitted-execution.js';
import {capacitySignalStateForTest} from '../src/capacity-signal.js';

const disabled=await executeWithAdmission({}, {requestClass:'interactive'}, async admission=>({admission:admission.decision,value:'ok'}));
assert.equal(disabled.ok,true);
assert.equal(disabled.executed,true);
assert.equal(disabled.value.value,'ok');
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

const missing=await executeWithAdmission({ADMISSION_CONTROL_ENABLED:'true'}, {}, async()=>{throw new Error('must not execute');});
assert.equal(missing.ok,false);
assert.equal(missing.executed,false);
assert.equal(missing.admission.code,'CAPACITY_SIGNAL_REQUIRED');
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

const env={ADMISSION_CONTROL_ENABLED:'true',ADMISSION_GLOBAL_CONCURRENCY_LIMIT:'2',ADMISSION_DEGRADE_AT_PERCENT:'50'};
let observedInside=-1;
const degraded=await executeWithAdmission(env,{requestClass:'interactive',cacheable:true},async admission=>{
  observedInside=capacitySignalStateForTest().activeRequests;
  assert.equal(admission.decision,'DEGRADE');
  assert.equal(admission.degradation.maxOutputScale,0.5);
  return 'degraded-ok';
});
assert.equal(degraded.ok,true);
assert.equal(observedInside,1);
assert.equal(degraded.value,'degraded-ok');
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

await assert.rejects(
  executeWithAdmission(env,{requestClass:'interactive'},async()=>{
    assert.equal(capacitySignalStateForTest().activeRequests,1);
    throw new Error('MODEL_FAILURE');
  }),
  /MODEL_FAILURE/
);
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

const held=await import('../src/capacity-signal.js').then(({reserveCapacity})=>reserveCapacity(env));
assert.equal(held.ok,true);
const second=await import('../src/capacity-signal.js').then(({reserveCapacity})=>reserveCapacity(env));
assert.equal(second.ok,true);
const blocked=await executeWithAdmission(env,{requestClass:'interactive'},async()=>{throw new Error('must not execute');});
assert.equal(blocked.ok,false);
assert.equal(blocked.executed,false);
assert.equal(blocked.admission.decision,'REJECT');
held.release();
second.release();
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

console.log('admitted-execution tests: PASS');
