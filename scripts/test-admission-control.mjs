import assert from 'node:assert/strict';
import {admissionPolicy,evaluateAdmission} from '../src/admission-control.js';

const disabled=evaluateAdmission({},{});
assert.equal(disabled.ok,true);
assert.equal(disabled.decision,'ADMIT');
assert.equal(disabled.code,'ADMISSION_CONTROL_DISABLED');

const env={ADMISSION_CONTROL_ENABLED:'true',ADMISSION_GLOBAL_CONCURRENCY_LIMIT:'20',ADMISSION_DEGRADE_AT_PERCENT:'75'};
const policy=admissionPolicy(env);
assert.equal(policy.hardLimit,20);
assert.equal(policy.degradeAt,15);
assert.equal(policy.paidFallback,false);

const missing=evaluateAdmission(env,{});
assert.equal(missing.ok,false);
assert.equal(missing.code,'CAPACITY_SIGNAL_REQUIRED');

const healthy=evaluateAdmission(env,{activeRequests:3,requestClass:'interactive'});
assert.equal(healthy.ok,true);
assert.equal(healthy.decision,'ADMIT');
assert.equal(healthy.code,'CAPACITY_AVAILABLE');

const pressure=evaluateAdmission(env,{activeRequests:15,requestClass:'interactive',cacheable:true});
assert.equal(pressure.ok,true);
assert.equal(pressure.decision,'DEGRADE');
assert.equal(pressure.degradation.preferCache,true);
assert.equal(pressure.degradation.disableOptionalTools,true);

const batchPressure=evaluateAdmission(env,{activeRequests:15,requestClass:'batch',priority:'low'});
assert.equal(batchPressure.ok,false);
assert.equal(batchPressure.decision,'QUEUE');
assert.equal(batchPressure.code,'CAPACITY_PRESSURE_BATCH_DEFERRED');

const exhausted=evaluateAdmission(env,{activeRequests:20,requestClass:'interactive'});
assert.equal(exhausted.ok,false);
assert.equal(exhausted.decision,'REJECT');
assert.equal(exhausted.code,'GLOBAL_CAPACITY_EXHAUSTED');

const lowPriority=evaluateAdmission(env,{activeRequests:20,requestClass:'interactive',priority:'low'});
assert.equal(lowPriority.decision,'QUEUE');

console.log('admission-control tests: PASS');
