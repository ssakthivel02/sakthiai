# SakthiAI Durable Replay + Benchmark — P2 Funding-Readiness Proof

Status: **DURABLE SINGLE-USE NONCE CONTRACT + 30-TRIAL CI BENCHMARK**  
Production ready: **NO**  
External write execution: **NO**  
Concrete executor bound: **NO**  
Live vendor-specific external agent: **NO**  
Real external-agent benchmark runs: **NO**

## Objective

P1 proved that an external HTTP client can submit a signed, allowlisted, read-only proposal to SakthiAI and receive a Trusted Action Gateway evidence result.

P2 closes the known replay gap by adding an optional durable consumed-nonce ledger and produces a repeatable 30-trial CI benchmark for the transport/policy path.

The entire path remains read-only and dry-run-only.

## Durable replay design

New migration:

`migrations/0004_agent_webhook_replay.sql`

New table:

`agent_webhook_nonces`

The durable uniqueness scope is:

`tenant_id + agent_id + nonce_sha256`

The database stores:

- generated ledger row ID
- tenant ID
- agent ID
- run ID
- SHA-256 of nonce
- request timestamp
- SHA-256 of raw request body
- expiry timestamp
- consumed timestamp

It does **not** store:

- raw shared secret
- request signature
- raw nonce
- raw request body

## Atomic replay rule

`src/webhook-replay-store.js` uses one atomic database statement:

`INSERT OR IGNORE INTO agent_webhook_nonces ...`

A successful first insert returns one changed row.

A duplicate tenant/agent/nonce hash returns zero changed rows and becomes:

`AGENT_WEBHOOK_REPLAY_DETECTED` / HTTP 409

The request is rejected before Trusted Action Gateway evaluation is returned to the caller.

## Fail-closed configuration

Non-secret defaults:

```text
AGENT_WEBHOOK_ENABLED=false
AGENT_WEBHOOK_DURABLE_REPLAY_ENABLED=false
AGENT_WEBHOOK_NONCE_RETENTION_SECONDS=3600
```

The signed webhook shared secret remains runtime-only:

`AGENT_WEBHOOK_SHARED_SECRET`

When durable replay is deliberately enabled but the D1 `DB` binding is absent, the request fails closed with:

`AGENT_WEBHOOK_REPLAY_STORE_BINDING_MISSING`

The default repository configuration therefore enables neither the machine webhook nor the replay ledger.

## P1 compatibility

If durable replay remains disabled, the signed webhook keeps the P1 behaviour:

- HMAC authentication
- timestamp freshness
- agent allowlist
- tenant allowlist
- read-only only
- dry-run only
- no external side effect

This is intentional for backward compatibility and is tested separately.

## P2 enabled behaviour

When durable replay is enabled with a database binding:

```text
signed request
  -> HMAC verification
  -> agent/tenant scope
  -> timestamp freshness
  -> read-only/dry-run restriction
  -> atomic nonce consumption
  -> duplicate? BLOCK 409
  -> Trusted Action Gateway
  -> SHA-256 policy evidence receipt
  -> response with no side effect
```

A write/execute proposal is rejected before nonce consumption.

An invalid signature is rejected before nonce consumption.

## Database evidence

`scripts/test_d1_migration.py` applies schema migrations 0001–0004 to an in-memory SQLite database and validates:

- schema version 4
- replay ledger table exists
- tenant foreign key enforcement
- tenant-scoped nonce uniqueness
- duplicate nonce rejection
- same nonce hash permitted in a different tenant
- replay-ledger indexes
- previous agent/executor constraints remain intact

This proves the SQL contract. It does **not** claim a production D1 database has been deployed or load-tested.

## Runtime replay evidence

`scripts/test-webhook-replay.mjs` validates:

- replay store disabled state
- enabled-without-DB fail closed
- first nonce consumption succeeds
- duplicate nonce is rejected
- raw nonce/body are not persisted by the store contract
- store-write failure fails closed
- invalid signature does not consume a nonce
- write/execute proposals do not consume a nonce
- route-level first request accepted
- route-level replay rejected before a result is returned
- expiry purge contract
- external side effects remain false

The runtime test uses a deterministic fake D1 adapter that implements the same atomic `INSERT OR IGNORE` contract. The separate SQLite migration test validates the real database uniqueness semantics.

## 30-trial benchmark

`scripts/build-signed-webhook-benchmark.mjs` runs:

- 30 unique signed read-only proposals
- 30 immediate replay attempts

Required outcome:

- unique accepted: 30/30
- replay rejected: 30/30
- unique evidence hashes: 30/30
- external side effects: 0
- executor bound: false

The generated artifact is:

`evidence/funding-readiness/signed-webhook-p2-benchmark.json`

CI uploads that JSON as a workflow artifact.

## Benchmark honesty boundary

The benchmark mode is explicitly:

`CI_DETERMINISTIC_TRANSPORT`

It is **not** a production latency benchmark.

It does not use live Codex, Claude Code, Gemini, Manus or another vendor-specific agent.

It uses a deterministic fake-D1 runtime adapter and a separately validated SQLite migration contract.

Therefore the truthful claim is:

> **SakthiAI has a repeatable 30-trial signed-proposal/replay-control benchmark in CI, with durable replay semantics validated by schema and runtime contracts, while external side effects remain disabled.**

It is not yet truthful to claim:

> **20+ real external-agent benchmark runs.**

That remains a future evidence gate.

## Next gate

After P2 is green, the next high-value sprint should be **P3 controlled real-client evidence**, not a write executor.

Recommended sequence:

1. provision a non-production D1 database and apply migration 0004
2. configure one non-production webhook secret, one agent ID and one tenant
3. bind one controlled external client or agent adapter in read-only mode
4. run 20+ real signed proposal trials
5. capture success rate, replay rejection, latency, evidence hashes and failure classes
6. keep all external writes disabled
7. only after those results are reviewed should an isolated-branch repository executor even be considered

## Absolute boundary

P2 does not enable:

- repository writes
- messages
- deployments
- destructive operations
- direct `main` writes
- force pushes
- production actions
- automatic paid-model fallback

`PRODUCTION READY = NO`
