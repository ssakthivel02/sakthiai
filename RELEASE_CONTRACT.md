# SakthiAI Flagship Release Contract

## Isolation
- Legacy production: `ssakthivel02/saravanai-legacy`.
- New flagship: `ssakthivel02/sakthiai`.
- Never repoint or overwrite SaravanAI during flagship validation.

## Mandatory release gates
1. Exact-head CI green.
2. GitHub Pages deployment green on `main`.
3. Pages URL smoke passes.
4. Backend/API hostname ownership is explicitly separated from SaravanAI.
5. Protected owner data, privacy, rate limits, tenant isolation and paid-provider approval gates remain intact.
6. Only then reclaim `sakthiai.omsaravanabhava.org` for the new flagship.

## Product claims
The static flagship shell is a product preview until the corresponding runtime capability is integrated and verified. Do not present simulated UI as a functioning production AI capability.
