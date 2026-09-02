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

## Current branch phase — Hi-Tech V2 foundation

`flagship/hi-tech-v1` now contains the V1 flagship workspace plus the V2 durable-intelligence foundation:

- 12 interactive flagship capability surfaces
- capability truth registry + machine-readable execution contracts
- responsive workspace shell + installable PWA
- clean `sakthiai-flagship-api` Worker scaffold
- free-first chat contract with no paid fallback
- D1 migration prepared but **no D1 binding provisioned**
- tenant/user/RBAC/project/conversation/task/approval/provenance/artifact/usage/audit schema
- fail-closed persistence adapter
- identity gate in front of all durable tenant data
- research, code, agent and knowledge execution contracts
- all execution/runtime gates default OFF
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

## Durable foundation

`migrations/0001_foundation.sql` defines the future D1 data model. It is source-only in this phase; it does not create or connect a Cloudflare database.

Durable APIs also fail closed unless both conditions are deliberately satisfied:

1. `PERSISTENCE_ENABLED=true` and a D1 `DB` binding exists.
2. the verified identity runtime is enabled.

The current header-shaped identity fields are a contract placeholder only. Production authorization must use verified Cloudflare Access/OIDC JWT claims with tenant membership/RBAC enforcement before durable APIs are activated.

## Execution contracts

`src/execution-contracts.js` defines bounded contracts for:

- evidence-first research
- sandbox-required code engineering
- durable agents with GREEN/AMBER/RED autonomy classes
- provenance-required knowledge/RAG

These contracts do not claim execution. Their runtime gates default disabled and return explicit `*_RUNTIME_DISABLED` states.

## Cost policy

Machine-readable policy: `config/runtime-policy.json`.

- paid AI providers: OFF
- silent paid fallback: OFF
- D1: schema prepared, activation not provisioned
- R2: OFF; no binding
- AI Search: OFF; no binding
- Workers AI chat: binding contract exists, but `AI_RUNTIME_ENABLED=false`
- all V2 runtime gates: OFF by default

## API contracts

- `openapi/sakthiai-v1.yaml` — initial flagship runtime contract
- `openapi/sakthiai-v2.yaml` — durable projects/tasks + research/code/agent/knowledge contracts

## Runtime isolation

`assets/runtime.js` probes only a configured SakthiAI API base or same-origin API when running on the approved SakthiAI custom domain. It does not point at the SaravanAI production runtime.

The frontend remains useful as a product shell when offline or unconfigured, but it will not fake an AI response.

## Release rule

Do not merge to `main`, provision durable cloud bindings, enable execution gates or repoint `sakthiai.omsaravanabhava.org` until exact-head CI, responsive/browser QA, verified identity, tenant isolation, cost controls and runtime/domain separation gates are green.
