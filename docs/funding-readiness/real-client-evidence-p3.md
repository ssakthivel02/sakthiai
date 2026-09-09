# SakthiAI Real External-Client Evidence Kit — P3

Status: **CLIENT KIT READY; NON-PRODUCTION PREFLIGHT REQUIRED BEFORE REAL EVIDENCE RUN**  
Production ready: **NO**  
External write execution: **NO**  
Repository executor bound: **NO**  
Live vendor-specific agent adapter: **NO**  
20+ real external-client runs completed: **NO — requires deliberate non-production environment configuration**

## Objective

P0 proved provider-neutral policy evaluation.  
P1 added signed machine-to-machine HTTP proposal intake.  
P2 added optional durable single-use nonce replay protection and a 30-trial deterministic CI benchmark.  
P3 adds the external-client tooling required to collect genuine non-production HTTPS evidence without enabling any write executor.

## Mandatory non-production preflight

Before any real P3 evidence run, execute:

`npm run preflight:p3`

Required environment variables:

```text
SAKTHIAI_EVIDENCE_NONPROD_ACK=NON_PRODUCTION_ONLY
SAKTHIAI_EVIDENCE_ENVIRONMENT=<explicit non-production label, e.g. p3-preview>
SAKTHIAI_WEBHOOK_ENDPOINT=https://<non-production-host>/api/v1/agents/external-proposals/evaluate
SAKTHIAI_WEBHOOK_SECRET=<runtime secret; never pass on command line>
SAKTHIAI_WEBHOOK_AGENT_ID=<allowlisted machine identity>
SAKTHIAI_WEBHOOK_TENANT_ID=<allowlisted non-production tenant>
```

The preflight refuses to pass when:

- the acknowledgement is missing
- the environment label is `prod`, `production` or `live`
- the endpoint is not HTTPS
- the endpoint is localhost
- the runtime secret is missing/weak
- the public SakthiAI contract endpoint is unavailable
- the webhook is disabled
- agent/tenant scope is not configured
- durable replay is not available
- D1 replay state is not `AVAILABLE`
- the contract permits anything beyond `read_only`
- requested execution is not `dry_run`
- the contract reports external side effects
- an executor is bound

The preflight never prints the configured secret.

A passing preflight is a prerequisite, not production certification.

## Single-run client

`scripts/signed-webhook-client.mjs`

Example:

```bash
npm run client:webhook -- \
  --task-id p3_manual_001 \
  --action "Read the permitted non-production target and return evidence only" \
  --rationale "Controlled funding-readiness external-client evidence run" \
  --target-system github \
  --target-resource ssakthivel02/sakthiai \
  --output evidence/funding-readiness/p3-single-run.json
```

The command line intentionally has **no `--secret` flag**. The secret must come from the process environment.

The client always constructs:

- `actionClass=read_only`
- `requestedExecution=dry_run`

There is no command-line option to request write or execute mode.

## 20+ trial runner

`scripts/run-real-client-benchmark.mjs`

Minimum trial count is hard-bounded to 20.

After `npm run preflight:p3` passes, run:

```bash
npm run benchmark:real-client -- \
  --trials 20 \
  --check-replay \
  --target-system github \
  --target-resource ssakthivel02/sakthiai \
  --output evidence/funding-readiness/signed-webhook-p3-real-client.json
```

With `--check-replay`, each accepted signed proposal is immediately replayed with the same nonce. A correctly configured durable replay store should reject it with HTTP 409 / `AGENT_WEBHOOK_REPLAY_DETECTED`.

## Evidence report and claim gates

The runner records:

- endpoint, agent ID and tenant ID but not secret
- trial counts and outcomes
- replay attempts/rejections
- unique evidence hashes
- p50/p95/max client-observed latency
- per-trial status/code/decision/evidence hash
- `productionReadyClaim:false`

The report refuses to serialize if the configured secret appears in output.

`qualifiesAsRealExternalClientEvidence=true` only when:

- endpoint is non-localhost HTTPS
- all trials are accepted
- all accepted runs have unique evidence hashes

`qualifiesAsDurableReplayEvidence=true` additionally requires every replay to be rejected.

`vendorSpecificAgentClaim=false` remains fixed. A generic signed HTTP client is not a Codex, Claude Code, Gemini or Manus integration.

## HTTPS / localhost boundary

Plain HTTP is rejected outside localhost.

`--allow-localhost` exists only for automated integration tests. A localhost report is labelled:

`evidenceMode=LOCAL_HTTP_TEST_CLIENT`

and cannot qualify as real external-client evidence.

## CI validation already achieved

P3 CI starts a separate local fixture server and drives the exact CLI/benchmark over a real TCP/HTTP socket. It requires:

- single-run CLI success
- 20/20 unique proposals accepted
- 20/20 immediate replays rejected
- 20 unique evidence hashes
- no secret leakage
- all external side effects false
- all claim gates for real evidence false because the endpoint is localhost
- the full SakthiAI regression suite green

This is integration-test evidence only, not genuine non-production HTTPS evidence.

## Genuine non-production prerequisites

Before running the stronger evidence collection, deliberately configure a non-production SakthiAI Worker/environment with:

1. migration `0004_agent_webhook_replay.sql` on non-production D1
2. D1 bound as `DB`
3. `AGENT_WEBHOOK_ENABLED=true`
4. `AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED=true`
5. one non-production allowed agent ID
6. one non-production allowed tenant ID
7. strong runtime-only `AGENT_WEBHOOK_SHARED_SECRET`
8. HTTPS endpoint
9. no production credentials/data
10. all external action/executor gates disabled

Repository defaults must remain false.

## What must NOT be done in P3

Do not enable:

- repository writes
- direct `main` changes
- force pushes
- messaging
- publishing
- deployments
- cloud mutations
- destructive actions
- production tenant data
- production secrets

## Funding evidence standard

Only after a genuine P3 evidence file passes its claim gates may the funding materials state:

> SakthiAI accepted 20+ signed proposals from an external client over HTTPS in a controlled non-production environment, produced distinct verifier/policy evidence receipts, and rejected replay attempts through the durable nonce ledger while external side effects remained disabled.

Until then the truthful statement is:

> **P3 CLIENT KIT + NON-PRODUCTION PREFLIGHT READY; REAL EXTERNAL-CLIENT EVIDENCE NOT YET COLLECTED.**

## Next gate

Only after owner review of genuine P3 results should P4 be considered. A possible P4 would be one isolated-branch repository executor with explicit approval, tests, evidence and rollback reference. It must not be started simply because the P3 tooling exists.
