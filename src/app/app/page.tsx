import Link from "next/link";
import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";
import { OperationalShell } from "@/components/operational-shell";
import { SyncQueuePanel } from "@/components/sync-queue-panel";
import { EmptyState } from "@/components/empty-state";

type Search = Promise<{ organizationId?: string; branchId?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  if (!(await hasOperationalPermission(scope, "dashboard.read"))) return <OperationalShell scope={scope} title="نمای امروز"><EmptyState title="دسترسی لازم وجود ندارد">برای دیدن اطلاعات این شعبه، از مدیر مجموعه بخواهید نقش مناسب را به عضویت شما بدهد.</EmptyState></OperationalShell>;
  const [equipment, overdue, defects, workOrders, dueTasks, recent] = await Promise.all([
    pool.query<{ count: string }>("SELECT count(*)::text AS count FROM equipment WHERE organization_id = $1 AND branch_id = $2 AND status <> 'archived'", [scope.organizationId, scope.branchId]),
    pool.query<{ count: string }>("SELECT count(*)::text AS count FROM inspection_schedules WHERE organization_id = $1 AND branch_id = $2 AND is_active AND next_due_at < now()", [scope.organizationId, scope.branchId]),
    pool.query<{ count: string }>("SELECT count(*)::text AS count FROM defects WHERE organization_id = $1 AND branch_id = $2 AND status IN ('open', 'in_progress')", [scope.organizationId, scope.branchId]),
    pool.query<{ count: string }>("SELECT count(*)::text AS count FROM work_orders WHERE organization_id = $1 AND branch_id = $2 AND status NOT IN ('closed', 'completed')", [scope.organizationId, scope.branchId]),
    pool.query<{ id: string; name: string; asset_code: string; next_due_at: Date }>(
      `SELECT s.id, e.name, e.asset_code, s.next_due_at FROM inspection_schedules s
         JOIN equipment e ON e.id = s.equipment_id AND e.organization_id = s.organization_id
        WHERE s.organization_id = $1 AND s.branch_id = $2 AND s.is_active
        ORDER BY s.next_due_at ASC LIMIT 5`, [scope.organizationId, scope.branchId]),
    pool.query<{ action: string; entity_type: string; created_at: Date }>(
      `SELECT action, entity_type, created_at FROM audit_events
        WHERE organization_id = $1 AND branch_id = $2 ORDER BY created_at DESC LIMIT 6`,
      [scope.organizationId, scope.branchId]),
  ]);
  const count = (result: { rows: { count: string }[] }) => Number(result.rows[0]?.count || 0);
  return <OperationalShell scope={scope} title="نمای امروز">
    <div className="section-heading"><div><span className="eyebrow">خلاصهٔ محدودهٔ مجاز</span><p>این داشبورد اطلاعات شعبهٔ فعال شما را نشان می‌دهد.</p></div><Link className="button button-secondary" href={`/app/scan?organizationId=${scope.organizationId}&branchId=${scope.branchId}`}>اسکن یا جست‌وجوی تجهیز</Link></div>
    <div className="stats-grid">
      <article className="stat-card"><span>تجهیزات ثبت‌شده</span><strong>{count(equipment)}</strong><small>در این شعبه</small></article>
      <article className="stat-card"><span>بازرسی‌های عقب‌افتاده</span><strong>{count(overdue)}</strong><small>نیازمند برنامه‌ریزی انسانی</small></article>
      <article className="stat-card"><span>عیب‌های باز</span><strong>{count(defects)}</strong><small>باز یا در حال رسیدگی</small></article>
      <article className="stat-card"><span>کارهای تعمیراتی</span><strong>{count(workOrders)}</strong><small>به‌جز تکمیل‌شده و بسته</small></article>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="section-heading"><div><h2>موعدهای نزدیک</h2><p>چک‌لیست‌های برنامه‌ریزی‌شده در همین شعبه</p></div><Link className="text-link" href={`/app/schedules?organizationId=${scope.organizationId}&branchId=${scope.branchId}`}>همهٔ برنامه‌ها</Link></div>
        {!dueTasks.rows.length ? <EmptyState title="برنامه‌ای ثبت نشده">از بخش برنامهٔ بازرسی، یک چک‌لیست منتشرشده را به تجهیز اختصاص دهید.</EmptyState> : <ul className="dashboard-list">{dueTasks.rows.map((item) => <li key={item.id}><div><strong>{item.name} <small>({item.asset_code})</small></strong><span>موعد: {formatBranchTime(item.next_due_at, scope.timezone)}</span></div><span className={item.next_due_at < new Date() ? "pill pill-warning" : "pill pill-teal"}>{item.next_due_at < new Date() ? "عقب‌افتاده" : "برنامه‌ریزی‌شده"}</span></li>)}</ul>}
      </section>
      <section className="panel"><div className="section-heading"><div><h2>رخدادهای اخیر</h2><p>تغییرهای ثبت‌شده در این شعبه</p></div><Link className="text-link" href={`/app/audit?organizationId=${scope.organizationId}&branchId=${scope.branchId}`}>دفتر حسابرسی</Link></div>
        {!recent.rows.length ? <EmptyState title="هنوز رخدادی نیست">پس از انجام عملیات، سابقهٔ آن در اینجا نمایش داده می‌شود.</EmptyState> : <ul className="dashboard-list">{recent.rows.map((item, index) => <li key={`${item.action}-${index}`}><div><strong>{humanAction(item.action)}</strong><span>{humanEntity(item.entity_type)}</span></div><span>{formatBranchTime(item.created_at, scope.timezone)}</span></li>)}</ul>}
      </section>
    </div>
    <SyncQueuePanel accountId={actor.id} />
  </OperationalShell>;
}

function humanAction(action: string): string {
  const labels: Record<string, string> = { "inspection.submitted": "بازرسی ثبت شد", "defect.created_from_inspection": "عیب از بازرسی ایجاد شد", "work_order.created": "کار تعمیراتی ساخته شد", "work_order.completed": "کار تکمیل شد", "work_order.closed": "کار بسته شد", "equipment.created": "تجهیز ثبت شد", "equipment.status_changed": "وضعیت تجهیز تغییر کرد" };
  return labels[action] || "عملیات ثبت‌شده";
}

function humanEntity(entity: string): string {
  const labels: Record<string, string> = { inspection: "بازرسی", defect: "عیب", work_order: "کار تعمیراتی", equipment: "تجهیز" };
  return labels[entity] || "سابقه";
}
