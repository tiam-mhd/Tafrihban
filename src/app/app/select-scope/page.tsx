import { redirect } from "next/navigation";
import { listAccessibleScopes } from "@/server/scopes";
import { requireOperationalActor } from "@/server/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { BrandLogo } from "@/components/brand-logo";
import { EmptyState } from "@/components/empty-state";

export default async function SelectScopePage() {
  const actor = await requireOperationalActor();
  const scopes = await listAccessibleScopes(actor);
  if (scopes.length === 1) redirect(`/app?organizationId=${encodeURIComponent(scopes[0]!.organization_id)}&branchId=${encodeURIComponent(scopes[0]!.branch_id)}`);
  return <main className="public-page"><section className="scope-picker">
    <header className="public-header"><span className="brand-lockup"><BrandLogo /><span>تفریح‌بان<small>انتخاب محدودهٔ کار</small></span></span><SignOutButton accountId={actor.id} platform={false} /></header>
    <div className="picker-heading"><span className="eyebrow">سلام {actor.name}</span><h1>مجموعه و شعبهٔ فعال را انتخاب کنید</h1><p>هر نشست در یک محدوده کار می‌کند؛ دسترسی هر شعبه در سرور دوباره بررسی می‌شود.</p></div>
    {!scopes.length ? <EmptyState title="عضویت فعالی پیدا نشد">از مدیر مجموعه بخواهید شما را به یک شعبه دعوت کند. تا آن زمان اطلاعات سازمانی نمایش داده نمی‌شود.</EmptyState> : <div className="scope-grid">{scopes.map((scope) => <a key={`${scope.organization_id}:${scope.branch_id}`} className="scope-option" href={`/app?organizationId=${encodeURIComponent(scope.organization_id)}&branchId=${encodeURIComponent(scope.branch_id)}`}><span className="scope-icon">⌖</span><span><small>{scope.organization_name}</small><strong>{scope.branch_name}</strong></span><b aria-hidden="true">←</b></a>)}</div>}
  </section></main>;
}
