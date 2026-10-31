import "server-only";

import { pool } from "@/db";
import type { OperationalActor } from "@/server/auth-guards";

export async function listAccessibleScopes(actor: OperationalActor) {
  const { rows } = await pool.query<{
    organization_id: string;
    organization_name: string;
    branch_id: string;
    branch_name: string;
    timezone: string;
  }>(
    `SELECT DISTINCT o.id AS organization_id, o.name AS organization_name,
            b.id AS branch_id, b.name AS branch_name, COALESCE(b.timezone, o.timezone) AS timezone
       FROM organization_memberships om
       JOIN organizations o ON o.id = om.organization_id AND o.status = 'active'
       JOIN branches b ON b.organization_id = o.id AND b.status = 'active'
      WHERE om.user_id = $1 AND om.status = 'active'
        AND (
          EXISTS (
            SELECT 1 FROM membership_role_assignments a
            JOIN operational_roles r ON r.id = a.role_id AND r.status = 'active'
            WHERE a.membership_id = om.id AND a.organization_id = om.organization_id
              AND a.scope_type = 'organization' AND a.branch_id IS NULL
          )
          OR EXISTS (
            SELECT 1 FROM branch_memberships bm
            WHERE bm.membership_id = om.id AND bm.organization_id = o.id
              AND bm.branch_id = b.id AND bm.status = 'active'
          )
        )
      ORDER BY o.name, b.name`,
    [actor.id],
  );
  return rows;
}
