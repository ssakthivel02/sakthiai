# SakthiAI P3 Non-Production Real-Evidence Runbook

Status: **OWNER/CLOUDFLARE STEP REQUIRED**  
Production ready: **NO**  
External writes: **NO**  
Executor bound: **NO**

This runbook is the final operational bridge between the merged P3 code and a truthful 20+ external HTTPS evidence claim.

## 0. Hard boundaries

Use a dedicated non-production Cloudflare Worker and D1 database only.

Never use production credentials, production tenant data, repository-write executors, messaging, publishing, deployments, cloud mutation tools or destructive actions during this evidence run.

## 1. Create a dedicated D1 database in Cloudflare

Recommended name:

` sakthiai-p3-evidence-db `

Record the returned database UUID. Do not commit account tokens or secrets.

## 2. Set local environment variables

PowerShell example:

```powershell
$env:SAKTHIAI_EVIDENCE_NONPROD_ACK="NON_PRODUCTION_ONLY"
$env:SAKTHIAI_EVIDENCE_ENVIRONMENT="funding-evidence-staging"
$env:SAKTHIAI_P3_D1_DATABASE_NAME="sakthiai-p3-evidence-db"
$env:SAKTHIAI_P3_D1_DATABASE_ID="<D1-UUID>"
$env:SAKTHIAI_WEBHOOK_AGENT_ID="funding-evidence-client"
$env:SAKTHIAI_WEBHOOK_TENANT_ID="tenant-funding-evidence"
```

Then generate the ignored Wrangler file:

```powershell
npm run prepare:p3-env
```

Expected marker:

`SAKTHIAI_P3_NONPROD_CONFIG_READY`

The generated file intentionally contains no webhook shared secret.

## 3. Apply D1 migrations 0001-0004

First list pending migrations:

```powershell
npx wrangler d1 migrations list sakthiai-p3-evidence-db --remote --config wrangler.p3-evidence.generated.jsonc
```

Then apply them:

```powershell
npx wrangler d1 migrations apply sakthiai-p3-evidence-db --remote --config wrangler.p3-evidence.generated.jsonc
```

Confirm schema migration 0004 is applied before continuing.

## 4. Add the runtime-only webhook secret

Create a random secret of at least 32 characters and keep it outside Git.

```powershell
npx wrangler secret put AGENT_WEBHOOK_SHARED_SECRET --config wrangler.p3-evidence.generated.jsonc
```

Set the same value only in the local shell used by the evidence client:

```powershell
$env:SAKTHIAI_WEBHOOK_SECRET="<same-runtime-secret>"
```

Do not paste the secret into documentation, commits, PR comments or evidence files.

## 5. Deploy only the dedicated non-production Worker

```powershell
npx wrangler deploy --config wrangler.p3-evidence.generated.jsonc
```

Copy the resulting HTTPS Worker URL and set:

```powershell
$env:SAKTHIAI_WEBHOOK_ENDPOINT="https://<non-production-worker>/api/v1/agents/external-proposals/evaluate"
```

## 6. Mandatory preflight

```powershell
npm run preflight:p3
```

Do not continue unless it returns:

`P3_NONPROD_PREFLIGHT_PASS`

The preflight must confirm:
- HTTPS and not localhost
- non-production acknowledgement/name
- webhook enabled
- agent + tenant scopes configured
- durable replay store available
- read-only only
- dry-run only
- no external side effects
- no executor bound

## 7. Run 20 genuine external HTTPS trials

```powershell
npm run benchmark:real-client -- --trials 20 --check-replay --target-system github --target-resource ssakthivel02/sakthiai --output evidence/funding-readiness/signed-webhook-p3-real-client.json
```

Required minimum result:
- accepted = 20/20
- failed = 0
- replayRejected = 20/20
- uniqueEvidenceHashes = 20
- qualifiesAsRealExternalClientEvidence = true
- qualifiesAsDurableReplayEvidence = true

## 8. Independent claim validation

```powershell
npm run validate:p3-evidence -- evidence/funding-readiness/signed-webhook-p3-real-client.json
```

Do not upgrade the funding claim unless this returns:

`SAKTHIAI_P3_REAL_EVIDENCE_VALIDATED`

The validator also emits the exact evidence-supported funding sentence.

## 9. After the run

Keep the evidence JSON privately in the data room/evidence bundle. Do not commit it to the public repository.

Disable/remove the test Worker and D1 resources when no longer needed, or leave the Worker disabled with all external-action/executor gates false.

## 10. Claim boundary

Before successful steps 1-8:

> P3 client/evidence tooling is ready; real external-client evidence is not yet collected.

After successful validator output only:

> Use the exact `truthfulFundingClaim` emitted by `validate:p3-evidence`.

This does not establish production readiness or a vendor-specific Codex/Claude/Gemini/Manus integration.
