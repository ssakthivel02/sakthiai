const PERMISSIONS=Object.freeze({
  ai_use:['owner','admin','member'],
  projects_read:['owner','admin','member','viewer','auditor'],
  projects_write:['owner','admin','member'],
  tasks_read:['owner','admin','member','viewer','auditor'],
  tasks_write:['owner','admin','member'],
  agents_read:['owner','admin','member','viewer','auditor'],
  agents_write:['owner','admin','member'],
  agents_verify:['owner','admin','member'],
  agents_approve:['owner','admin'],
  approvals_decide:['owner','admin'],
  audit_read:['owner','admin','auditor']
});

export function rolesFor(permission){return PERMISSIONS[permission]||[];}

export async function authorizeTenant(env,identity,tenantId,permission){
  if(!env.DB)return {ok:false,code:'BINDING_MISSING'};
  if(!identity?.ok||!identity.subject)return {ok:false,code:'IDENTITY_REQUIRED'};
  const safeTenant=String(tenantId||'').trim();
  if(!safeTenant)return {ok:false,code:'TENANT_REQUIRED'};
  const allowed=rolesFor(permission);
  if(!allowed.length)return {ok:false,code:'PERMISSION_UNKNOWN'};
  const row=await env.DB.prepare(`
    SELECT u.id AS user_id,m.role AS role,t.status AS tenant_status,u.status AS user_status,m.status AS membership_status
    FROM users u
    JOIN memberships m ON m.user_id=u.id
    JOIN tenants t ON t.id=m.tenant_id
    WHERE u.external_subject=? AND m.tenant_id=?
    LIMIT 1
  `).bind(identity.subject,safeTenant).first();
  if(!row)return {ok:false,code:'TENANT_MEMBERSHIP_REQUIRED'};
  if(row.tenant_status!=='active'||row.user_status!=='active'||row.membership_status!=='active')return {ok:false,code:'TENANT_ACCESS_INACTIVE'};
  if(!allowed.includes(row.role))return {ok:false,code:'RBAC_FORBIDDEN',role:row.role};
  return {ok:true,tenantId:safeTenant,userId:row.user_id,role:row.role};
}
