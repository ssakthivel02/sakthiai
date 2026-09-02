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

## Current branch phase

`flagship/hi-tech-v1` establishes the new frontend operating workspace:

- 12 interactive capability surfaces
- capability truth registry
- responsive workspace shell
- fail-closed SakthiAI runtime detector
- free-first runtime policy
- installable PWA foundation
- no SaravanAI data/runtime dependency

The preview host deliberately does not submit prompts unless a verified SakthiAI runtime is connected.

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

## Cost policy

Machine-readable policy: `config/runtime-policy.json`.

- paid AI providers: OFF
- silent paid fallback: OFF
- D1: eligible for free-plan-first activation when durable persistence is needed
- R2: OFF until explicit owner approval because usage beyond the free allowance can be billable
- AI Search: activation deferred to the runtime phase; its current open-beta service limits and separate Workers AI / AI Gateway usage must be checked before activation

## Runtime contract

`assets/runtime.js` probes only a configured SakthiAI API base or same-origin API when running on the approved SakthiAI custom domain. It never points at the SaravanAI production runtime.

The frontend remains useful as a product shell when offline or unconfigured, but it will not fake an AI response.

## Release rule

Do not merge to `main` or repoint `sakthiai.omsaravanabhava.org` until CI, responsive QA, accessibility checks and runtime/domain separation gates are green.
