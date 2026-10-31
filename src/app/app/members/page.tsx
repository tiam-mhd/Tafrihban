import { pool } from "@/db";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { addMemberAction, revokeMemberAction } from "@/app/app/actions";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission, hasOrganizationPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; error?: string; saved?: string }>;

export default async function MembersPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const allowed = await hasOperationalPermission(scope, "member.manage") && await hasOrganizationPermission(scope, "member.manage");
  if (!allowed) return <OperationalShell scope={scope} title="اعضای مجموعه"><AccessDenied /></OperationalShell>;
  const [members, roles] = await Promise.all([
    pool.query<{ membership_id: string; user_id: string; name: string; email: string; role_names: string | null; joined_at: Date | null }>(
      `SELECT om.id AS membership_id, u.id AS user_id, u.name, u.email, om.joined_at,
              string_agg(DISTINCT r.name, '، ' ORDER BY r.name) AS role_names
         FROM organization_memberships om JOIN users u ON u.id = om.user_id
         LEFT JOIN membership_role_assignments a ON a.membership_id = om.id AND a.organization_id = om.organization_id
           AND ((a.scope_type = 'organization' AND a.branch_id IS NULL) OR (a.scope_type = 'branch' AND a.branch_id = $2))
         LEFT JOIN operational_roles r ON r.id = a.role_id AND r.organization_id = om.organization_id AND r.status = 'active'
        WHERE om.organization_id = $1 AND om.status = 'active'
          AND (EXISTS (SELECT 1 FROM branch_memberships bm WHERE bm.membership_id = om.id AND bm.organization_id = $1 AND bm.branch_id = $2 AND bm.status = 'active')
               OR EXISTS (SELECT 1 FROM membership_role_assignments oa WHERE oa.membership_id = om.id AND oa.organization_id = $1 AND oa.scope_type = 'organization' AND oa.branch_id IS NULL))
        GROUP BY om.id, u.id ORDER BY u.name`, [scope.organizationId, scope.branchId]),
    pool.query<{ key: string; name: string }>("SELECT key, name FROM operational_roles WHERE organization_id = $1 AND status = 'active' ORDER BY is_system_role DESC, name", [scope.organizationId]),
  ]);
  return <OperationalShell scope={scope} title="اعضای محدوده">
    <FormNotice searchParams={query} />
    <section className="panel"><div className="section-heading"><div><h2>عضویت‌های فعال</h2><p>فهرست فقط اعضای مجاز این مجموعه و شعبه را نشان می‌دهد.</p></div></div>
      {!members.rows.length ? <EmptyState title="عضو فعالی پیدا نشد">با افزودن عضو، دسترسی او از عضویت و نقش ثبت‌شده تعیین می‌شود.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>نام</th><th>ایمیل عملیاتی</th><th>نقش‌های مؤثر در این شعبه</th><th>مدیریت</th></tr></thead><tbody>{members.rows.map((member) => <tr key={member.membership_id}><td>{member.name}</td><td dir="ltr">{member.email}</td><td>{member.role_names || "بدون نقش فعال"}</td><td>{member.membership_id === scope.membershipId ? <span className="pill">حساب شما</span> : <form action={revokeMemberAction}><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><input type="hidden" name="membershipId" value={member.membership_id} /><button className="link-button" type="submit">لغو همهٔ عضویت‌های این مجموعه</button></form>}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel narrow-panel"><h2>افزودن عضو یا تخصیص نقش</h2><p className="form-note">برای حساب تازه رمز موقت حداقل ۱۲ نویسه‌ای بسازید؛ حساب موجود با همان ایمیل رمز تازه نمی‌گیرد.</p><form action={addMemberAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} />
      <label className="field-label">نام<input name="name" required minLength={2} maxLength={120} /></label><label className="field-label">ایمیل<input name="email" type="email" required maxLength={254} dir="ltr" autoComplete="off" /></label><label className="field-label">رمز موقت برای حساب تازه<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <label className="field-label">نقش<select name="roleKey" required defaultValue=""><option value="" disabled>انتخاب کنید</option>{roles.rows.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select></label>
      <label className="field-label">محدودهٔ نقش<select name="scopeType"><option value="branch">همین شعبه</option><option value="organization">کل مجموعه و همهٔ شعبه‌ها</option></select></label>
      <button className="button button-primary" type="submit" disabled={!roles.rows.length}>ثبت عضو و نقش</button>
    </form></section>
  </OperationalShell>;
}
