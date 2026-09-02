PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES ('schema_version','3',CURRENT_TIMESTAMP);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approvals_tenant_id ON approvals(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_verifier_runs_tenant_id ON verifier_runs(tenant_id,id);

CREATE TABLE IF NOT EXISTS execution_attempts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  executor_contract_id TEXT NOT NULL,
  action_class TEXT NOT NULL CHECK(action_class IN ('read_only','internal_write','repository_write','external_write','publish','message','deploy','destructive')),
  idempotency_key TEXT NOT NULL,
  approval_id TEXT,
  verifier_run_id TEXT,
  state TEXT NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','authorized','dry_run_validated','executing','verifying','committed','rollback_pending','rolling_back','rolled_back','failed','cancelled')),
  external_action INTEGER NOT NULL DEFAULT 0 CHECK(external_action IN (0,1)),
  dry_run INTEGER NOT NULL DEFAULT 1 CHECK(dry_run IN (0,1)),
  side_effects INTEGER NOT NULL DEFAULT 0 CHECK(side_effects IN (0,1)),
  request_hash TEXT,
  rollback_plan_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY (tenant_id,task_id) REFERENCES tasks(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,approval_id) REFERENCES approvals(tenant_id,id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id,verifier_run_id) REFERENCES verifier_runs(tenant_id,id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_attempts_tenant_id ON execution_attempts(tenant_id,id);

CREATE TABLE IF NOT EXISTS execution_receipts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  execution_attempt_id TEXT NOT NULL,
  receipt_type TEXT NOT NULL CHECK(receipt_type IN ('preflight','dry_run','execute','verify','commit','rollback','error')),
  status TEXT NOT NULL,
  checksum_sha256 TEXT,
  external_ref TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id,task_id) REFERENCES tasks(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,execution_attempt_id) REFERENCES execution_attempts(tenant_id,id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rollback_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  execution_attempt_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','not_required','pending','running','completed','failed')),
  strategy TEXT NOT NULL,
  outcome_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id,task_id) REFERENCES tasks(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,execution_attempt_id) REFERENCES execution_attempts(tenant_id,id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_attempts_task_state ON execution_attempts(tenant_id,task_id,state,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_receipts_attempt ON execution_receipts(tenant_id,execution_attempt_id,created_at);
CREATE INDEX IF NOT EXISTS idx_rollback_attempt_state ON rollback_records(tenant_id,execution_attempt_id,state,updated_at DESC);
