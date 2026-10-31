import { z } from "zod";
import { pool } from "@/db";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, FormNotice } from "@/components/empty-state";
import { CategoryManagement, type CategoryFilters, type EquipmentCategoryRecord } from "@/components/equipment/category-management";
import { hasOperationalPermission, hasOrganizationPermission, requireOperationalActor, requireOperationalScope } from "@/server/auth-guards";

type Search = Promise<Record<string, string | undefined>>;
const dateFilter = z.string().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const filterSchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["active", "archived", "all"]).default("active"),
  usage: z.enum(["", "used", "unused"]).default(""),
  createdFrom: dateFilter.default(""),
  createdTo: dateFilter.default(""),
}).superRefine((value, context) => {
  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) context.addIssue({ code: "custom", path: ["createdTo"], message: "invalid date range" });
});

export default async function EquipmentCategoriesPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const canManage = await hasOperationalPermission(scope, "equipment.manage") && await hasOrganizationPermission(scope, "equipment.manage");
  if (!canManage) return <OperationalShell scope={scope} title="دسته‌بندی تجهیزات"><AccessDenied /></OperationalShell>;

  const parsed = filterSchema.safeParse({ q: query.q, status: query.status, usage: query.usage, createdFrom: query.createdFrom, createdTo: query.createdTo });
  const filters: CategoryFilters = parsed.success ? parsed.data : filterSchema.parse({});
  const conditions = ["c.organization_id = $1"];
  const values: unknown[] = [scope.organizationId];
  const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (filters.status !== "all") conditions.push(`c.status = ${bind(filters.status)}`);
  if (filters.q) conditions.push(`concat_ws(' ', c.name, c.description) ILIKE '%' || ${bind(filters.q)} || '%'`);
  const dateTimezone = filters.createdFrom || filters.createdTo ? bind(scope.timezone) : "";
  if (filters.createdFrom) conditions.push(`(c.created_at AT TIME ZONE ${dateTimezone})::date >= ${bind(filters.createdFrom)}::date`);
  if (filters.createdTo) conditions.push(`(c.created_at AT TIME ZONE ${dateTimezone})::date <= ${bind(filters.createdTo)}::date`);
  if (filters.usage === "used") conditions.push("category_usage.equipment_count > 0");
  if (filters.usage === "unused") conditions.push("category_usage.equipment_count = 0");

  const categories = await pool.query<EquipmentCategoryRecord>(
    `SELECT c.id, c.name, c.description, c.status, c.created_at, category_usage.equipment_count
       FROM equipment_categories c
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS equipment_count FROM equipment e
          WHERE e.organization_id = c.organization_id AND e.category_id = c.id
       ) category_usage ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY CASE WHEN c.status = 'active' THEN 0 ELSE 1 END, c.name`, values,
  );

  return <OperationalShell
    scope={scope}
    title="دسته‌بندی تجهیزات"
    description="ساختار گروه‌بندی مشترک مجموعه را مرتب کنید؛ هر دسته در تمام شعب قابل استفاده است."
    headerActions={<CategoryManagement organizationId={scope.organizationId} branchId={scope.branchId} categories={categories.rows} filters={filters} />}
  >
    <FormNotice searchParams={{ error: query.error, saved: query.saved }} />
    {!parsed.success && <p className="notice notice-warning" role="alert">بعضی از فیلترها معتبر نبودند و نمایش به فیلترهای پیش‌فرض برگشت.</p>}
  </OperationalShell>;
}
