import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.SUPERADMIN_NAME?.trim();
const password = process.env.SUPERADMIN_INITIAL_PASSWORD;
if (!email || !name || !password) {
  throw new Error("Set SUPERADMIN_EMAIL, SUPERADMIN_NAME and SUPERADMIN_INITIAL_PASSWORD before bootstrapping.");
}
if (password.length < 14 || password.length > 128) {
  throw new Error("SUPERADMIN_INITIAL_PASSWORD must be between 14 and 128 characters.");
}

const [{ platformAuth }, { pool }] = await Promise.all([
  import("../src/lib/platform-auth"),
  import("../src/db"),
]);
const { ensureSuperadminRole } = await import("../src/modules/identity/platform-bootstrap");

try {
  let admin = await pool.query<{ id: string }>(
    "SELECT id FROM platform_admins WHERE email = $1",
    [email],
  );
  let created = false;
  if (!admin.rowCount) {
    const result = await platformAuth.api.signUpEmail({ body: { email, name, password } });
    admin = { ...admin, rows: [{ id: result.user.id }], rowCount: 1 };
    created = true;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bootstrap = await ensureSuperadminRole(client, admin.rows[0]!.id, created);
    await client.query(
      `INSERT INTO platform_admin_audit_events
         (id, actor_platform_admin_id, action, entity_type, entity_id, reason, metadata)
       VALUES (gen_random_uuid()::text, $1, $2, 'platform_admin', $1, 'Initial environment bootstrap', $3::jsonb)`,
      [admin.rows[0]!.id, created ? "platform_admin.bootstrap_created" : "platform_admin.bootstrap_verified", JSON.stringify(bootstrap)],
    );
    await client.query("COMMIT");
    console.info(created ? "SUPERADMIN account created and audited." : "Existing platform account preserved and audited.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
