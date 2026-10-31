import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/db";
import { authBaseUrl, isProduction, requiredEnv } from "@/lib/env";
import {
  platformAdminAccounts,
  platformAdminSessions,
  platformAdminTwoFactors,
  platformAdminVerifications,
  platformAdmins,
} from "../../db/auth-schema";

const platformAuthSchema = {
  // Keep the adapter's logical keys and the schema checker's configured model names.
  user: platformAdmins,
  session: platformAdminSessions,
  account: platformAdminAccounts,
  verification: platformAdminVerifications,
  twoFactor: platformAdminTwoFactors,
  platform_admins: platformAdmins,
  platform_admin_sessions: platformAdminSessions,
  platform_admin_accounts: platformAdminAccounts,
  platform_admin_verifications: platformAdminVerifications,
  platform_admin_two_factors: platformAdminTwoFactors,
};

export const platformAuth = betterAuth({
  appName: "Tafrihban Platform",
  baseURL: authBaseUrl(),
  basePath: "/api/platform-auth",
  secret: requiredEnv("PLATFORM_AUTH_SECRET"),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: platformAuthSchema,
  }),
  user: {
    modelName: "platform_admins",
    additionalFields: {
      status: { type: "string", required: false, defaultValue: "active", input: false },
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  session: {
    modelName: "platform_admin_sessions",
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 60 * 2,
    cookieCache: { enabled: false },
  },
  account: { modelName: "platform_admin_accounts" },
  verification: { modelName: "platform_admin_verifications" },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 14,
    maxPasswordLength: 128,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
  },
  plugins: [twoFactor({ issuer: "Tafrihban Platform", twoFactorTable: "platform_admin_two_factors" })],
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  advanced: {
    database: { generateId: "uuid" },
    cookiePrefix: "tafrihban-platform",
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
