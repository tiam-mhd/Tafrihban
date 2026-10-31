import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/db";
import { hasPlatformPermission, requirePlatformActor } from "@/server/auth-guards";
import { PlatformShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { createPlatformBranchAction, updateOrganizationAction, updateOrganizationStatusAction, updatePlatformBranchAction } from "@/app/platform/actions";

export default async function OrganizationDetailPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const actor = await requirePlatformActor();
  const [{ organizationId }, query] = await Promise.all([params, searchParams]);
  const allowed = await hasPlatformPermission(actor, "organization.read");
  if (!allowed) return <PlatformShell title="جزئیات سازمان" actorName={actor.name} actorId={actor.id}><AccessDenied /></PlatformShell>;
  const org = await pool.query<{ id: string; name: string; slug: string; status: string; timezone: string }>(
    "SELECT id, name, slug, status, timezone FROM organizations WHERE id = $1", [organizationId],
  );
  if (!org.rowCount) notFound();
  const branches = await pool.query<{ id: string; name: string; code: string; address: string | null; status: string; timezone: string; member_count: string }>(
    `SELECT b.id, b.name, b.code, b.address, b.status, b.timezone, count(DISTINCT bm.membership_id)::text AS member_count
       FROM branches b LEFT JOIN branch_memberships bm ON bm.branch_id = b.id AND bm.organization_id = b.organization_id AND bm.status = 'active'
      WHERE b.organization_id = $1 GROUP BY b.id ORDER BY b.created_at`, [organizationId],
  );
  const canManage = await hasPlatformPermission(actor, "organization.manage");
  return <PlatformShell title={org.rows[0]!.name} actorName={actor.name} actorId={actor.id}>
    <FormNotice searchParams={query} />
    <div className="panel"><div className="section-heading"><div><span className="eyebrow">{org.rows[0]!.slug}</span><h2>{org.rows[0]!.name}</h2><p>{org.rows[0]!.timezone} · وضعیت: {org.rows[0]!.status}</p></div><Link className="text-link" href="/platform/organizations">فهرست سازمان‌ها</Link></div></div>
    {canManage && <section className="panel form-stack" style={{ marginTop: 15 }}><div className="section-heading"><div><h2>افزودن شعبه</h2><p>کاربران دارای نقش سازمانی با شعبهٔ جدید نیز همگام می‌شوند.</p></div></div><form action={createPlatformBranchAction} className="form-grid"><input type="hidden" name="organizationId" value={organizationId} /><label className="field-label">نام شعبه<input name="name" required minLength={2} maxLength={120} /></label><label className="field-label">کد<input name="code" required minLength={2} maxLength={20} dir="ltr" /></label><label className="field-label">منطقهٔ زمانی<input name="timezone" required defaultValue={org.rows[0]!.timezone} /></label><label className="field-label">دلیل ثبت<input name="reason" required minLength={8} maxLength={300} /></label><div className="form-actions span-all"><button className="button button-primary" type="submit">ثبت شعبه</button></div></form></section>}
    {canManage && <form action={updateOrganizationAction} className="panel form-grid" style={{ marginTop: 15 }}><input type="hidden" name="organizationId" value={organizationId} /><label className="field-label">نام سازمان<input name="name" required minLength={2} maxLength={160} defaultValue={org.rows[0]!.name} /></label><label className="field-label">منطقهٔ زمانی<input name="timezone" required defaultValue={org.rows[0]!.timezone} /></label><label className="field-label span-all">دلیل تغییر<input name="reason" required minLength={8} maxLength={300} /></label><button className="button button-secondary span-all" type="submit">ذخیرهٔ مشخصات سازمان</button></form>}
    <section className="panel" style={{ marginTop: 15 }}><div className="section-heading"><div><h2>شعبه‌ها</h2><p>اعضای شعبه در جدول عضویت مستقل نگهداری می‌شوند.</p></div></div>{!branches.rows.length ? <EmptyState title="شعبه‌ای ثبت نشده">برای این سازمان شعبه ایجاد کنید.</EmptyState> : <div className="form-stack">{branches.rows.map((branch) => <form action={updatePlatformBranchAction} className="form-grid branch-admin-card" key={branch.id}><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="branchId" value={branch.id} /><label className="field-label">نام شعبه<input name="name" required minLength={2} maxLength={120} defaultValue={branch.name} /></label><label className="field-label">کد<input name="code" required minLength={2} maxLength={20} dir="ltr" defaultValue={branch.code} /></label><label className="field-label">منطقهٔ زمانی<input name="timezone" required defaultValue={branch.timezone} /></label><label className="field-label">وضعیت<select name="status" defaultValue={branch.status}><option value="active">فعال</option><option value="suspended">تعلیق</option><option value="archived">بایگانی</option></select></label><label className="field-label">نشانی<input name="address" maxLength={500} defaultValue={branch.address || ""} /></label><label className="field-label">دلیل تغییر<input name="reason" required minLength={8} maxLength={300} /></label><div className="form-actions span-all"><span className="pill">{branch.member_count} عضو فعال</span><button className="button button-secondary" type="submit">ذخیرهٔ شعبه</button></div></form>)}</div>}</section>
    {canManage && <form action={updateOrganizationStatusAction} className="panel form-grid" style={{ marginTop: 15 }}><input type="hidden" name="organizationId" value={organizationId} /><label className="field-label">وضعیت سازمان<select name="status" defaultValue={org.rows[0]!.status}><option value="active">فعال</option><option value="suspended">تعلیق دسترسی</option><option value="archived">بایگانی</option></select></label><label className="field-label">دلیل تغییر<input name="reason" required minLength={8} maxLength={300} /></label><div className="form-actions span-all"><button className="button button-secondary" type="submit">ثبت وضعیت</button></div></form>}
  </PlatformShell>;
}
