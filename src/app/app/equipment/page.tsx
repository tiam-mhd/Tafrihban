import Link from "next/link";
import { pool } from "@/db";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { createCategoryAction, createEquipmentAction, updateCategoryAction, updateEquipmentStatusAction } from "@/app/app/actions";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission, hasOrganizationPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; error?: string; saved?: string }>;

export default async function EquipmentPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const canRead = await hasOperationalPermission(scope, "equipment.read");
  const canManage = await hasOperationalPermission(scope, "equipment.manage");
  const canManageCategories = await hasOrganizationPermission(scope, "equipment.manage");
  if (!canRead) return <OperationalShell scope={scope} title="تجهیزات"><AccessDenied /></OperationalShell>;
  const [equipment, categories] = await Promise.all([
    pool.query<{ id: string; asset_code: string; name: string; category_name: string | null; status: string; public_qr_id: string }>(
      `SELECT e.id, e.asset_code, e.name, c.name AS category_name, e.status, e.public_qr_id
         FROM equipment e LEFT JOIN equipment_categories c ON c.id = e.category_id AND c.organization_id = e.organization_id
        WHERE e.organization_id = $1 AND e.branch_id = $2 ORDER BY e.asset_code`, [scope.organizationId, scope.branchId]),
    pool.query<{ id: string; name: string; description: string | null }>("SELECT id, name, description FROM equipment_categories WHERE organization_id = $1 ORDER BY name", [scope.organizationId]),
  ]);
  const params = `organizationId=${scope.organizationId}&branchId=${scope.branchId}`;
  return <OperationalShell scope={scope} title="پروندهٔ تجهیزات">
    <FormNotice searchParams={query} />
    <section className="panel"><div className="section-heading"><div><h2>تجهیزات این شعبه</h2><p>کد QR فقط یک شناسهٔ تصادفی است؛ دسترسی به پرونده با عضویت و scope سرور کنترل می‌شود.</p></div><Link className="button button-secondary" href={`/app/scan?${params}`}>اسکن QR</Link></div>
      {!equipment.rows.length ? <EmptyState title="تجهیزی در این شعبه ثبت نشده">برای ساخت پرونده، از فرم پایین استفاده کنید.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>کد تجهیز</th><th>نام</th><th>دسته‌بندی</th><th>وضعیت</th><th>پرونده</th>{canManage && <th>تغییر وضعیت</th>}</tr></thead><tbody>{equipment.rows.map((item) => <tr key={item.id}><td dir="ltr">{item.asset_code}</td><td>{item.name}</td><td>{item.category_name || "—"}</td><td><span className={`pill ${item.status === "maintenance" ? "pill-warning" : ""}`}>{statusLabel(item.status)}</span></td><td><Link className="text-link" href={`/app/equipment/lookup?qr=${item.public_qr_id}&${params}`}>بازکردن</Link></td>{canManage && <td><form action={updateEquipmentStatusAction} className="inline-actions"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><input type="hidden" name="equipmentId" value={item.id} /><select name="status" defaultValue={item.status} aria-label={`وضعیت ${item.asset_code}`}><option value="active">فعال</option><option value="inactive">غیرفعال</option><option value="maintenance">در تعمیر</option><option value="archived">بایگانی</option></select><button className="link-button" type="submit">ثبت</button></form></td>}</tr>)}</tbody></table></div>}
    </section>
    {canManage && <div className="content-grid section-spaced"><section className="panel"><h2>ثبت تجهیز</h2><form action={createEquipmentAction} className="form-stack">
      <input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} />
      <label className="field-label">نام تجهیز<input name="name" required minLength={2} maxLength={120} /></label>
      <label className="field-label">کد دارایی<input name="assetCode" required maxLength={40} dir="ltr" /></label>
      <label className="field-label">دسته‌بندی<select name="categoryId"><option value="">بدون دسته‌بندی</option>{categories.rows.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="field-label">سازنده<input name="manufacturer" maxLength={100} /></label><label className="field-label">مدل<input name="model" maxLength={100} /></label>
      <label className="field-label">شمارهٔ سریال<input name="serialNumber" maxLength={100} /></label><label className="field-label">موقعیت در شعبه<input name="location" maxLength={200} /></label>
      <button className="button button-primary" type="submit">ساخت پرونده و QR</button>
    </form></section>{canManageCategories && <section className="panel"><h2>دسته‌بندی‌ها</h2><form action={createCategoryAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><label className="field-label">نام دسته‌بندی تازه<input name="name" required minLength={2} maxLength={80} /></label><label className="field-label">توضیح<textarea name="description" maxLength={300} rows={3} /></label><button className="button button-secondary" type="submit">ثبت دسته‌بندی</button></form>{categories.rows.map((category) => <form action={updateCategoryAction} className="form-stack category-editor" key={category.id}><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><input type="hidden" name="categoryId" value={category.id} /><label className="field-label">نام<input name="name" required minLength={2} maxLength={80} defaultValue={category.name} /></label><label className="field-label">توضیح<textarea name="description" maxLength={300} defaultValue={category.description || ""} /></label><button className="link-button" type="submit">ذخیرهٔ دسته‌بندی</button></form>)}</section>}</div>}
  </OperationalShell>;
}

function statusLabel(status: string) {
  return ({ active: "فعال", inactive: "غیرفعال", maintenance: "در تعمیر", archived: "بایگانی" } as Record<string, string>)[status] || status;
}
