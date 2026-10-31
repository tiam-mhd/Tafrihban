import "server-only";

import { pool } from "@/db";
import { isIranianE164 } from "@/modules/identity/iranian-phone";
import { sendParsGreenOtp } from "@/modules/identity/pars-green-otp";

export async function deliverOperationalOtp(phoneNumber: string, code: string): Promise<void> {
  if (!isIranianE164(phoneNumber)) return;

  // The explicit local test sink reads Better Auth's local verification row;
  // it never sends E2E codes to real phone numbers.
  if (process.env.NODE_ENV !== "production" && process.env.TAFRIHBAN_TEST_OTP_SINK === "1") return;

  const eligible = await pool.query(
    "SELECT 1 FROM users u WHERE u.phone_number = $1 AND u.status = 'active' " +
      "AND EXISTS (SELECT 1 FROM organization_memberships om " +
      "JOIN organizations o ON o.id = om.organization_id AND o.status = 'active' " +
      "JOIN branches b ON b.organization_id = o.id AND b.status = 'active' " +
      "WHERE om.user_id = u.id AND om.status = 'active' AND (" +
      "EXISTS (SELECT 1 FROM membership_role_assignments a " +
      "JOIN operational_roles r ON r.id = a.role_id AND r.status = 'active' " +
      "WHERE a.membership_id = om.id AND a.organization_id = om.organization_id " +
      "AND a.scope_type = 'organization' AND a.branch_id IS NULL) " +
      "OR EXISTS (SELECT 1 FROM branch_memberships bm " +
      "WHERE bm.membership_id = om.id AND bm.organization_id = o.id " +
      "AND bm.branch_id = b.id AND bm.status = 'active'))) LIMIT 1",
    [phoneNumber],
  );
  if (!eligible.rowCount) return;

  await sendParsGreenOtp(phoneNumber, code);
}
