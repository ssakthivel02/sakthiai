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
- Repository evidence, controlled-preview evidence and production readiness are separate states.

## Current branch phase — Hi-Tech V6 Preview Readiness & Observability

`flagship/hi-tech-v1` contains the V1 flagship workspace, V2 durable-intelligence contracts, V3 verified-security foundation, V4 durable agent-control plane, V5 Agent Control Center / executor-safety foundation and V6 preview-readiness / observability foundation.

Current V6 additions:

- responsive **Preview Readiness Observatory** integrated as an isolated frontend module
- public configuration-only readiness, observability and cost-boundary endpoints
- request correlation via request ID + trace ID response headers
- server timing correlation without logging prompts or identities
- observability runtime logging gate defaults OFF
- preview deployment gate defaults OFF
- source-preview safety state is distinct from production readiness
- `productionReady:false`, `deploymentPerformed:false`, `browserQaPerformed:false` remain explicit
- public tenant usage totals/details are prohibited
- static accessibility/responsive contract test added to CI
- exact-head preview evidence manifest generated only after the safety test chain passes
- evidence manifest is repository-only and does not claim cloud provisioning, deployment or browser QA
- no D1/R2/AI Search/executor binding added
- no production DNS or custom-domain change added

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

V4/V5 task-linked tables use tenant-scoped composite foreign keys. V5 execution attempts enforce `UNIQUE(tenant_id,idempotency_key)` so a tenant cannot silently repeat the same execution intent under one idempotency key.

The ledger records execution truth explicitly, including `dry_run` and `side_effects`, with side effects defaulting to false. Approval/verifier references are tenant-scoped and deletion-restricted so execution evidence cannot be silently detached.

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

Required controls include tenant scope, idempotency, consequential approval, dry-run/preview where supported, evidence, trusted verifier, rollback/compensation, server-side secrets, bounded retries and audit events. Paid-provider assumptions, direct-main writes and force push remain prohibited.

`validateExecutionEnvelope()` is contract validation only; it performs no network or external action. A non-dry-run envelope cannot validate unless the binding gate is enabled and a concrete executor is declared bound. No actual executor adapter exists in V6.

## SAI-V6 Preview Readiness Observatory

`assets/observability-ui.js` and `assets/observability.css` add a read-only diagnostic surface. It consumes only:

- `GET /api/v1/readiness`
- `GET /api/v1/observability/status`
- `GET /api/v1/cost/status`

The Observatory intentionally does not request tenant tasks, user identity, prompts, raw audit payloads or credentials. It renders locked/unknown state rather than inventing runtime telemetry.

### Preview readiness truth

`src/observability.js` reports a source-preview safety state based on fail-closed guards. In V6:

- `productionReady:false`
- `deploymentPerformed:false`
- `browserQaPerformed:false`
- paid providers OFF
- AI runtime OFF
- persistence OFF
- identity runtime OFF
- quota runtime OFF
- agent control OFF
- executor bindings OFF
- external actions OFF
- trusted verifier OFF
- preview deployment OFF
- D1/R2/AI Search unbound

A safe source configuration is not the same as production readiness.

### Safe request correlation

Every Worker response is finalized with:

- `x-sakthiai-request-id`
- `x-sakthiai-trace-id`
- `Server-Timing`

A valid W3C `traceparent` trace ID may be reused for correlation; otherwise SakthiAI generates a trace ID. Query strings are stripped from the recorded route.

Runtime structured logging is controlled separately by `OBSERVABILITY_RUNTIME_ENABLED`, which defaults to `false`. When enabled in a future reviewed environment, the allowlisted event fields are only request ID, trace ID, method, route, status, duration and coarse outcome code.

Explicitly prohibited from public/runtime observability payloads include prompts, message bodies, email, authorization data, cookies, JWTs, tenant usage details, user identity and raw audit payloads.

## Four independent agent barriers

All default to `false`:

1. `AGENT_CONTROL_ENABLED`
2. `AGENT_EXECUTOR_BINDINGS_ENABLED`
3. `AGENT_EXTERNAL_ACTIONS_ENABLED`
4. `AGENT_VERIFIER_RUNTIME_ENABLED`

V6 additionally keeps these gates OFF:

5. `OBSERVABILITY_RUNTIME_ENABLED`
6. `PREVIEW_DEPLOY_ENABLED`

Enabling one gate does not enable the others. Zero executors are bound.

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
- app-level observability logging: OFF
- preview deployment: OFF
- D1: migrations/test ready, binding not provisioned
- R2: OFF; no binding
- AI Search: OFF; no binding
- production DNS: untouched

The public cost endpoint reports policy/binding state only. Tenant usage totals and tenant usage details remain private.

## API contracts

- `openapi/sakthiai-v1.yaml` — initial flagship runtime contract
- `openapi/sakthiai-v2.yaml` — durable projects/tasks + research/code/agent/knowledge contracts
- `openapi/sakthiai-v3.yaml` — verified Access JWT, tenant-RBAC and quota contract
- `openapi/sakthiai-v4.yaml` — durable task/checkpoint/approval/event/verifier-history control contract
- `openapi/sakthiai-v5.yaml` — read-only Agent Control Center / executor registry plus future internal execution-envelope schema
- `openapi/sakthiai-v6.yaml` — preview readiness, observability and cost-boundary configuration contract

No V6 public API exposes deployment, executor execution, D1 provisioning, verifier mutation or production activation.

## Validation and evidence

The flagship CI validates:

1. structural and secret/CORS safety rules
2. JavaScript syntax across source, scripts and frontend modules
3. V5 policy + executor-ledger invariants
4. V6 preview/observability invariants
5. real RSA-signed Cloudflare Access JWT verification
6. agent state-machine/risk/approval/verifier/retry behavior
7. executor envelope safety including idempotency, approval, verifier, rollback and binding gates
8. preview readiness/correlation behavior
9. static accessibility/responsive contracts
10. SQLite execution of D1 migrations 0001 + 0002 + 0003 with tenant/isolation/idempotency/receipt/rollback tests

Only after those checks pass does `scripts/build-preview-evidence.mjs` generate `artifacts/preview-evidence.json`, which GitHub Actions uploads as an exact-head evidence artifact.

That artifact explicitly records:

- evidence scope = repository only
- production activation = false
- deployment performed = false
- cloud resources provisioned = false
- executor bound = false
- browser QA performed = false
- controlled preview still required = true

Static accessibility/responsive validation is not presented as real browser QA. Real desktop/mobile/browser/accessibility verification remains a controlled-preview release gate.

## Runtime isolation

`assets/runtime.js` probes only a configured SakthiAI API base or same-origin API on the approved SakthiAI hostname. It does not point at the SaravanAI production runtime.

The agent capability uses `CONTROL_PLANE_READY` only for durable orchestration readiness; executor metadata remains contract-only and cannot make the agent capability claim external execution.

## Release rule

Keep PR #5 draft. Do not merge to `main`, provision cloud bindings, bind executors, enable execution gates, deploy a preview, or repoint `sakthiai.omsaravanabhava.org` merely because repository CI is green.

Before production consideration, separately prove protected-main governance, required CI status, controlled Cloudflare Access configuration, real browser/responsive/accessibility QA on a controlled preview, explicit D1 owner approval, preview D1 migration/backup/restore, concurrent quota behavior, trusted verifier design, executor-specific authorization/rollback evidence and SaravanAI namespace separation.

Exact-head CI evidence belongs in PR #5 and release-gate Issue #6 rather than being self-referenced inside this README.
