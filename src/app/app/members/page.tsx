import { pool } from "@/db";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied, EmptyState, FormNotice } from "@/components/empty-state";
import { addMemberAction, revokeMemberAction } from "@/app/app/actions";
import { canListAssignableMemberRole } from "@/modules/identity/member-management-policy";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission, hasOrganizationPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string; error?: string; saved?: string }>;

export default async function MembersPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  const [allowed, canManageOrganizationMembers] = await Promise.all([
    hasOperationalPermission(scope, "member.manage"),
    hasOrganizationPermission(scope, "member.manage"),
  ]);
  if (!allowed) return <OperationalShell scope={scope} title="اعضای مجموعه"><AccessDenied /></OperationalShell>;
  const [members, roles] = await Promise.all([
    pool.query<{ membership_id: string; user_id: string; name: string; phone_number: string | null; role_names: string | null; joined_at: Date | null }>(
      `SELECT om.id AS membership_id, u.id AS user_id, u.name, u.phone_number, om.joined_at,
              string_agg(DISTINCT r.name, '، ' ORDER BY r.name) AS role_names
         FROM organization_memberships om JOIN users u ON u.id = om.user_id
         LEFT JOIN membership_role_assignments a ON a.membership_id = om.id AND a.organization_id = om.organization_id
           AND ((a.scope_type = 'organization' AND a.branch_id IS NULL) OR (a.scope_type = 'branch' AND a.branch_id = $2))
         LEFT JOIN operational_roles r ON r.id = a.role_id AND r.organization_id = om.organization_id AND r.status = 'active'
        WHERE om.organization_id = $1 AND om.status = 'active'
          AND (EXISTS (SELECT 1 FROM branch_memberships bm WHERE bm.membership_id = om.id AND bm.organization_id = $1 AND bm.branch_id = $2 AND bm.status = 'active')
               OR EXISTS (SELECT 1 FROM membership_role_assignments oa WHERE oa.membership_id = om.id AND oa.organization_id = $1 AND oa.scope_type = 'organization' AND oa.branch_id IS NULL))
        GROUP BY om.id, u.id ORDER BY u.name`, [scope.organizationId, scope.branchId]),
    pool.query<{ key: string; name: string; permission_keys: string[] | null }>(
      `SELECT r.key, r.name, array_agg(rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL) AS permission_keys
         FROM operational_roles r
         LEFT JOIN operational_role_permissions rp ON rp.role_id = r.id
        WHERE r.organization_id = $1 AND r.status = 'active'
        GROUP BY r.id ORDER BY r.is_system_role DESC, r.name`,
      [scope.organizationId],
    ),
  ]);
  const assignableRoles = roles.rows.filter((role) => canListAssignableMemberRole({
    actorCanManageOrganizationMembers: canManageOrganizationMembers,
    roleKey: role.key,
    rolePermissionKeys: role.permission_keys ?? [],
  }));
  return <OperationalShell scope={scope} title="اعضای محدوده">
    <FormNotice searchParams={query} />
    <section className="panel"><div className="section-heading"><div><h2>عضویت‌های فعال</h2><p>فهرست فقط اعضای مجاز این مجموعه و شعبه را نشان می‌دهد.</p></div></div>
      {!members.rows.length ? <EmptyState title="عضو فعالی پیدا نشد">با افزودن عضو، دسترسی او از عضویت و نقش ثبت‌شده تعیین می‌شود.</EmptyState> : <div className="table-wrap"><table className="data-table"><thead><tr><th>نام</th><th>شمارهٔ همراه</th><th>نقش‌های مؤثر در این شعبه</th><th>مدیریت</th></tr></thead><tbody>{members.rows.map((member) => <tr key={member.membership_id}><td>{member.name}</td><td dir="ltr">{member.phone_number || "ثبت نشده"}</td><td>{member.role_names || "بدون نقش فعال"}</td><td>{member.membership_id === scope.membershipId ? <span className="pill">حساب شما</span> : <form action={revokeMemberAction}><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} /><input type="hidden" name="membershipId" value={member.membership_id} /><button className="link-button" type="submit">{canManageOrganizationMembers ? "لغو عضویت در کل مجموعه" : "لغو عضویت در همین شعبه"}</button></form>}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel narrow-panel"><h2>افزودن عضو یا تخصیص نقش</h2><p className="form-note">حساب با شمارهٔ همراه به‌صورت سراسری ساخته می‌شود یا به این محدوده می‌پیوندد. کاربر با کد یک‌بارمصرف همان شماره وارد می‌شود. مدیر شعبه فقط عضو عادی شعبهٔ خودش را می‌سازد؛ مدیر شعبهٔ تازه را مدیر مجموعه تعریف می‌کند.</p><form action={addMemberAction} className="form-stack"><input type="hidden" name="organizationId" value={scope.organizationId} /><input type="hidden" name="branchId" value={scope.branchId} />
      <label className="field-label">نام<input name="name" required minLength={2} maxLength={120} /></label><label className="field-label">شمارهٔ همراه<input name="phone" type="tel" required minLength={7} maxLength={30} dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09..." /></label>
      <label className="field-label">نقش<select name="roleKey" required defaultValue=""><option value="" disabled>انتخاب کنید</option>{assignableRoles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select></label>
      {canManageOrganizationMembers ? <label className="field-label">محدودهٔ نقش<select name="scopeType"><option value="branch">همین شعبه</option><option value="organization">کل مجموعه و همهٔ شعبه‌ها</option></select></label> : <input type="hidden" name="scopeType" value="branch" />}
      <button className="button button-primary" type="submit" disabled={!assignableRoles.length}>ثبت عضو و نقش</button>
    </form></section>
  </OperationalShell>;
}
