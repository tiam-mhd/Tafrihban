import { pool } from "@/db";
import { PlatformShell } from "@/components/operational-shell";
import { EmptyState, FormNotice } from "@/components/empty-state";
import { manageOperationalAccountAction } from "@/app/platform/actions";
import { normalizeIranianMobile } from "@/modules/identity/iranian-phone";
import { requirePlatformActor, hasPlatformPermission } from "@/server/auth-guards";

type Search = Promise<{ phone?: string; error?: string; saved?: string }>;

export default async function OperationalAccountsPage({ searchParams }: { searchParams: Search }) {
  const actor = await requirePlatformActor();
  const query = await searchParams;
  const allowed = await hasPlatformPermission(actor, "operational_account.manage");
  if (!allowed) return <PlatformShell title="مدیریت حساب‌های عملیاتی" actorName={actor.name} actorId={actor.id}><p className="notice notice-warning">اجازهٔ مدیریت سراسری حساب‌های عملیاتی را ندارید.</p></PlatformShell>;

  const phoneInput = query.phone?.trim().slice(0, 30) || "";
  const normalizedPhone = phoneInput ? normalizeIranianMobile(phoneInput) : null;
  const found = normalizedPhone
    ? await pool.query<{
      id: string;
      name: string;
      phone_number: string;
      phone_number_verified: boolean;
      status: string;
      membership_count: string;
    }>(
      "SELECT u.id, u.name, u.phone_number, u.phone_number_verified, u.status, " +
        "count(DISTINCT om.organization_id)::text AS membership_count " +
        "FROM users u LEFT JOIN organization_memberships om ON om.user_id = u.id " +
        "WHERE u.phone_number = $1 GROUP BY u.id LIMIT 1",
      [normalizedPhone],
    )
    : null;
  const user = found?.rows[0];
  const nextStatus = user?.status === "active" ? "suspended" : "active";

  return <PlatformShell title="مدیریت حساب‌های عملیاتی" actorName={actor.name} actorId={actor.id}>
    <FormNotice searchParams={query} />
    <section className="panel">
      <h2>پیداکردن حساب با شمارهٔ همراه</h2>
      <form method="get" className="manual-lookup">
        <label className="field-label">شمارهٔ همراه<input name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required maxLength={30} defaultValue={phoneInput} /></label>
        <button className="button button-secondary" type="submit">جست‌وجو</button>
      </form>
      {phoneInput && !normalizedPhone && <p className="notice notice-warning section-spaced" role="alert">شمارهٔ همراه ایران معتبر نیست.</p>}
      {normalizedPhone && !user && <EmptyState title="حسابی پیدا نشد">بررسی کنید شمارهٔ همراه درست وارد شده باشد.</EmptyState>}
      {user && <div className="notice notice-info section-spaced">
        <strong>{user.name}</strong> · <span dir="ltr">{user.phone_number}</span><br />
        وضعیت حساب: {user.status === "active" ? "فعال" : "معلق"} · تأیید شماره: {user.phone_number_verified ? "تأییدشده" : "تأییدنشده"} · عضویت در {user.membership_count} مجموعه
      </div>}
    </section>
    {user && <section className="panel narrow-panel">
      <h2>{nextStatus === "suspended" ? "تعلیق حساب و لغو نشست‌ها" : "فعال‌سازی حساب"}</h2>
      <p className="lede">این تغییر سراسری است و نشست‌های عملیاتی فعلی کاربر در همهٔ مجموعه‌ها را باطل می‌کند. عضویت‌ها و سوابق نگه داشته می‌شوند.</p>
      <form action={manageOperationalAccountAction} className="form-stack">
        <input type="hidden" name="phone" value={user.phone_number} />
        <input type="hidden" name="status" value={nextStatus} />
        <label className="field-label">دلیل درخواست<input name="reason" required minLength={8} maxLength={300} /></label>
        <label className="checklist-item"><input type="checkbox" name="confirmation" value="yes" required /><span>می‌دانم نشست‌های این حساب در همهٔ مجموعه‌ها لغو می‌شود.</span></label>
        <button className={nextStatus === "suspended" ? "button button-danger" : "button button-primary"} type="submit">{nextStatus === "suspended" ? "تعلیق حساب" : "فعال‌سازی حساب"}</button>
      </form>
    </section>}
  </PlatformShell>;
}
