import { requirePlatformActor } from "@/server/auth-guards";
import { PlatformShell } from "@/components/operational-shell";
import { PlatformTwoFactorSetup } from "@/components/auth-form";

export default async function PlatformSecurityPage() {
  const actor = await requirePlatformActor();
  return <PlatformShell title="امنیت مدیر" actorName={actor.name} actorId={actor.id}><section className="content-grid"><div><p className="lede">عامل دومرحله‌ای TOTP را با برنامهٔ احراز هویت فعال کنید. برای مدیران پلتفرم قابلیت ورود دومرحله‌ای فراهم شده است.</p><PlatformTwoFactorSetup /></div><aside className="panel subtle-panel"><h2>نشست‌های مدیر</h2><p>نشست پلتفرم با cookie و جدول جداگانه نگهداری می‌شود. خروج از حساب، نشست فعلی را باطل می‌کند.</p></aside></section></PlatformShell>;
}
