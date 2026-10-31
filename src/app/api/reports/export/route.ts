import { NextResponse } from "next/server";
import { pool } from "@/db";
import { assertOperationalPermission, operationalActorFromRequest, resolveOperationalScope } from "@/server/auth-guards";
import { auditOperational } from "@/server/auth-guards";

export const runtime = "nodejs";

type ExportRow = Record<string, string | number | Date | null>;

function csvCell(value: unknown): string {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(headers: string[], rows: ExportRow[]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(headers.map((key) => csvCell(row[key])).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
}

export async function GET(request: Request) {
  const actor = await operationalActorFromRequest(request);
  if (!actor) return NextResponse.json({ error: "ورود لازم است." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (!type || !["equipment", "inspections", "defects", "work-orders"].includes(type)) return NextResponse.json({ error: "نوع گزارش معتبر نیست." }, { status: 400 });
  const scope = await resolveOperationalScope(actor, url.searchParams.get("organizationId") || undefined, url.searchParams.get("branchId") || undefined);
  if (!scope) return NextResponse.json({ error: "دسترسی به این محدوده مجاز نیست." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  try { await assertOperationalPermission(scope, "report.export"); } catch { return NextResponse.json({ error: "اجازهٔ خروجی ندارید." }, { status: 403, headers: { "Cache-Control": "no-store" } }); }

  let headers: string[];
  let result: { rows: ExportRow[] };
  if (type === "equipment") {
    headers = ["asset_code", "name", "category", "status", "manufacturer", "model", "location"];
    result = await pool.query<ExportRow>(
      `SELECT e.asset_code, e.name, c.name AS category, e.status, e.manufacturer, e.model, e.location FROM equipment e
         LEFT JOIN equipment_categories c ON c.id = e.category_id AND c.organization_id = e.organization_id
        WHERE e.organization_id = $1 AND e.branch_id = $2 ORDER BY e.asset_code`, [scope.organizationId, scope.branchId]);
  } else if (type === "inspections") {
    headers = ["created_at_utc", "asset_code", "equipment", "inspector", "outcome", "notes"];
    result = await pool.query<ExportRow>(
      `SELECT i.created_at, e.asset_code, e.name AS equipment, u.name AS inspector, i.outcome, i.notes FROM inspections i
         JOIN equipment e ON e.id = i.equipment_id AND e.organization_id = i.organization_id AND e.branch_id = i.branch_id
         JOIN users u ON u.id = i.inspector_id WHERE i.organization_id = $1 AND i.branch_id = $2 ORDER BY i.created_at DESC`, [scope.organizationId, scope.branchId]);
  } else if (type === "defects") {
    headers = ["created_at_utc", "asset_code", "title", "description", "severity", "status"];
    result = await pool.query<ExportRow>(
      `SELECT d.created_at, e.asset_code, d.title, d.description, d.severity, d.status FROM defects d
         JOIN equipment e ON e.id = d.equipment_id AND e.organization_id = d.organization_id AND e.branch_id = d.branch_id
        WHERE d.organization_id = $1 AND d.branch_id = $2 ORDER BY d.created_at DESC`, [scope.organizationId, scope.branchId]);
  } else {
    headers = ["created_at_utc", "asset_code", "title", "assignee", "priority", "status", "due_at_utc", "completion_note"];
    result = await pool.query<ExportRow>(
      `SELECT w.created_at, e.asset_code, w.title, u.name AS assignee, w.priority, w.status, w.due_at, w.completion_note FROM work_orders w
         JOIN equipment e ON e.id = w.equipment_id AND e.organization_id = w.organization_id AND e.branch_id = w.branch_id
         LEFT JOIN users u ON u.id = w.assigned_to WHERE w.organization_id = $1 AND w.branch_id = $2 ORDER BY w.created_at DESC`, [scope.organizationId, scope.branchId]);
  }
  await auditOperational(scope, "report.exported", "report", null, { type, rowCount: result.rows.length });
  return new NextResponse(csv(headers, result.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tafrihban-${type}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
