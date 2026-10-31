import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { PlatformShell } from "@/components/operational-shell";
import { EmptyState } from "@/components/empty-state";
import { requirePlatformActor, hasPlatformPermission } from "@/server/auth-guards";

export default async function PlatformAuditPage() {
  const actor = await requirePlatformActor();
  if (!(await hasPlatformPermission(actor, "platform_audit.read"))) return <PlatformShell title="حسابرسی پلتفرم" actorName={actor.name} actorId={actor.id}><p className="notice notice-warning">اجازهٔ مشاهدهٔ دفتر سراسری را ندارید.</p></PlatformShell>;
  const events = await pool.query<{ action: string; entity_type: string; entity_id: string | null; reason: string | null; metadata: Record<string, unknown>; created_at: Date; actor_name: string | null }>(
    `SELECT a.action, a.entity_type, a.entity_id, a.reason, a.metadata, a.created_at, p.name AS actor_name
       FROM platform_admin_audit_events a LEFT JOIN platform_admins p ON p.id = a.actor_platform_admin_id
      ORDER BY a.created_at DESC LIMIT 250`, []);
  return <PlatformShell title="دفتر حسابرسی سراسری" actorName={actor.name} actorId={actor.id}><section className="panel"><h2>رویدادهای پلتفرم</h2>
    {!events.rows.length ? <EmptyState title="رویدادی ثبت نشده">تغییرهای مدیریتی سراسری اینجا ثبت می‌شوند.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>زمان</th><th>مدیر</th><th>عملیات</th><th>رکورد</th><th>دلیل</th></tr></thead><tbody>{events.rows.map((event, index) => <tr key={`${event.created_at.toISOString()}-${index}`}><td>{formatBranchTime(event.created_at, "Asia/Tehran")}</td><td>{event.actor_name || "سامانه"}</td><td dir="ltr">{event.action}</td><td>{event.entity_type}<small dir="ltr">{event.entity_id || "—"}</small></td><td>{event.reason || "—"}</td></tr>)}</tbody></table></div>}
  </section></PlatformShell>;
}
