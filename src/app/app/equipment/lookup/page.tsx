import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState } from "@/components/empty-state";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";
import { updateEquipmentAction } from "@/app/app/actions";

type Search = Promise<{ organizationId?: string; branchId?: string; qr?: string; code?: string }>;

export default async function EquipmentLookupPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  if (!(await hasOperationalPermission(scope, "equipment.read"))) return <OperationalShell scope={scope} title="پروندهٔ تجهیز"><AccessDenied /></OperationalShell>;
  const key = (query.qr || query.code || "").trim();
  if (!key || key.length > 100) return <OperationalShell scope={scope} title="پروندهٔ تجهیز"><EmptyState title="شناسه وارد نشده">برای بازکردن پرونده، از اسکن QR یا کد دارایی در فهرست تجهیزات استفاده کنید.</EmptyState></OperationalShell>;
  const canManage = await hasOperationalPermission(scope, "equipment.manage");
  const equipment = await pool.query<{ id: string; asset_code: string; name: string; public_qr_id: string; category_id: string | null; category_name: string | null; manufacturer: string | null; model: string | null; serial_number: string | null; location: string | null; status: string; created_at: Date }>(
    `SELECT e.id, e.asset_code, e.name, e.public_qr_id, e.category_id, c.name AS category_name, e.manufacturer, e.model,
            e.serial_number, e.location, e.status, e.created_at
       FROM equipment e LEFT JOIN equipment_categories c ON c.id = e.category_id AND c.organization_id = e.organization_id
      WHERE e.organization_id = $1 AND e.branch_id = $2 AND (e.public_qr_id = $3 OR upper(e.asset_code) = upper($3)) LIMIT 1`,
    [scope.organizationId, scope.branchId, key],
  );
  const item = equipment.rows[0];
  if (!item) return <OperationalShell scope={scope} title="پروندهٔ تجهیز"><EmptyState title="تجهیز در این شعبه پیدا نشد">شناسه را بررسی کنید یا با مدیر شعبه دربارهٔ عضویت خود هماهنگ شوید.</EmptyState></OperationalShell>;
  const [qrData, history, inspections, categories] = await Promise.all([
    QRCode.toDataURL(item.public_qr_id, { margin: 1, width: 220, errorCorrectionLevel: "M" }),
    pool.query<{ previous_status: string | null; new_status: string; note: string | null; created_at: Date }>(
      "SELECT previous_status, new_status, note, created_at FROM equipment_status_events WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3 ORDER BY created_at DESC LIMIT 12",
      [scope.organizationId, scope.branchId, item.id]),
    pool.query<{ id: string; outcome: string; created_at: Date; inspector_name: string }>(
      `SELECT i.id, i.outcome, i.created_at, u.name AS inspector_name FROM inspections i JOIN users u ON u.id = i.inspector_id
        WHERE i.organization_id = $1 AND i.branch_id = $2 AND i.equipment_id = $3 ORDER BY i.created_at DESC LIMIT 8`,
      [scope.organizationId, scope.branchId, item.id]),
    canManage ? pool.query<{ id: string; name: string }>("SELECT id, name FROM equipment_categories WHERE organization_id = $1 ORDER BY name", [scope.organizationId]) : Promise.resolve({ rows: [] as { id: string; name: string }[] }),
  ]);
  const params = `organizationId=${scope.organizationId}&branchId=${scope.branchId}`;
  return <OperationalShell scope={scope} title="پروندهٔ تجهیز">
    <section className="panel equipment-card"><div><div className="section-heading"><div><span className="eyebrow">کد دارایی {item.asset_code}</span><h2>{item.name}</h2></div><span className="pill">{statusLabel(item.status)}</span></div><div className="equipment-meta">
      <Meta label="دسته‌بندی" value={item.category_name} /><Meta label="سازنده" value={item.manufacturer} /><Meta label="مدل" value={item.model} /><Meta label="سریال" value={item.serial_number} /><Meta label="موقعیت" value={item.location} /><Meta label="ثبت پرونده" value={formatBranchTime(item.created_at, scope.timezone)} />
    </div><div className="form-actions section-spaced"><Link className="button button-primary" href={`/app/inspections/new?equipmentId=${item.id}&${params}`}>ثبت بازرسی</Link><Link className="button button-secondary" href={`/app/scan?${params}`}>بازگشت به اسکن</Link></div></div>
      <div className="qr-block"><Image className="qr-image" src={qrData} width={160} height={160} unoptimized alt={`QR عمومی تجهیز ${item.asset_code}`} /><span>شناسهٔ تصادفی QR</span><code dir="ltr">{item.public_qr_id}</code></div>
    </section>
    {canManage && <section className="panel narrow-panel section-spaced"><h2>ویرایش مشخصات تجهیز</h2><form action={updateEquipmentAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><input type="hidden" name="equipmentId" value={item.id} /><label className="field-label">نام تجهیز<input name="name" required minLength={2} maxLength={120} defaultValue={item.name} /></label><label className="field-label">دسته‌بندی<select name="categoryId" defaultValue={item.category_id || ""}><option value="">بدون دسته‌بندی</option>{categories.rows.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="field-label">سازنده<input name="manufacturer" maxLength={100} defaultValue={item.manufacturer || ""} /></label><label className="field-label">مدل<input name="model" maxLength={100} defaultValue={item.model || ""} /></label><label className="field-label">شمارهٔ سریال<input name="serialNumber" maxLength={100} defaultValue={item.serial_number || ""} /></label><label className="field-label">موقعیت<input name="location" maxLength={200} defaultValue={item.location || ""} /></label><button className="button button-secondary" type="submit">ذخیرهٔ مشخصات</button></form></section>}
    <div className="dashboard-grid section-spaced"><section className="panel"><h2>بازرسی‌های اخیر</h2>{!inspections.rows.length ? <EmptyState title="بازرسی ثبت نشده">پس از ثبت بازرسی، سوابق اینجا نمایش داده می‌شوند.</EmptyState> : <ul className="dashboard-list">{inspections.rows.map((entry) => <li key={entry.id}><div><strong>{entry.outcome === "findings" ? "دارای مورد نامنطبق" : "بدون مورد نامنطبق ثبت‌شده"}</strong><span>{entry.inspector_name}</span></div><span>{formatBranchTime(entry.created_at, scope.timezone)}</span></li>)}</ul>}</section>
      <section className="panel"><h2>تاریخچهٔ وضعیت</h2>{!history.rows.length ? <EmptyState title="رویدادی در تاریخچه نیست">تغییر وضعیت تجهیز اینجا ثبت می‌شود.</EmptyState> : <ul className="asset-history">{history.rows.map((entry, index) => <li key={`${entry.created_at.toISOString()}-${index}`}><strong>{entry.previous_status ? `${statusLabel(entry.previous_status)} ← ` : ""}{statusLabel(entry.new_status)}</strong> · {formatBranchTime(entry.created_at, scope.timezone)}{entry.note && <span> — {entry.note}</span>}</li>)}</ul>}</section></div>
  </OperationalShell>;
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return <div><span>{label}</span><strong>{value || "ثبت نشده"}</strong></div>;
}
function statusLabel(status: string) { return ({ active: "فعال", inactive: "غیرفعال", maintenance: "در تعمیر", archived: "بایگانی" } as Record<string, string>)[status] || status; }
