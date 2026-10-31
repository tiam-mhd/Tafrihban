import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied } from "@/components/empty-state";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string }>;

export default async function ReportsPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  if (!(await hasOperationalPermission(scope, "report.export"))) return <OperationalShell scope={scope} title="گزارش‌ها"><AccessDenied /></OperationalShell>;
  const params = `organizationId=${scope.organizationId}&branchId=${scope.branchId}`;
  return <OperationalShell scope={scope} title="گزارش‌های شعبه">
    <section className="panel"><h2>خروجی CSV محدود به همین شعبه</h2><p className="lede">خروجی‌ها از مجوز و محدودهٔ تأییدشدهٔ سرور استفاده می‌کنند؛ هر خروجی در دفتر حسابرسی ثبت می‌شود.</p><div className="report-grid">
      <ExportCard title="تجهیزات" href={`/api/reports/export?type=equipment&${params}`} description="کد، دسته‌بندی، وضعیت و مشخصات پایه" />
      <ExportCard title="بازرسی‌ها" href={`/api/reports/export?type=inspections&${params}`} description="زمان UTC، تجهیز، بازرس و نتیجهٔ ثبت" />
      <ExportCard title="عیب‌ها" href={`/api/reports/export?type=defects&${params}`} description="شرح، شدت و وضعیت پیگیری" />
      <ExportCard title="کارهای تعمیراتی" href={`/api/reports/export?type=work-orders&${params}`} description="مسئول، اولویت، موعد و یادداشت تکمیل" />
    </div></section>
  </OperationalShell>;
}

function ExportCard({ title, href, description }: { title: string; href: string; description: string }) {
  return <article className="report-card"><span className="state-icon" aria-hidden="true">↓</span><div><h3>{title}</h3><p>{description}</p></div><a className="button button-secondary" href={href}>دریافت CSV</a></article>;
}
