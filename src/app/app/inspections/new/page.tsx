import { pool } from "@/db";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState } from "@/components/empty-state";
import { InspectionForm } from "@/components/inspection-form";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; equipmentId?: string; checklistVersionId?: string; scheduleId?: string }>;

export default async function NewInspectionPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const allowed = await hasOperationalPermission(scope, "inspection.create");
  if (!allowed) return <OperationalShell scope={scope} title="ثبت بازرسی"><AccessDenied /></OperationalShell>;
  const [equipment, versions] = await Promise.all([
    pool.query<{ id: string; name: string; asset_code: string }>("SELECT id, name, asset_code FROM equipment WHERE organization_id = $1 AND branch_id = $2 AND status <> 'archived' ORDER BY asset_code", [scope.organizationId, scope.branchId]),
    pool.query<{ id: string; template_name: string; version: number }>(
      `SELECT v.id, t.name AS template_name, v.version FROM checklist_template_versions v JOIN checklist_templates t ON t.id = v.template_id AND t.organization_id = v.organization_id WHERE v.organization_id = $1 AND v.status = 'published' AND t.status = 'active' ORDER BY t.name, v.version DESC`, [scope.organizationId]),
  ]);
  let ready: { equipmentId: string; checklistVersionId: string; scheduleId?: string; questions: { id: string; prompt: string; guidance: string | null; required: boolean }[] } | null = null;
  if (query.equipmentId && query.checklistVersionId) {
    const chosenEquipment = equipment.rows.find((item) => item.id === query.equipmentId);
    const chosenVersion = versions.rows.find((item) => item.id === query.checklistVersionId);
    if (chosenEquipment && chosenVersion) {
      let scheduleAllowed = !query.scheduleId;
      if (query.scheduleId) {
        const schedule = await pool.query("SELECT id FROM inspection_schedules WHERE id = $1 AND organization_id = $2 AND branch_id = $3 AND equipment_id = $4 AND checklist_version_id = $5 AND is_active AND (assigned_user_id IS NULL OR assigned_user_id = $6)",
          [query.scheduleId, scope.organizationId, scope.branchId, chosenEquipment.id, chosenVersion.id, actor.id]);
        scheduleAllowed = Boolean(schedule.rowCount);
      }
      if (scheduleAllowed) {
        const questions = await pool.query<{ id: string; prompt: string; guidance: string | null; required: boolean }>(
          "SELECT id, prompt, guidance, required FROM checklist_questions WHERE organization_id = $1 AND template_version_id = $2 ORDER BY position", [scope.organizationId, chosenVersion.id]);
        if (questions.rows.length) ready = { equipmentId: chosenEquipment.id, checklistVersionId: chosenVersion.id, ...(query.scheduleId ? { scheduleId: query.scheduleId } : {}), questions: questions.rows };
      }
    }
  }
  return <OperationalShell scope={scope} title="ثبت بازرسی">
    {!ready ? <section className="panel narrow-panel"><h2>انتخاب تجهیز و نسخهٔ چک‌لیست</h2><p className="lede">برای بازرسی زمان‌بندی‌شده، از برنامهٔ بازرسی «شروع» را بزنید. اطلاعات این فرم ابتدا روی همین دستگاه ذخیره می‌شود و پس از تأیید سرور نهایی خواهد شد.</p>
      {!equipment.rows.length || !versions.rows.length ? <EmptyState title="اطلاعات لازم آماده نیست">برای شروع باید تجهیز فعال و نسخهٔ منتشرشدهٔ چک‌لیست داشته باشید.</EmptyState> : <form method="get" className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} />
        <label className="field-label">تجهیز<select name="equipmentId" required defaultValue={query.equipmentId || ""}><option value="" disabled>انتخاب کنید</option>{equipment.rows.map((item) => <option key={item.id} value={item.id}>{item.asset_code} · {item.name}</option>)}</select></label>
        <label className="field-label">چک‌لیست منتشرشده<select name="checklistVersionId" required defaultValue={query.checklistVersionId || ""}><option value="" disabled>انتخاب کنید</option>{versions.rows.map((item) => <option key={item.id} value={item.id}>{item.template_name} · نسخه {item.version}</option>)}</select></label>
        <button className="button button-primary" type="submit">بازکردن فرم بازرسی</button>
      </form>}
    </section> : <section className="panel"><p className="lede">بازرس: {actor.name} · شعبه: {scope.branchName}</p><InspectionForm input={{ organizationId: scope.organizationId, branchId: scope.branchId, equipmentId: ready.equipmentId, checklistVersionId: ready.checklistVersionId, ...(ready.scheduleId ? { scheduleId: ready.scheduleId } : {}) }} questions={ready.questions} accountId={actor.id} /></section>}
  </OperationalShell>;
}
