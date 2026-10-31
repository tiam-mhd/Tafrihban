import Link from "next/link";
import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState } from "@/components/empty-state";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string }>;

export default async function InspectionsPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const canRead = await hasOperationalPermission(scope, "inspection.read");
  const canCreate = await hasOperationalPermission(scope, "inspection.create");
  if (!canRead && !canCreate) return <OperationalShell scope={scope} title="بازرسی‌ها"><AccessDenied /></OperationalShell>;
  const rows = canRead ? await pool.query<{ id: string; equipment_name: string; asset_code: string; inspector_name: string; outcome: string; created_at: Date; notes: string | null }>(
    `SELECT i.id, e.name AS equipment_name, e.asset_code, u.name AS inspector_name, i.outcome, i.created_at, i.notes
       FROM inspections i JOIN equipment e ON e.id = i.equipment_id AND e.organization_id = i.organization_id AND e.branch_id = i.branch_id
       JOIN users u ON u.id = i.inspector_id
      WHERE i.organization_id = $1 AND i.branch_id = $2 ORDER BY i.created_at DESC LIMIT 100`, [scope.organizationId, scope.branchId]) : { rows: [] };
  const params = `organizationId=${scope.organizationId}&branchId=${scope.branchId}`;
  return <OperationalShell scope={scope} title="بازرسی‌ها">
    <section className="panel"><div className="section-heading"><div><h2>سوابق این شعبه</h2><p>«بدون مورد نامنطبق ثبت‌شده» به معنی تأیید ایمنی یا مجوز بهره‌برداری نیست.</p></div>{canCreate && <Link className="button button-primary" href={`/app/inspections/new?${params}`}>ثبت بازرسی</Link>}</div>
      {!rows.rows.length ? <EmptyState title="بازرسی ثبت نشده">پس از ثبت بازرسی آنلاین، سابقهٔ سرور اینجا نمایش داده می‌شود.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>زمان شعبه</th><th>تجهیز</th><th>بازرس</th><th>نتیجهٔ ثبت</th><th>یادداشت / جزئیات</th></tr></thead><tbody>{rows.rows.map((row) => <tr key={row.id}><td>{formatBranchTime(row.created_at, scope.timezone)}</td><td><strong>{row.equipment_name}</strong><small dir="ltr">{row.asset_code}</small></td><td>{row.inspector_name}</td><td><span className={`pill ${row.outcome === "findings" ? "pill-warning" : "pill-teal"}`}>{row.outcome === "findings" ? "دارای مورد نامنطبق" : "بدون مورد نامنطبق"}</span></td><td>{row.notes || "—"}<small><Link className="text-link" href={`/app/inspections/${row.id}?organizationId=${scope.organizationId}&branchId=${scope.branchId}`}>مشاهدهٔ پاسخ‌ها و پیوست‌ها</Link></small></td></tr>)}</tbody></table></div>}
    </section>
  </OperationalShell>;
}
