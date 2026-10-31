import Link from "next/link";
import { pool } from "@/db";
import { hasPlatformPermission, requirePlatformActor } from "@/server/auth-guards";
import { PlatformShell } from "@/components/operational-shell";
import { EmptyState } from "@/components/empty-state";

export default async function PlatformHomePage() {
  const actor = await requirePlatformActor();
  const canRead = await hasPlatformPermission(actor, "organization.read");
  const [organizations, branches, admins, events] = await Promise.all([
    canRead ? pool.query<{ count: string }>("SELECT count(*)::text AS count FROM organizations WHERE status <> 'archived'") : Promise.resolve({ rows: [{ count: "—" }] }),
    canRead ? pool.query<{ count: string }>("SELECT count(*)::text AS count FROM branches WHERE status = 'active'") : Promise.resolve({ rows: [{ count: "—" }] }),
    canRead ? pool.query<{ count: string }>("SELECT count(*)::text AS count FROM platform_admins WHERE status = 'active'") : Promise.resolve({ rows: [{ count: "—" }] }),
    await hasPlatformPermission(actor, "platform_audit.read") ? pool.query<{ action: string; entity_type: string; created_at: Date }>("SELECT action, entity_type, created_at FROM platform_admin_audit_events ORDER BY created_at DESC LIMIT 5") : Promise.resolve({ rows: [] }),
  ]);
  return <PlatformShell title="نمای کلی پلتفرم" actorName={actor.name} actorId={actor.id}>
    <p className="lede">حساب مدیر پلتفرم در نشست مستقل قرار دارد. تغییرهای سراسری در دفتر حسابرسی ثبت می‌شوند.</p>
    {canRead ? <div className="stats-grid"><article className="stat-card"><span>سازمان‌های فعال</span><strong>{organizations.rows[0]?.count}</strong></article><article className="stat-card"><span>شعبه‌های فعال</span><strong>{branches.rows[0]?.count}</strong></article><article className="stat-card"><span>مدیران پلتفرم</span><strong>{admins.rows[0]?.count}</strong></article><article className="stat-card"><span>محدوده</span><strong>سراسری</strong><small>با مجوز platform</small></article></div> : <EmptyState title="دسترسی سراسری ندارید">این حساب پلتفرم هنوز مجوز مشاهدهٔ سازمان‌ها ندارد. از SUPERADMIN بخواهید نقش را بررسی کند.</EmptyState>}
    <div className="dashboard-grid"><section className="panel"><div className="section-heading"><div><h2>شروع کار</h2><p>مدیریت پلتفرم از اینجا انجام می‌شود.</p></div></div><div className="form-actions"><Link className="button button-primary" href="/platform/organizations/new">ساخت سازمان و مدیر اولیه</Link><Link className="button button-secondary" href="/platform/admins">مدیریت مدیران پلتفرم</Link><Link className="button button-secondary" href="/platform/security">راه‌اندازی MFA</Link></div></section>
      <section className="panel"><div className="section-heading"><div><h2>حسابرسی اخیر</h2><p>عملیات سراسری قابل ردگیری است.</p></div><Link className="text-link" href="/platform/audit">دفتر کامل</Link></div>{!events.rows.length ? <p className="form-note">رخداد حسابرسی تازه‌ای برای این نقش نمایش داده نمی‌شود.</p> : <ul className="dashboard-list">{events.rows.map((event, index) => <li key={`${event.action}-${index}`}><div><strong>{platformAction(event.action)}</strong><span>{platformEntity(event.entity_type)}</span></div><span>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(event.created_at)}</span></li>)}</ul>}</section></div>
  </PlatformShell>;
}

function platformAction(action: string) {
  const labels: Record<string, string> = { "organization.created": "سازمان ساخته شد", "branch.created": "شعبه ساخته شد", "platform_admin.created": "مدیر پلتفرم ساخته شد", "platform_admin.suspended": "مدیر پلتفرم تعلیق شد", "platform_setting.updated": "تنظیمات تغییر کرد" };
  return labels[action] || "عملیات سراسری ثبت شد";
}
function platformEntity(entity: string) {
  return ({ organization: "سازمان", branch: "شعبه", platform_admin: "مدیر پلتفرم", platform_setting: "تنظیم پلتفرم" } as Record<string, string>)[entity] || "پلتفرم";
}
