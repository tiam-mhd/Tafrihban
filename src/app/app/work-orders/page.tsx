import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { createWorkOrderAction, transitionWorkOrderAction } from "@/app/app/actions";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; error?: string; saved?: string }>;

export default async function WorkOrdersPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const canManage = await hasOperationalPermission(scope, "work_order.manage");
  const canClose = await hasOperationalPermission(scope, "work_order.close");
  if (!canManage && !canClose) return <OperationalShell scope={scope} title="کارهای تعمیراتی"><AccessDenied /></OperationalShell>;
  const [orders, defects, members] = await Promise.all([
    pool.query<{ id: string; title: string; equipment_name: string; asset_code: string; priority: string; status: string; due_at: Date | null; assignee: string | null; defect_title: string; completion_note: string | null }>(
      `SELECT w.id, w.title, e.name AS equipment_name, e.asset_code, w.priority, w.status, w.due_at, u.name AS assignee, d.title AS defect_title, w.completion_note
         FROM work_orders w JOIN equipment e ON e.id = w.equipment_id AND e.organization_id = w.organization_id AND e.branch_id = w.branch_id
         JOIN defects d ON d.id = w.defect_id AND d.organization_id = w.organization_id AND d.branch_id = w.branch_id
         LEFT JOIN users u ON u.id = w.assigned_to
        WHERE w.organization_id = $1 AND w.branch_id = $2 ORDER BY CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, w.due_at NULLS LAST, w.created_at DESC LIMIT 150`, [scope.organizationId, scope.branchId]),
    pool.query<{ id: string; title: string; asset_code: string; equipment_name: string }>(
      `SELECT d.id, d.title, e.asset_code, e.name AS equipment_name FROM defects d JOIN equipment e ON e.id = d.equipment_id AND e.organization_id = d.organization_id AND e.branch_id = d.branch_id
        WHERE d.organization_id = $1 AND d.branch_id = $2 AND d.status <> 'closed' AND NOT EXISTS (SELECT 1 FROM work_orders w WHERE w.defect_id = d.id AND w.organization_id = d.organization_id AND w.branch_id = d.branch_id)
        ORDER BY d.created_at`, [scope.organizationId, scope.branchId]),
    pool.query<{ id: string; name: string }>(
      `SELECT DISTINCT u.id, u.name FROM branch_memberships bm JOIN organization_memberships om ON om.id = bm.membership_id AND om.organization_id = bm.organization_id JOIN users u ON u.id = om.user_id WHERE bm.organization_id = $1 AND bm.branch_id = $2 AND bm.status = 'active' AND om.status = 'active' ORDER BY u.name`, [scope.organizationId, scope.branchId]),
  ]);
  return <OperationalShell scope={scope} title="کارهای تعمیراتی">
    <FormNotice searchParams={query} />
    <section className="panel"><div className="section-heading"><div><h2>کارهای این شعبه</h2><p>تکمیل کار نیازمند یادداشت مدرک است؛ بستن کار مرحلهٔ بازبینی جداگانه دارد.</p></div></div>
      {!orders.rows.length ? <EmptyState title="کار تعمیراتی ثبت نشده">برای هر عیب باز می‌توانید یک کار تعمیراتی بسازید.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>کار</th><th>تجهیز</th><th>مسئول</th><th>اولویت / موعد</th><th>وضعیت و اقدام</th></tr></thead><tbody>{orders.rows.map((order) => <tr key={order.id}><td><strong>{order.title}</strong><small>عیب: {order.defect_title}</small>{order.completion_note && <small>مدرک تکمیل: {order.completion_note}</small>}</td><td>{order.equipment_name}<small dir="ltr">{order.asset_code}</small></td><td>{order.assignee || "تخصیص‌نیافته"}</td><td>{priorityLabel(order.priority)}<small>{order.due_at ? formatBranchTime(order.due_at, scope.timezone) : "بدون موعد"}</small></td><td><span className="pill">{statusLabel(order.status)}</span>{canManage && nextStatus(order.status) && <form action={transitionWorkOrderAction} className="form-stack compact-form"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><input type="hidden" name="workOrderId" value={order.id} /><input type="hidden" name="nextStatus" value={nextStatus(order.status) ?? ""} />{order.status === "in_progress" && <label className="field-label">مدرک/یادداشت تکمیل<input name="note" required minLength={8} maxLength={2000} /></label>}{order.status !== "in_progress" && <input type="hidden" name="note" value="" />}<button className="link-button" type="submit">{transitionLabel(nextStatus(order.status)!)}</button></form>}{canClose && order.status === "completed" && <form action={transitionWorkOrderAction} className="compact-form"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><input type="hidden" name="workOrderId" value={order.id} /><input type="hidden" name="nextStatus" value="closed" /><input type="hidden" name="note" value="بازبینی و بستن" /><button className="link-button" type="submit">تأیید و بستن</button></form>}</td></tr>)}</tbody></table></div>}
    </section>
    {canManage && <section className="panel narrow-panel"><h2>ساخت کار از عیب باز</h2><form action={createWorkOrderAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} />
      <label className="field-label">عیب<select name="defectId" required defaultValue=""><option value="" disabled>انتخاب کنید</option>{defects.rows.map((defect) => <option key={defect.id} value={defect.id}>{defect.asset_code} · {defect.equipment_name} · {defect.title}</option>)}</select></label>
      <label className="field-label">مسئول<select name="assignedTo"><option value="">تخصیص‌نیافته</option>{members.rows.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <label className="field-label">اولویت<select name="priority"><option value="normal">معمولی</option><option value="low">کم</option><option value="high">زیاد</option><option value="urgent">فوری</option></select></label>
      <label className="field-label">موعد اختیاری، به وقت شعبه<input type="datetime-local" name="dueAt" /></label><label className="field-label">دستورکار<textarea name="instructions" rows={3} maxLength={2000} /></label>
      <button className="button button-primary" type="submit" disabled={!defects.rows.length}>ساخت کار تعمیراتی</button>
    </form></section>}
  </OperationalShell>;
}

function nextStatus(status: string): string | null { return ({ open: "accepted", accepted: "in_progress", in_progress: "completed" } as Record<string, string>)[status] || null; }
function transitionLabel(status: string) { return ({ accepted: "پذیرش کار", in_progress: "شروع رسیدگی", completed: "ثبت تکمیل", closed: "بستن کار" } as Record<string, string>)[status] || status; }
function statusLabel(status: string) { return ({ open: "باز", accepted: "پذیرفته‌شده", in_progress: "در حال رسیدگی", completed: "تکمیل‌شده برای بازبینی", closed: "بسته" } as Record<string, string>)[status] || status; }
function priorityLabel(priority: string) { return ({ low: "کم", normal: "معمولی", high: "زیاد", urgent: "فوری" } as Record<string, string>)[priority] || priority; }
