import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "@/db";
import { operationalAuth } from "@/lib/auth";
import { platformAuth } from "@/lib/platform-auth";
import { grantsPermission } from "@/modules/authorization/permissions";
import { OPERATIONAL_SCOPE_QUERY } from "@/server/scope-queries";

export type OperationalActor = {
  id: string;
  name: string;
  email: string;
};

export type PlatformActor = {
  id: string;
  name: string;
  email: string;
};

export type OperationalScope = {
  actor: OperationalActor;
  membershipId: string;
  organizationId: string;
  organizationName: string;
  branchId: string;
  branchName: string;
  timezone: string;
};

export async function requireOperationalActor(): Promise<OperationalActor> {
  const session = await operationalAuth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const user = await pool.query<{ status: string }>("SELECT status FROM users WHERE id = $1", [session.user.id]);
  if (user.rows[0]?.status !== "active") redirect("/login?reason=inactive");

  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

export async function operationalActorFromRequest(request: Request): Promise<OperationalActor | null> {
  const session = await operationalAuth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  const user = await pool.query<{ status: string }>("SELECT status FROM users WHERE id = $1", [session.user.id]);
  if (user.rows[0]?.status !== "active") return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

export async function requirePlatformActor(): Promise<PlatformActor> {
  const session = await platformAuth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/platform/login");

  const admin = await pool.query<{ status: string; must_change_password: boolean }>("SELECT status, must_change_password FROM platform_admins WHERE id = $1", [session.user.id]);
  if (admin.rows[0]?.status !== "active") redirect("/platform/login?reason=inactive");
  if (admin.rows[0]?.must_change_password) redirect("/platform/security/change-password");

  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

export async function resolveOperationalScope(
  actor: OperationalActor,
  requestedOrganizationId?: string,
  requestedBranchId?: string,
): Promise<OperationalScope | null> {
  const { rows } = await pool.query<{
    membership_id: string;
    organization_id: string;
    organization_name: string;
    branch_id: string;
    branch_name: string;
    timezone: string;
  }>(
    OPERATIONAL_SCOPE_QUERY,
    [actor.id, requestedOrganizationId ?? null, requestedBranchId ?? null],
  );

  if (rows.length !== 1) return null;
  const scope = rows[0];
  return {
    actor,
    membershipId: scope.membership_id,
    organizationId: scope.organization_id,
    organizationName: scope.organization_name,
    branchId: scope.branch_id,
    branchName: scope.branch_name,
    timezone: scope.timezone,
  };
}

export async function requireOperationalScope(
  actor: OperationalActor,
  organizationId?: string,
  branchId?: string,
): Promise<OperationalScope> {
  const scope = await resolveOperationalScope(actor, organizationId, branchId);
  if (!scope) redirect("/app/select-scope");
  return scope;
}

export async function assertOperationalPermission(scope: OperationalScope, permission: string): Promise<void> {
  if (!(await hasOperationalPermission(scope, permission))) throw new Error("اجازهٔ انجام این عملیات در این شعبه را ندارید.");
}

export async function hasOperationalPermission(scope: OperationalScope, permission: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
       FROM organization_memberships om
       JOIN organizations o ON o.id = om.organization_id AND o.status = 'active'
       JOIN membership_role_assignments a ON a.membership_id = om.id AND a.organization_id = om.organization_id
       JOIN operational_roles r ON r.id = a.role_id AND r.status = 'active'
       JOIN operational_role_permissions rp ON rp.role_id = r.id AND rp.permission_key = $4
      WHERE om.id = $1 AND om.user_id = $2 AND om.organization_id = $3 AND om.status = 'active'
        AND (
          (a.scope_type = 'organization' AND a.branch_id IS NULL)
          OR (a.scope_type = 'branch' AND a.branch_id = $5 AND EXISTS (
            SELECT 1 FROM branch_memberships bm
            WHERE bm.membership_id = om.id AND bm.organization_id = om.organization_id
              AND bm.branch_id = a.branch_id AND bm.status = 'active'
          ))
        )
        AND EXISTS (
          SELECT 1 FROM branches b
          WHERE b.id = $5 AND b.organization_id = om.organization_id AND b.status = 'active'
        )
      LIMIT 1`,
    [scope.membershipId, scope.actor.id, scope.organizationId, permission, scope.branchId],
  );
  return Boolean(result.rowCount);
}

export async function hasOrganizationPermission(scope: OperationalScope, permission: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
       FROM organization_memberships om
       JOIN membership_role_assignments a ON a.membership_id = om.id AND a.organization_id = om.organization_id
       JOIN operational_roles r ON r.id = a.role_id AND r.organization_id = om.organization_id AND r.status = 'active'
       JOIN operational_role_permissions rp ON rp.role_id = r.id AND rp.permission_key = $4
      WHERE om.id = $1 AND om.user_id = $2 AND om.organization_id = $3 AND om.status = 'active'
        AND a.scope_type = 'organization' AND a.branch_id IS NULL
      LIMIT 1`,
    [scope.membershipId, scope.actor.id, scope.organizationId, permission],
  );
  return Boolean(result.rowCount);
}

export async function assertOrganizationPermission(scope: OperationalScope, permission: string): Promise<void> {
  if (!(await hasOrganizationPermission(scope, permission))) throw new Error("این عملیات به نقش در سطح مجموعه نیاز دارد.");
}

export async function assertPlatformPermission(actor: PlatformActor, permission: string): Promise<void> {
  if (!(await hasPlatformPermission(actor, permission))) throw new Error("اجازهٔ انجام این عملیات را ندارید.");
}

export async function hasPlatformPermission(actor: PlatformActor, permission: string): Promise<boolean> {
  const result = await pool.query<{ grants_all_permissions: boolean; permission_key: string | null }>(
    `SELECT r.grants_all_permissions, rp.permission_key
       FROM platform_admin_role_assignments a
       JOIN platform_admin_roles r ON r.id = a.role_id AND r.status = 'active'
       JOIN platform_admins p ON p.id = a.platform_admin_id AND p.status = 'active'
       LEFT JOIN platform_role_permissions rp ON rp.role_id = r.id
      WHERE p.id = $1`, [actor.id],
  );
  return result.rows.some((row) => grantsPermission({ grantsAllPermissions: row.grants_all_permissions, permissionKeys: new Set(row.permission_key ? [row.permission_key] : []) }, permission));
}

export async function auditOperational(
  scope: OperationalScope,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_events (id, actor_user_id, organization_id, branch_id, action, entity_type, entity_id, metadata)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [scope.actor.id, scope.organizationId, scope.branchId, action, entityType, entityId, JSON.stringify(metadata)],
  );
}

export async function auditPlatform(
  actor: PlatformActor | null,
  action: string,
  entityType: string,
  entityId: string | null,
  reason: string | null = null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO platform_admin_audit_events
       (id, actor_platform_admin_id, action, entity_type, entity_id, reason, metadata)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::jsonb)`,
    [actor?.id ?? null, action, entityType, entityId, reason, JSON.stringify(metadata)],
  );
}
