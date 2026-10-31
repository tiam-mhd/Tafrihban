import { pool } from "@/db";
import { PlatformShell } from "@/components/operational-shell";
import { FormNotice } from "@/components/empty-state";
import { createPlatformRoleAction, updatePlatformRoleAction } from "@/app/platform/actions";
import { requirePlatformActor, hasPlatformPermission } from "@/server/auth-guards";

type Search = Promise<{ error?: string; saved?: string }>;

export default async function PlatformRolesPage({ searchParams }: { searchParams: Search }) {
  const actor = await requirePlatformActor();
  const query = await searchParams;
  if (!(await hasPlatformPermission(actor, "platform_admin.manage"))) return <PlatformShell title="نقش‌های پلتفرم" actorName={actor.name} actorId={actor.id}><p className="notice notice-warning">اجازهٔ مدیریت نقش‌ها را ندارید.</p></PlatformShell>;
  const [roles, permissions] = await Promise.all([
    pool.query<{ id: string; key: string; name: string; description: string; grants_all_permissions: boolean; permission_keys: string[] | null }>(
      `SELECT r.id, r.key, r.name, r.description, r.grants_all_permissions, array_agg(rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL) AS permission_keys
         FROM platform_admin_roles r LEFT JOIN platform_role_permissions rp ON rp.role_id = r.id
        WHERE r.status = 'active' GROUP BY r.id ORDER BY r.grants_all_permissions DESC, r.name`, []),
    pool.query<{ key: string; description: string }>("SELECT key, description FROM platform_permissions ORDER BY key", []),
  ]);
  const checklist = (selected: string[] = []) => <div className="permission-grid">{permissions.rows.map((permission) => <label className="checklist-item" key={permission.key}><input type="checkbox" name="permissions" value={permission.key} defaultChecked={selected.includes(permission.key)} /><span><strong dir="ltr">{permission.key}</strong><small>{permission.description}</small></span></label>)}</div>;
  return <PlatformShell title="نقش‌های پلتفرم" actorName={actor.name} actorId={actor.id}>
    <FormNotice searchParams={query} />
    {roles.rows.map((role) => <section className="panel narrow-panel" key={role.id}><h2>{role.name} <small dir="ltr">{role.key}</small></h2>{role.grants_all_permissions ? <p className="notice notice-info">این نقش wildcard دارد و همهٔ مجوزهای فعلی و آینده را پوشش می‌دهد. تغییر دستی آن از رابط ممکن نیست.</p> : <form action={updatePlatformRoleAction} className="form-stack"><input type="hidden" name="roleId" value={role.id} /><label className="field-label">نام<input value={role.name} readOnly aria-label="نام نقش" /></label><label className="field-label">دلیل تغییر<input name="reason" required minLength={8} maxLength={300} /></label>{checklist(role.permission_keys || [])}<button className="button button-secondary" type="submit">ذخیرهٔ مجوزها</button></form>}</section>)}
    <section className="panel narrow-panel"><h2>نقش محدود تازه</h2><form action={createPlatformRoleAction} className="form-stack"><label className="field-label">کلید لاتین<input name="key" required pattern="[A-Z][A-Z0-9_]{1,50}" dir="ltr" /></label><label className="field-label">نام<input name="name" required minLength={2} maxLength={80} /></label><label className="field-label">توضیح<textarea name="description" maxLength={300} /></label><label className="field-label">دلیل ساخت<input name="reason" required minLength={8} maxLength={300} /></label>{checklist()}<button className="button button-primary" type="submit">ایجاد نقش محدود</button></form></section>
  </PlatformShell>;
}
