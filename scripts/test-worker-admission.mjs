import assert from 'node:assert/strict';
import {admissionHttpStatus,admissionHeaders,admissionStatus} from '../src/worker-admission.js';

assert.equal(admissionHttpStatus('ADMIT'),200);
assert.equal(admissionHttpStatus('DEGRADE'),200);
assert.equal(admissionHttpStatus('QUEUE'),503);
assert.equal(admissionHttpStatus('REJECT'),429);
assert.deepEqual(admissionHeaders({admission:{retryAfterSeconds:15}}),{'retry-after':'15'});
assert.deepEqual(admissionHeaders({admission:{}}),{});

const disabled=admissionStatus({ADMISSION_CONTROL_ENABLED:'false'});
assert.equal(disabled.policy.enabled,false);
assert.equal(disabled.signal.globallyAuthoritative,false);

const enabled=admissionStatus({ADMISSION_CONTROL_ENABLED:'true',ADMISSION_GLOBAL_CONCURRENCY_LIMIT:'4'});
assert.equal(enabled.policy.enabled,true);
assert.equal(enabled.policy.hardLimit,4);
assert.equal(enabled.signal.scope,'worker-isolate');
assert.equal(enabled.signal.globallyAuthoritative,false);

const missing=admissionStatus({ADMISSION_CONTROL_ENABLED:'true'});
assert.equal(missing.signal.ok,false);
assert.equal(missing.signal.code,'CAPACITY_LIMIT_REQUIRED');

console.log('worker-admission integration tests: PASS');
