PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES ('schema_version','4',CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS agent_webhook_nonces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  nonce_sha256 TEXT NOT NULL CHECK(length(nonce_sha256)=64),
  request_timestamp INTEGER NOT NULL,
  body_sha256 TEXT NOT NULL CHECK(length(body_sha256)=64),
  expires_at INTEGER NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id,agent_id,nonce_sha256),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_webhook_nonce_expiry
  ON agent_webhook_nonces(expires_at,consumed_at);

CREATE INDEX IF NOT EXISTS idx_agent_webhook_nonce_tenant_agent
  ON agent_webhook_nonces(tenant_id,agent_id,consumed_at DESC);
