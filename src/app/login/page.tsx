import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const query = await searchParams;
  return <main className="public-page auth-page"><section className="public-card auth-card"><Link href="/" className="brand-lockup"><span className="brand-mark">ت</span><span>تفریح‌بان<small>ورود کاربران مجموعه</small></span></Link><span className="eyebrow">فضای عملیاتی</span><h1>به پرونده‌های مجموعه وارد شوید</h1><p>با حساب عملیاتی خود وارد شوید. دسترسی شعبه از عضویت ثبت‌شدهٔ سرور تعیین می‌شود.</p>{query.reason === "inactive" && <p className="notice notice-warning" role="alert">این حساب غیرفعال است؛ با مدیر مجموعه تماس بگیرید.</p>}<AuthForm /><p className="auth-switch">مدیر پلتفرم هستید؟ <Link href="/platform/login">ورود جداگانهٔ مدیر</Link></p></section><div className="auth-side-note"><span className="big-check">✓</span><h2>ثبت محلی، تا پیش از تأیید سرور نهایی نیست.</h2><p>وضعیت‌های صف برای هر بازرسی روشن می‌مانند تا کاربر بداند کدام رویداد ثبت شده است.</p></div></main>;
}
