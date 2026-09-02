# SakthiAI — Intelligence OS

SakthiAI is the clean next-generation flagship AI platform. This repository does not import SaravanAI website content, UI data, project datasets or legacy runtime behavior.

## Flagship build principles

- One unified AI workspace for reasoning, research, engineering, agents, automation, apps, media, documents and knowledge.
- Provider-independent architecture with replaceable engines.
- Paid providers disabled by default; no silent paid fallback.
- Consequential external writes require explicit approval policy.
- Runtime capability truth is mandatory: unavailable backends are labelled, never simulated as successful.
- Browser JavaScript stores no API keys or provider secrets.
- API responses are excluded from PWA caching.
- Mobile, tablet, desktop, keyboard and reduced-motion behavior are first-class release gates.

## Current branch phase — Hi-Tech V5 Agent Control Center + executor contracts

`flagship/hi-tech-v1` contains the V1 flagship workspace, V2 durable-intelligence contracts, V3 verified-security foundation, V4 durable agent-control plane and V5 Agent Control Center / executor-safety foundation.

Current V5 additions:

- premium responsive **Agent Control Center** integrated into the flagship workspace
- verified control-plane status only; no fabricated tenant tasks, approvals, usage or execution telemetry
- provider-neutral executor contract registry with six executor classes
- all executor classes remain `NO_EXECUTOR_BOUND`
- read-only `GET /api/v1/agents/executors/contracts`
- no public agent `/execute` route
- idempotency, approval, evidence, trusted-verifier and rollback requirements expressed in code and machine-readable policy
- non-dry-run envelopes require both the executor-binding gate and a concrete executor binding
- dry-run receipts explicitly report `executed:false`, `sideEffects:false`, `executorBound:false`
- source-only D1 migration 0003 for execution attempts, receipts and rollback records
- three-migration SQLite tests for tenant isolation, duplicate idempotency prevention and rollback/receipt linkage
- PWA offline cache includes the Agent Control Center UI assets while API responses remain excluded
- all runtime, executor, external-action and verifier gates remain OFF
- D1/R2/AI Search remain unprovisioned or unbound
- no SaravanAI runtime/data dependency

## Capability surfaces

1. AI Chat & Reasoning
2. Deep Research
3. Code & Engineering
4. Agents & Orchestration
5. Automation Hub
6. Website & App Builder
7. Image Studio
8. Video & Avatar Studio
9. Voice, STT & Dubbing
10. Docs, Slides & Sheets
11. Knowledge & RAG
12. Developer Platform

## Verified identity and tenant authorization

`src/auth.js` verifies Cloudflare Access RS256 JWTs instead of trusting raw identity headers. Runtime configuration must provide the Access team domain and audience outside source control. Signature, issuer, audience and expiry are validated against controlled Cloudflare Access JWKS.

`src/rbac.js` resolves the verified external subject against SakthiAI `users`, `memberships` and `tenants`. The tenant header is a selector only; authorization comes from verified identity plus active server-side membership and RBAC.

Bearer-style Access JWT acceptance remains disabled by default.

## Durable D1 foundation

The repository contains source-only migrations; no Cloudflare D1 database is provisioned by this branch.

- `migrations/0001_foundation.sql` — tenants, users, memberships, projects, conversations, messages, tasks, approvals, provenance, artifacts, usage and audit.
- `migrations/0002_agent_control.sql` — task execution policy, checkpoints, worker leases, verifier runs and evidence records.
- `migrations/0003_executor_control.sql` — execution attempts, execution receipts and rollback records.

V4/V5 task-linked tables use tenant-scoped composite foreign keys. V5 execution attempts also enforce `UNIQUE(tenant_id,idempotency_key)` so a tenant cannot silently repeat the same execution intent under one idempotency key.

The V5 ledger records execution truth explicitly, including `dry_run` and `side_effects`, with side effects defaulting to false. Approval/verifier references are tenant-scoped and deletion-restricted so execution evidence cannot be silently detached.

`scripts/test_d1_migration.py` executes migrations 0001 + 0002 + 0003 against in-memory SQLite and tests positive schema behavior plus negative cross-tenant task, approval, verifier, receipt and rollback linkage.

## Durable Agent Control Plane

`src/agent-state.js` defines the task state/risk model:

`planned → queued → running → completed/failed`, with durable `waiting_approval`, `paused` and `cancelled` paths.

Safety rules include:

- terminal completed/cancelled tasks cannot resume
- failed tasks cannot exceed bounded retry limits
- AMBER/RED work cannot start without approval
- repository/external/publish/message/deploy/destructive actions cannot run while external actions are disabled
- task completion requires the latest verifier state to be `passed`

Risk defaults:

- GREEN: read-only or internal reversible work
- AMBER: repository writes, external writes, publishing and messaging
- RED: deployment and destructive actions

`src/agent-control.js` persists durable task/control records. `src/agent-leases.js` supplies internal worker lease acquire/heartbeat/release and latest-checkpoint recovery. `src/agent-api.js` exposes guarded control operations; approval decisions are owner/admin-only and verifier mutation is intentionally not public.

## SAI-V5 Agent Control Center

`assets/agent-control-ui.js` and `assets/agent-control.css` add a premium control surface without replacing the existing flagship workspace.

The Control Center shows only verified public metadata or explicit locked/unknown states:

- control plane gate
- executor binding gate
- external-action gate
- trusted-verifier gate
- executor lifecycle contract
- six provider-neutral executor contract classes
- safety interlocks for idempotency, approval, evidence/verifier and rollback

Tenant-scoped task metrics remain `—` until authenticated durable task data is deliberately connected. The UI performs GET-only metadata reads and exposes no action execution endpoint.

## Provider-neutral executor contracts

`config/executor-contracts.json` and `src/executor-contracts.js` define six unbound contract classes:

1. Sandbox Code Executor
2. Repository Executor
3. External Connector Executor
4. Publish & Message Executor
5. Deployment Executor
6. Destructive Action Executor

Every class is currently `NO_EXECUTOR_BOUND`.

Future executor lifecycle contract:

`prepare → authorize → dry_run → execute → verify → commit_or_rollback`

Required controls include:

- tenant scope
- idempotency key
- consequential-action approval
- dry run/preview where supported
- evidence requirements
- trusted verifier
- rollback or compensation plan
- server-side secrets only
- bounded retries
- audit events
- no paid-provider assumption
- no direct-main write
- no force push

`validateExecutionEnvelope()` is contract validation only; it performs no network or external action. A non-dry-run envelope cannot validate unless the binding gate is enabled and a concrete executor is declared bound. No actual executor adapter exists in V5.

## Four independent agent barriers

All default to `false`:

1. `AGENT_CONTROL_ENABLED` — durable orchestration/control records.
2. `AGENT_EXECUTOR_BINDINGS_ENABLED` — permission to bind reviewed executor adapters.
3. `AGENT_EXTERNAL_ACTIONS_ENABLED` — consequential external/repository/deployment/destructive actions.
4. `AGENT_VERIFIER_RUNTIME_ENABLED` — trusted internal verifier mutation.

Enabling one barrier does not enable the others. In V5, all four remain OFF and zero executors are bound.

## Cost and cloud boundary

- paid AI providers: OFF
- silent paid fallback: OFF
- paid overage: OFF
- AI runtime: OFF
- identity runtime: OFF
- persistence runtime: OFF
- quota runtime: OFF
- agent control: OFF
- executor bindings: OFF
- external agent actions: OFF
- trusted verifier runtime: OFF
- D1: schema/test ready, binding not provisioned
- R2: OFF; no binding
- AI Search: OFF; no binding
- production DNS: untouched

## API contracts

- `openapi/sakthiai-v1.yaml` — initial flagship runtime contract
- `openapi/sakthiai-v2.yaml` — durable projects/tasks + research/code/agent/knowledge contracts
- `openapi/sakthiai-v3.yaml` — verified Access JWT, tenant-RBAC and quota contract
- `openapi/sakthiai-v4.yaml` — durable task/checkpoint/approval/event/verifier-history control contract
- `openapi/sakthiai-v5.yaml` — read-only Agent Control Center / executor registry plus future internal execution-envelope schema

No V5 public API path accepts an execution envelope.

## Validation

The flagship CI validates:

1. structural and safety rules
2. JavaScript syntax across source, scripts and frontend modules
3. V5 policy + executor-ledger invariants
4. real RSA-signed Cloudflare Access JWT verification
5. agent state-machine/risk/approval/verifier/retry behavior
6. executor envelope safety rules including idempotency, approval, verifier, rollback and binding gates
7. SQLite execution of D1 migrations 0001 + 0002 + 0003 with tenant/isolation/idempotency/receipt/rollback tests

Substantive V5 code head before this documentation commit:

- commit `0c12d40462acb36fd9a31d2004aa81c0cfb94c9b`
- GitHub Actions `Validate SakthiAI flagship` run #99: **SUCCESS**

A green CI run proves repository-level contracts only. It does **not** activate production identity, D1, DNS, AI runtime, executor bindings or external agent execution.

## Runtime isolation

`assets/runtime.js` probes only a configured SakthiAI API base or same-origin API on the approved SakthiAI hostname. It does not point at the SaravanAI production runtime.

The agent capability uses `CONTROL_PLANE_READY` only for durable orchestration readiness; executor metadata remains contract-only and cannot make the agent capability claim external execution.

## Release rule

Keep PR #5 draft. Do not merge to `main`, provision cloud bindings, bind executors, enable execution gates or repoint `sakthiai.omsaravanabhava.org` until exact-head CI, browser/responsive/accessibility QA, protected-main governance, controlled identity configuration, tenant isolation, preview persistence/backup/restore, cost controls, trusted verifier design, reviewed executor-specific authorization/rollback evidence and runtime/domain separation gates are green.
