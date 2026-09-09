# SakthiAI Real External-Client Evidence Kit — P3

Status: **CLIENT KIT READY FOR NON-PRODUCTION EVIDENCE RUN**  
Production ready: **NO**  
External write execution: **NO**  
Repository executor bound: **NO**  
Live vendor-specific agent adapter: **NO**  
20+ real external-client runs completed: **NO — requires deliberate non-production environment configuration**

## Objective

P0 proved provider-neutral policy evaluation.  
P1 added signed machine-to-machine HTTP proposal intake.  
P2 added optional durable single-use nonce replay protection and a 30-trial deterministic CI benchmark.

P3 adds the client-side tooling required to collect the next class of evidence from a **real non-production HTTPS endpoint** without enabling any write executor.

The tooling is intentionally usable from a separate machine/process so the evidence can prove that SakthiAI receives signed external HTTP proposals rather than only in-process fixtures.

## New tooling

### Single-run client

`scripts/signed-webhook-client.mjs`

Required environment variables:

```text
SAKTHIAI_WEBHOOK_SECRET=<runtime secret; never pass on command line>
SAKTHIAI_WEBHOOK_ENDPOINT=https://<non-production-host>/api/v1/agents/external-proposals/evaluate
SAKTHIAI_WEBHOOK_AGENT_ID=<allowlisted machine identity>
SAKTHIAI_WEBHOOK_TENANT_ID=<allowlisted non-production tenant>
```

Example:

```bash
node scripts/signed-webhook-client.mjs \
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

Example:

```bash
node scripts/run-real-client-benchmark.mjs \
  --trials 20 \
  --check-replay \
  --target-system github \
  --target-resource ssakthivel02/sakthiai \
  --output evidence/funding-readiness/signed-webhook-p3-real-client.json
```

With `--check-replay`, each accepted signed proposal is immediately replayed with the same nonce. A properly configured P2 durable replay store should reject the replay with HTTP 409 / `AGENT_WEBHOOK_REPLAY_DETECTED`.

## Evidence report

The runner records:

- timestamp
- endpoint (but not secret)
- agent ID
- tenant ID
- trial count
- accepted count
- failed count
- replay attempts/rejections
- unique evidence hashes
- p50/p95/max observed client latency
- per-trial status/code/decision/evidence hash
- explicit `productionReadyClaim:false`

The report refuses to serialize if the configured secret appears in the output.

## Claim gates

The generated report calculates two explicit gates.

### Real external-client evidence

`qualifiesAsRealExternalClientEvidence=true` only when:

- endpoint is not localhost
- all trials are accepted
- every accepted run has a unique evidence hash

### Durable replay evidence

`qualifiesAsDurableReplayEvidence=true` only when:

- endpoint is not localhost
- replay checking is enabled
- every replay is rejected

These fields do **not** imply a vendor-specific agent integration.

`vendorSpecificAgentClaim=false` remains fixed in the report.

## HTTPS boundary

The client rejects plain HTTP endpoints by default.

`--allow-localhost` exists only for automated local integration testing. Reports generated with this flag use:

`evidenceMode=LOCAL_HTTP_TEST_CLIENT`

and cannot qualify as real external-client evidence.

A non-localhost evidence run must use HTTPS.

## CI validation

P3 CI starts a separate local fixture server process and drives the exact CLI/benchmark tooling over a real TCP/HTTP socket.

This proves:

- external-process request construction
- HMAC signing
- machine/tenant headers
- network serialization
- server request verification
- durable replay rejection
- evidence-file generation
- no secret leakage

Because CI uses localhost, it remains **test evidence**, not the real non-production endpoint evidence required for the next funding claim.

## Non-production deployment prerequisites

Before running genuine P3 evidence, deliberately configure a non-production SakthiAI Worker/environment with:

1. schema migration `0004_agent_webhook_replay.sql` applied to a non-production D1 database
2. D1 bound as `DB`
3. `AGENT_WEBHOOK_ENABLED=true`
4. `AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED=true`
5. one non-production `AGENT_WEBHOOK_ALLOWED_AGENTS` ID
6. one non-production `AGENT_WEBHOOK_ALLOWED_TENANTS` ID
7. strong runtime secret `AGENT_WEBHOOK_SHARED_SECRET`
8. no external-action executor bindings
9. no production credentials
10. HTTPS endpoint

The repository defaults must remain false.

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

After a genuine P3 run, the truthful stronger claim can become:

> SakthiAI accepted 20+ signed proposals from an external client over HTTPS in a controlled non-production environment, produced distinct verifier/policy evidence receipts, and rejected replay attempts through the durable nonce ledger while external side effects remained disabled.

That statement must only be used if the generated evidence file and environment record support it.

Until then:

> **P3 CLIENT KIT READY; REAL EXTERNAL-CLIENT EVIDENCE NOT YET COLLECTED.**

## Next gate after genuine P3 evidence

Only after owner review of genuine P3 results should we evaluate P4.

The next candidate would be one **isolated-branch repository executor** with explicit approval, tests, evidence and rollback reference. That is not part of P3 and should not be started merely because the client kit exists.
