import assert from 'node:assert/strict';
import {capacitySignal,reserveCapacity,capacitySignalStateForTest} from '../src/capacity-signal.js';

const disabled={ADMISSION_CONTROL_ENABLED:'false'};
assert.equal(capacitySignal(disabled).ok,true);
assert.equal(capacitySignal(disabled).code,'ADMISSION_CONTROL_DISABLED');

const missing={ADMISSION_CONTROL_ENABLED:'true'};
assert.equal(capacitySignal(missing).ok,false);
assert.equal(capacitySignal(missing).code,'CAPACITY_LIMIT_REQUIRED');

const env={ADMISSION_CONTROL_ENABLED:'true',ADMISSION_GLOBAL_CONCURRENCY_LIMIT:'2'};
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});
const first=reserveCapacity(env);
assert.equal(first.ok,true);
assert.equal(first.reserved,true);
assert.equal(first.activeRequests,1);
const second=reserveCapacity(env);
assert.equal(second.ok,true);
assert.equal(second.reserved,true);
assert.equal(second.activeRequests,2);
const third=reserveCapacity(env);
assert.equal(third.ok,false);
assert.equal(third.code,'LOCAL_CAPACITY_EXHAUSTED');
assert.equal(third.reserved,false);

first.release();
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:1});
first.release();
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:1});
second.release();
assert.deepEqual(capacitySignalStateForTest(),{activeRequests:0});

console.log('capacity-signal tests: PASS');
