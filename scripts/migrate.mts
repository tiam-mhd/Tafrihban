import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import nextEnv from "@next/env";
import { Pool } from "pg";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to run migrations.");

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 });
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const directory = join(process.cwd(), "db", "migrations");
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of names) {
    const sql = await readFile(join(directory, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const previous = await pool.query<{ checksum: string }>(
      "SELECT checksum FROM schema_migrations WHERE name = $1",
      [name],
    );
    if (previous.rowCount) {
      if (previous.rows[0]?.checksum !== checksum) {
        throw new Error(`Applied migration ${name} was edited. Add a new migration instead.`);
      }
      console.info(`already applied: ${name}`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [name, checksum]);
      await client.query("COMMIT");
      console.info(`applied: ${name}`);
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
