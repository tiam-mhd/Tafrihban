"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { platformAuth } from "@/lib/platform-auth";
import { parsePlatformPasswordInput } from "@/modules/identity/platform-password";

function raw(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function invalid(path: string, reason = "invalid"): never {
  redirect(`${path}?error=${reason}`);
}

function safeErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("body" in error && typeof error.body === "object" && error.body !== null && "code" in error.body && typeof error.body.code === "string") {
    return error.body.code;
  }
  return undefined;
}

function logPasswordChangeFailure(phase: string, error: unknown): void {
  const code = safeErrorCode(error);
  console.error("Platform password change failed", {
    phase,
    name: error instanceof Error ? error.name : "UnknownError",
    ...(code ? { code } : {}),
  });
}

export async function changePlatformPasswordAction(form: FormData): Promise<void> {
  const path = "/platform/security/change-password";
  const parsed = parsePlatformPasswordInput({
    currentPassword: raw(form, "currentPassword"),
    newPassword: raw(form, "newPassword"),
    confirmation: raw(form, "confirmation"),
  });
  if (!parsed.success) invalid(path);

  const requestHeaders = await headers();
  let session: Awaited<ReturnType<typeof platformAuth.api.getSession>>;
  try {
    session = await platformAuth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    logPasswordChangeFailure("session", error);
    invalid(path, "failed");
  }
  if (!session?.user?.id) redirect("/platform/login");
  let adminStatus: string | undefined;
  try {
    const admin = await pool.query<{ status: string }>("SELECT status FROM platform_admins WHERE id = $1", [session.user.id]);
    adminStatus = admin.rows[0]?.status;
  } catch (error) {
    logPasswordChangeFailure("account", error);
    invalid(path, "failed");
  }
  if (adminStatus !== "active") redirect("/platform/login?reason=inactive");

  try {
    await platformAuth.api.changePassword({
      // Preserve this server action's current cookie; revoke other sessions below.
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: false },
      headers: requestHeaders,
    });
  } catch (error) {
    if (safeErrorCode(error) !== "INVALID_PASSWORD") {
      logPasswordChangeFailure("credential-change", error);
      invalid(path, "failed");
    }
    invalid(path);
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const transaction = client;
    await transaction.query("BEGIN");
    await transaction.query("UPDATE platform_admins SET must_change_password = false, updated_at = now() WHERE id = $1", [session.user.id]);
    await transaction.query(
      "DELETE FROM platform_admin_sessions WHERE user_id = $1 AND token <> $2",
      [session.user.id, session.session.token],
    );
    await transaction.query(
      `INSERT INTO platform_admin_audit_events (id, actor_platform_admin_id, action, entity_type, entity_id, reason)
       VALUES (gen_random_uuid()::text, $1, 'platform_admin.password_changed', 'platform_admin', $1, 'Self-service password update')`,
      [session.user.id],
    );
    await transaction.query("COMMIT");
  } catch (error) {
    logPasswordChangeFailure("finalize", error);
    await client?.query("ROLLBACK").catch(() => undefined);
    invalid(path, "failed");
  } finally {
    client?.release();
  }
  redirect(`${path}?changed=1`);
}
