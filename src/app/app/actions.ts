"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pool } from "@/db";
import { localDateTimeToUtc } from "@/lib/dates";
import { createOperationalUser, findOperationalUser, removeUnusedOperationalUser } from "@/modules/identity/accounts";
import { normalizeIranianMobile } from "@/modules/identity/iranian-phone";
import { canAssignMemberRole, canRevokeMemberAssignment } from "@/modules/identity/member-management-policy";
import { assertOperationalPermission, assertOrganizationPermission, hasOrganizationPermission, requireOperationalActor, requireOperationalScope } from "@/server/auth-guards";
import { insertOperationalAudit } from "@/server/transactions";

const idSchema = z.string().uuid();
const queryFor = (scope: { organizationId: string; branchId: string }) =>
  `?organizationId=${encodeURIComponent(scope.organizationId)}&branchId=${encodeURIComponent(scope.branchId)}`;

function fail(path: string, code: string): never {
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}

function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createBranchAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const organizationId = formString(form, "organizationId");
  const branchId = formString(form, "branchId");
  const scope = await requireOperationalScope(actor, organizationId, branchId);
  await assertOperationalPermission(scope, "branch.manage");
  await assertOrganizationPermission(scope, "branch.manage");
  const parsed = z.object({
    name: z.string().min(2).max(120),
    code: z.string().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/),
    address: z.string().max(500).optional().default(""),
    timezone: z.string().min(1).max(100),
  }).safeParse({
    name: formString(form, "name"),
    code: formString(form, "code"),
    address: formString(form, "address"),
    timezone: formString(form, "timezone") || scope.timezone,
  });
  if (!parsed.success) fail("/app/branches", "invalid");
  try {
    new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone });
  } catch {
    fail("/app/branches", "timezone");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const branchIdNew = randomUUID();
    await client.query(
      `INSERT INTO branches (id, organization_id, name, code, address, timezone)
       VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6)`,
      [branchIdNew, scope.organizationId, parsed.data.name, parsed.data.code.toUpperCase(), parsed.data.address, parsed.data.timezone],
    );
    await client.query(
      `INSERT INTO branch_memberships (id, membership_id, organization_id, branch_id)
       SELECT gen_random_uuid()::text, a.membership_id, a.organization_id, $2
         FROM membership_role_assignments a
         JOIN operational_roles r ON r.id = a.role_id AND r.status = 'active'
        WHERE a.organization_id = $1 AND a.scope_type = 'organization' AND a.branch_id IS NULL
       ON CONFLICT (membership_id, branch_id) DO NOTHING`,
      [scope.organizationId, branchIdNew],
    );
    await insertOperationalAudit(client, {
      actorId: actor.id,
      organizationId: scope.organizationId,
      branchId: branchIdNew,
      action: "branch.created",
      entityType: "branch",
      entityId: branchIdNew,
      metadata: { code: parsed.data.code.toUpperCase() },
    });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/branches", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/branches");
  redirect(`/app/branches${queryFor(scope)}&saved=1`);
}

export async function updateBranchAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "branch.manage");
  const parsed = z.object({ name: z.string().min(2).max(120), address: z.string().max(500).default(""), timezone: z.string().min(1).max(100) })
    .safeParse({ name: formString(form, "name"), address: formString(form, "address"), timezone: formString(form, "timezone") });
  if (!parsed.success) fail("/app/branches", "invalid");
  try { new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone }); } catch { fail("/app/branches", "timezone"); }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query(
      `UPDATE branches SET name = $1, address = NULLIF($2, ''), timezone = $3, updated_at = now()
        WHERE id = $4 AND organization_id = $5`, [parsed.data.name, parsed.data.address, parsed.data.timezone, scope.branchId, scope.organizationId]);
    if (!changed.rowCount) throw new Error("not found");
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "branch.updated", entityType: "branch", entityId: scope.branchId });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/app/branches", "could-not-save"); } finally { client.release(); }
  revalidatePath("/app/branches");
  redirect(`/app/branches${queryFor(scope)}&saved=1`);
}

export async function addMemberAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "member.manage");
  const canManageOrganizationMembers = await hasOrganizationPermission(scope, "member.manage");
  const parsed = z.object({
    name: z.string().min(2).max(120),
    phone: z.string().min(7).max(30),
    roleKey: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
    scopeType: z.enum(["organization", "branch"]),
  }).safeParse({
    name: formString(form, "name"),
    phone: formString(form, "phone"),
    roleKey: formString(form, "roleKey"),
    scopeType: formString(form, "scopeType") || "branch",
  });
  if (!parsed.success) fail("/app/members", "invalid");

  const phone = normalizeIranianMobile(parsed.data.phone);
  if (!phone) fail("/app/members", "invalid-phone");
  if (!canAssignMemberRole({
    actorCanManageOrganizationMembers: canManageOrganizationMembers,
    roleKey: parsed.data.roleKey,
    rolePermissionKeys: [],
    scopeType: parsed.data.scopeType,
  })) fail("/app/members", "permission-denied");

  let account = await findOperationalUser(phone);
  let createdAccountId: string | null = null;
  if (!account) {
    try {
      const created = await createOperationalUser({ phone, name: parsed.data.name });
      account = { id: created.id, name: parsed.data.name };
      if (created.created) createdAccountId = created.id;
    } catch {
      fail("/app/members", "account-create-failed");
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const membership = await client.query<{ id: string }>(
      `INSERT INTO organization_memberships (id, user_id, organization_id, status, joined_at)
       VALUES ($1, $2, $3, 'active', now())
       ON CONFLICT (user_id, organization_id) DO UPDATE SET status = 'active', joined_at = COALESCE(organization_memberships.joined_at, now())
       RETURNING id`,
      [randomUUID(), account.id, scope.organizationId],
    );
    const targetMembershipId = membership.rows[0]!.id;
    const role = await client.query<{ id: string; permission_keys: string[] | null }>(
      `SELECT r.id, array_agg(rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL) AS permission_keys
         FROM operational_roles r
         LEFT JOIN operational_role_permissions rp ON rp.role_id = r.id
        WHERE r.organization_id = $1 AND r.key = $2 AND r.status = 'active'
        GROUP BY r.id`,
      [scope.organizationId, parsed.data.roleKey],
    );
    if (!role.rowCount) throw new Error("role missing");
    if (!canAssignMemberRole({
      actorCanManageOrganizationMembers: canManageOrganizationMembers,
      roleKey: parsed.data.roleKey,
      rolePermissionKeys: role.rows[0]!.permission_keys ?? [],
      scopeType: parsed.data.scopeType,
    })) throw new Error("role exceeds member-management scope");
    const targetBranch = parsed.data.scopeType === "branch" ? scope.branchId : null;
    if (targetBranch) {
      await client.query(
        `INSERT INTO branch_memberships (id, membership_id, organization_id, branch_id)
         VALUES ($1, $2, $3, $4) ON CONFLICT (membership_id, branch_id) DO UPDATE SET status = 'active'`,
        [randomUUID(), targetMembershipId, scope.organizationId, targetBranch],
      );
    }
    await client.query(
      `INSERT INTO membership_role_assignments
         (id, membership_id, organization_id, role_id, scope_type, branch_id, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [randomUUID(), targetMembershipId, scope.organizationId, role.rows[0]!.id, parsed.data.scopeType, targetBranch, actor.id],
    );
    await insertOperationalAudit(client, {
      actorId: actor.id,
      organizationId: scope.organizationId,
      branchId: targetBranch,
      action: "membership.role_assigned",
      entityType: "organization_membership",
      entityId: targetMembershipId,
      metadata: { targetUserId: account.id, roleKey: parsed.data.roleKey, scopeType: parsed.data.scopeType },
    });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    if (createdAccountId) await removeUnusedOperationalUser(createdAccountId).catch(() => undefined);
    fail("/app/members", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/members");
  redirect(`/app/members${queryFor(scope)}&saved=1`);
}

export async function revokeMemberAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "member.manage");
  const canManageOrganizationMembers = await hasOrganizationPermission(scope, "member.manage");
  const membershipId = formString(form, "membershipId");
  if (!idSchema.safeParse(membershipId).success || membershipId === scope.membershipId) fail("/app/members", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query<{ user_id: string; has_organization_role: boolean; has_elevated_branch_role: boolean }>(
      `SELECT om.user_id,
              EXISTS (
                SELECT 1 FROM membership_role_assignments a
                 WHERE a.membership_id = om.id AND a.organization_id = om.organization_id
                   AND a.scope_type = 'organization' AND a.branch_id IS NULL
              ) AS has_organization_role,
              EXISTS (
                SELECT 1 FROM membership_role_assignments a
                JOIN operational_roles r ON r.id = a.role_id AND r.organization_id = a.organization_id AND r.status = 'active'
                LEFT JOIN operational_role_permissions rp ON rp.role_id = r.id
                 WHERE a.membership_id = om.id AND a.organization_id = om.organization_id
                   AND a.scope_type = 'branch' AND a.branch_id = $3
                   AND (r.key = 'branch_manager' OR rp.permission_key = ANY($4::text[]))
              ) AS has_elevated_branch_role
         FROM organization_memberships om
        WHERE om.id = $1 AND om.organization_id = $2 AND om.status = 'active'
        FOR UPDATE`,
      [membershipId, scope.organizationId, scope.branchId, ["organization.manage", "branch.manage", "member.manage", "role.manage"]],
    );
    if (!target.rowCount) throw new Error("not found");
    if (!canRevokeMemberAssignment({
      actorCanManageOrganizationMembers: canManageOrganizationMembers,
      targetHasOrganizationRole: target.rows[0]!.has_organization_role,
      targetHasElevatedBranchRole: target.rows[0]!.has_elevated_branch_role,
    })) throw new Error("manager membership is outside branch-management scope");
    if (canManageOrganizationMembers) {
      await client.query(
        "UPDATE organization_memberships SET status = 'revoked' WHERE id = $1 AND organization_id = $2",
        [membershipId, scope.organizationId],
      );
      await client.query(
        "UPDATE branch_memberships SET status = 'revoked' WHERE membership_id = $1 AND organization_id = $2",
        [membershipId, scope.organizationId],
      );
      await client.query(
        "DELETE FROM membership_role_assignments WHERE membership_id = $1 AND organization_id = $2",
        [membershipId, scope.organizationId],
      );
    } else {
      const changed = await client.query(
        "UPDATE branch_memberships SET status = 'revoked' WHERE membership_id = $1 AND organization_id = $2 AND branch_id = $3 AND status = 'active'",
        [membershipId, scope.organizationId, scope.branchId],
      );
      if (!changed.rowCount) throw new Error("branch membership is outside scope");
      await client.query(
        "DELETE FROM membership_role_assignments WHERE membership_id = $1 AND organization_id = $2 AND scope_type = 'branch' AND branch_id = $3",
        [membershipId, scope.organizationId, scope.branchId],
      );
    }
    await insertOperationalAudit(client, {
      actorId: actor.id, organizationId: scope.organizationId, branchId: canManageOrganizationMembers ? null : scope.branchId,
      action: canManageOrganizationMembers ? "membership.revoked" : "branch_membership.revoked",
      entityType: canManageOrganizationMembers ? "organization_membership" : "branch_membership",
      entityId: membershipId, metadata: { targetUserId: target.rows[0]!.user_id },
    });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/members", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/members");
  redirect(`/app/members${queryFor(scope)}&saved=1`);
}

export async function createRoleAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "role.manage");
  await assertOrganizationPermission(scope, "role.manage");
  const rawPermissions = form.getAll("permissions").filter((value): value is string => typeof value === "string");
  const parsed = z.object({
    name: z.string().min(2).max(80),
    key: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
    description: z.string().max(300).optional().default(""),
    permissions: z.array(z.string().min(3).max(100)).min(1).max(50),
  }).safeParse({
    name: formString(form, "name"), key: formString(form, "key"),
    description: formString(form, "description"), permissions: rawPermissions,
  });
  if (!parsed.success) fail("/app/roles", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const permissions = await client.query<{ key: string }>(
      "SELECT key FROM permissions WHERE key = ANY($1::text[])", [parsed.data.permissions],
    );
    if (permissions.rowCount !== new Set(parsed.data.permissions).size) throw new Error("permission missing");
    const roleId = randomUUID();
    await client.query(
      `INSERT INTO operational_roles (id, organization_id, key, name, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [roleId, scope.organizationId, parsed.data.key, parsed.data.name, parsed.data.description],
    );
    for (const permission of permissions.rows) {
      await client.query("INSERT INTO operational_role_permissions (role_id, permission_key) VALUES ($1, $2)", [roleId, permission.key]);
    }
    await insertOperationalAudit(client, {
      actorId: actor.id, organizationId: scope.organizationId, action: "role.created",
      entityType: "operational_role", entityId: roleId, metadata: { key: parsed.data.key, permissionCount: permissions.rowCount },
    });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/roles", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/roles");
  redirect(`/app/roles${queryFor(scope)}&saved=1`);
}

export async function updateOperationalRoleAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "role.manage");
  await assertOrganizationPermission(scope, "role.manage");
  const roleId = formString(form, "roleId");
  const permissionKeys = form.getAll("permissions").filter((value): value is string => typeof value === "string");
  const parsed = z.object({ name: z.string().min(2).max(80), description: z.string().max(300).default("") })
    .safeParse({ name: formString(form, "name"), description: formString(form, "description") });
  if (!idSchema.safeParse(roleId).success || !parsed.success || !permissionKeys.length || permissionKeys.length > 50) fail("/app/roles", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const role = await client.query<{ key: string; is_system_role: boolean }>(
      "SELECT key, is_system_role FROM operational_roles WHERE id = $1 AND organization_id = $2 AND status = 'active' FOR UPDATE", [roleId, scope.organizationId]);
    if (!role.rowCount || role.rows[0]!.is_system_role) throw new Error("protected role");
    const allowed = await client.query<{ key: string }>("SELECT key FROM permissions WHERE key = ANY($1::text[])", [permissionKeys]);
    if (allowed.rows.length !== new Set(permissionKeys).size) throw new Error("permission missing");
    await client.query("UPDATE operational_roles SET name = $1, description = $2 WHERE id = $3 AND organization_id = $4", [parsed.data.name, parsed.data.description, roleId, scope.organizationId]);
    await client.query("DELETE FROM operational_role_permissions WHERE role_id = $1", [roleId]);
    for (const permission of allowed.rows) await client.query("INSERT INTO operational_role_permissions (role_id, permission_key) VALUES ($1, $2)", [roleId, permission.key]);
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, action: "role.updated", entityType: "operational_role", entityId: roleId, metadata: { permissionCount: allowed.rows.length } });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/app/roles", "could-not-save"); } finally { client.release(); }
  revalidatePath("/app/roles");
  redirect(`/app/roles${queryFor(scope)}&saved=1`);
}

export async function archiveOperationalRoleAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "role.manage");
  await assertOrganizationPermission(scope, "role.manage");
  const roleId = formString(form, "roleId");
  if (!idSchema.safeParse(roleId).success) fail("/app/roles", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query("UPDATE operational_roles SET status = 'archived' WHERE id = $1 AND organization_id = $2 AND status = 'active' AND is_system_role = false", [roleId, scope.organizationId]);
    if (!changed.rowCount) throw new Error("protected role or not found");
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, action: "role.archived", entityType: "operational_role", entityId: roleId });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/app/roles", "could-not-save"); } finally { client.release(); }
  revalidatePath("/app/roles");
  redirect(`/app/roles${queryFor(scope)}&saved=1`);
}

export async function createCategoryAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "equipment.manage");
  await assertOrganizationPermission(scope, "equipment.manage");
  const parsed = z.object({ name: z.string().min(2).max(80), description: z.string().max(300).optional().default("") })
    .safeParse({ name: formString(form, "name"), description: formString(form, "description") });
  if (!parsed.success) fail("/app/equipment/categories", "invalid");
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO equipment_categories (id, organization_id, name, description) VALUES ($1, $2, $3, NULLIF($4, ''))",
      [id, scope.organizationId, parsed.data.name, parsed.data.description],
    );
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "equipment_category.created", entityType: "equipment_category", entityId: id });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/equipment/categories", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/equipment");
  revalidatePath("/app/equipment/categories");
  redirect(`/app/equipment/categories${queryFor(scope)}&saved=1`);
}

export async function updateCategoryAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "equipment.manage");
  await assertOrganizationPermission(scope, "equipment.manage");
  const categoryId = formString(form, "categoryId");
  const parsed = z.object({ name: z.string().min(2).max(80), description: z.string().max(300).default("") })
    .safeParse({ name: formString(form, "name"), description: formString(form, "description") });
  if (!idSchema.safeParse(categoryId).success || !parsed.success) fail("/app/equipment/categories", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query("UPDATE equipment_categories SET name = $1, description = NULLIF($2, '') WHERE id = $3 AND organization_id = $4", [parsed.data.name, parsed.data.description, categoryId, scope.organizationId]);
    if (!changed.rowCount) throw new Error("category not found");
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "equipment_category.updated", entityType: "equipment_category", entityId: categoryId });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/app/equipment/categories", "could-not-save"); } finally { client.release(); }
  revalidatePath("/app/equipment");
  revalidatePath("/app/equipment/categories");
  redirect(`/app/equipment/categories${queryFor(scope)}&saved=1`);
}

export async function archiveEquipmentCategoryAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "equipment.manage");
  await assertOrganizationPermission(scope, "equipment.manage");
  const categoryId = formString(form, "categoryId");
  if (!idSchema.safeParse(categoryId).success) fail("/app/equipment/categories", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const category = await client.query<{ status: string }>(
      "SELECT status FROM equipment_categories WHERE id = $1 AND organization_id = $2 FOR UPDATE",
      [categoryId, scope.organizationId],
    );
    if (!category.rowCount || category.rows[0]!.status !== "active") throw new Error("category not active");
    const linked = await client.query<{ equipment_count: number }>(
      "SELECT count(*)::int AS equipment_count FROM equipment WHERE organization_id = $1 AND category_id = $2",
      [scope.organizationId, categoryId],
    );
    await client.query("UPDATE equipment_categories SET status = 'archived', archived_at = now() WHERE id = $1 AND organization_id = $2", [categoryId, scope.organizationId]);
    await insertOperationalAudit(client, {
      actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId,
      action: "equipment_category.archived", entityType: "equipment_category", entityId: categoryId,
      metadata: { linkedEquipmentCount: linked.rows[0]?.equipment_count ?? 0 },
    });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/app/equipment/categories", "could-not-save"); } finally { client.release(); }
  revalidatePath("/app/equipment");
  revalidatePath("/app/equipment/categories");
  redirect(`/app/equipment/categories${queryFor(scope)}&saved=1`);
}

export async function restoreEquipmentCategoryAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "equipment.manage");
  await assertOrganizationPermission(scope, "equipment.manage");
  const categoryId = formString(form, "categoryId");
  if (!idSchema.safeParse(categoryId).success) fail("/app/equipment/categories", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query(
      `UPDATE equipment_categories SET status = 'active', archived_at = NULL
        WHERE id = $1 AND organization_id = $2 AND status = 'archived'`,
      [categoryId, scope.organizationId],
    );
    if (!changed.rowCount) throw new Error("archived category not found");
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "equipment_category.restored", entityType: "equipment_category", entityId: categoryId });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/app/equipment/categories", "could-not-save"); } finally { client.release(); }
  revalidatePath("/app/equipment");
  revalidatePath("/app/equipment/categories");
  redirect(`/app/equipment/categories${queryFor(scope)}&saved=1`);
}

export async function createEquipmentAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "equipment.manage");
  const parsed = z.object({
    name: z.string().min(2).max(120), assetCode: z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
    categoryId: z.union([z.literal(""), z.string().uuid()]).optional().default(""),
    manufacturer: z.string().max(100).optional().default(""), model: z.string().max(100).optional().default(""),
    serialNumber: z.string().max(100).optional().default(""), location: z.string().max(200).optional().default(""),
  }).safeParse({
    name: formString(form, "name"), assetCode: formString(form, "assetCode"), categoryId: formString(form, "categoryId"),
    manufacturer: formString(form, "manufacturer"), model: formString(form, "model"),
    serialNumber: formString(form, "serialNumber"), location: formString(form, "location"),
  });
  if (!parsed.success) fail("/app/equipment", "invalid");
  const id = randomUUID();
  const qrId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (parsed.data.categoryId) {
      const category = await client.query(
        "SELECT id FROM equipment_categories WHERE id = $1 AND organization_id = $2 AND status = 'active' FOR KEY SHARE",
        [parsed.data.categoryId, scope.organizationId],
      );
      if (!category.rowCount) throw new Error("category not active in this organization");
    }
    await client.query(
      `INSERT INTO equipment (id, organization_id, branch_id, category_id, public_qr_id, asset_code, name,
                              manufacturer, model, serial_number, location, created_by)
       VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''), $12)`,
      [id, scope.organizationId, scope.branchId, parsed.data.categoryId, qrId, parsed.data.assetCode.toUpperCase(), parsed.data.name,
        parsed.data.manufacturer, parsed.data.model, parsed.data.serialNumber, parsed.data.location, actor.id],
    );
    await client.query(
      `INSERT INTO equipment_status_events (id, organization_id, branch_id, equipment_id, new_status, actor_user_id)
       VALUES ($1, $2, $3, $4, 'active', $5)`,
      [randomUUID(), scope.organizationId, scope.branchId, id, actor.id],
    );
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "equipment.created", entityType: "equipment", entityId: id, metadata: { assetCode: parsed.data.assetCode.toUpperCase() } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/equipment", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/equipment");
  redirect(`/app/equipment${queryFor(scope)}&saved=1`);
}

export async function updateEquipmentAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "equipment.manage");
  const equipmentId = formString(form, "equipmentId");
  const parsed = z.object({
    name: z.string().min(2).max(120), categoryId: z.union([z.literal(""), z.string().uuid()]).default(""),
    status: z.enum(["active", "inactive", "maintenance"]),
    manufacturer: z.string().max(100).default(""), model: z.string().max(100).default(""),
    serialNumber: z.string().max(100).default(""), location: z.string().max(200).default(""),
  }).safeParse({ name: formString(form, "name"), categoryId: formString(form, "categoryId"), status: formString(form, "status"), manufacturer: formString(form, "manufacturer"), model: formString(form, "model"), serialNumber: formString(form, "serialNumber"), location: formString(form, "location") });
  if (!idSchema.safeParse(equipmentId).success || !parsed.success) fail("/app/equipment", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ status: string; category_id: string | null }>(
      "SELECT status, category_id FROM equipment WHERE id = $1 AND organization_id = $2 AND branch_id = $3 FOR UPDATE",
      [equipmentId, scope.organizationId, scope.branchId],
    );
    if (!current.rowCount || current.rows[0]!.status === "archived") throw new Error("equipment not editable");
    if (parsed.data.categoryId) {
      const category = await client.query(
        `SELECT id FROM equipment_categories c
          WHERE c.id = $1 AND c.organization_id = $2 AND (c.status = 'active' OR c.id = $3)
          FOR KEY SHARE OF c`,
        [parsed.data.categoryId, scope.organizationId, current.rows[0]!.category_id],
      );
      if (!category.rowCount) throw new Error("category not active in this organization");
    }
    const changed = await client.query(
      `UPDATE equipment SET name = $1, category_id = NULLIF($2, ''), manufacturer = NULLIF($3, ''), model = NULLIF($4, ''),
         serial_number = NULLIF($5, ''), location = NULLIF($6, ''), status = $7, updated_at = now()
        WHERE id = $8 AND organization_id = $9 AND branch_id = $10`,
      [parsed.data.name, parsed.data.categoryId, parsed.data.manufacturer, parsed.data.model, parsed.data.serialNumber, parsed.data.location, parsed.data.status, equipmentId, scope.organizationId, scope.branchId]);
    if (!changed.rowCount) throw new Error("equipment not found");
    if (current.rows[0]!.status !== parsed.data.status) {
      await client.query(
        `INSERT INTO equipment_status_events (id, organization_id, branch_id, equipment_id, previous_status, new_status, note, actor_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'وضعیت از پنجرهٔ ویرایش تغییر کرد', $7)`,
        [randomUUID(), scope.organizationId, scope.branchId, equipmentId, current.rows[0]!.status, parsed.data.status, actor.id],
      );
    }
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "equipment.updated", entityType: "equipment", entityId: equipmentId, metadata: { statusChanged: current.rows[0]!.status !== parsed.data.status } });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/app/equipment", "could-not-save"); } finally { client.release(); }
  revalidatePath("/app/equipment");
  revalidatePath("/app/equipment/lookup");
  redirect(`/app/equipment${queryFor(scope)}&saved=1`);
}

export async function archiveEquipmentAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "equipment.manage");
  const equipmentId = formString(form, "equipmentId");
  const note = formString(form, "note");
  if (!idSchema.safeParse(equipmentId).success || note.length > 500) fail("/app/equipment", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ status: string }>(
      `SELECT status FROM equipment WHERE id = $1 AND organization_id = $2 AND branch_id = $3 FOR UPDATE`,
      [equipmentId, scope.organizationId, scope.branchId],
    );
    if (!current.rowCount || current.rows[0]!.status === "archived") throw new Error("equipment not archivable");
    const previousStatus = current.rows[0]!.status;
    const dependencies = await client.query<{ inspections: number; defects: number; work_orders: number; schedules: number }>(
      `SELECT
         (SELECT count(*)::int FROM inspections WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3) AS inspections,
         (SELECT count(*)::int FROM defects WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3) AS defects,
         (SELECT count(*)::int FROM work_orders WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3) AS work_orders,
         (SELECT count(*)::int FROM inspection_schedules WHERE organization_id = $1 AND branch_id = $2 AND equipment_id = $3) AS schedules`,
      [scope.organizationId, scope.branchId, equipmentId],
    );
    const previous = await client.query(
      `UPDATE equipment SET status = 'archived', updated_at = now()
        WHERE id = $1 AND organization_id = $2 AND branch_id = $3`,
      [equipmentId, scope.organizationId, scope.branchId],
    );
    if (!previous.rowCount) throw new Error("not found");
    await client.query(
      `INSERT INTO equipment_status_events (id, organization_id, branch_id, equipment_id, previous_status, new_status, note, actor_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8)`,
      [randomUUID(), scope.organizationId, scope.branchId, equipmentId, previousStatus, "archived", note || "بایگانی نرم با حفظ سوابق و وابستگی‌ها", actor.id],
    );
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "equipment.archived", entityType: "equipment", entityId: equipmentId, metadata: { dependencies: dependencies.rows[0], note: note || null } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/equipment", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/equipment");
  revalidatePath("/app");
  redirect(`/app/equipment${queryFor(scope)}&saved=archived`);
}

export async function restoreEquipmentAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "equipment.manage");
  const equipmentId = formString(form, "equipmentId");
  if (!idSchema.safeParse(equipmentId).success) fail("/app/equipment", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ status: string }>(
      "SELECT status FROM equipment WHERE id = $1 AND organization_id = $2 AND branch_id = $3 FOR UPDATE",
      [equipmentId, scope.organizationId, scope.branchId],
    );
    if (!current.rowCount || current.rows[0]!.status !== "archived") throw new Error("equipment is not archived");
    await client.query("UPDATE equipment SET status = 'active', updated_at = now() WHERE id = $1 AND organization_id = $2 AND branch_id = $3", [equipmentId, scope.organizationId, scope.branchId]);
    await client.query(
      `INSERT INTO equipment_status_events (id, organization_id, branch_id, equipment_id, previous_status, new_status, note, actor_user_id)
       VALUES ($1, $2, $3, $4, 'archived', 'active', 'پروندهٔ تجهیز بازیابی شد', $5)`,
      [randomUUID(), scope.organizationId, scope.branchId, equipmentId, actor.id],
    );
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "equipment.restored", entityType: "equipment", entityId: equipmentId });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/app/equipment", "could-not-save"); } finally { client.release(); }
  revalidatePath("/app/equipment");
  revalidatePath("/app");
  redirect(`/app/equipment${queryFor(scope)}&saved=1`);
}

export async function createChecklistAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "checklist.manage");
  await assertOrganizationPermission(scope, "checklist.manage");
  const questionLines = formString(form, "questions").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const parsed = z.object({ name: z.string().min(2).max(120), description: z.string().max(500).optional().default("") })
    .safeParse({ name: formString(form, "name"), description: formString(form, "description") });
  if (!parsed.success || questionLines.length < 1 || questionLines.length > 50 || questionLines.some((item) => item.length > 300)) fail("/app/checklists", "invalid");
  const templateId = randomUUID();
  const versionId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO checklist_templates (id, organization_id, name, description, created_by)
       VALUES ($1, $2, $3, NULLIF($4, ''), $5)`,
      [templateId, scope.organizationId, parsed.data.name, parsed.data.description, actor.id],
    );
    await client.query(
      `INSERT INTO checklist_template_versions (id, organization_id, template_id, version, status, change_note, created_by, published_at)
       VALUES ($1, $2, $3, 1, 'published', 'نسخهٔ نخست', $4, now())`,
      [versionId, scope.organizationId, templateId, actor.id],
    );
    for (const [position, prompt] of questionLines.entries()) {
      await client.query(
        `INSERT INTO checklist_questions (id, organization_id, template_version_id, position, prompt)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), scope.organizationId, versionId, position + 1, prompt],
      );
    }
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "checklist.version_published", entityType: "checklist_template_version", entityId: versionId, metadata: { templateId, version: 1, questionCount: questionLines.length } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/checklists", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/checklists");
  redirect(`/app/checklists${queryFor(scope)}&saved=1`);
}

export async function createChecklistVersionAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "checklist.manage");
  await assertOrganizationPermission(scope, "checklist.manage");
  const templateId = formString(form, "templateId");
  const changeNote = formString(form, "changeNote");
  const questionLines = formString(form, "questions").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!idSchema.safeParse(templateId).success || changeNote.length > 300 || questionLines.length < 1 || questionLines.length > 50 || questionLines.some((line) => line.length > 300)) fail("/app/checklists", "invalid");
  const client = await pool.connect();
  let versionId = "";
  let versionNumber = 0;
  try {
    await client.query("BEGIN");
    const template = await client.query<{ id: string }>("SELECT id FROM checklist_templates WHERE id = $1 AND organization_id = $2 AND status = 'active' FOR UPDATE", [templateId, scope.organizationId]);
    if (!template.rowCount) throw new Error("template missing");
    const version = await client.query<{ next_version: number }>("SELECT COALESCE(max(version), 0) + 1 AS next_version FROM checklist_template_versions WHERE template_id = $1 AND organization_id = $2", [templateId, scope.organizationId]);
    versionNumber = version.rows[0]!.next_version;
    versionId = randomUUID();
    await client.query(
      `INSERT INTO checklist_template_versions (id, organization_id, template_id, version, status, change_note, created_by, published_at)
       VALUES ($1, $2, $3, $4, 'published', $5, $6, now())`,
      [versionId, scope.organizationId, templateId, versionNumber, changeNote || `نسخهٔ ${versionNumber}`, actor.id]);
    for (const [position, prompt] of questionLines.entries()) await client.query(
      "INSERT INTO checklist_questions (id, organization_id, template_version_id, position, prompt) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), scope.organizationId, versionId, position + 1, prompt]);
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "checklist.version_published", entityType: "checklist_template_version", entityId: versionId, metadata: { templateId, version: versionNumber, questionCount: questionLines.length } });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/app/checklists", "could-not-save"); } finally { client.release(); }
  revalidatePath("/app/checklists");
  revalidatePath("/app/schedules");
  redirect(`/app/checklists${queryFor(scope)}&saved=1`);
}

export async function createScheduleAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "inspection_schedule.manage");
  const parsed = z.object({
    equipmentId: z.string().uuid(), checklistVersionId: z.string().uuid(), assignedUserId: z.union([z.literal(""), z.string().uuid()]).optional().default(""),
    frequency: z.enum(["daily", "weekly", "monthly", "custom"]), intervalDays: z.coerce.number().int().min(1).max(3650).optional(), dueAt: z.string().min(16).max(16),
  }).safeParse({
    equipmentId: formString(form, "equipmentId"), checklistVersionId: formString(form, "checklistVersionId"),
    assignedUserId: formString(form, "assignedUserId"), frequency: formString(form, "frequency"),
    intervalDays: formString(form, "intervalDays") || undefined, dueAt: formString(form, "dueAt"),
  });
  if (!parsed.success || (parsed.data.frequency === "custom" && !parsed.data.intervalDays) || (parsed.data.frequency !== "custom" && parsed.data.intervalDays)) fail("/app/schedules", "invalid");
  let dueAt: Date;
  try {
    dueAt = localDateTimeToUtc(parsed.data.dueAt, scope.timezone);
  } catch {
    fail("/app/schedules", "invalid-time");
  }
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO inspection_schedules
         (id, organization_id, branch_id, equipment_id, checklist_version_id, assigned_user_id, frequency, interval_days, next_due_at, created_by)
       SELECT $1, $2, $3, e.id, v.id, NULLIF($6, ''), $7, $8, $9, $10
         FROM equipment e
         JOIN checklist_template_versions v ON v.id = $5 AND v.organization_id = $2 AND v.status = 'published'
        WHERE e.id = $4 AND e.organization_id = $2 AND e.branch_id = $3 AND e.status <> 'archived'
          AND ($6 = '' OR EXISTS (
            SELECT 1 FROM organization_memberships om
            JOIN branch_memberships bm ON bm.membership_id = om.id AND bm.organization_id = om.organization_id
            WHERE om.user_id = $6 AND om.organization_id = $2 AND om.status = 'active'
              AND bm.branch_id = $3 AND bm.status = 'active'
          ))`,
      [id, scope.organizationId, scope.branchId, parsed.data.equipmentId, parsed.data.checklistVersionId,
        parsed.data.assignedUserId, parsed.data.frequency, parsed.data.intervalDays ?? null, dueAt, actor.id],
    );
    const created = await client.query("SELECT id FROM inspection_schedules WHERE id = $1", [id]);
    if (!created.rowCount) throw new Error("invalid schedule refs");
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "inspection_schedule.created", entityType: "inspection_schedule", entityId: id, metadata: { equipmentId: parsed.data.equipmentId, checklistVersionId: parsed.data.checklistVersionId } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/schedules", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/schedules");
  redirect(`/app/schedules${queryFor(scope)}&saved=1`);
}

export async function createWorkOrderAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  await assertOperationalPermission(scope, "work_order.manage");
  const parsed = z.object({
    defectId: z.string().uuid(), assignedTo: z.union([z.literal(""), z.string().uuid()]).optional().default(""),
    priority: z.enum(["low", "normal", "high", "urgent"]), instructions: z.string().max(2000).optional().default(""),
    dueAt: z.string().optional().default(""),
  }).safeParse({ defectId: formString(form, "defectId"), assignedTo: formString(form, "assignedTo"), priority: formString(form, "priority"), instructions: formString(form, "instructions"), dueAt: formString(form, "dueAt") });
  if (!parsed.success) fail("/app/work-orders", "invalid");
  let dueAt: Date | null = null;
  if (parsed.data.dueAt) {
    try { dueAt = localDateTimeToUtc(parsed.data.dueAt, scope.timezone); } catch { fail("/app/work-orders", "invalid-time"); }
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const defect = await client.query<{ id: string; equipment_id: string; title: string; action_id: string }>(
      `SELECT d.id, d.equipment_id, d.title, ca.id AS action_id
         FROM defects d JOIN corrective_actions ca ON ca.defect_id = d.id
        WHERE d.id = $1 AND d.organization_id = $2 AND d.branch_id = $3 AND d.status <> 'closed' FOR UPDATE OF d, ca`,
      [parsed.data.defectId, scope.organizationId, scope.branchId],
    );
    if (!defect.rowCount) throw new Error("defect unavailable");
    if (parsed.data.assignedTo) {
      const assignee = await client.query(
        `SELECT 1 FROM organization_memberships om
           JOIN branch_memberships bm ON bm.membership_id = om.id AND bm.organization_id = om.organization_id
          WHERE om.user_id = $1 AND om.organization_id = $2 AND om.status = 'active'
            AND bm.branch_id = $3 AND bm.status = 'active' LIMIT 1`,
        [parsed.data.assignedTo, scope.organizationId, scope.branchId],
      );
      if (!assignee.rowCount) throw new Error("assignee unavailable");
    }
    const workOrderId = randomUUID();
    const row = defect.rows[0]!;
    await client.query(
      `INSERT INTO work_orders
         (id, organization_id, branch_id, equipment_id, defect_id, corrective_action_id, title, instructions, assigned_to, priority, due_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), NULLIF($9, ''), $10, $11, $12)`,
      [workOrderId, scope.organizationId, scope.branchId, row.equipment_id, row.id, row.action_id,
        `رسیدگی به عیب: ${row.title}`, parsed.data.instructions, parsed.data.assignedTo, parsed.data.priority, dueAt, actor.id],
    );
    await client.query("UPDATE defects SET status = 'in_progress', updated_at = now() WHERE id = $1", [row.id]);
    await client.query("UPDATE corrective_actions SET status = 'in_progress', updated_at = now() WHERE id = $1", [row.action_id]);
    await client.query(
      `INSERT INTO work_order_events (id, organization_id, branch_id, work_order_id, actor_user_id, event_type, note)
       VALUES ($1, $2, $3, $4, $5, 'work_order.created', NULLIF($6, ''))`,
      [randomUUID(), scope.organizationId, scope.branchId, workOrderId, actor.id, parsed.data.instructions],
    );
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: "work_order.created", entityType: "work_order", entityId: workOrderId, metadata: { defectId: row.id, priority: parsed.data.priority } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/work-orders", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/app/work-orders");
  revalidatePath("/app/defects");
  redirect(`/app/work-orders${queryFor(scope)}&saved=1`);
}

export async function transitionWorkOrderAction(form: FormData): Promise<void> {
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, formString(form, "organizationId"), formString(form, "branchId"));
  const workOrderId = formString(form, "workOrderId");
  const nextStatus = formString(form, "nextStatus");
  const note = formString(form, "note");
  if (!idSchema.safeParse(workOrderId).success || note.length > 2000) fail("/app/work-orders", "invalid");
  if (nextStatus === "closed") await assertOperationalPermission(scope, "work_order.close");
  else await assertOperationalPermission(scope, "work_order.manage");
  const allowed: Record<string, string[]> = {
    open: ["accepted"], accepted: ["in_progress"], in_progress: ["completed"], completed: ["closed"],
  };
  if (!["accepted", "in_progress", "completed", "closed"].includes(nextStatus)) fail("/app/work-orders", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ status: string; corrective_action_id: string; defect_id: string }>(
      `SELECT status, corrective_action_id, defect_id FROM work_orders
        WHERE id = $1 AND organization_id = $2 AND branch_id = $3 FOR UPDATE`,
      [workOrderId, scope.organizationId, scope.branchId],
    );
    if (!current.rowCount || !allowed[current.rows[0]!.status]?.includes(nextStatus)) throw new Error("invalid transition");
    if (nextStatus === "completed" && note.length < 8) throw new Error("completion note required");
    await client.query(
      `UPDATE work_orders SET status = $1, completion_note = CASE WHEN $1 = 'completed' THEN $2 ELSE completion_note END,
         completed_by = CASE WHEN $1 = 'completed' THEN $3 ELSE completed_by END,
         completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE completed_at END, updated_at = now()
       WHERE id = $4 AND organization_id = $5 AND branch_id = $6`,
      [nextStatus, note, actor.id, workOrderId, scope.organizationId, scope.branchId],
    );
    if (nextStatus === "closed") {
      await client.query("UPDATE corrective_actions SET status = 'closed', updated_at = now() WHERE id = $1", [current.rows[0]!.corrective_action_id]);
      await client.query("UPDATE defects SET status = 'closed', updated_at = now() WHERE id = $1", [current.rows[0]!.defect_id]);
    }
    await client.query(
      `INSERT INTO work_order_events (id, organization_id, branch_id, work_order_id, actor_user_id, event_type, note)
       VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''))`,
      [randomUUID(), scope.organizationId, scope.branchId, workOrderId, actor.id, `work_order.${nextStatus}`, note],
    );
    await insertOperationalAudit(client, { actorId: actor.id, organizationId: scope.organizationId, branchId: scope.branchId, action: `work_order.${nextStatus}`, entityType: "work_order", entityId: workOrderId, metadata: { status: nextStatus } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/app/work-orders", "invalid-transition");
  } finally {
    client.release();
  }
  revalidatePath("/app/work-orders");
  revalidatePath("/app/defects");
  redirect(`/app/work-orders${queryFor(scope)}&saved=1`);
}
