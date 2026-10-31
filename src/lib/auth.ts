import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { authBaseUrl, isProduction, requiredEnv } from "@/lib/env";
import { userAccounts, userSessions, userVerifications, users } from "../../db/auth-schema";

const operationalAuthSchema = {
  // Better Auth addresses CRUD models by their singular keys; its schema
  // checker addresses custom modelName values, so expose both aliases.
  user: users,
  session: userSessions,
  account: userAccounts,
  verification: userVerifications,
  users,
  user_sessions: userSessions,
  user_accounts: userAccounts,
  user_verifications: userVerifications,
};

export const operationalAuth = betterAuth({
  appName: "تفریح‌بان",
  baseURL: authBaseUrl(),
  basePath: "/api/auth",
  secret: requiredEnv("BETTER_AUTH_SECRET"),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: operationalAuthSchema,
  }),
  user: {
    modelName: "users",
    additionalFields: {
      status: { type: "string", required: false, defaultValue: "active", input: false },
      locale: { type: "string", required: false, defaultValue: "fa", input: false },
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  session: {
    modelName: "user_sessions",
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 12,
    cookieCache: { enabled: false },
  },
  account: { modelName: "user_accounts" },
  verification: { modelName: "user_verifications" },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
  },
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 4 },
    },
  },
  advanced: {
    database: { generateId: "uuid" },
    cookiePrefix: "tafrihban-ops",
    useSecureCookies: isProduction(),
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      path: "/",
    },
  },
  trustedOrigins: [authBaseUrl()],
  telemetry: { enabled: false },
});
