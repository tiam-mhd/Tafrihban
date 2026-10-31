import { pool } from "@/db";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { createBranchAction, updateBranchAction } from "@/app/app/actions";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission, hasOrganizationPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; error?: string; saved?: string }>;

export default async function BranchesPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  if (!(await hasOperationalPermission(scope, "branch.manage"))) return <OperationalShell scope={scope} title="شعبه‌ها"><AccessDenied /></OperationalShell>;
  const canManageOrganization = await hasOrganizationPermission(scope, "branch.manage");
  const branches = await pool.query<{ id: string; name: string; code: string; address: string | null; timezone: string; status: string }>(
    "SELECT id, name, code, address, timezone, status FROM branches WHERE organization_id = $1 AND ($2::boolean OR id = $3) ORDER BY name", [scope.organizationId, canManageOrganization, scope.branchId],
  );
  return <OperationalShell scope={scope} title="شعبه‌های مجموعه">
    <FormNotice searchParams={query} />
    <section className="panel">
      <div className="section-heading"><div><h2>شعبه‌های ثبت‌شده</h2><p>مدیرانی که نقش سازمانی دارند به‌طور خودکار به شعبهٔ تازه دسترسی می‌گیرند.</p></div></div>
      {!branches.rows.length ? <EmptyState title="شعبه‌ای ثبت نشده">برای شروع، شعبهٔ فعلی را در سطح پلتفرم یا از این فرم ایجاد کنید.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>نام</th><th>کد</th><th>منطقهٔ زمانی</th><th>وضعیت</th></tr></thead><tbody>{branches.rows.map((branch) => <tr key={branch.id}><td>{branch.name}</td><td dir="ltr">{branch.code}</td><td dir="ltr">{branch.timezone}</td><td><span className="pill">{branch.status === "active" ? "فعال" : branch.status}</span></td></tr>)}</tbody></table></div>}
    </section>
    {canManageOrganization && <section className="panel narrow-panel"><h2>ایجاد شعبه</h2><form action={createBranchAction} className="form-stack">
      <input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} />
      <label className="field-label">نام شعبه<input name="name" required minLength={2} maxLength={120} /></label>
      <label className="field-label">کد یکتا<input name="code" required minLength={2} maxLength={20} dir="ltr" /></label>
      <label className="field-label">نشانی اختیاری<input name="address" maxLength={500} /></label>
      <label className="field-label">منطقهٔ زمانی IANA<input name="timezone" defaultValue={scope.timezone} required /></label>
      <button className="button button-primary" type="submit">ثبت شعبه</button>
    </form></section>}
    <section className="panel narrow-panel"><h2>ویرایش شعبهٔ فعال</h2><form action={updateBranchAction} className="form-stack">
      <input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} />
      <label className="field-label">نام<input name="name" required minLength={2} maxLength={120} defaultValue={scope.branchName} /></label>
      <label className="field-label">نشانی<input name="address" maxLength={500} defaultValue={branches.rows.find((branch) => branch.id === scope.branchId)?.address || ""} /></label>
      <label className="field-label">منطقهٔ زمانی<input name="timezone" required defaultValue={scope.timezone} /></label>
      <button className="button button-secondary" type="submit">ذخیرهٔ شعبهٔ فعال</button>
    </form><p className="form-note">ویرایش فقط برای همین شعبهٔ فعال انجام می‌شود.</p></section>
  </OperationalShell>;
}
