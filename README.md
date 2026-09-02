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

## Current branch phase — Hi-Tech V3 security foundation

`flagship/hi-tech-v1` now contains the V1 flagship workspace, V2 durable-intelligence contracts and V3 verified-security foundation:

- 12 interactive flagship capability surfaces
- capability truth registry + machine-readable execution contracts
- responsive workspace shell + installable PWA
- clean `sakthiai-flagship-api` Worker scaffold
- Cloudflare Access RS256 JWT verification using controlled JWKS lookup
- issuer, audience, expiry and cryptographic signature validation
- server-side internal user + tenant membership + RBAC authorization
- fail-closed request-window and daily-AI quota contracts backed by the future D1 usage ledger
- D1 migration prepared and execution-tested, but **no D1 binding provisioned**
- tenant/user/RBAC/project/conversation/task/approval/provenance/artifact/usage/audit schema
- research, code, agent and knowledge execution contracts
- all execution/runtime/security gates default OFF
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

## Durable foundation

`migrations/0001_foundation.sql` defines the future D1 data model. It is source-only in this phase; it does not create or connect a Cloudflare database.

`scripts/test_d1_migration.py` executes that migration against in-memory SQLite in CI and validates required tables, schema version, foreign keys, indexes, tenant-scoped project visibility, positive membership lookup and negative cross-tenant membership isolation.

Durable APIs remain unavailable unless all required gates are deliberately satisfied:

1. `PERSISTENCE_ENABLED=true` and a D1 `DB` binding exists.
2. verified identity runtime is configured and enabled.
3. the verified subject has an active SakthiAI tenant membership with sufficient RBAC permission.
4. quota runtime is enabled and the request remains within policy.

## Quota and cost boundary

`src/quota.js` defines a D1-backed fail-closed quota foundation with a request window and daily AI allowance. Defaults are policy values only; quota execution itself is disabled in preview.

- paid AI providers: OFF
- silent paid fallback: OFF
- paid overage: OFF
- AI runtime: OFF
- identity runtime: OFF
- persistence runtime: OFF
- quota runtime: OFF
- D1: schema/test ready, binding not provisioned
- R2: OFF; no binding
- AI Search: OFF; no binding

A future AI request is allowed only after AI runtime + verified identity + tenant RBAC + D1 persistence/usage ledger + quota controls are all deliberately enabled. One flag cannot bypass the other gates.

## Execution contracts

`src/execution-contracts.js` defines bounded contracts for:

- evidence-first research
- sandbox-required code engineering
- durable agents with GREEN/AMBER/RED autonomy classes
- provenance-required knowledge/RAG

These contracts do not claim execution. Their runtime gates default disabled and return explicit `*_RUNTIME_DISABLED` states.

## API contracts

- `openapi/sakthiai-v1.yaml` — initial flagship runtime contract
- `openapi/sakthiai-v2.yaml` — durable projects/tasks + research/code/agent/knowledge contracts
- `openapi/sakthiai-v3.yaml` — verified Access JWT, tenant-RBAC and quota-protected runtime contract

## Validation

The flagship CI runs:

1. structural and safety validation
2. machine-readable V3 policy validation
3. a real RSA-signed Cloudflare Access JWT verification test
4. a real SQLite execution test of the D1 migration and tenant-isolation model

Latest exact-head evidence before this documentation-only record:

- commit `3f32c402e47baec677507646359e81e5c73cae95`
- GitHub Actions `Validate SakthiAI flagship` run #43: **SUCCESS**
- structural/safety: PASS
- V3 policy validator: PASS
- Access JWT cryptographic test: PASS
- D1 migration + tenant-isolation test: PASS

A green CI run proves those repository-level contracts only. It does **not** mean production identity, D1, DNS or AI runtime has been activated.

## Runtime isolation

`assets/runtime.js` probes only a configured SakthiAI API base or same-origin API when running on the approved SakthiAI custom domain. It does not point at the SaravanAI production runtime.

The frontend remains useful as a product shell when offline or unconfigured, but it will not fake an AI response.

## Release rule

Do not merge to `main`, provision durable cloud bindings, enable execution gates or repoint `sakthiai.omsaravanabhava.org` until exact-head CI, responsive/browser QA, protected-main governance, controlled identity configuration, tenant isolation, cost controls and runtime/domain separation gates are green.
