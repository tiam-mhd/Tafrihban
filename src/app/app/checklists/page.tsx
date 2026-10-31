import { pool } from "@/db";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { createChecklistAction, createChecklistVersionAction } from "@/app/app/actions";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission, hasOrganizationPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; error?: string; saved?: string }>;

export default async function ChecklistsPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const canRead = await hasOperationalPermission(scope, "checklist.read");
  const canManage = await hasOrganizationPermission(scope, "checklist.manage");
  if (!canRead) return <OperationalShell scope={scope} title="چک‌لیست‌ها"><AccessDenied /></OperationalShell>;
  const templates = await pool.query<{ id: string; template_id: string; name: string; description: string | null; version: number; question_count: string; published_at: Date | null }>(
    `SELECT t.id AS template_id, t.name, t.description, v.version, count(q.id)::text AS question_count, v.published_at
       FROM checklist_templates t JOIN checklist_template_versions v ON v.template_id = t.id AND v.organization_id = t.organization_id
       LEFT JOIN checklist_questions q ON q.template_version_id = v.id AND q.organization_id = v.organization_id
      WHERE t.organization_id = $1 AND t.status = 'active' AND v.status = 'published'
      GROUP BY t.id, t.name, t.description, v.version, v.published_at ORDER BY t.name, v.version DESC`, [scope.organizationId],
  );
  return <OperationalShell scope={scope} title="چک‌لیست‌های نسخه‌دار">
    <FormNotice searchParams={query} />
    <section className="panel"><div className="section-heading"><div><h2>نسخه‌های منتشرشده</h2><p>بازرسی‌های پیشین به همان نسخهٔ چک‌لیستی که هنگام ثبت استفاده شده متصل می‌مانند.</p></div></div>
      {!templates.rows.length ? <EmptyState title="چک‌لیست منتشرشده‌ای ندارید">با ایجاد اولین چک‌لیست، می‌توانید آن را به برنامهٔ بازرسی وصل کنید.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>عنوان</th><th>نسخه</th><th>موارد</th><th>توضیح</th></tr></thead><tbody>{templates.rows.map((row) => <tr key={`${row.template_id}-${row.version}`}><td><strong>{row.name}</strong></td><td>{row.version}</td><td>{row.question_count}</td><td>{row.description || "—"}</td></tr>)}</tbody></table></div>}
    </section>
    {canManage && <section className="panel narrow-panel"><h2>چک‌لیست و نسخهٔ نخست</h2><p className="form-note">برای تغییر موارد، یک چک‌لیست تازه بسازید؛ ویرایش نسخهٔ منتشرشده سوابق را تغییر نمی‌دهد.</p><form action={createChecklistAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><label className="field-label">عنوان<input name="name" required minLength={2} maxLength={120} /></label><label className="field-label">توضیح<textarea name="description" maxLength={500} rows={2} /></label><label className="field-label">موارد بازرسی، هر مورد در یک خط<textarea name="questions" required minLength={2} maxLength={16000} rows={8} placeholder="مثلاً وضعیت حفاظ‌ها&#10;بررسی نشانه‌های نشت" /></label><button className="button button-primary" type="submit">انتشار نسخهٔ ۱</button></form></section>}
    {canManage && templates.rows.length > 0 && <section className="panel narrow-panel"><h2>انتشار نسخهٔ تازه</h2><p className="form-note">نسخهٔ قبلی و سوابق آن بدون تغییر باقی می‌ماند.</p><form action={createChecklistVersionAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><label className="field-label">چک‌لیست<select name="templateId" required defaultValue=""><option value="" disabled>انتخاب کنید</option>{[...new Map(templates.rows.map((row) => [row.template_id, row.name])).entries()].map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><label className="field-label">توضیح تغییر<input name="changeNote" maxLength={300} /></label><label className="field-label">موارد این نسخه، هر مورد در یک خط<textarea name="questions" required rows={7} maxLength={16000} /></label><button className="button button-primary" type="submit">انتشار نسخهٔ بعدی</button></form></section>}
  </OperationalShell>;
}
