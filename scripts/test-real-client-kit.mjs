import assert from 'node:assert/strict';
import {validateExternalClientConfig,buildReadOnlyProposal,createSignedExternalProposalRequest,sanitizedClientConfig} from './lib/signed-webhook-client.mjs';
import {createSignedAgentWebhookSignature} from '../src/signed-agent-webhook.js';

const SECRET='client-test-only-shared-secret-0123456789abcdef';
const HTTPS='https://preview.example.invalid/api/v1/agents/external-proposals/evaluate';
const LOCAL='http://127.0.0.1:8877/api/v1/agents/external-proposals/evaluate';
const config={endpoint:HTTPS,secret:SECRET,agentId:'test-agent',tenantId:'test-tenant'};

let check=validateExternalClientConfig({});
assert.equal(check.code,'CLIENT_ENDPOINT_REQUIRED');
check=validateExternalClientConfig({...config,endpoint:'http://example.com/api/v1/agents/external-proposals/evaluate'});
assert.equal(check.code,'CLIENT_HTTPS_REQUIRED');
check=validateExternalClientConfig({...config,endpoint:'https://example.com/wrong'});
assert.equal(check.code,'CLIENT_ENDPOINT_PATH_INVALID');
check=validateExternalClientConfig({...config,secret:'short'});
assert.equal(check.code,'CLIENT_SECRET_MISSING_OR_WEAK');
check=validateExternalClientConfig({...config,endpoint:LOCAL});
assert.equal(check.code,'CLIENT_HTTPS_REQUIRED');
check=validateExternalClientConfig({...config,endpoint:LOCAL,allowLocalhost:true});
assert.equal(check.ok,true);

let proposal=buildReadOnlyProposal({});
assert.equal(proposal.code,'CLIENT_TASK_ID_REQUIRED');
proposal=buildReadOnlyProposal({taskId:'tsk',action:'Read only.',rationale:'Evidence.'});
assert.equal(proposal.ok,true);
assert.equal(proposal.proposal.actionClass,'read_only');
assert.equal(proposal.proposal.requestedExecution,'dry_run');
assert.equal('approvalId' in proposal.proposal,false);
assert.equal('forcePush' in proposal.proposal,false);

const timestamp='1770000000',runId='run_client_001',nonce='nonce_client_001';
const built=await createSignedExternalProposalRequest(config,{taskId:'tsk_client',action:'Inspect read-only metadata.',rationale:'Controlled client construction test.',target:{system:'github',resource:'ssakthivel02/sakthiai'}},{timestamp,runId,nonce});
assert.equal(built.ok,true);
assert.equal(built.metadata.actionClass,'read_only');
assert.equal(built.metadata.requestedExecution,'dry_run');
assert.equal(built.metadata.runId,runId);
assert.equal(built.metadata.nonce,nonce);
assert.equal(built.request.method,'POST');
const body=await built.request.clone().text();
const parsed=JSON.parse(body);
assert.equal(parsed.actionClass,'read_only');
assert.equal(parsed.requestedExecution,'dry_run');
const expected=await createSignedAgentWebhookSignature(SECRET,{timestamp,agentId:'test-agent',runId,tenantId:'test-tenant',nonce,body});
assert.equal(built.request.headers.get('x-sakthiai-signature'),expected);
assert.equal(built.request.headers.get('x-sakthiai-agent-id'),'test-agent');
assert.equal(built.request.headers.get('x-sakthiai-tenant'),'test-tenant');
assert.equal(JSON.stringify(built.metadata).includes(SECRET),false);
assert.equal(built.secretExposed,false);
assert.equal(built.signatureExposed,false);

const safe=sanitizedClientConfig(config);
assert.equal(safe.secretConfigured,true);
assert.equal(safe.secretExposed,false);
assert.equal(JSON.stringify(safe).includes(SECRET),false);

console.log(JSON.stringify({marker:'SAKTHIAI_P3_CLIENT_KIT_TEST_PASS',httpsRequired:true,localhostRequiresExplicitFlag:true,readOnly:true,dryRunOnly:true,secretOnCommandLine:false,secretExposed:false,externalSideEffects:false},null,2));
