import { pool } from "@/db";
import { PlatformShell } from "@/components/operational-shell";
import { EmptyState, FormNotice } from "@/components/empty-state";
import { createPlatformAdminAction, suspendPlatformAdminAction } from "@/app/platform/actions";
import { requirePlatformActor, hasPlatformPermission } from "@/server/auth-guards";

type Search = Promise<{ error?: string; saved?: string }>;

export default async function PlatformAdminsPage({ searchParams }: { searchParams: Search }) {
  const actor = await requirePlatformActor();
  if (!(await hasPlatformPermission(actor, "platform_admin.manage"))) return <PlatformShell title="مدیران پلتفرم" actorName={actor.name} actorId={actor.id}><p className="notice notice-warning">اجازهٔ مدیریت مدیران پلتفرم را ندارید.</p></PlatformShell>;
  const query = await searchParams;
  const [admins, roles] = await Promise.all([
    pool.query<{ id: string; name: string; email: string; status: string; two_factor_enabled: boolean; role_names: string | null; created_at: Date }>(
      `SELECT p.id, p.name, p.email, p.status, p.two_factor_enabled, p.created_at, string_agg(DISTINCT r.name, '، ' ORDER BY r.name) AS role_names
         FROM platform_admins p LEFT JOIN platform_admin_role_assignments a ON a.platform_admin_id = p.id
         LEFT JOIN platform_admin_roles r ON r.id = a.role_id AND r.status = 'active'
        GROUP BY p.id ORDER BY p.created_at`, []),
    pool.query<{ key: string; name: string }>("SELECT key, name FROM platform_admin_roles WHERE status = 'active' AND grants_all_permissions = false ORDER BY name", []),
  ]);
  return <PlatformShell title="مدیران پلتفرم" actorName={actor.name} actorId={actor.id}>
    <FormNotice searchParams={query} />
    <section className="panel"><h2>حساب‌های مدیر پلتفرم</h2>{!admins.rows.length ? <EmptyState title="مدیری ثبت نشده">مدیر تازه را با نقش محدود بسازید.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>نام / ایمیل</th><th>نقش</th><th>عامل دومرحله‌ای</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>{admins.rows.map((admin) => <tr key={admin.id}><td><strong>{admin.name}</strong><small dir="ltr">{admin.email}</small></td><td>{admin.role_names || "بدون نقش"}</td><td>{admin.two_factor_enabled ? "فعال" : "هنوز فعال نشده"}</td><td>{admin.status === "active" ? "فعال" : "معلق"}</td><td>{admin.id === actor.id || admin.status !== "active" ? <span className="pill">حساب جاری/معلق</span> : <form action={suspendPlatformAdminAction} className="form-stack"><input type="hidden" name="platformAdminId" value={admin.id} /><label className="field-label">دلیل تعلیق<input name="reason" required minLength={8} maxLength={300} /></label><button className="link-button" type="submit">تعلیق و ابطال نشست‌ها</button></form>}</td></tr>)}</tbody></table></div>}</section>
    <section className="panel narrow-panel"><h2>ایجاد مدیر پلتفرم</h2><p className="form-note">مدیر جدید هنگام نخستین ورود باید رمز را عوض کند. فعال‌کردن TOTP از مسیر امنیت مدیر پیشنهاد می‌شود.</p><form action={createPlatformAdminAction} className="form-stack"><label className="field-label">نام<input name="name" required minLength={2} maxLength={120} /></label><label className="field-label">ایمیل<input name="email" type="email" required maxLength={254} dir="ltr" /></label><label className="field-label">رمز موقت، حداقل ۱۴ نویسه<input name="password" type="password" required minLength={14} maxLength={128} autoComplete="new-password" /></label><label className="field-label">نقش<select name="roleKey" required defaultValue=""><option value="" disabled>انتخاب نقش محدود</option>{roles.rows.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select></label><label className="field-label">دلیل دسترسی<input name="reason" minLength={8} maxLength={300} defaultValue="مدیریت دسترسی پلتفرم" required /></label><button className="button button-primary" type="submit" disabled={!roles.rows.length}>ایجاد مدیر</button></form></section>
  </PlatformShell>;
}
