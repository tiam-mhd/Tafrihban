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
      <p className="lede">سازمان، نخستین شعبه، عضویت مدیر مشتری و نقش مدیر مجموعه به‌صورت تراکنشی ثبت می‌شوند. حساب عملیاتی با شمارهٔ همراه به‌صورت سراسری ساخته می‌شود.</p>
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
        <div className="section-heading"><div><h2>مدیر مجموعه</h2><p>حساب عملیاتی با شمارهٔ همراه سراسری ساخته یا به این مجموعه متصل می‌شود.</p></div></div>
        <div className="form-grid">
          <label className="field-label">نام مدیر<input name="managerName" required minLength={2} maxLength={120} /></label>
          <label className="field-label span-all">شمارهٔ همراه مدیر<input name="managerPhone" type="tel" required minLength={7} maxLength={30} inputMode="tel" autoComplete="tel" dir="ltr" placeholder="09..." /><small>مدیر مجموعه با کد یک‌بارمصرف ارسالی به این شماره وارد می‌شود.</small></label>
        </div>
        <div className="form-actions"><button className="button button-primary" type="submit">ساخت سازمان، شعبه و مدیر</button><Link className="button button-secondary" href="/platform/organizations">بازگشت</Link></div>
      </form>
    </>}
  </PlatformShell>;
}
