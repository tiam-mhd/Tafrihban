import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export async function insertOperationalAudit(client: PoolClient, input: {
  actorId: string;
  organizationId: string;
  branchId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await client.query(
    `INSERT INTO audit_events
       (id, actor_user_id, organization_id, branch_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [randomUUID(), input.actorId, input.organizationId, input.branchId ?? null, input.action,
      input.entityType, input.entityId ?? null, JSON.stringify(input.metadata ?? {})],
  );
}

export async function insertPlatformAudit(client: PoolClient, input: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await client.query(
    `INSERT INTO platform_admin_audit_events
       (id, actor_platform_admin_id, action, entity_type, entity_id, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [randomUUID(), input.actorId, input.action, input.entityType, input.entityId ?? null,
      input.reason ?? null, JSON.stringify(input.metadata ?? {})],
  );
}
