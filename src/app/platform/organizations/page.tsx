import Link from "next/link";
import { pool } from "@/db";
import { hasPlatformPermission, requirePlatformActor } from "@/server/auth-guards";
import { PlatformShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const actor = await requirePlatformActor();
  const query = await searchParams;
  const allowed = await hasPlatformPermission(actor, "organization.read");
  const organizations = allowed ? await pool.query<{
    id: string; name: string; slug: string; status: string; timezone: string; branch_count: string; member_count: string;
  }>(
    `SELECT o.id, o.name, o.slug, o.status, o.timezone,
            count(DISTINCT b.id)::text AS branch_count, count(DISTINCT m.id)::text AS member_count
       FROM organizations o
       LEFT JOIN branches b ON b.organization_id = o.id AND b.status <> 'archived'
       LEFT JOIN organization_memberships m ON m.organization_id = o.id AND m.status = 'active'
      WHERE o.status <> 'archived'
      GROUP BY o.id ORDER BY o.created_at DESC`,
  ) : { rows: [] };
  return <PlatformShell title="سازمان‌ها و شعبه‌ها" actorName={actor.name} actorId={actor.id}>
    <FormNotice searchParams={query} />
    {!allowed ? <AccessDenied /> : <>
      <div className="section-heading"><div><span className="eyebrow">مدیریت مشتریان</span><p>هر سازمان و شعبه محدودهٔ دادهٔ جدا دارد.</p></div><Link className="button button-primary" href="/platform/organizations/new">ساخت سازمان</Link></div>
      {!organizations.rows.length ? <EmptyState title="سازمانی ثبت نشده">با ساخت سازمان، شعبه و مدیر اولیه را در یک گردش کار ایجاد کنید.<br /><br /><Link className="button button-primary" href="/platform/organizations/new">ساخت اولین سازمان</Link></EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>سازمان</th><th>محدوده</th><th>اعضا</th><th>منطقهٔ زمانی</th><th>وضعیت</th><th /></tr></thead><tbody>{organizations.rows.map((org) => <tr key={org.id}><td><strong>{org.name}</strong><small>{org.slug}</small></td><td>{org.branch_count} شعبه</td><td>{org.member_count} عضو</td><td>{org.timezone}</td><td><span className={org.status === "active" ? "pill pill-success" : "pill pill-warning"}>{org.status === "active" ? "فعال" : "تعلیق‌شده"}</span></td><td><Link className="text-link" href={`/platform/organizations/${org.id}`}>جزئیات</Link></td></tr>)}</tbody></table></div>}
    </>}
  </PlatformShell>;
}
