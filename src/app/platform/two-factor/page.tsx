import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { platformAuth } from "@/lib/platform-auth";
import { TwoFactorVerifyForm } from "@/components/auth-form";

export default async function PlatformTwoFactorPage() {
  const session = await platformAuth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/platform/login");
  return <main className="public-page auth-page platform-login-page"><section className="public-card auth-card"><span className="brand-mark platform-mark">پ</span><span className="eyebrow">تأیید دومرحله‌ای</span><h1>کد برنامهٔ احراز هویت را وارد کنید</h1><p>برای این نشست پلتفرم، عامل دومرحله‌ای فعال است.</p><TwoFactorVerifyForm /></section></main>;
}
