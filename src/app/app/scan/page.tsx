import Link from "next/link";
import { QrScanner } from "@/components/qr-scanner";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied } from "@/components/empty-state";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string }>;

export default async function ScanPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const allowed = await hasOperationalPermission(scope, "equipment.read");
  if (!allowed) return <OperationalShell scope={scope} title="اسکن تجهیز"><AccessDenied /></OperationalShell>;
  return <OperationalShell scope={scope} title="یافتن تجهیز">
    <section className="panel narrow-panel">
      <p className="lede">با انتخاب دکمه، اجازهٔ دوربین درخواست می‌شود. در صورت پشتیبانی‌نشدن دوربین یا نبود اینترنت، شناسه یا کد تجهیز را دستی وارد کنید.</p>
      <QrScanner organizationId={scope.organizationId} branchId={scope.branchId} />
      <p className="tiny-note">شناسهٔ QR عمومی و غیرحساس است؛ اطلاعات تجهیز فقط پس از بررسی عضویت و شعبه از سرور نمایش داده می‌شود.</p>
      <Link className="text-link" href={`/app/equipment?organizationId=${scope.organizationId}&branchId=${scope.branchId}`}>فهرست تجهیزات</Link>
    </section>
  </OperationalShell>;
}
