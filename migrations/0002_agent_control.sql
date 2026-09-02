PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES ('schema_version','2',CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS task_checkpoints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL CHECK(sequence_no >= 0),
  state TEXT NOT NULL,
  checkpoint_json TEXT NOT NULL DEFAULT '{}',
  created_by_type TEXT NOT NULL CHECK(created_by_type IN ('system','worker','verifier','user')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id,sequence_no),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS worker_leases (
  task_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  lease_token TEXT NOT NULL UNIQUE,
  acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verifier_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  verifier_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','running','passed','failed','inconclusive')),
  summary TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK(evidence_count >= 0),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  verifier_run_id TEXT,
  evidence_type TEXT NOT NULL,
  source_ref TEXT,
  checksum_sha256 TEXT,
  claim TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (verifier_run_id) REFERENCES verifier_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_task_sequence ON task_checkpoints(tenant_id,task_id,sequence_no DESC);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_expires ON worker_leases(tenant_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_verifier_task_created ON verifier_runs(tenant_id,task_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_task_created ON evidence_records(tenant_id,task_id,created_at DESC);
