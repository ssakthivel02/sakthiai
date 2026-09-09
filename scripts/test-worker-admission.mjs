import assert from 'node:assert/strict';
import worker,{admissionHttpStatus,admissionHeaders,admissionStatus,policyWithAdmission} from '../src/worker-admission.js';

assert.equal(admissionHttpStatus('ADMIT'),200);
assert.equal(admissionHttpStatus('DEGRADE'),200);
assert.equal(admissionHttpStatus('QUEUE'),503);
assert.equal(admissionHttpStatus('REJECT'),429);
assert.deepEqual(admissionHeaders({admission:{retryAfterSeconds:15}}),{'retry-after':'15'});
assert.deepEqual(admissionHeaders({admission:{}}),{});

const disabled=admissionStatus({ADMISSION_CONTROL_ENABLED:'false'});
assert.equal(disabled.policy.enabled,false);
assert.equal(disabled.signal.globallyAuthoritative,false);

const env={ADMISSION_CONTROL_ENABLED:'true',ADMISSION_GLOBAL_CONCURRENCY_LIMIT:'4'};
const enabled=admissionStatus(env);
assert.equal(enabled.policy.enabled,true);
assert.equal(enabled.policy.hardLimit,4);
assert.equal(enabled.signal.scope,'worker-isolate');
assert.equal(enabled.signal.globallyAuthoritative,false);

const combined=policyWithAdmission(env);
assert.equal(combined.product,'SakthiAI');
assert.equal(combined.admission.policy.hardLimit,4);
assert.equal(combined.admission.signal.scope,'worker-isolate');
assert.equal(combined.admission.signal.globallyAuthoritative,false);

for(const path of ['/api/v1/policy','/api/v1/status']){
  const response=await worker.fetch(new Request(`https://sakthiai.example${path}`),env,{});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.policy.admission.policy.enabled,true);
  assert.equal(body.policy.admission.policy.hardLimit,4);
  assert.equal(body.policy.admission.signal.scope,'worker-isolate');
  assert.equal(body.policy.admission.signal.globallyAuthoritative,false);
}

const missing=admissionStatus({ADMISSION_CONTROL_ENABLED:'true'});
assert.equal(missing.signal.ok,false);
assert.equal(missing.signal.code,'CAPACITY_LIMIT_REQUIRED');

console.log('worker-admission integration tests: PASS');
