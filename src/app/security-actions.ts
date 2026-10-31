"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pool } from "@/db";
import { platformAuth } from "@/lib/platform-auth";

const passwordInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
  confirmation: z.string().min(1).max(128),
}).refine((value) => value.newPassword === value.confirmation, { path: ["confirmation"] })
  .refine((value) => value.currentPassword !== value.newPassword, { path: ["newPassword"] });

function raw(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function invalid(path: string): never {
  redirect(`${path}?error=invalid`);
}

export async function changePlatformPasswordAction(form: FormData): Promise<void> {
  const path = "/platform/security/change-password";
  const parsed = passwordInput.extend({ newPassword: z.string().min(14).max(128) }).safeParse({
    currentPassword: raw(form, "currentPassword"),
    newPassword: raw(form, "newPassword"),
    confirmation: raw(form, "confirmation"),
  });
  if (!parsed.success) invalid(path);

  const requestHeaders = await headers();
  const session = await platformAuth.api.getSession({ headers: requestHeaders });
  if (!session?.user?.id) redirect("/platform/login");
  const admin = await pool.query<{ status: string }>("SELECT status FROM platform_admins WHERE id = $1", [session.user.id]);
  if (admin.rows[0]?.status !== "active") redirect("/platform/login?reason=inactive");

  try {
    await platformAuth.api.changePassword({
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true },
      headers: requestHeaders,
    });
  } catch {
    invalid(path);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE platform_admins SET must_change_password = false, updated_at = now() WHERE id = $1", [session.user.id]);
    await client.query(
      `INSERT INTO platform_admin_audit_events (id, actor_platform_admin_id, action, entity_type, entity_id, reason)
       VALUES (gen_random_uuid()::text, $1, 'platform_admin.password_changed', 'platform_admin', $1, 'Self-service password update')`,
      [session.user.id],
    );
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    invalid(path);
  } finally {
    client.release();
  }
  revalidatePath("/platform");
  revalidatePath(path);
  redirect(`${path}?changed=1`);
}
