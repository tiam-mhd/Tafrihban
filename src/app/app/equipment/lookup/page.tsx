import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState } from "@/components/empty-state";
import { EquipmentEditDialog, type EquipmentEditableRecord } from "@/components/equipment/equipment-item-actions";
import { UiIcon } from "@/components/ui-icon";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; qr?: string; code?: string }>;
type EquipmentDetail = EquipmentEditableRecord & {
  public_qr_id: string;
  category_name: string | null;
  category_status: string | null;
  created_at: Date;
  updated_at: Date;
};

export default async function EquipmentLookupPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  if (!(await hasOperationalPermission(scope, "equipment.read"))) return <OperationalShell scope={scope} title="پروندهٔ تجهیز"><AccessDenied /></OperationalShell>;
  const key = (query.qr || query.code || "").trim();
  if (!key || key.length > 100) return <OperationalShell scope={scope} title="پروندهٔ تجهیز"><EmptyState title="شناسه وارد نشده">برای بازکردن پرونده، از اسکن QR یا کد دارایی در فهرست تجهیزات استفاده کنید.</EmptyState></OperationalShell>;

  const [equipment, canManage, canInspect] = await Promise.all([
    pool.query<EquipmentDetail>(
      `SELECT e.id, e.asset_code, e.name, e.public_qr_id, e.category_id, c.name AS category_name, c.status AS category_status,
              e.manufacturer, e.model, e.serial_number, e.location, e.status, e.created_at, e.updated_at
         FROM equipment e LEFT JOIN equipment_categories c ON c.id = e.category_id AND c.organization_id = e.organization_id
        WHERE e.organization_id = $1 AND e.branch_id = $2 AND (e.public_qr_id = $3 OR upper(e.asset_code) = upper($3)) LIMIT 1`,
      [scope.organizationId, scope.branchId, key],
    ),
    hasOperationalPermission(scope, "equipment.manage"),
    hasOperationalPermission(scope, "inspection.create"),
  ]);
  const item = equipment.rows[0];
  if (!item) return <OperationalShell scope={scope} title="پروندهٔ تجهیز"><EmptyState title="تجهیز در این شعبه پیدا نشد">شناسه را بررسی کنید یا با مدیر شعبه دربارهٔ عضویت خود هماهنگ شوید.</EmptyState></OperationalShell>;

  const [qrData, history, inspections, metrics, categories] = await Promise.all([
    QRCode.toDataURL(item.public_qr_id, { margin: 1, width: 240, errorCorrectionLevel: "M" }),
    pool.query<{ previous_status: string | null; new_status: string; note: string | null; created_at: Date }>(
      `SELECT previous_status, new_status, note, created_at FROM equipment_status_events
        WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3 ORDER BY created_at DESC LIMIT 12`,
      [scope.organizationId, scope.branchId, item.id]),
    pool.query<{ id: string; outcome: string; created_at: Date; inspector_name: string; notes: string | null }>(
      `SELECT i.id, i.outcome, i.created_at, u.name AS inspector_name, i.notes
         FROM inspections i JOIN users u ON u.id = i.inspector_id
        WHERE i.organization_id = $1 AND i.branch_id = $2 AND i.equipment_id = $3 ORDER BY i.created_at DESC LIMIT 6`,
      [scope.organizationId, scope.branchId, item.id]),
    pool.query<{ inspections: number; defects: number; open_work_orders: number; schedules: number }>(
      `SELECT
         (SELECT count(*)::int FROM inspections WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3) AS inspections,
         (SELECT count(*)::int FROM defects WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3) AS defects,
         (SELECT count(*)::int FROM work_orders WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3 AND status NOT IN ('completed', 'closed')) AS open_work_orders,
         (SELECT count(*)::int FROM inspection_schedules WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3 AND is_active) AS schedules`,
      [scope.organizationId, scope.branchId, item.id]),
    canManage ? pool.query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM equipment_categories WHERE organization_id = $1
        AND (status = 'active' OR id = $2) ORDER BY status, name`, [scope.organizationId, item.category_id],
    ) : Promise.resolve({ rows: [] as { id: string; name: string; status: string }[] }),
  ]);
  const counts = metrics.rows[0]!;
  const scopeParams = new URLSearchParams({ organizationId: scope.organizationId, branchId: scope.branchId });

  return <OperationalShell
    scope={scope}
    title="پروندهٔ تجهیز"
    description={`شناسهٔ دارایی ${item.asset_code} · اطلاعات و سوابق ثبت‌شده در ${scope.branchName}`}
    headerActions={<div className="detail-header-actions">
      {canManage && item.status !== "archived" && <EquipmentEditDialog item={item} categories={categories.rows} organizationId={scope.organizationId} branchId={scope.branchId} prominent />}
      {canInspect && item.status !== "archived" && <Link className="button button-primary" href={`/app/inspections/new?equipmentId=${item.id}&${scopeParams}`}><UiIcon name="plus" /> ثبت بازرسی</Link>}
      <Link className="button button-quiet" href={`/app/equipment?${scopeParams}`}><UiIcon name="category" /> فهرست تجهیزات</Link>
    </div>}
  >
    <div className="asset-detail-page">
      <section className="asset-detail-hero panel">
        <div className="asset-detail-identity">
          <span className="asset-detail-mark"><UiIcon name="scan" size={26} /></span>
          <div><span className="eyebrow">کد دارایی · <bdi dir="ltr">{item.asset_code}</bdi></span><h2>{item.name}</h2><p>پروندهٔ این تجهیز در محدودهٔ انتخاب‌شده نگهداری می‌شود.</p></div>
          <span className={`pill ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
        </div>
        <div className="asset-detail-qr">
          <Image className="asset-qr-image" src={qrData} width={152} height={152} unoptimized alt={`کد QR تجهیز ${item.asset_code}`} />
          <span>QR پرونده</span><code dir="ltr">{item.public_qr_id}</code>
        </div>
      </section>

      {item.status === "archived" && <p className="notice notice-warning" role="status">این پرونده بایگانی شده است. سوابق آن برای حفظ تاریخچه در دسترس باقی مانده‌اند.</p>}

      <section className="asset-metric-grid" aria-label="خلاصهٔ سوابق تجهیز">
        <Metric icon="calendar" label="بازرسی ثبت‌شده" value={counts.inspections} />
        <Metric icon="filter" label="عیب ثبت‌شده" value={counts.defects} />
        <Metric icon="archive" label="کار تعمیراتی باز" value={counts.open_work_orders} />
        <Metric icon="scan" label="برنامهٔ فعال" value={counts.schedules} />
      </section>

      <section className="panel asset-spec-panel">
        <div className="asset-panel-heading"><div><span className="eyebrow">مشخصات اصلی</span><h2>اطلاعات پرونده</h2></div><span className="asset-panel-note">آخرین به‌روزرسانی: {formatBranchTime(item.updated_at, scope.timezone)}</span></div>
        <div className="asset-spec-grid">
          <Detail label="نام تجهیز" value={item.name} icon="scan" />
          <Detail label="کد دارایی" value={item.asset_code} ltr icon="category" />
          <Detail label="دسته‌بندی" value={item.category_name ? `${item.category_name}${item.category_status === "archived" ? " · بایگانی‌شده" : ""}` : "بدون دسته‌بندی"} icon="category" />
          <Detail label="سازنده" value={item.manufacturer} icon="category" />
          <Detail label="مدل" value={item.model} icon="category" />
          <Detail label="شمارهٔ سریال" value={item.serial_number} ltr icon="category" />
          <Detail label="موقعیت در شعبه" value={item.location} icon="pin" />
          <Detail label="زمان ساخت پرونده" value={formatBranchTime(item.created_at, scope.timezone)} icon="calendar" />
        </div>
      </section>

      <div className="asset-history-grid">
        <section className="panel asset-timeline-panel">
          <div className="asset-panel-heading"><div><span className="eyebrow">سوابق انسانی</span><h2>بازرسی‌های اخیر</h2></div><span className="asset-count-badge">{counts.inspections.toLocaleString("fa-IR")}</span></div>
          {!inspections.rows.length ? <EmptyState title="بازرسی ثبت نشده">پس از ثبت بازرسی، نتیجه و تاریخ آن در این بخش می‌آید.</EmptyState> : <ol className="asset-timeline">{inspections.rows.map((inspection) => <li key={inspection.id}>
            <span className={`timeline-marker ${inspection.outcome === "findings" ? "timeline-marker-warning" : ""}`} />
            <div><div className="timeline-title-row"><strong>{inspection.outcome === "findings" ? "دارای مورد نامنطبق" : "بدون مورد نامنطبق ثبت‌شده"}</strong><span className={`pill ${inspection.outcome === "findings" ? "pill-warning" : "pill-teal"}`}>{inspection.outcome === "findings" ? "نیازمند پیگیری" : "ثبت‌شده"}</span></div><p>{inspection.inspector_name}{inspection.notes ? ` · ${inspection.notes}` : ""}</p><time>{formatBranchTime(inspection.created_at, scope.timezone)}</time></div>
            <Link className="icon-link" href={`/app/inspections/${inspection.id}?${scopeParams}`} aria-label="مشاهدهٔ جزئیات بازرسی"><UiIcon name="eye" /></Link>
          </li>)}</ol>}
        </section>
        <section className="panel asset-timeline-panel">
          <div className="asset-panel-heading"><div><span className="eyebrow">تغییرات ثبت‌شده</span><h2>تاریخچهٔ وضعیت</h2></div><span className="asset-count-badge">{history.rows.length.toLocaleString("fa-IR")}</span></div>
          {!history.rows.length ? <EmptyState title="تغییری در وضعیت ثبت نشده">تغییرهای بعدی وضعیت با کاربر و زمان در اینجا ثبت می‌شوند.</EmptyState> : <ol className="asset-timeline">{history.rows.map((entry, index) => <li key={`${entry.created_at.toISOString()}-${index}`}>
            <span className="timeline-marker" /><div><strong>{entry.previous_status ? `${statusLabel(entry.previous_status)} ← ` : "وضعیت آغازین · "}{statusLabel(entry.new_status)}</strong><p>{entry.note || "ثبت تغییر وضعیت"}</p><time>{formatBranchTime(entry.created_at, scope.timezone)}</time></div>
          </li>)}</ol>}
        </section>
      </div>
      <p className="asset-safety-note">این صفحه پرونده و سوابق ثبت‌شده را نمایش می‌دهد؛ تصمیم بهره‌برداری و ارزیابی ایمنی با متخصص انسانی مجموعه است.</p>
    </div>
  </OperationalShell>;
}

function Metric({ icon, label, value }: { icon: "calendar" | "filter" | "archive" | "scan"; label: string; value: number }) {
  return <article className="asset-metric"><span><UiIcon name={icon} /></span><div><strong>{value.toLocaleString("fa-IR")}</strong><small>{label}</small></div></article>;
}

function Detail({ label, value, icon, ltr = false }: { label: string; value: string | null; icon: "scan" | "category" | "pin" | "calendar"; ltr?: boolean }) {
  return <div className="asset-spec"><span className="asset-spec-icon"><UiIcon name={icon} size={16} /></span><div><small>{label}</small><strong dir={ltr ? "ltr" : undefined}>{value || "ثبت نشده"}</strong></div></div>;
}

function statusLabel(status: string) { return ({ active: "فعال", inactive: "غیرفعال", maintenance: "در تعمیر", archived: "بایگانی‌شده" } as Record<string, string>)[status] || status; }
function statusTone(status: string) { return ({ active: "pill-teal", inactive: "pill-muted", maintenance: "pill-warning", archived: "pill-muted" } as Record<string, string>)[status] || "pill-muted"; }
