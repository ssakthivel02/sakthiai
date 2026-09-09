# SakthiAI Trusted Action Gateway — P0 Funding-Readiness Proof

Status: **CONTROLLED P0 POLICY / DRY-RUN PROOF**  
Production ready: **NO**  
Live external-agent binding: **NO**  
External side-effect execution: **NO**

## Why this exists

The funding wedge is not "another AI chat app". The P0 goal is to demonstrate a provider-neutral trust boundary that can sit between an AI agent and a consequential action.

The gateway accepts an action proposal from an external-agent adapter and makes a deterministic decision before any side effect is allowed.

```text
External agent proposal
  -> SakthiAI trusted-action gateway
  -> action/risk classification
  -> policy hard blocks
  -> verifier gate
  -> approval gate for consequential actions
  -> executor-contract validation
  -> dry-run receipt
  -> SHA-256 evidence record
  -> DRY_RUN_READY / APPROVAL_REQUIRED / VERIFIER_REQUIRED / BLOCKED
```

## P0 supported action classes

- `read_only`
- `internal_write`
- `repository_write`
- `external_write`
- `publish`
- `message`
- `deploy`
- `destructive`

The gateway reuses SakthiAI's existing executor contract registry rather than creating a parallel safety model.

## Hard controls demonstrated

- verifier is required before an action reaches dry-run readiness
- consequential actions require approval
- direct writes to `main` / `master` are blocked for repository actions
- force-push proposals are blocked
- idempotency key is required
- evidence requirements are required
- rollback/compensation plan is required
- external-action feature gate is respected
- no bound executor is claimed
- no external side effect is performed
- each evaluated proposal gets a SHA-256 evidence hash over the decision record

## API surface

### Contract

`GET /api/v1/agents/trusted-actions/contract`

Returns the public P0 gateway contract and evidence boundary.

### Evaluate

`POST /api/v1/agents/trusted-actions/evaluate`

The evaluate route is behind the existing SakthiAI agent-control security stack:

- verified identity
- tenant selection
- tenant RBAC
- quota controls
- agent-control durable-store availability

The request is still policy/dry-run only. It does not bind to Codex, Claude Code, Gemini, GitHub, cloud platforms or any other external executor in P0.

Example proposal shape:

```json
{
  "sourceAgent": "external-agent-adapter",
  "sourceRunId": "run_123",
  "taskId": "tsk_123",
  "actionClass": "repository_write",
  "action": "Prepare a feature-branch change",
  "rationale": "Required by the approved task",
  "target": {
    "system": "github",
    "resource": "owner/repo",
    "branch": "funding-readiness/example"
  },
  "idempotencyKey": "idem_123",
  "verifierId": "ver_123",
  "verifierState": "passed",
  "approvalId": "apr_123",
  "approvalState": "approved",
  "evidenceRequirements": ["diff", "tests"],
  "rollbackPlan": "Revert the isolated branch commit"
}
```

## Automated evidence

`scripts/test-trusted-action-gateway.mjs` runs a deterministic 24-case matrix across:

- 3 agent-adapter fixture labels
- 8 action classes

It also explicitly tests:

- missing required fields
- verifier pending
- verifier failure
- approval required
- direct-main block
- force-push block
- external-action gate
- dry-run receipt generation
- evidence hashing
- zero side effects

The fixture labels are **not** claims of live Codex / Claude / Gemini integrations. They exist only to prove provider-neutral input handling.

## What this proves

The repository can now demonstrate the core funding thesis at policy level:

> An AI agent can propose an action, and SakthiAI can independently classify, gate, verify, require approval, validate execution controls and generate evidence before any consequential action is allowed.

## What remains before stronger investor claims

P0 does **not** yet prove:

- a live external-agent adapter
- a concrete sandbox/repository/connector/deployment executor
- real tool execution
- rollback against a real external system
- production identity deployment
- production-scale latency, reliability or cost metrics
- 20+ real external-agent benchmark runs

The next evidence sprint should bind **one** real external agent or deterministic external webhook adapter to this contract in an isolated environment, then execute only a non-destructive/read-only or isolated-branch workflow with post-condition verification.
