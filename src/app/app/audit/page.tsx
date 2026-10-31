import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState } from "@/components/empty-state";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission, hasOrganizationPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string }>;

export default async function AuditPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  if (!(await hasOperationalPermission(scope, "audit.read"))) return <OperationalShell scope={scope} title="دفتر حسابرسی"><AccessDenied /></OperationalShell>;
  const organizationWide = await hasOrganizationPermission(scope, "audit.read");
  const events = await pool.query<{ action: string; entity_type: string; entity_id: string | null; created_at: Date; actor_name: string | null; metadata: Record<string, unknown> }>(
    `SELECT a.action, a.entity_type, a.entity_id, a.created_at, u.name AS actor_name, a.metadata
       FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE a.organization_id = $1 AND ($2::boolean OR a.branch_id = $3)
      ORDER BY a.created_at DESC LIMIT 200`, [scope.organizationId, organizationWide, scope.branchId]);
  return <OperationalShell scope={scope} title="دفتر حسابرسی">
    <section className="panel"><h2>تغییرهای ثبت‌شده</h2><p className="lede">نمایش {organizationWide ? "رویدادهای مجموعه" : "رویدادهای شعبهٔ فعال"}. دادهٔ جزئی دیگر شعبه در نقش شعبه‌ای نمایش داده نمی‌شود.</p>
      {!events.rows.length ? <EmptyState title="رویدادی ثبت نشده">ایجاد و تغییر داده‌های حساس در این فهرست ظاهر می‌شود.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>زمان شعبه</th><th>کاربر</th><th>رویداد</th><th>نوع رکورد</th><th>شناسه</th></tr></thead><tbody>{events.rows.map((event, index) => <tr key={`${event.created_at.toISOString()}-${index}`}><td>{formatBranchTime(event.created_at, scope.timezone)}</td><td>{event.actor_name || "سامانه"}</td><td dir="ltr">{event.action}</td><td>{event.entity_type}</td><td><code dir="ltr">{event.entity_id || "—"}</code></td></tr>)}</tbody></table></div>}
    </section>
  </OperationalShell>;
}
