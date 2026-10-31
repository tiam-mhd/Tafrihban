import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState } from "@/components/empty-state";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string }>;

export default async function DefectsPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  if (!(await hasOperationalPermission(scope, "defect.manage"))) return <OperationalShell scope={scope} title="عیب‌ها"><AccessDenied /></OperationalShell>;
  const defects = await pool.query<{ id: string; title: string; description: string; severity: string; status: string; asset_code: string; equipment_name: string; created_at: Date; reporter: string; work_order_id: string | null }>(
    `SELECT d.id, d.title, d.description, d.severity, d.status, e.asset_code, e.name AS equipment_name, d.created_at, u.name AS reporter, w.id AS work_order_id
       FROM defects d JOIN equipment e ON e.id = d.equipment_id AND e.organization_id = d.organization_id AND e.branch_id = d.branch_id
       JOIN users u ON u.id = d.reported_by LEFT JOIN work_orders w ON w.defect_id = d.id AND w.organization_id = d.organization_id AND w.branch_id = d.branch_id
      WHERE d.organization_id = $1 AND d.branch_id = $2 ORDER BY CASE d.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, d.created_at DESC LIMIT 150`, [scope.organizationId, scope.branchId]);
  return <OperationalShell scope={scope} title="عیب‌ها و اقدام اصلاحی">
    <section className="panel"><div className="section-heading"><div><h2>عیب‌های ثبت‌شده</h2><p>موارد نامنطبق بازرسی برای بررسی انسانی ثبت می‌شوند؛ سامانه دربارهٔ بهره‌برداری تصمیم نمی‌گیرد.</p></div></div>
      {!defects.rows.length ? <EmptyState title="عیبی ثبت نشده">اگر پاسخ موردی «مورد دارد» باشد، عیب برای پیگیری ساخته می‌شود.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>زمان</th><th>تجهیز</th><th>شرح عیب</th><th>اولویت</th><th>وضعیت</th><th>کار تعمیراتی</th></tr></thead><tbody>{defects.rows.map((item) => <tr key={item.id}><td>{formatBranchTime(item.created_at, scope.timezone)}</td><td><strong>{item.equipment_name}</strong><small dir="ltr">{item.asset_code}</small></td><td><strong>{item.title}</strong><small>{item.description}</small></td><td><span className={`pill ${item.severity === "critical" || item.severity === "high" ? "pill-danger" : "pill-warning"}`}>{severityLabel(item.severity)}</span></td><td>{statusLabel(item.status)}</td><td>{item.work_order_id ? "ساخته شده" : "نیازمند اقدام"}</td></tr>)}</tbody></table></div>}
    </section>
  </OperationalShell>;
}

function severityLabel(value: string) { return ({ low: "کم", medium: "متوسط", high: "زیاد", critical: "بحرانی" } as Record<string, string>)[value] || value; }
function statusLabel(value: string) { return ({ open: "باز", in_progress: "در حال رسیدگی", resolved: "رفع‌شده", closed: "بسته" } as Record<string, string>)[value] || value; }
