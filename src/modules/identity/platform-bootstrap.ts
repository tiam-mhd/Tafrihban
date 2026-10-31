import type { PoolClient } from "pg";

export async function ensureSuperadminRole(client: PoolClient, adminId: string, created: boolean): Promise<{ rolePreserved: boolean }> {
  const role = await client.query<{ id: string }>(
    "SELECT id FROM platform_admin_roles WHERE key = 'SUPERADMIN' AND grants_all_permissions = true AND status = 'active'",
  );
  if (!role.rowCount) throw new Error("The wildcard SUPERADMIN role is missing; run migrations first.");
  const assignments = await client.query<{ role_id: string }>(
    "SELECT role_id FROM platform_admin_role_assignments WHERE platform_admin_id = $1",
    [adminId],
  );
  if (created || assignments.rows.length === 0) {
    await client.query(
      `INSERT INTO platform_admin_role_assignments (id, platform_admin_id, role_id)
       VALUES (gen_random_uuid()::text, $1, $2) ON CONFLICT (platform_admin_id, role_id) DO NOTHING`,
      [adminId, role.rows[0]!.id],
    );
  }
  if (created) await client.query("UPDATE platform_admins SET must_change_password = true WHERE id = $1", [adminId]);
  return { rolePreserved: !created && assignments.rows.length > 0 };
}
