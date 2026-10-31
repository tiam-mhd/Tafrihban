import Link from "next/link";
import { requirePlatformActor, hasPlatformPermission } from "@/server/auth-guards";
import { PlatformShell } from "@/components/operational-shell";
import { AccessDenied, FormNotice } from "@/components/empty-state";
import { createOrganizationAction } from "@/app/platform/actions";

export default async function NewOrganizationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requirePlatformActor();
  const query = await searchParams;
  const allowed = await hasPlatformPermission(actor, "organization.manage");
  return <PlatformShell title="ساخت سازمان و مدیر اولیه" actorName={actor.name} actorId={actor.id}>
    {!allowed ? <AccessDenied /> : <>
      <p className="lede">سازمان، نخستین شعبه، عضویت مدیر مشتری و نقش مدیر مجموعه به‌صورت تراکنشی ثبت می‌شوند. حساب عملیاتی در جدول کاربران سراسری می‌ماند.</p>
      <FormNotice searchParams={query} />
      <form action={createOrganizationAction} className="panel form-stack">
        <div className="section-heading"><div><h2>مجموعه و شعبه</h2><p>کد و نشانی در محدودهٔ همین سازمان یکتا هستند.</p></div></div>
        <div className="form-grid">
          <label className="field-label">نام سازمان<input name="organizationName" required minLength={2} maxLength={160} /></label>
          <label className="field-label">شناسهٔ URL<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={60} dir="ltr" /><small>حروف انگلیسی کوچک، عدد و خط تیره</small></label>
          <label className="field-label">نام نخستین شعبه<input name="branchName" required minLength={2} maxLength={120} /></label>
          <label className="field-label">کد شعبه<input name="branchCode" required minLength={2} maxLength={20} dir="ltr" /></label>
          <label className="field-label span-all">منطقهٔ زمانی<input name="organizationTimezone" defaultValue="Asia/Tehran" required /></label>
        </div>
        <div className="section-heading"><div><h2>مدیر مشتری</h2><p>رمز موقت را خارج از سامانه با روش امن به مدیر تحویل دهید.</p></div></div>
        <div className="form-grid">
          <label className="field-label">نام مدیر<input name="managerName" required minLength={2} maxLength={120} /></label>
          <label className="field-label">ایمیل حساب عملیاتی<input name="managerEmail" type="email" required maxLength={254} dir="ltr" /></label>
          <label className="field-label span-all">رمز اولیهٔ موقت<input name="managerPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>در گزارش یا پیام ثبت نمی‌شود. مدیر پس از نخستین ورود باید رمز را تغییر دهد.</small></label>
        </div>
        <div className="form-actions"><button className="button button-primary" type="submit">ساخت سازمان، شعبه و مدیر</button><Link className="button button-secondary" href="/platform/organizations">بازگشت</Link></div>
      </form>
    </>}
  </PlatformShell>;
}
