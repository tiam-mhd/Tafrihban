import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { ensureSuperadminRole } from "../src/modules/identity/platform-bootstrap";
import { OPERATIONAL_SCOPE_QUERY } from "../src/server/scope-queries";

const dbTest = process.env.DATABASE_URL ? test : test.skip;

dbTest("branch scope rejects cross-tenant and sibling-branch requests; composite foreign keys reject mixed tenant rows", async () => {
  const database = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const authIdDefaults = await client.query<{ table_name: string; column_default: string | null }>(
      `SELECT table_name, column_default
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = ANY($1::text[])
          AND column_name = 'id'`,
      [[
        "users", "user_sessions", "user_accounts", "user_verifications",
        "platform_admins", "platform_admin_sessions", "platform_admin_accounts",
        "platform_admin_verifications", "platform_admin_two_factors",
      ]],
    );
    assert.equal(authIdDefaults.rowCount, 9);
    assert.ok(authIdDefaults.rows.every((row) => row.column_default?.includes("gen_random_uuid")));

    const orgA = randomUUID();
    const orgB = randomUUID();
    const branchA = randomUUID();
    const branchASibling = randomUUID();
    const branchB = randomUUID();
    const userId = randomUUID();
    const membershipId = randomUUID();
    await client.query("INSERT INTO organizations (id, name, slug) VALUES ($1, 'Test A', $2), ($3, 'Test B', $4)", [orgA, `test-${orgA}`, orgB, `test-${orgB}`]);
    await client.query("INSERT INTO branches (id, organization_id, name, code) VALUES ($1,$2,'A-1','A1'),($3,$2,'A-2','A2'),($4,$5,'B-1','B1')", [branchA, orgA, branchASibling, branchB, orgB]);
    await client.query("INSERT INTO users (id, name, email) VALUES ($1, 'Scope Test', $2)", [userId, `${userId}@example.test`]);
    await client.query("INSERT INTO organization_memberships (id,user_id,organization_id,status) VALUES ($1,$2,$3,'active')", [membershipId, userId, orgA]);
    await client.query("INSERT INTO branch_memberships (id,membership_id,organization_id,branch_id,status) VALUES ($1,$2,$3,$4,'active')", [randomUUID(), membershipId, orgA, branchA]);

    const allowed = await client.query(OPERATIONAL_SCOPE_QUERY, [userId, orgA, branchA]);
    const otherTenant = await client.query(OPERATIONAL_SCOPE_QUERY, [userId, orgB, branchB]);
    const siblingBranch = await client.query(OPERATIONAL_SCOPE_QUERY, [userId, orgA, branchASibling]);
    assert.equal(allowed.rows.length, 1);
    assert.equal(otherTenant.rows.length, 0);
    assert.equal(siblingBranch.rows.length, 0);

    const categoryId = randomUUID();
    await client.query("INSERT INTO equipment_categories (id,organization_id,name) VALUES ($1,$2,'Test Category')", [categoryId, orgA]);
    await client.query("SAVEPOINT cross_tenant_equipment");
    await assert.rejects(
      client.query(
        `INSERT INTO equipment (id,organization_id,branch_id,category_id,public_qr_id,asset_code,name)
         VALUES ($1,$2,$3,$4,$5,'MIXED-1','Mixed tenant row')`,
        [randomUUID(), orgA, branchB, categoryId, randomUUID()],
      ),
      (error: { code?: string }) => error.code === "23503",
    );
    await client.query("ROLLBACK TO SAVEPOINT cross_tenant_equipment");

    const existingAdminId = randomUUID();
    await client.query("INSERT INTO platform_admins (id,name,email) VALUES ($1,'Existing Admin',$2)", [existingAdminId, `${existingAdminId}@example.test`]);
    await client.query("INSERT INTO platform_admin_role_assignments (id,platform_admin_id,role_id) VALUES ($1,$2,'system-platform-operator')", [randomUUID(), existingAdminId]);
    await ensureSuperadminRole(client, existingAdminId, false);
    const preserved = await client.query("SELECT role_id FROM platform_admin_role_assignments WHERE platform_admin_id = $1", [existingAdminId]);
    assert.deepEqual(preserved.rows.map((row) => row.role_id), ["system-platform-operator"]);

    const newAdminId = randomUUID();
    await client.query("INSERT INTO platform_admins (id,name,email) VALUES ($1,'Bootstrap Admin',$2)", [newAdminId, `${newAdminId}@example.test`]);
    await ensureSuperadminRole(client, newAdminId, true);
    await client.query("UPDATE platform_admins SET must_change_password = false WHERE id = $1", [newAdminId]);
    await ensureSuperadminRole(client, newAdminId, false);
    const bootstrapped = await client.query(
      `SELECT a.role_id, p.must_change_password FROM platform_admin_role_assignments a
         JOIN platform_admins p ON p.id = a.platform_admin_id WHERE p.id = $1`, [newAdminId]);
    assert.equal(bootstrapped.rows[0]?.role_id, "system-superadmin");
    assert.equal(bootstrapped.rows[0]?.must_change_password, false);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await database.end();
  }
});
