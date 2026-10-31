import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function PlatformLoginPage() {
  return <main className="public-page auth-page platform-login-page"><section className="public-card auth-card"><Link href="/" className="brand-lockup"><span className="brand-mark platform-mark">پ</span><span>مدیریت پلتفرم<small>تفریح‌بان</small></span></Link><span className="eyebrow">ورود مجزا و حسابرسی‌شده</span><h1>مدیریت سراسری پلتفرم</h1><p>این نشست از حساب و نشست کاربران عملیاتی جداست.</p><AuthForm platform /><p className="auth-switch"><Link href="/login">بازگشت به ورود کاربران مجموعه</Link></p></section><div className="auth-side-note"><span className="platform-shield">◆</span><h2>حساب‌های پلتفرم جدا نگهداری می‌شوند.</h2><p>تغییر سازمان، نقش و تنظیمات سراسری در دفتر حسابرسی ثبت می‌شود.</p></div></main>;
}
