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

## Current branch phase — Hi-Tech V4 agent-control foundation

`flagship/hi-tech-v1` contains the V1 flagship workspace, V2 durable-intelligence contracts, V3 verified-security foundation and V4 durable agent-control plane:

- 12 interactive flagship capability surfaces
- verified Cloudflare Access RS256 JWT contract
- server-side tenant membership + RBAC authorization
- fail-closed request-window and daily-AI quota foundation
- D1 schema and migrations tested locally in CI, but **no D1 binding provisioned**
- durable agent state machine with bounded retries
- GREEN / AMBER / RED action-risk classification
- tenant-scoped task execution policy
- checkpoint/resume records
- internal worker leases to prevent duplicate task workers
- owner/admin approval queue and decision audit trail
- trusted verifier run + evidence schema
- completion requires a passed verifier record
- public verifier mutation disabled
- autonomous external execution not implemented
- all runtime/security/control gates default OFF
- R2 and AI Search bindings absent
- no SaravanAI data/runtime dependency

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

`src/auth.js` verifies Cloudflare Access JWTs instead of trusting raw identity headers. Runtime configuration must provide the Access team domain and audience outside source control. The verifier pins RS256, restricts JWKS lookup to `*.cloudflareaccess.com`, verifies signature, issuer, audience and expiry, and rejects malformed or expired tokens.

`src/rbac.js` then resolves the verified external subject against SakthiAI's own `users`, `memberships` and `tenants` records. The tenant header is only a selector; it does not grant access. Durable or AI operations require an active user, active tenant, active membership and an allowed role.

Bearer-style Access JWT acceptance is disabled by default. The normal protected-web contract uses `Cf-Access-Jwt-Assertion`.

## Durable D1 foundation

`migrations/0001_foundation.sql` defines tenants, users, memberships, projects, conversations, messages, tasks, task events, approvals, knowledge provenance, artifacts, usage and audit records.

`migrations/0002_agent_control.sql` extends the model with:

- `task_execution_policy`
- `task_checkpoints`
- `worker_leases`
- `verifier_runs`
- `evidence_records`

V4 agent rows use composite `(tenant_id, task_id)` foreign keys so a record cannot pair one tenant with another tenant's task merely because both IDs exist.

`scripts/test_d1_migration.py` executes both migrations against in-memory SQLite and verifies schema version, required tables/indexes, foreign keys, tenant visibility, membership isolation, cross-tenant agent-row rejection, verifier-evidence isolation and single-worker task lease enforcement.

The source does not create a Cloudflare database. Durable APIs remain unavailable until D1 provisioning is explicitly approved and all required identity/quota gates are enabled.

## Agent control plane

`src/agent-state.js` is the pure transition/risk model. Tasks use:

`planned → queued → running → completed/failed`, with durable `waiting_approval`, `paused` and `cancelled` paths.

Safety rules include:

- terminal completed/cancelled tasks cannot resume
- failed tasks cannot exceed bounded retry limits
- AMBER/RED work cannot start without approval
- repository/external/publish/message/deploy/destructive actions cannot run while external actions are disabled
- a task cannot become `completed` without the latest verifier state being `passed`

Action-risk defaults:

- GREEN: read-only or internal reversible work
- AMBER: repository writes, external writes, publishing and messaging
- RED: deployment and destructive actions

`src/agent-control.js` persists task state, execution policy, approvals, checkpoints, events, audit records and trusted verifier evidence.

`src/agent-leases.js` provides internal lease acquire/heartbeat/release plus latest-checkpoint recovery. Lease tokens are not exposed by the public V4 API.

`src/agent-api.js` exposes guarded task/control operations only. Approval decisions require owner/admin RBAC. Verifier history is readable, but verifier mutation is intentionally not public; `recordVerifier()` additionally fails closed unless `AGENT_VERIFIER_RUNTIME_ENABLED=true` in a future trusted internal verifier runtime.

### Three independent agent gates

All default to `false`:

1. `AGENT_CONTROL_ENABLED` — durable orchestration/control records.
2. `AGENT_EXTERNAL_ACTIONS_ENABLED` — consequential repository/external/deploy/destructive actions.
3. `AGENT_VERIFIER_RUNTIME_ENABLED` — trusted internal verifier mutation.

Enabling the control plane therefore does **not** enable external actions or self-verification.

## Quota and cost boundary

`src/quota.js` defines a D1-backed fail-closed quota foundation with a request window and daily AI allowance. Defaults are policy values only; quota execution itself is disabled in preview.

- paid AI providers: OFF
- silent paid fallback: OFF
- paid overage: OFF
- AI runtime: OFF
- identity runtime: OFF
- persistence runtime: OFF
- quota runtime: OFF
- agent control: OFF
- agent external actions: OFF
- trusted verifier runtime: OFF
- D1: schema/test ready, binding not provisioned
- R2: OFF; no binding
- AI Search: OFF; no binding

A future AI or durable-control request cannot bypass the independent identity, tenant-RBAC, persistence and quota gates.

## API contracts

- `openapi/sakthiai-v1.yaml` — initial flagship runtime contract
- `openapi/sakthiai-v2.yaml` — durable projects/tasks + research/code/agent/knowledge contracts
- `openapi/sakthiai-v3.yaml` — verified Access JWT, tenant-RBAC and quota-protected runtime contract
- `openapi/sakthiai-v4.yaml` — durable agent task/checkpoint/approval/event/verifier-history control contract

The V4 public API has no agent `/execute` endpoint and no verifier-write endpoint.

## Validation

The flagship CI now runs:

1. structural and safety validation
2. JavaScript syntax validation
3. machine-readable V4 policy validation
4. real RSA-signed Cloudflare Access JWT verification test
5. agent state-machine/risk/approval/verifier/retry tests
6. real SQLite execution of D1 migrations 0001 + 0002 with tenant-isolation tests

A green CI run proves repository-level contracts only. It does **not** mean production identity, D1, DNS, AI runtime or external agent execution has been activated.

## Runtime isolation

`assets/runtime.js` probes only a configured SakthiAI API base or same-origin API when running on the approved SakthiAI custom domain. It does not point at the SaravanAI production runtime.

The frontend remains useful as a product shell when offline or unconfigured, but it will not fake an AI response. The agent capability uses `CONTROL_PLANE_READY` when durable orchestration is available; it does not claim `RUNTIME_AVAILABLE` merely because the control plane is healthy.

## Release rule

Do not merge to `main`, provision durable cloud bindings, enable execution gates or repoint `sakthiai.omsaravanabhava.org` until exact-head CI, responsive/browser QA, protected-main governance, controlled identity configuration, tenant isolation, cost controls and runtime/domain separation gates are green.
