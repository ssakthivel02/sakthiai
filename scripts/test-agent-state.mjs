import assert from 'node:assert/strict';
import {canTransition,classifyAction,nextStateAfterApproval,requiredAutonomyForAction,taskStateContract} from '../src/agent-state.js';

const green={state:'planned',retryCount:0,maxRetries:2,autonomyClass:'green',actionClass:'read_only'};
assert.equal(canTransition(green,'queued').ok,true);
assert.equal(canTransition({...green,state:'queued'},'running').ok,true);
assert.equal(canTransition({...green,state:'running'},'completed').code,'VERIFIER_REQUIRED');
assert.equal(canTransition({...green,state:'running'},'completed',{verifierState:'passed'}).ok,true);

const amber={state:'queued',retryCount:0,maxRetries:2,autonomyClass:'amber',actionClass:'repository_write'};
assert.equal(canTransition(amber,'running').code,'APPROVAL_REQUIRED');
assert.equal(canTransition(amber,'running',{approvalState:'approved'}).code,'EXTERNAL_ACTIONS_DISABLED');
assert.equal(canTransition(amber,'running',{approvalState:'approved',externalActionsEnabled:true}).ok,true);

const escalated=classifyAction({taskAutonomy:'green',actionClass:'deploy'});
assert.equal(escalated.requiredAutonomy,'red');
assert.equal(escalated.effectiveAutonomy,'red');
assert.equal(escalated.approvalRequired,true);
assert.equal(escalated.externalAction,true);
assert.equal(requiredAutonomyForAction('destructive'),'red');

assert.equal(canTransition({state:'waiting_approval',retryCount:0,maxRetries:2,autonomyClass:'amber',actionClass:'repository_write'},'queued').code,'APPROVAL_REQUIRED');
assert.equal(canTransition({state:'waiting_approval',retryCount:0,maxRetries:2,autonomyClass:'amber',actionClass:'repository_write'},'queued',{approvalState:'approved'}).ok,true);

assert.equal(canTransition({state:'failed',retryCount:1,maxRetries:2,autonomyClass:'green',actionClass:'read_only'},'queued').ok,true);
assert.equal(canTransition({state:'failed',retryCount:2,maxRetries:2,autonomyClass:'green',actionClass:'read_only'},'queued').code,'TASK_RETRY_LIMIT_REACHED');
assert.equal(canTransition({state:'completed',retryCount:0,maxRetries:2,autonomyClass:'green',actionClass:'read_only'},'queued').code,'TASK_TRANSITION_FORBIDDEN');
assert.equal(canTransition({state:'cancelled',retryCount:0,maxRetries:2,autonomyClass:'green',actionClass:'read_only'},'running').code,'TASK_TRANSITION_FORBIDDEN');

assert.equal(nextStateAfterApproval('approved'),'queued');
assert.equal(nextStateAfterApproval('rejected'),'paused');
assert.throws(()=>nextStateAfterApproval('maybe'),/APPROVAL_DECISION_INVALID/);

const contract=taskStateContract();
assert.deepEqual(contract.states,['planned','queued','running','waiting_approval','paused','completed','failed','cancelled']);
assert.equal(contract.actionRisk.deploy,'red');
assert.equal(contract.actionRisk.repository_write,'amber');
assert.equal(contract.actionRisk.read_only,'green');

console.log('SAKTHIAI_AGENT_STATE_TEST_PASS');
