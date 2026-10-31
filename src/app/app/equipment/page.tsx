import Link from "next/link";
import { z } from "zod";
import { pool } from "@/db";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { EquipmentControls, type EquipmentFilters } from "@/components/equipment/equipment-controls";
import { EquipmentItemActions, type EquipmentRecord } from "@/components/equipment/equipment-item-actions";
import { UiIcon } from "@/components/ui-icon";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<Record<string, string | undefined>>;
const dateFilter = z.string().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const filterSchema = z.object({
  q: z.string().trim().max(120).default(""),
  assetCode: z.string().trim().max(40).default(""),
  name: z.string().trim().max(120).default(""),
  categoryId: z.union([z.literal(""), z.string().uuid()]).default(""),
  status: z.enum(["", "active", "inactive", "maintenance", "archived"]).default(""),
  manufacturer: z.string().trim().max(100).default(""),
  model: z.string().trim().max(100).default(""),
  serialNumber: z.string().trim().max(100).default(""),
  location: z.string().trim().max(200).default(""),
  createdBy: z.union([z.literal(""), z.string().uuid()]).default(""),
  createdFrom: dateFilter.default(""),
  createdTo: dateFilter.default(""),
  updatedFrom: dateFilter.default(""),
  updatedTo: dateFilter.default(""),
  includeArchived: z.enum(["", "1"]).default(""),
}).superRefine((value, context) => {
  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) context.addIssue({ code: "custom", path: ["createdTo"], message: "invalid date range" });
  if (value.updatedFrom && value.updatedTo && value.updatedFrom > value.updatedTo) context.addIssue({ code: "custom", path: ["updatedTo"], message: "invalid date range" });
});

export default async function EquipmentPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const canRead = await hasOperationalPermission(scope, "equipment.read");
  const canManage = await hasOperationalPermission(scope, "equipment.manage");
  if (!canRead) return <OperationalShell scope={scope} title="تجهیزات"><AccessDenied /></OperationalShell>;

  const parsedFilters = filterSchema.safeParse({
    q: query.q, assetCode: query.assetCode, name: query.name, categoryId: query.categoryId, status: query.status,
    manufacturer: query.manufacturer, model: query.model, serialNumber: query.serialNumber, location: query.location,
    createdBy: query.createdBy, createdFrom: query.createdFrom, createdTo: query.createdTo,
    updatedFrom: query.updatedFrom, updatedTo: query.updatedTo, includeArchived: query.includeArchived,
  });
  const filterData = parsedFilters.success ? parsedFilters.data : filterSchema.parse({});
  const filters: EquipmentFilters = { ...filterData, includeArchived: filterData.includeArchived === "1" };

  const conditions = ["e.organization_id = $1", "e.branch_id = $2"];
  const values: unknown[] = [scope.organizationId, scope.branchId];
  const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
  const partial = (column: string, value: string) => { if (value) conditions.push(`${column} ILIKE '%' || ${bind(value)} || '%'`); };
  if (!filters.includeArchived && filters.status !== "archived") conditions.push("e.status <> 'archived'");
  if (filters.q) {
    const search = bind(filters.q);
    conditions.push(`concat_ws(' ', e.asset_code, e.name, e.manufacturer, e.model, e.serial_number, e.location, e.public_qr_id, c.name, u.name) ILIKE '%' || ${search} || '%'`);
  }
  partial("e.asset_code", filters.assetCode);
  partial("e.name", filters.name);
  if (filters.categoryId) conditions.push(`e.category_id = ${bind(filters.categoryId)}`);
  if (filters.status) conditions.push(`e.status = ${bind(filters.status)}`);
  partial("e.manufacturer", filters.manufacturer);
  partial("e.model", filters.model);
  partial("e.serial_number", filters.serialNumber);
  partial("e.location", filters.location);
  if (filters.createdBy) conditions.push(`e.created_by = ${bind(filters.createdBy)}`);
  const dateTimezone = filters.createdFrom || filters.createdTo || filters.updatedFrom || filters.updatedTo ? bind(scope.timezone) : "";
  if (filters.createdFrom) conditions.push(`(e.created_at AT TIME ZONE ${dateTimezone})::date >= ${bind(filters.createdFrom)}::date`);
  if (filters.createdTo) conditions.push(`(e.created_at AT TIME ZONE ${dateTimezone})::date <= ${bind(filters.createdTo)}::date`);
  if (filters.updatedFrom) conditions.push(`(e.updated_at AT TIME ZONE ${dateTimezone})::date >= ${bind(filters.updatedFrom)}::date`);
  if (filters.updatedTo) conditions.push(`(e.updated_at AT TIME ZONE ${dateTimezone})::date <= ${bind(filters.updatedTo)}::date`);

  const [equipment, categories, creators] = await Promise.all([
    pool.query<EquipmentRecord>(
      `SELECT e.id, e.organization_id, e.branch_id, e.category_id, c.name AS category_name, c.status AS category_status,
              e.asset_code, e.name, e.public_qr_id, e.manufacturer, e.model, e.serial_number, e.location, e.status,
              u.name AS created_by_name, e.created_at, e.updated_at,
              (SELECT count(*)::int FROM inspections i WHERE i.organization_id = e.organization_id AND i.branch_id = e.branch_id AND i.equipment_id = e.id) AS inspection_count,
              (SELECT count(*)::int FROM defects d WHERE d.organization_id = e.organization_id AND d.branch_id = e.branch_id AND d.equipment_id = e.id) AS defect_count,
              (SELECT count(*)::int FROM work_orders w WHERE w.organization_id = e.organization_id AND w.branch_id = e.branch_id AND w.equipment_id = e.id) AS work_order_count,
              (SELECT count(*)::int FROM inspection_schedules s WHERE s.organization_id = e.organization_id AND s.branch_id = e.branch_id AND s.equipment_id = e.id) AS schedule_count
         FROM equipment e
         LEFT JOIN equipment_categories c ON c.id = e.category_id AND c.organization_id = e.organization_id
         LEFT JOIN users u ON u.id = e.created_by
        WHERE ${conditions.join(" AND ")}
        ORDER BY CASE WHEN e.status = 'archived' THEN 1 ELSE 0 END, e.updated_at DESC, e.asset_code`, values),
    pool.query<{ id: string; name: string; status: string }>(
      `SELECT c.id, c.name, c.status FROM equipment_categories c
        WHERE c.organization_id = $1 AND (c.status = 'active' OR EXISTS (
          SELECT 1 FROM equipment e WHERE e.category_id = c.id AND e.organization_id = c.organization_id AND e.branch_id = $2
        )) ORDER BY c.status, c.name`, [scope.organizationId, scope.branchId]),
    pool.query<{ id: string; name: string }>(
      `SELECT DISTINCT u.id, u.name FROM equipment e JOIN users u ON u.id = e.created_by
        WHERE e.organization_id = $1 AND e.branch_id = $2 ORDER BY u.name`, [scope.organizationId, scope.branchId]),
  ]);
  const params = new URLSearchParams({ organizationId: scope.organizationId, branchId: scope.branchId });

  return <OperationalShell
    scope={scope}
    title="تجهیزات"
    description="پرونده‌ها، وضعیت‌ها و سوابق تجهیزات این شعبه را یک‌جا مدیریت کنید."
    headerActions={<EquipmentControls organizationId={scope.organizationId} branchId={scope.branchId} canManage={canManage} categories={categories.rows} creators={creators.rows} filters={filters} />}
  >
    <FormNotice searchParams={{ error: query.error, saved: query.saved }} />
    {!parsedFilters.success && <p className="notice notice-warning" role="alert">بخشی از فیلترها معتبر نبود؛ مقدارهای فیلتر را بررسی کنید.</p>}
    <section className="equipment-results panel" aria-labelledby="equipment-results-title">
      <div className="results-summary">
        <div><span className="eyebrow">فهرست شعبه</span><strong id="equipment-results-title">{equipment.rows.length.toLocaleString("fa-IR")} پرونده</strong></div>
        <span>شناسهٔ QR به‌تنهایی مجوز دسترسی نیست؛ همهٔ پرونده‌ها با محدودهٔ فعال کنترل می‌شوند.</span>
      </div>
      {!equipment.rows.length
        ? <EmptyState title={hasActiveFilters(filters) ? "تجهیزی با این فیلترها پیدا نشد" : "هنوز تجهیزی در این شعبه ثبت نشده"}>
            {hasActiveFilters(filters) ? <><span>فیلترها را پاک کنید یا عبارت دیگری جستجو کنید. </span><Link className="text-link" href={`/app/equipment?${params}`}>پاک‌کردن فیلترها</Link></> : "برای ساخت پرونده از دکمهٔ «افزودن تجهیز» در بالای صفحه استفاده کنید."}
          </EmptyState>
        : <div className="equipment-card-grid">
            {equipment.rows.map((item) => <article key={item.id} className={`equipment-row-card${item.status === "archived" ? " equipment-row-archived" : ""}`}>
              <div className="equipment-row-main">
                <span className="equipment-glyph"><UiIcon name="scan" size={22} /></span>
                <div className="equipment-row-copy">
                  <div className="equipment-row-heading"><h2>{item.name}</h2><span className={`pill ${statusTone(item.status)}`}>{statusLabel(item.status)}</span></div>
                  <p className="equipment-row-code"><span>کد دارایی</span><code dir="ltr">{item.asset_code}</code></p>
                  <div className="equipment-row-tags">
                    {item.category_name && <span><UiIcon name="category" size={14} />{item.category_name}{item.category_status === "archived" && " · دستهٔ بایگانی‌شده"}</span>}
                    {item.manufacturer && <span>{item.manufacturer}{item.model ? ` · ${item.model}` : ""}</span>}
                    {item.location && <span><UiIcon name="pin" size={14} />{item.location}</span>}
                  </div>
                </div>
              </div>
              <div className="equipment-row-stats" aria-label="تعداد سوابق">
                <span><strong>{item.inspection_count.toLocaleString("fa-IR")}</strong> بازرسی</span>
                <span><strong>{item.defect_count.toLocaleString("fa-IR")}</strong> عیب</span>
                <span><strong>{item.work_order_count.toLocaleString("fa-IR")}</strong> دستورکار</span>
              </div>
              <div className="equipment-row-footer">
                <Link className="button button-quiet asset-open-link" href={`/app/equipment/lookup?qr=${encodeURIComponent(item.public_qr_id)}&${params.toString()}`}><UiIcon name="eye" /> مشاهدهٔ پرونده</Link>
                {canManage && <EquipmentItemActions item={item} categories={categories.rows} organizationId={scope.organizationId} branchId={scope.branchId} />}
              </div>
            </article>)}
          </div>}
    </section>
  </OperationalShell>;
}

function hasActiveFilters(filters: EquipmentFilters) {
  return Object.values(filters).some((value) => Boolean(value));
}

function statusLabel(status: string) {
  return ({ active: "فعال", inactive: "غیرفعال", maintenance: "در تعمیر", archived: "بایگانی‌شده" } as Record<string, string>)[status] || status;
}

function statusTone(status: string) {
  return ({ active: "pill-teal", inactive: "pill-muted", maintenance: "pill-warning", archived: "pill-muted" } as Record<string, string>)[status] || "pill-muted";
}
