import sqlite3
from pathlib import Path

conn = sqlite3.connect(':memory:')
conn.executescript(Path('migrations/0001_foundation.sql').read_text(encoding='utf-8'))
conn.executescript(Path('migrations/0002_agent_control.sql').read_text(encoding='utf-8'))
conn.execute('PRAGMA foreign_keys = ON')

tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {
    'schema_meta','tenants','users','memberships','projects','conversations','messages','tasks',
    'task_events','approvals','knowledge_sources','artifacts','usage_ledger','audit_events',
    'task_execution_policy','task_checkpoints','worker_leases','verifier_runs','evidence_records'
}
missing = required - tables
if missing:
    raise SystemExit(f'MISSING_TABLES:{sorted(missing)}')

version = conn.execute("SELECT value FROM schema_meta WHERE key='schema_version'").fetchone()
if not version or version[0] != '2':
    raise SystemExit(f'SCHEMA_VERSION_INVALID:{version}')

conn.execute("INSERT INTO tenants(id,slug,name) VALUES('ten_a','a','Tenant A'),('ten_b','b','Tenant B')")
conn.execute("INSERT INTO users(id,external_subject,display_name) VALUES('usr_a','sub-a','User A'),('usr_b','sub-b','User B')")
conn.execute("INSERT INTO memberships(tenant_id,user_id,role) VALUES('ten_a','usr_a','owner'),('ten_b','usr_b','owner')")
conn.execute("INSERT INTO projects(id,tenant_id,owner_user_id,name) VALUES('prj_a','ten_a','usr_a','A Project'),('prj_b','ten_b','usr_b','B Project')")
conn.execute("INSERT INTO tasks(id,tenant_id,project_id,created_by,task_type,title,objective,state,autonomy_class,approval_required) VALUES('tsk_a','ten_a','prj_a','usr_a','agent','A Task','Test A','planned','green',0),('tsk_b','ten_b','prj_b','usr_b','agent','B Task','Test B','planned','green',0)")

visible_a = conn.execute("SELECT id FROM projects WHERE tenant_id=? AND status!='deleted'", ('ten_a',)).fetchall()
if visible_a != [('prj_a',)]:
    raise SystemExit(f'TENANT_SCOPE_BROKEN:{visible_a}')

membership = conn.execute("""
SELECT u.id,m.role,t.status,u.status,m.status
FROM users u
JOIN memberships m ON m.user_id=u.id
JOIN tenants t ON t.id=m.tenant_id
WHERE u.external_subject=? AND m.tenant_id=?
LIMIT 1
""", ('sub-a','ten_a')).fetchone()
if membership != ('usr_a','owner','active','active','active'):
    raise SystemExit(f'RBAC_LOOKUP_INVALID:{membership}')

cross = conn.execute("""
SELECT u.id,m.role
FROM users u JOIN memberships m ON m.user_id=u.id
WHERE u.external_subject=? AND m.tenant_id=?
""", ('sub-a','ten_b')).fetchone()
if cross is not None:
    raise SystemExit('CROSS_TENANT_MEMBERSHIP_LEAK')

conn.execute("INSERT INTO task_execution_policy(id,tenant_id,task_id,action_class,external_action,destructive_action) VALUES('pol_a','ten_a','tsk_a','read_only',0,0)")
conn.execute("INSERT INTO task_checkpoints(id,tenant_id,task_id,sequence_no,state,checkpoint_json,created_by_type,created_by) VALUES('chk_a','ten_a','tsk_a',0,'planned','{}','user','usr_a')")
conn.execute("INSERT INTO worker_leases(task_id,tenant_id,worker_id,lease_token,expires_at) VALUES('tsk_a','ten_a','worker-a','lease-a','2099-01-01T00:00:00.000Z')")
conn.execute("INSERT INTO verifier_runs(id,tenant_id,task_id,verifier_type,state,summary,evidence_count,completed_at) VALUES('ver_a','ten_a','tsk_a','policy','passed','ok',1,CURRENT_TIMESTAMP)")
conn.execute("INSERT INTO evidence_records(id,tenant_id,task_id,verifier_run_id,evidence_type,source_ref,evidence_json) VALUES('evd_a','ten_a','tsk_a','ver_a','test','local:test','{}')")
conn.commit()

def expect_integrity(sql, code):
    try:
        conn.execute(sql)
        conn.commit()
        raise SystemExit(code)
    except sqlite3.IntegrityError:
        conn.rollback()

expect_integrity(
    "INSERT INTO task_execution_policy(id,tenant_id,task_id,action_class,external_action,destructive_action) VALUES('bad_pol','ten_b','tsk_a','read_only',0,0)",
    'CROSS_TENANT_POLICY_ALLOWED'
)
expect_integrity(
    "INSERT INTO task_checkpoints(id,tenant_id,task_id,sequence_no,state,checkpoint_json,created_by_type) VALUES('bad_chk','ten_b','tsk_a',1,'planned','{}','system')",
    'CROSS_TENANT_CHECKPOINT_ALLOWED'
)
expect_integrity(
    "INSERT INTO verifier_runs(id,tenant_id,task_id,verifier_type,state) VALUES('bad_ver','ten_b','tsk_a','policy','pending')",
    'CROSS_TENANT_VERIFIER_ALLOWED'
)
expect_integrity(
    "INSERT INTO evidence_records(id,tenant_id,task_id,verifier_run_id,evidence_type,evidence_json) VALUES('bad_evd','ten_b','tsk_b','ver_a','test','{}')",
    'CROSS_TENANT_VERIFIER_EVIDENCE_ALLOWED'
)
expect_integrity(
    "INSERT INTO worker_leases(task_id,tenant_id,worker_id,lease_token,expires_at) VALUES('tsk_a','ten_a','worker-b','lease-b','2099-01-01T00:00:00.000Z')",
    'DUPLICATE_TASK_LEASE_ALLOWED'
)
expect_integrity(
    "INSERT INTO projects(id,tenant_id,owner_user_id,name) VALUES('bad','ten_missing','usr_a','Bad')",
    'FOREIGN_KEY_NOT_ENFORCED'
)

still_present = conn.execute("SELECT id FROM tasks WHERE tenant_id='ten_a' AND id='tsk_a'").fetchone()
if still_present != ('tsk_a',):
    raise SystemExit('NEGATIVE_TEST_ROLLBACK_CORRUPTED_SETUP')

indexes = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='index'")}
for name in [
    'idx_projects_tenant_updated','idx_tasks_tenant_state','idx_usage_tenant_created','idx_audit_tenant_created',
    'uq_tasks_tenant_id','idx_execution_policy_tenant','idx_checkpoints_task_sequence','idx_leases_tenant_expires',
    'idx_verifier_task_created','idx_evidence_task_created'
]:
    if name not in indexes:
        raise SystemExit(f'MISSING_INDEX:{name}')

print('SAKTHIAI_D1_V4_MIGRATION_TEST_PASS')
