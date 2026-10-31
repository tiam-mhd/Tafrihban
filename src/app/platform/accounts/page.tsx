import { pool } from "@/db";
import { PlatformShell } from "@/components/operational-shell";
import { EmptyState, FormNotice } from "@/components/empty-state";
import { recoverOperationalAccountAction } from "@/app/platform/actions";
import { requirePlatformActor, hasPlatformPermission } from "@/server/auth-guards";

type Search = Promise<{ email?: string; error?: string; saved?: string }>;

export default async function OperationalAccountsPage({ searchParams }: { searchParams: Search }) {
  const actor = await requirePlatformActor();
  const query = await searchParams;
  if (!(await hasPlatformPermission(actor, "operational_account.recover"))) return <PlatformShell title="بازیابی حساب عملیاتی" actorName={actor.name} actorId={actor.id}><p className="notice notice-warning">اجازهٔ بازیابی سراسری حساب را ندارید.</p></PlatformShell>;
  const email = query.email?.trim().toLowerCase().slice(0, 254) || "";
  const found = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? await pool.query<{ id: string; name: string; email: string; status: string; membership_count: string; credential_exists: boolean }>(
    `SELECT u.id, u.name, u.email, u.status, count(DISTINCT om.organization_id)::text AS membership_count,
            bool_or(ua.provider_id = 'credential') AS credential_exists
       FROM users u LEFT JOIN organization_memberships om ON om.user_id = u.id
       LEFT JOIN user_accounts ua ON ua.user_id = u.id
      WHERE lower(u.email) = $1 GROUP BY u.id LIMIT 1`, [email]) : { rows: [] as { id: string; name: string; email: string; status: string; membership_count: string; credential_exists: boolean }[] };
  const user = found.rows[0];
  return <PlatformShell title="بازیابی حساب عملیاتی" actorName={actor.name} actorId={actor.id}>
    <FormNotice searchParams={query} />
    <section className="panel"><h2>پیداکردن حساب</h2><form method="get" className="manual-lookup"><label className="field-label">ایمیل حساب عملیاتی<input name="email" type="email" dir="ltr" required maxLength={254} defaultValue={email} /></label><button className="button button-secondary" type="submit">جست‌وجو</button></form>
      {email && !user && <EmptyState title="حسابی پیدا نشد">بررسی کنید ایمیل را درست وارد کرده‌اید.</EmptyState>}
      {user && <div className="notice notice-info section-spaced"><strong>{user.name}</strong> · <span dir="ltr">{user.email}</span><br />وضعیت حساب: {user.status === "active" ? "فعال" : "معلق"} · عضویت در {user.membership_count} مجموعه · رمز ورود: {user.credential_exists ? "تنظیم‌شده" : "تنظیم‌نشده"}</div>}
    </section>
    <section className="panel narrow-panel"><h2>تنظیم رمز موقت</h2><p className="lede">این اقدام برای حساب سراسری است: رمز ورود عوض می‌شود، همهٔ نشست‌های عملیاتی باطل می‌شوند و تغییر رمز در ورود بعدی اجباری است. رمز موقت را فقط از راه امن خارج از سامانه به صاحب حساب برسانید.</p><form action={recoverOperationalAccountAction} className="form-stack"><label className="field-label">ایمیل حساب<input name="email" type="email" required maxLength={254} dir="ltr" defaultValue={email} /></label><label className="field-label">رمز موقت تازه، حداقل ۱۲ نویسه<input name="temporaryPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label><label className="field-label">دلیل درخواست<input name="reason" required minLength={8} maxLength={300} /></label><label className="checklist-item"><input type="checkbox" name="confirmation" value="yes" required /><span>می‌دانم همهٔ نشست‌های عملیاتی این حساب در همهٔ مجموعه‌ها باطل می‌شود.</span></label><button className="button button-primary" type="submit">تنظیم رمز و باطل‌کردن نشست‌ها</button></form></section>
  </PlatformShell>;
}
