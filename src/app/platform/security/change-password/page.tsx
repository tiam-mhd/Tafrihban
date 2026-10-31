import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "@/db";
import { platformAuth } from "@/lib/platform-auth";
import { changePlatformPasswordAction } from "@/app/security-actions";

type Search = Promise<{ error?: string }>;

export default async function PlatformPasswordPage({ searchParams }: { searchParams: Search }) {
  const session = await platformAuth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/platform/login");
  const admin = await pool.query<{ status: string; must_change_password: boolean }>("SELECT status, must_change_password FROM platform_admins WHERE id = $1", [session.user.id]);
  if (admin.rows[0]?.status !== "active") redirect("/platform/login?reason=inactive");
  if (!admin.rows[0]?.must_change_password) redirect("/platform");
  const query = await searchParams;
  return <main className="public-page platform-login-page"><section className="auth-card password-card">
    <span className="eyebrow">حفاظت از حساب مدیر پلتفرم</span>
    <h1>رمز موقت را تغییر دهید</h1>
    <p>برای ادامه، رمز تازه‌ای با حداقل ۱۴ نویسه انتخاب کنید. نشست‌های دیگر این حساب باطل می‌شوند.</p>
    {query.error && <p className="notice notice-warning" role="alert">رمز فعلی معتبر نیست یا تغییر رمز انجام نشد. طول رمز تازه را هم بررسی کنید.</p>}
    <form action={changePlatformPasswordAction} className="stack-form">
      <label className="field-label">رمز فعلی<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
      <label className="field-label">رمز تازه، حداقل ۱۴ نویسه<input name="newPassword" type="password" autoComplete="new-password" required minLength={14} maxLength={128} /></label>
      <label className="field-label">تکرار رمز تازه<input name="confirmation" type="password" autoComplete="new-password" required minLength={14} maxLength={128} /></label>
      <button className="button button-primary" type="submit">تغییر رمز و ادامه</button>
    </form>
  </section></main>;
}
