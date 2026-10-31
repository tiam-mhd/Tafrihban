import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { createDefaultOperationalRoles } from "../src/modules/organizations/default-roles";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());
if (process.env.NODE_ENV !== "development") {
  throw new Error("Development fixtures are disabled unless NODE_ENV=development.");
}
const fixturePassword = process.env.DEV_FIXTURE_PASSWORD;
if (!fixturePassword || fixturePassword.length < 12) {
  throw new Error("Set DEV_FIXTURE_PASSWORD (12+ characters) to create the local fixture account.");
}

const [{ pool }, { createOperationalUser }] = await Promise.all([
  import("../src/db"),
  import("../src/modules/identity/accounts"),
]);

try {
  const email = "inspector@example.test";
  const account = await createOperationalUser({ email, name: "بازرس آزمایشی", password: fixturePassword });
  const existing = await pool.query<{ id: string }>("SELECT id FROM organizations WHERE slug = 'fixture-park'");
  if (existing.rowCount) {
    console.info("Development fixture already exists; no data was changed.");
    process.exitCode = 0;
  } else {
    const client = await pool.connect();
    const organizationId = randomUUID();
    const branchId = randomUUID();
    const membershipId = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO organizations (id, name, slug) VALUES ($1, 'مجموعهٔ آزمایشی', 'fixture-park')",
        [organizationId],
      );
      await client.query(
        "INSERT INTO branches (id, organization_id, name, code) VALUES ($1, $2, 'شعبهٔ نمونه', 'DEMO')",
        [branchId, organizationId],
      );
      await createDefaultOperationalRoles(client, organizationId);
      await client.query(
        `INSERT INTO organization_memberships (id, user_id, organization_id, status, joined_at)
         VALUES ($1, $2, $3, 'active', now())`,
        [membershipId, account.id, organizationId],
      );
      await client.query(
        `INSERT INTO branch_memberships (id, membership_id, organization_id, branch_id)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), membershipId, organizationId, branchId],
      );
      const role = await client.query<{ id: string }>(
        "SELECT id FROM operational_roles WHERE organization_id = $1 AND key = 'inspector'",
        [organizationId],
      );
      await client.query(
        `INSERT INTO membership_role_assignments
           (id, membership_id, organization_id, role_id, scope_type, branch_id)
         VALUES ($1, $2, $3, $4, 'branch', $5)`,
        [randomUUID(), membershipId, organizationId, role.rows[0]!.id, branchId],
      );
      await client.query("COMMIT");
      console.info("Created fake development organization, branch and inspector account.");
      console.info(`Sign in with ${email} and the operator-provided DEV_FIXTURE_PASSWORD.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
