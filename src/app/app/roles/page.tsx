import { pool } from "@/db";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { archiveOperationalRoleAction, createRoleAction, updateOperationalRoleAction } from "@/app/app/actions";
import { requireOperationalActor, requireOperationalScope, hasOrganizationPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; error?: string; saved?: string }>;

export default async function RolesPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  if (!(await hasOrganizationPermission(scope, "role.manage"))) return <OperationalShell scope={scope} title="نقش‌ها"><AccessDenied /></OperationalShell>;
  const [roles, permissions] = await Promise.all([
    pool.query<{ id: string; key: string; name: string; description: string; is_system_role: boolean; permission_keys: string[] | null }>(
      `SELECT r.id, r.key, r.name, r.description, r.is_system_role, array_agg(rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL) AS permission_keys
         FROM operational_roles r LEFT JOIN operational_role_permissions rp ON rp.role_id = r.id
        WHERE r.organization_id = $1 AND r.status = 'active' GROUP BY r.id ORDER BY r.is_system_role DESC, r.name`, [scope.organizationId]),
    pool.query<{ key: string; module: string; description: string }>("SELECT key, module, description FROM permissions ORDER BY module, key"),
  ]);
  const fields = (selected: string[] = []) => <div className="permission-grid">{permissions.rows.map((permission) => <label key={permission.key} className="checklist-item"><input type="checkbox" name="permissions" value={permission.key} defaultChecked={selected.includes(permission.key)} /><span><strong dir="ltr">{permission.key}</strong><small>{permission.description}</small></span></label>)}</div>;
  return <OperationalShell scope={scope} title="نقش‌ها و مجوزها">
    <FormNotice searchParams={query} />
    <section className="panel"><h2>نقش‌های فعال</h2>{!roles.rows.length ? <EmptyState title="نقشی تعریف نشده">ساخت نقش‌های پایهٔ مجموعه در زمان ایجاد سازمان انجام می‌شود.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>نقش</th><th>مجوزهای فعال</th><th>نوع</th></tr></thead><tbody>{roles.rows.map((role) => <tr key={role.id}><td><strong>{role.name}</strong><small dir="ltr">{role.key}</small><small>{role.description}</small></td><td>{role.permission_keys?.length ? role.permission_keys.join("، ") : "بدون مجوز"}</td><td>{role.is_system_role ? "پایهٔ سامانه" : "قابل مدیریت"}</td></tr>)}</tbody></table></div>}</section>
    {roles.rows.filter((role) => !role.is_system_role).map((role) => <section className="panel narrow-panel" key={`edit-${role.id}`}><h2>ویرایش: {role.name}</h2><form action={updateOperationalRoleAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><input type="hidden" name="roleId" value={role.id} /><label className="field-label">نام<input name="name" required minLength={2} maxLength={80} defaultValue={role.name} /></label><label className="field-label">توضیح<textarea name="description" maxLength={300} defaultValue={role.description} /></label>{fields(role.permission_keys || [])}<button className="button button-secondary" type="submit">ذخیرهٔ مجوزها</button></form><form action={archiveOperationalRoleAction} className="section-spaced"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><input type="hidden" name="roleId" value={role.id} /><button className="link-button" type="submit">بایگانی نقش</button><p className="form-note">نقش‌های تخصیص‌یافتهٔ بایگانی‌شده دیگر مجوز نمی‌دهند؛ سابقه حفظ می‌شود.</p></form></section>)}
    <section className="panel narrow-panel"><h2>ساخت نقش تازه</h2><form action={createRoleAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><label className="field-label">نام نقش<input name="name" required minLength={2} maxLength={80} /></label><label className="field-label">کلید یکتا، لاتین<input name="key" required pattern="[a-z][a-z0-9_]{1,49}" maxLength={50} dir="ltr" /></label><label className="field-label">توضیح<textarea name="description" maxLength={300} /></label>{fields()}<button className="button button-primary" type="submit">ثبت نقش</button></form></section>
  </OperationalShell>;
}
