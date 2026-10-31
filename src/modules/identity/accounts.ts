import "server-only";

import { pool } from "@/db";
import { operationalAuth } from "@/lib/auth";

export async function findOperationalUser(email: string): Promise<{ id: string; name: string } | null> {
  const result = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE email = $1 AND status = 'active'",
    [email.trim().toLowerCase()],
  );
  return result.rows[0] ?? null;
}

export async function createOperationalUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ id: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const existing = await findOperationalUser(email);
  if (existing) return { id: existing.id, created: false };

  const result = await operationalAuth.api.signUpEmail({
    body: {
      email,
      name: input.name.trim(),
      password: input.password,
    },
  });
  await pool.query("UPDATE users SET must_change_password = true WHERE id = $1", [result.user.id]);
  return { id: result.user.id, created: true };
}

export async function removeUnusedOperationalUser(userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM users u WHERE u.id = $1
      AND NOT EXISTS (SELECT 1 FROM organization_memberships om WHERE om.user_id = u.id)`,
    [userId],
  );
}
