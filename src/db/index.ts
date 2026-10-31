import "server-only";

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "../../db/auth-schema";
import { requiredEnv } from "@/lib/env";

const globalDb = globalThis as typeof globalThis & { tafrihbanPool?: Pool };

export const pool =
  globalDb.tafrihbanPool ??
  new Pool({
    connectionString: requiredEnv("DATABASE_URL"),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "tafrihban-web",
  });

if (process.env.NODE_ENV !== "production") globalDb.tafrihbanPool = pool;

export const db = drizzle(pool, { schema: authSchema });
