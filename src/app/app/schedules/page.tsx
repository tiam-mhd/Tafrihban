import Link from "next/link";
import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { createScheduleAction } from "@/app/app/actions";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; error?: string; saved?: string }>;

export default async function SchedulesPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const canRead = await hasOperationalPermission(scope, "checklist.read");
  const canManage = await hasOperationalPermission(scope, "inspection_schedule.manage");
  if (!canRead) return <OperationalShell scope={scope} title="برنامهٔ بازرسی"><AccessDenied /></OperationalShell>;
  const [schedules, equipment, versions, members] = await Promise.all([
    pool.query<{ id: string; equipment_id: string; checklist_version_id: string; equipment_name: string; asset_code: string; checklist_name: string; version: number; due_at: Date; frequency: string; assignee: string | null }>(
      `SELECT s.id, s.equipment_id, s.checklist_version_id, e.name AS equipment_name, e.asset_code, t.name AS checklist_name, v.version, s.next_due_at AS due_at, s.frequency, u.name AS assignee
         FROM inspection_schedules s JOIN equipment e ON e.id = s.equipment_id AND e.organization_id = s.organization_id
         JOIN checklist_template_versions v ON v.id = s.checklist_version_id AND v.organization_id = s.organization_id
         JOIN checklist_templates t ON t.id = v.template_id AND t.organization_id = v.organization_id
         LEFT JOIN users u ON u.id = s.assigned_user_id
        WHERE s.organization_id = $1 AND s.branch_id = $2 AND s.is_active ORDER BY s.next_due_at`, [scope.organizationId, scope.branchId]),
    pool.query<{ id: string; name: string; asset_code: string }>("SELECT id, name, asset_code FROM equipment WHERE organization_id = $1 AND branch_id = $2 AND status <> 'archived' ORDER BY asset_code", [scope.organizationId, scope.branchId]),
    pool.query<{ id: string; title: string; version: number }>(
      `SELECT v.id, t.name AS title, v.version FROM checklist_template_versions v JOIN checklist_templates t ON t.id = v.template_id AND t.organization_id = v.organization_id WHERE v.organization_id = $1 AND v.status = 'published' ORDER BY t.name, v.version DESC`, [scope.organizationId]),
    pool.query<{ id: string; name: string }>(
      `SELECT DISTINCT u.id, u.name FROM branch_memberships bm JOIN organization_memberships om ON om.id = bm.membership_id AND om.organization_id = bm.organization_id JOIN users u ON u.id = om.user_id WHERE bm.organization_id = $1 AND bm.branch_id = $2 AND bm.status = 'active' AND om.status = 'active' ORDER BY u.name`, [scope.organizationId, scope.branchId]),
  ]);
  const params = `organizationId=${scope.organizationId}&branchId=${scope.branchId}`;
  return <OperationalShell scope={scope} title="برنامهٔ بازرسی">
    <FormNotice searchParams={query} />
    <section className="panel"><div className="section-heading"><div><h2>موعدهای فعال</h2><p>موعدها راهنمای برنامه‌ریزی هستند؛ نتیجهٔ بازرسی تصمیم ایمنی صادر نمی‌کند.</p></div><Link className="button button-secondary" href={`/app/inspections?${params}`}>بازرسی‌های ثبت‌شده</Link></div>
      {!schedules.rows.length ? <EmptyState title="برنامه‌ای ثبت نشده">تجهیز، چک‌لیست منتشرشده و موعد بعدی را انتخاب کنید.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>تجهیز</th><th>چک‌لیست</th><th>تناوب</th><th>موعد بعدی</th><th>مسئول</th><th>شروع</th></tr></thead><tbody>{schedules.rows.map((row) => <tr key={row.id}><td><strong>{row.equipment_name}</strong><small dir="ltr">{row.asset_code}</small></td><td>{row.checklist_name} · نسخه {row.version}</td><td>{frequencyLabel(row.frequency)}</td><td>{formatBranchTime(row.due_at, scope.timezone)}</td><td>{row.assignee || "بدون مسئول مشخص"}</td><td><Link className="text-link" href={`/app/inspections/new?equipmentId=${row.equipment_id}&checklistVersionId=${row.checklist_version_id}&scheduleId=${row.id}&${params}`}>شروع</Link></td></tr>)}</tbody></table></div>}
    </section>
    {canManage && <section className="panel narrow-panel"><h2>برنامهٔ تازه</h2><form action={createScheduleAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} />
      <label className="field-label">تجهیز<select name="equipmentId" required defaultValue=""><option value="" disabled>انتخاب کنید</option>{equipment.rows.map((item) => <option key={item.id} value={item.id}>{item.asset_code} · {item.name}</option>)}</select></label>
      <label className="field-label">نسخهٔ منتشرشدهٔ چک‌لیست<select name="checklistVersionId" required defaultValue=""><option value="" disabled>انتخاب کنید</option>{versions.rows.map((item) => <option key={item.id} value={item.id}>{item.title} · نسخه {item.version}</option>)}</select></label>
      <label className="field-label">مسئول اختیاری<select name="assignedUserId"><option value="">بدون مسئول مشخص</option>{members.rows.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <label className="field-label">تناوب<select name="frequency"><option value="daily">روزانه</option><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option><option value="custom">فاصلهٔ دلخواه</option></select></label>
      <label className="field-label">تعداد روز، فقط برای فاصلهٔ دلخواه<input type="number" name="intervalDays" min={1} max={3650} /></label>
      <label className="field-label">موعد نخست (زمان محلی این شعبه)<input type="datetime-local" name="dueAt" required /></label>
      <button className="button button-primary" type="submit" disabled={!equipment.rows.length || !versions.rows.length}>ثبت برنامه</button>
      {(!equipment.rows.length || !versions.rows.length) && <p className="form-note">ابتدا یک تجهیز و یک نسخهٔ چک‌لیست منتشرشده بسازید.</p>}
    </form></section>}
  </OperationalShell>;
}

function frequencyLabel(value: string) { return ({ daily: "روزانه", weekly: "هفتگی", monthly: "ماهانه", custom: "دلخواه" } as Record<string, string>)[value] || value; }
