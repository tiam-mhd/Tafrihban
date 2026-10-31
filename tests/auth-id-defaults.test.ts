import test from "node:test";
import assert from "node:assert/strict";
import {
  platformAdminAccounts,
  platformAdminSessions,
  platformAdminTwoFactors,
  platformAdminVerifications,
  platformAdmins,
  userAccounts,
  userSessions,
  userVerifications,
  users,
} from "../db/auth-schema";

test("Better Auth Drizzle identity tables declare PostgreSQL UUID text defaults", () => {
  for (const [name, table] of [
    ["users", users],
    ["user_sessions", userSessions],
    ["user_accounts", userAccounts],
    ["user_verifications", userVerifications],
    ["platform_admins", platformAdmins],
    ["platform_admin_sessions", platformAdminSessions],
    ["platform_admin_accounts", platformAdminAccounts],
    ["platform_admin_verifications", platformAdminVerifications],
    ["platform_admin_two_factors", platformAdminTwoFactors],
  ] as const) {
    assert.equal(table.id.hasDefault, true, `${name}.id should be database generated`);
  }
});
