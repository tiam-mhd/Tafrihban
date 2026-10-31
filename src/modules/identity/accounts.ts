import "server-only";

import { randomUUID } from "node:crypto";
import { pool } from "@/db";
import { normalizeIranianMobile } from "@/modules/identity/iranian-phone";

export async function findOperationalUser(phone: string): Promise<{ id: string; name: string } | null> {
  const phoneNumber = normalizeIranianMobile(phone);
  if (!phoneNumber) return null;
  const result = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE phone_number = $1 AND status = 'active'",
    [phoneNumber],
  );
  return result.rows[0] ?? null;
}

export async function createOperationalUser(input: {
  phone: string;
  name: string;
}): Promise<{ id: string; created: boolean }> {
  const phoneNumber = normalizeIranianMobile(input.phone);
  if (!phoneNumber) throw new Error("A valid Iranian mobile number is required");
  const existing = await findOperationalUser(phoneNumber);
  if (existing) return { id: existing.id, created: false };

  const id = randomUUID();
  const email = "ops." + id + "@accounts.tafrihban.invalid";
  const result = await pool.query<{ id: string }>(
    "INSERT INTO users (id, name, email, phone_number, status) " +
      "VALUES ($1, $2, $3, $4, 'active') ON CONFLICT DO NOTHING RETURNING id",
    [id, input.name.trim(), email, phoneNumber],
  );
  if (result.rows[0]) return { id: result.rows[0].id, created: true };

  const raced = await findOperationalUser(phoneNumber);
  if (raced) return { id: raced.id, created: false };
  throw new Error("The operational mobile number is already reserved");
}

export async function removeUnusedOperationalUser(userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM users u WHERE u.id = $1
      AND NOT EXISTS (SELECT 1 FROM organization_memberships om WHERE om.user_id = u.id)`,
    [userId],
  );
}
