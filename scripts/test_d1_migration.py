import sqlite3
from pathlib import Path

sql = Path('migrations/0001_foundation.sql').read_text(encoding='utf-8')
conn = sqlite3.connect(':memory:')
conn.executescript(sql)
conn.execute('PRAGMA foreign_keys = ON')

tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {
    'schema_meta','tenants','users','memberships','projects','conversations','messages','tasks',
    'task_events','approvals','knowledge_sources','artifacts','usage_ledger','audit_events'
}
missing = required - tables
if missing:
    raise SystemExit(f'MISSING_TABLES:{sorted(missing)}')

version = conn.execute("SELECT value FROM schema_meta WHERE key='schema_version'").fetchone()
if not version or version[0] != '1':
    raise SystemExit('SCHEMA_VERSION_INVALID')

conn.execute("INSERT INTO tenants(id,slug,name) VALUES('ten_a','a','Tenant A'),('ten_b','b','Tenant B')")
conn.execute("INSERT INTO users(id,external_subject,display_name) VALUES('usr_a','sub-a','User A'),('usr_b','sub-b','User B')")
conn.execute("INSERT INTO memberships(tenant_id,user_id,role) VALUES('ten_a','usr_a','owner'),('ten_b','usr_b','owner')")
conn.execute("INSERT INTO projects(id,tenant_id,owner_user_id,name) VALUES('prj_a','ten_a','usr_a','A Project'),('prj_b','ten_b','usr_b','B Project')")

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

try:
    conn.execute("INSERT INTO projects(id,tenant_id,owner_user_id,name) VALUES('bad','ten_missing','usr_a','Bad')")
    conn.commit()
    raise SystemExit('FOREIGN_KEY_NOT_ENFORCED')
except sqlite3.IntegrityError:
    conn.rollback()

indexes = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='index'")}
for name in ['idx_projects_tenant_updated','idx_tasks_tenant_state','idx_usage_tenant_created','idx_audit_tenant_created']:
    if name not in indexes:
        raise SystemExit(f'MISSING_INDEX:{name}')

print('SAKTHIAI_D1_MIGRATION_TEST_PASS')
