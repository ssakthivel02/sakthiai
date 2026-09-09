# SakthiAI Signed External-Agent Webhook — P1 Funding-Readiness Proof

Status: **SIGNED READ-ONLY EXTERNAL PROPOSAL INTAKE**  
Production ready: **NO**  
External write execution: **NO**  
Concrete executor bound: **NO**  
Durable replay/nonce store: **NO**

## Objective

P0 proved the Trusted Action Gateway could evaluate provider-neutral action proposals in-process.

P1 adds a real machine-to-machine HTTP intake surface so an external system can submit a proposal to SakthiAI over a signed request, while keeping the entire path read-only and dry-run-only.

```text
External system / agent
  -> HMAC-SHA-256 signed HTTP request
  -> timestamp freshness check
  -> explicit agent allowlist
  -> explicit tenant allowlist
  -> read-only + dry-run policy
  -> SakthiAI Trusted Action Gateway
  -> verifier/policy dry-run receipt
  -> SHA-256 evidence record
  -> response with no side effect
```

## Routes

### Public contract

`GET /api/v1/agents/external-proposals/contract`

Returns the adapter contract and whether the feature/scope is configured. It does not expose the shared secret or its value.

### Signed proposal evaluation

`POST /api/v1/agents/external-proposals/evaluate`

This is a machine-auth path and does not use the human Cloudflare Access JWT flow. Instead, it requires a runtime-held HMAC shared secret plus explicit agent/tenant allowlists.

Required headers:

- `x-sakthiai-agent-id`
- `x-sakthiai-agent-run-id`
- `x-sakthiai-tenant`
- `x-sakthiai-timestamp`
- `x-sakthiai-nonce`
- `x-sakthiai-signature`

Signature format:

`v1=<hex HMAC-SHA-256>`

Signed input:

```text
timestamp
agentId
runId
tenantId
nonce
rawBody
```

The signature therefore binds the raw JSON body and the machine/tenant/run identity metadata.

## Runtime configuration

Non-secret flags in `wrangler.jsonc`:

```text
AGENT_WEBHOOK_ENABLED=false
AGENT_WEBHOOK_MAX_SKEW_SECONDS=300
AGENT_WEBHOOK_ALLOWED_AGENTS=
AGENT_WEBHOOK_ALLOWED_TENANTS=
```

The shared secret is intentionally **not** stored in Git:

`AGENT_WEBHOOK_SHARED_SECRET`

When deliberately enabling a controlled environment, all of these must be configured:

1. `AGENT_WEBHOOK_ENABLED=true`
2. strong `AGENT_WEBHOOK_SHARED_SECRET` (minimum 32 characters in P1)
3. one or more comma-separated `AGENT_WEBHOOK_ALLOWED_AGENTS`
4. one or more comma-separated `AGENT_WEBHOOK_ALLOWED_TENANTS`

The feature remains fail-closed if the secret or scope configuration is missing.

## P1 restrictions

The machine webhook accepts only:

- action class: `read_only`
- requested execution: `dry_run`

Any repository write, message, deployment, external write, publish or destructive proposal is rejected at the transport adapter before reaching an executor.

P1 binds **no executor** and performs **no external side effect**.

## Authentication controls demonstrated

- HMAC-SHA-256 request authentication
- raw body integrity binding
- signed agent ID
- signed run ID
- signed tenant ID
- signed nonce
- timestamp freshness (default maximum skew 300 seconds, bounded 30–900)
- explicit agent allowlist
- explicit tenant allowlist
- constant-time comparison over the fixed-length signature hex
- no secret/signature returned in the evaluation response
- 64 KiB request bound

## Replay boundary

P1 uses:

- freshness timestamp
- nonce
- deterministic idempotency key: `webhook:<agentId>:<nonce>`

But P1 does **not** yet persist consumed nonces in D1/Durable Objects or another durable replay store.

Therefore a correctly signed request can be replayed within the freshness window and receive the same deterministic policy/evidence result. Because the P1 path has no side effects, this is an explicitly bounded limitation rather than a hidden production claim.

Before enabling any consequential execution, durable single-use nonce/replay protection is mandatory.

## Automated evidence

`scripts/test-signed-agent-webhook.mjs` checks:

- disabled-by-default behaviour
- missing/weak secret fails closed
- missing scope fails closed
- required-header enforcement
- agent allowlist
- tenant allowlist
- stale timestamp rejection
- invalid signature rejection
- body tampering rejection
- valid signed read-only HTTP proposal
- deterministic gateway `DRY_RUN_READY` result
- no executor / no side effect
- shared secret never appears in result
- write proposal rejection
- real-execution request rejection
- route-level contract and signed evaluation behaviour
- replay-boundary truthfulness

The full `npm test` suite includes both the P0 Trusted Action Gateway harness and this P1 signed-webhook harness.

## What this now proves

SakthiAI can accept a proposal from a real external HTTP client through a machine-authenticated interface and route it through the same provider-neutral Trusted Action Gateway used by the P0 proof.

The truthful P1 claim is:

> **Signed external proposal intake -> scoped machine authentication -> read-only/dry-run policy -> trusted-action evaluation -> evidence receipt, with zero external side effects.**

## What remains before the next funding claim

P1 still does not prove:

- a vendor-specific live Codex / Claude Code / Gemini adapter
- durable nonce replay prevention
- a bound repository/sandbox/cloud executor
- real external action execution
- post-action verification against a changed external system
- rollback against a real external system
- production-scale reliability/latency/cost
- 20+ real external-agent benchmark runs

Recommended P2 sequence:

1. add durable single-use nonce storage
2. bind one controlled **read-only** external agent/client
3. run at least 20 signed proposal/evaluation trials
4. collect latency, failure classes, evidence hashes and manual-intervention rate
5. only then consider an isolated-branch repository executor under explicit approval and rollback controls
