import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "@/db";
import { operationalAuth } from "@/lib/auth";
import { changeOperationalPasswordAction } from "@/app/security-actions";

type Search = Promise<{ error?: string }>;

export default async function OperationalPasswordPage({ searchParams }: { searchParams: Search }) {
  const session = await operationalAuth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");
  const user = await pool.query<{ status: string; must_change_password: boolean }>("SELECT status, must_change_password FROM users WHERE id = $1", [session.user.id]);
  if (user.rows[0]?.status !== "active") redirect("/login?reason=inactive");
  if (!user.rows[0]?.must_change_password) redirect("/app/select-scope");
  const query = await searchParams;
  return <main className="public-page"><section className="auth-card password-card">
    <span className="eyebrow">حفاظت از حساب عملیاتی</span>
    <h1>رمز موقت را تغییر دهید</h1>
    <p>برای ادامه، رمز تازه‌ای انتخاب کنید. نشست‌های دیگر این حساب پس از تغییر رمز باطل می‌شوند.</p>
    {query.error && <p className="notice notice-warning" role="alert">رمز فعلی معتبر نیست یا تغییر رمز انجام نشد. طول رمز تازه را هم بررسی کنید.</p>}
    <form action={changeOperationalPasswordAction} className="stack-form">
      <label className="field-label">رمز فعلی<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
      <label className="field-label">رمز تازه، حداقل ۱۲ نویسه<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
      <label className="field-label">تکرار رمز تازه<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
      <button className="button button-primary" type="submit">تغییر رمز و ادامه</button>
    </form>
  </section></main>;
}
