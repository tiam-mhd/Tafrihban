import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "@/db";
import { platformAuth } from "@/lib/platform-auth";
import { changePlatformPasswordAction } from "@/app/security-actions";

type Search = Promise<{ error?: string; changed?: string }>;

export default async function PlatformPasswordPage({ searchParams }: { searchParams: Search }) {
  const session = await platformAuth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/platform/login");

  const admin = await pool.query<{ status: string; must_change_password: boolean }>(
    "SELECT status, must_change_password FROM platform_admins WHERE id = $1",
    [session.user.id],
  );
  const account = admin.rows[0];
  if (account?.status !== "active") redirect("/platform/login?reason=inactive");

  const query = await searchParams;
  return <main className="public-page platform-login-page"><section className="auth-card password-card">
    {!account.must_change_password && <Link className="text-link" href="/platform">بازگشت به مدیریت پلتفرم</Link>}
    <span className="eyebrow">امنیت حساب مدیر پلتفرم</span>
    <h1>{account.must_change_password ? "رمز موقت را تغییر دهید" : "تغییر رمز مدیر"}</h1>
    <p>رمز تازه باید دست‌کم ۱۴ نویسه داشته باشد. پس از تغییر رمز، نشست‌های دیگر این حساب باطل می‌شوند.</p>
    {query.changed && <p className="notice notice-success" role="status">رمز با موفقیت تغییر کرد.</p>}
    {query.error && <p className="notice notice-warning" role="alert">رمز فعلی معتبر نیست یا تغییر رمز کامل نشد. رمزها را بررسی کنید و دوباره تلاش کنید.</p>}
    <form action={changePlatformPasswordAction} className="stack-form">
      <label className="field-label">رمز فعلی<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
      <label className="field-label">رمز تازه، حداقل ۱۴ نویسه<input name="newPassword" type="password" autoComplete="new-password" required minLength={14} maxLength={128} /></label>
      <label className="field-label">تکرار رمز تازه<input name="confirmation" type="password" autoComplete="new-password" required minLength={14} maxLength={128} /></label>
      <button className="button button-primary" type="submit">تغییر رمز</button>
    </form>
  </section></main>;
}
