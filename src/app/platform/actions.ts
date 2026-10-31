"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { pool } from "@/db";
import { platformAuth } from "@/lib/platform-auth";
import { createDefaultOperationalRoles } from "@/modules/organizations/default-roles";
import { createOperationalUser, removeUnusedOperationalUser } from "@/modules/identity/accounts";
import { assertPlatformPermission, requirePlatformActor } from "@/server/auth-guards";
import { insertPlatformAudit } from "@/server/transactions";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function raw(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function fail(path: string, reason: string): never {
  redirect(`${path}?error=${encodeURIComponent(reason)}`);
}

export async function createOrganizationAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "organization.manage");
  const parsed = z.object({
    organizationName: z.string().min(2).max(160),
    slug: z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    organizationTimezone: z.string().min(1).max(100),
    branchName: z.string().min(2).max(120),
    branchCode: z.string().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/),
    managerName: z.string().min(2).max(120),
    managerEmail: z.email().max(254),
    managerPassword: z.string().min(12).max(128),
  }).safeParse({
    organizationName: text(form, "organizationName"), slug: text(form, "slug"),
    organizationTimezone: text(form, "organizationTimezone") || "Asia/Tehran",
    branchName: text(form, "branchName"), branchCode: text(form, "branchCode"),
    managerName: text(form, "managerName"), managerEmail: text(form, "managerEmail"),
    managerPassword: raw(form, "managerPassword"),
  });
  if (!parsed.success) fail("/platform/organizations/new", "invalid");
  try {
    new Intl.DateTimeFormat("en", { timeZone: parsed.data.organizationTimezone });
  } catch {
    fail("/platform/organizations/new", "timezone");
  }

  let manager: { id: string; created: boolean };
  try {
    manager = await createOperationalUser({
      email: parsed.data.managerEmail,
      name: parsed.data.managerName,
      password: parsed.data.managerPassword,
    });
  } catch {
    fail("/platform/organizations/new", "manager-account");
  }

  const organizationId = randomUUID();
  const branchId = randomUUID();
  const membershipId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO organizations (id, name, slug, timezone) VALUES ($1, $2, $3, $4)`,
      [organizationId, parsed.data.organizationName, parsed.data.slug, parsed.data.organizationTimezone],
    );
    await client.query(
      `INSERT INTO branches (id, organization_id, name, code, timezone) VALUES ($1, $2, $3, $4, $5)`,
      [branchId, organizationId, parsed.data.branchName, parsed.data.branchCode.toUpperCase(), parsed.data.organizationTimezone],
    );
    await createDefaultOperationalRoles(client, organizationId);
    await client.query(
      `INSERT INTO organization_memberships (id, user_id, organization_id, status, invited_at, joined_at)
       VALUES ($1, $2, $3, 'active', now(), now())`,
      [membershipId, manager.id, organizationId],
    );
    await client.query(
      `INSERT INTO branch_memberships (id, membership_id, organization_id, branch_id)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), membershipId, organizationId, branchId],
    );
    const role = await client.query<{ id: string }>(
      "SELECT id FROM operational_roles WHERE organization_id = $1 AND key = 'organization_manager'",
      [organizationId],
    );
    await client.query(
      `INSERT INTO membership_role_assignments
         (id, membership_id, organization_id, role_id, scope_type, assigned_by)
       VALUES ($1, $2, $3, $4, 'organization', NULL)`,
      [randomUUID(), membershipId, organizationId, role.rows[0]!.id],
    );
    await insertPlatformAudit(client, {
      actorId: actor.id,
      action: "organization.created",
      entityType: "organization",
      entityId: organizationId,
      reason: "Customer organization setup",
      metadata: { slug: parsed.data.slug, branchId, initialManagerUserId: manager.id, managerAccountCreated: manager.created },
    });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    if (manager!.created) await removeUnusedOperationalUser(manager!.id).catch(() => undefined);
    fail("/platform/organizations/new", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/platform/organizations");
  redirect(`/platform/organizations/${organizationId}?created=1`);
}

export async function createPlatformAdminAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "platform_admin.manage");
  const parsed = z.object({
    name: z.string().min(2).max(120), email: z.email().max(254), password: z.string().min(14).max(128),
    roleKey: z.string().regex(/^[A-Z][A-Z0-9_]{1,50}$/).optional().default("PLATFORM_OPERATOR"),
  }).safeParse({ name: text(form, "name"), email: text(form, "email"), password: raw(form, "password"), roleKey: text(form, "roleKey") || "PLATFORM_OPERATOR" });
  if (!parsed.success) fail("/platform/admins", "invalid");

  let adminId: string;
  let adminCreated = false;
  try {
    const result = await platformAuth.api.signUpEmail({
      body: { name: parsed.data.name, email: parsed.data.email.toLowerCase(), password: parsed.data.password },
    });
    adminId = result.user.id;
    adminCreated = true;
    await pool.query("UPDATE platform_admins SET must_change_password = true WHERE id = $1", [adminId]);
  } catch {
    fail("/platform/admins", "account-create-failed");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const role = await client.query<{ id: string }>("SELECT id FROM platform_admin_roles WHERE key = $1 AND status = 'active' AND grants_all_permissions = false", [parsed.data.roleKey]);
    if (!role.rowCount) throw new Error("role missing");
    await client.query(
      `INSERT INTO platform_admin_role_assignments (id, platform_admin_id, role_id, assigned_by)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), adminId, role.rows[0]!.id, actor.id],
    );
    await insertPlatformAudit(client, {
      actorId: actor.id, action: "platform_admin.created", entityType: "platform_admin", entityId: adminId,
      reason: text(form, "reason") || "Platform administrator setup",
      metadata: { role: parsed.data.roleKey },
    });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    if (adminCreated) await pool.query(
      `DELETE FROM platform_admins p WHERE p.id = $1
        AND NOT EXISTS (SELECT 1 FROM platform_admin_role_assignments a WHERE a.platform_admin_id = p.id)`,
      [adminId!],
    ).catch(() => undefined);
    fail("/platform/admins", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/platform/admins");
  redirect("/platform/admins?saved=1");
}

export async function recoverOperationalAccountAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "operational_account.recover");
  const parsed = z.object({
    email: z.email().max(254),
    temporaryPassword: z.string().min(12).max(128),
    reason: z.string().min(8).max(300),
    confirmation: z.literal("yes"),
  }).safeParse({
    email: text(form, "email"),
    temporaryPassword: raw(form, "temporaryPassword"),
    reason: text(form, "reason"),
    confirmation: text(form, "confirmation"),
  });
  if (!parsed.success) fail("/platform/accounts", "invalid");
  const email = parsed.data.email.toLowerCase();
  const encodedPassword = await hashPassword(parsed.data.temporaryPassword);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: string }>("SELECT id FROM users WHERE lower(email) = $1 FOR UPDATE", [email]);
    if (!user.rowCount) throw new Error("account missing");
    const account = await client.query<{ id: string }>("SELECT id FROM user_accounts WHERE user_id = $1 AND provider_id = 'credential' FOR UPDATE", [user.rows[0]!.id]);
    if (account.rowCount) {
      await client.query("UPDATE user_accounts SET password = $1, updated_at = now() WHERE id = $2", [encodedPassword, account.rows[0]!.id]);
    } else {
      await client.query(
        `INSERT INTO user_accounts (id, account_id, provider_id, user_id, password)
         VALUES ($1, $2, 'credential', $2, $3)`,
        [randomUUID(), user.rows[0]!.id, encodedPassword],
      );
    }
    await client.query("UPDATE users SET must_change_password = true, updated_at = now() WHERE id = $1", [user.rows[0]!.id]);
    const sessions = await client.query("DELETE FROM user_sessions WHERE user_id = $1", [user.rows[0]!.id]);
    await insertPlatformAudit(client, {
      actorId: actor.id, action: "operational_account.credential_recovered", entityType: "user", entityId: user.rows[0]!.id,
      reason: parsed.data.reason, metadata: { sessionsRevoked: sessions.rowCount ?? 0, temporaryPasswordIssued: true },
    });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/platform/accounts", "could-not-save");
  } finally { client.release(); }
  revalidatePath("/platform/accounts");
  redirect(`/platform/accounts?email=${encodeURIComponent(email)}&saved=1`);
}

export async function createPlatformRoleAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "platform_admin.manage");
  const permissions = form.getAll("permissions").filter((value): value is string => typeof value === "string");
  const parsed = z.object({
    key: z.string().regex(/^[A-Z][A-Z0-9_]{1,50}$/),
    name: z.string().min(2).max(80),
    description: z.string().max(300).optional().default(""),
    permissions: z.array(z.string().min(3).max(100)).min(1).max(30),
  }).safeParse({ key: text(form, "key"), name: text(form, "name"), description: text(form, "description"), permissions });
  if (!parsed.success) fail("/platform/roles", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const allowed = await client.query<{ key: string }>("SELECT key FROM platform_permissions WHERE key = ANY($1::text[])", [parsed.data.permissions]);
    if (allowed.rowCount !== new Set(parsed.data.permissions).size) throw new Error("permission missing");
    const roleId = randomUUID();
    await client.query(
      `INSERT INTO platform_admin_roles (id, key, name, description, grants_all_permissions)
       VALUES ($1, $2, $3, $4, false)`,
      [roleId, parsed.data.key, parsed.data.name, parsed.data.description],
    );
    for (const permission of allowed.rows) await client.query(
      "INSERT INTO platform_role_permissions (role_id, permission_key) VALUES ($1, $2)", [roleId, permission.key],
    );
    await insertPlatformAudit(client, { actorId: actor.id, action: "platform_role.created", entityType: "platform_admin_role", entityId: roleId, reason: text(form, "reason") || "Platform role setup", metadata: { key: parsed.data.key, permissionCount: allowed.rowCount } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/platform/roles", "could-not-save");
  } finally { client.release(); }
  revalidatePath("/platform/roles");
  redirect("/platform/roles?saved=1");
}

export async function updatePlatformRoleAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "platform_admin.manage");
  const roleId = text(form, "roleId");
  const reason = text(form, "reason");
  const permissions = form.getAll("permissions").filter((value): value is string => typeof value === "string");
  if (!z.string().uuid().safeParse(roleId).success || reason.length < 8 || reason.length > 300 || permissions.length > 30) fail("/platform/roles", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const role = await client.query<{ key: string; grants_all_permissions: boolean }>(
      "SELECT key, grants_all_permissions FROM platform_admin_roles WHERE id = $1 AND status = 'active' FOR UPDATE", [roleId],
    );
    if (!role.rowCount || role.rows[0]!.grants_all_permissions || role.rows[0]!.key === "SUPERADMIN") throw new Error("protected role");
    const allowed = await client.query<{ key: string }>("SELECT key FROM platform_permissions WHERE key = ANY($1::text[])", [permissions]);
    if (allowed.rowCount !== new Set(permissions).size) throw new Error("permission missing");
    await client.query("DELETE FROM platform_role_permissions WHERE role_id = $1", [roleId]);
    for (const permission of allowed.rows) await client.query(
      "INSERT INTO platform_role_permissions (role_id, permission_key) VALUES ($1, $2)", [roleId, permission.key],
    );
    await insertPlatformAudit(client, { actorId: actor.id, action: "platform_role.permissions_changed", entityType: "platform_admin_role", entityId: roleId, reason, metadata: { key: role.rows[0]!.key, permissionCount: allowed.rowCount } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/platform/roles", "could-not-save");
  } finally { client.release(); }
  revalidatePath("/platform/roles");
  redirect("/platform/roles?saved=1");
}

export async function createPlatformBranchAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "organization.manage");
  const parsed = z.object({
    organizationId: z.string().uuid(), name: z.string().min(2).max(120),
    code: z.string().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/), timezone: z.string().min(1).max(100),
    reason: z.string().min(8).max(300),
  }).safeParse({ organizationId: text(form, "organizationId"), name: text(form, "name"), code: text(form, "code"), timezone: text(form, "timezone"), reason: text(form, "reason") });
  if (!parsed.success) fail("/platform/organizations", "invalid");
  try { new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone }); } catch { fail("/platform/organizations", "timezone"); }
  const client = await pool.connect();
  let branchId = "";
  try {
    await client.query("BEGIN");
    branchId = randomUUID();
    await client.query(
      `INSERT INTO branches (id, organization_id, name, code, timezone)
       VALUES ($1, $2, $3, $4, $5)`,
      [branchId, parsed.data.organizationId, parsed.data.name, parsed.data.code.toUpperCase(), parsed.data.timezone],
    );
    await client.query(
      `INSERT INTO branch_memberships (id, membership_id, organization_id, branch_id)
       SELECT gen_random_uuid()::text, a.membership_id, a.organization_id, $2
         FROM membership_role_assignments a JOIN operational_roles r ON r.id = a.role_id AND r.status = 'active'
        WHERE a.organization_id = $1 AND a.scope_type = 'organization' AND a.branch_id IS NULL
       ON CONFLICT (membership_id, branch_id) DO NOTHING`,
      [parsed.data.organizationId, branchId],
    );
    await insertPlatformAudit(client, { actorId: actor.id, action: "branch.created", entityType: "branch", entityId: branchId, reason: parsed.data.reason, metadata: { organizationId: parsed.data.organizationId, code: parsed.data.code.toUpperCase() } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/platform/organizations", "could-not-save");
  } finally { client.release(); }
  revalidatePath(`/platform/organizations/${parsed.data.organizationId}`);
  redirect(`/platform/organizations/${parsed.data.organizationId}?saved=1`);
}

export async function updateOrganizationAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "organization.manage");
  const organizationId = text(form, "organizationId");
  const name = text(form, "name");
  const timezone = text(form, "timezone");
  const reason = text(form, "reason");
  if (!z.string().uuid().safeParse(organizationId).success || name.length < 2 || name.length > 160 || timezone.length > 100 || reason.length < 8 || reason.length > 300) fail("/platform/organizations", "invalid");
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { fail("/platform/organizations", "timezone"); }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query("UPDATE organizations SET name = $1, timezone = $2, updated_at = now() WHERE id = $3", [name, timezone, organizationId]);
    if (!changed.rowCount) throw new Error("not found");
    await insertPlatformAudit(client, { actorId: actor.id, action: "organization.updated", entityType: "organization", entityId: organizationId, reason, metadata: { timezone } });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/platform/organizations", "could-not-save"); } finally { client.release(); }
  revalidatePath("/platform/organizations");
  revalidatePath(`/platform/organizations/${organizationId}`);
  redirect(`/platform/organizations/${organizationId}?saved=1`);
}

export async function updatePlatformBranchAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "organization.manage");
  const parsed = z.object({
    organizationId: z.string().uuid(), branchId: z.string().uuid(), name: z.string().min(2).max(120),
    code: z.string().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/), address: z.string().max(500).default(""),
    timezone: z.string().min(1).max(100), status: z.enum(["active", "suspended", "archived"]), reason: z.string().min(8).max(300),
  }).safeParse({ organizationId: text(form, "organizationId"), branchId: text(form, "branchId"), name: text(form, "name"), code: text(form, "code"), address: text(form, "address"), timezone: text(form, "timezone"), status: text(form, "status"), reason: text(form, "reason") });
  if (!parsed.success) fail("/platform/organizations", "invalid");
  try { new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone }); } catch { fail("/platform/organizations", "timezone"); }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query(
      `UPDATE branches SET name = $1, code = $2, address = NULLIF($3, ''), timezone = $4, status = $5, updated_at = now()
        WHERE id = $6 AND organization_id = $7`,
      [parsed.data.name, parsed.data.code.toUpperCase(), parsed.data.address, parsed.data.timezone, parsed.data.status, parsed.data.branchId, parsed.data.organizationId]);
    if (!changed.rowCount) throw new Error("not found");
    await insertPlatformAudit(client, { actorId: actor.id, action: "branch.updated", entityType: "branch", entityId: parsed.data.branchId, reason: parsed.data.reason, metadata: { organizationId: parsed.data.organizationId, status: parsed.data.status, code: parsed.data.code.toUpperCase() } });
    await client.query("COMMIT");
  } catch { await client.query("ROLLBACK"); fail("/platform/organizations", "could-not-save"); } finally { client.release(); }
  revalidatePath(`/platform/organizations/${parsed.data.organizationId}`);
  redirect(`/platform/organizations/${parsed.data.organizationId}?saved=1`);
}

export async function updateOrganizationStatusAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "organization.manage");
  const organizationId = text(form, "organizationId");
  const status = text(form, "status");
  const reason = text(form, "reason");
  if (!z.string().uuid().safeParse(organizationId).success || !["active", "suspended", "archived"].includes(status) || reason.length < 8 || reason.length > 300) fail("/platform/organizations", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query("UPDATE organizations SET status = $1, updated_at = now(), archived_at = CASE WHEN $1 = 'archived' THEN now() ELSE NULL END WHERE id = $2", [status, organizationId]);
    if (!changed.rowCount) throw new Error("not found");
    await insertPlatformAudit(client, { actorId: actor.id, action: "organization.status_changed", entityType: "organization", entityId: organizationId, reason, metadata: { status } });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/platform/organizations", "could-not-save");
  } finally { client.release(); }
  revalidatePath("/platform/organizations");
  revalidatePath(`/platform/organizations/${organizationId}`);
  redirect(`/platform/organizations/${organizationId}?saved=1`);
}

export async function suspendPlatformAdminAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "platform_admin.manage");
  const targetId = text(form, "platformAdminId");
  const reason = text(form, "reason");
  if (!z.string().uuid().safeParse(targetId).success || targetId === actor.id || reason.length < 8 || reason.length > 300) fail("/platform/admins", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query(
      "UPDATE platform_admins SET status = 'suspended', updated_at = now() WHERE id = $1 AND status = 'active'",
      [targetId],
    );
    if (!changed.rowCount) throw new Error("not found");
    await client.query("DELETE FROM platform_admin_sessions WHERE user_id = $1", [targetId]);
    await insertPlatformAudit(client, {
      actorId: actor.id, action: "platform_admin.suspended", entityType: "platform_admin", entityId: targetId,
      reason,
    });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/platform/admins", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/platform/admins");
  redirect("/platform/admins?saved=1");
}

export async function updatePlatformSettingAction(form: FormData): Promise<void> {
  const actor = await requirePlatformActor();
  await assertPlatformPermission(actor, "platform_settings.manage");
  const key = text(form, "key");
  const value = text(form, "value");
  const reason = text(form, "reason");
  if (!/^[a-z][a-z0-9_.-]{2,80}$/.test(key) || value.length > 500 || reason.length < 8 || reason.length > 300) fail("/platform/settings", "invalid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO platform_settings (key, value, updated_by, updated_at)
       VALUES ($1, to_jsonb($2::text), $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, value, actor.id],
    );
    await insertPlatformAudit(client, {
      actorId: actor.id, action: "platform_setting.updated", entityType: "platform_setting", entityId: key,
      reason, metadata: { key },
    });
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    fail("/platform/settings", "could-not-save");
  } finally {
    client.release();
  }
  revalidatePath("/platform/settings");
  redirect("/platform/settings?saved=1");
}
