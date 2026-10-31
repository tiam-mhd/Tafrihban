import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";

const ROLE_DEFINITIONS = [
  {
    key: "organization_manager",
    name: "مدیر مجموعه",
    description: "مدیریت همهٔ شعب و گردش‌کارهای مجموعه.",
    permissions: "all" as const,
  },
  {
    key: "branch_manager",
    name: "مدیر شعبه",
    description: "مدیریت کارهای روزمره در شعبهٔ واگذارشده.",
    permissions: [
      "dashboard.read", "member.manage", "equipment.read", "equipment.manage", "checklist.read", "inspection_schedule.manage",
      "inspection.read", "inspection.create", "defect.manage", "work_order.manage", "work_order.close", "report.export", "audit.read",
    ],
  },
  {
    key: "inspector",
    name: "بازرس",
    description: "مشاهدهٔ تجهیز و ثبت بازرسی.",
    permissions: ["dashboard.read", "equipment.read", "checklist.read", "inspection.read", "inspection.create"],
  },
  {
    key: "technician",
    name: "تعمیرکار",
    description: "رسیدگی به عیب و به‌روزرسانی کارهای تعمیراتی.",
    permissions: ["dashboard.read", "equipment.read", "inspection.read", "defect.manage", "work_order.manage"],
  },
] as const;

export async function createDefaultOperationalRoles(client: PoolClient, organizationId: string): Promise<void> {
  const allPermissions = await client.query<{ key: string }>("SELECT key FROM permissions ORDER BY key");
  for (const role of ROLE_DEFINITIONS) {
    const roleId = randomUUID();
    await client.query(
      `INSERT INTO operational_roles (id, organization_id, key, name, description, is_system_role)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (organization_id, key) DO NOTHING`,
      [roleId, organizationId, role.key, role.name, role.description],
    );
    const storedRole = await client.query<{ id: string }>(
      "SELECT id FROM operational_roles WHERE organization_id = $1 AND key = $2",
      [organizationId, role.key],
    );
    const permissionKeys = role.permissions === "all" ? allPermissions.rows.map((item) => item.key) : role.permissions;
    for (const permissionKey of permissionKeys) {
      await client.query(
        `INSERT INTO operational_role_permissions (role_id, permission_key)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [storedRole.rows[0]!.id, permissionKey],
      );
    }
  }
}
