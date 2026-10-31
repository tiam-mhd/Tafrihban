import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIranianMobile } from "../src/modules/identity/iranian-phone";
import { PARSGREEN_OTP_ENDPOINT, sendParsGreenOtp } from "../src/modules/identity/pars-green-otp";
import { canAssignMemberRole, canListAssignableMemberRole, canRevokeMemberAssignment } from "../src/modules/identity/member-management-policy";

test("Iranian mobile normalization accepts Persian digits and common country prefixes", () => {
  assert.equal(normalizeIranianMobile("۰۹۱۲ ۳۴۵ ۶۷۸۹"), "+989123456789");
  assert.equal(normalizeIranianMobile("00989123456789"), "+989123456789");
  assert.equal(normalizeIranianMobile("+98 (912) 345-6789"), "+989123456789");
  assert.equal(normalizeIranianMobile("+12025550123"), null);
});

test("ParsGreen OTP uses its token, Iranian mobile, and six digit code over HTTPS", async () => {
  let requestedUrl = "";
  let requestedHeaders: HeadersInit | undefined;
  let requestedBody = "";
  const fetcher: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedHeaders = init?.headers;
    requestedBody = String(init?.body);
    return new Response(JSON.stringify({ R_Success: true }), { status: 200 });
  };

  await sendParsGreenOtp("+989123456789", "123456", "local-test-token", fetcher);

  assert.equal(requestedUrl, PARSGREEN_OTP_ENDPOINT);
  assert.equal(new URL(requestedUrl).protocol, "https:");
  assert.equal(new Headers(requestedHeaders).get("authorization"), "basic apikey:local-test-token");
  assert.deepEqual(JSON.parse(requestedBody), {
    Mobile: "09123456789",
    SmsCode: "123456",
    TemplateId: 0,
    AddName: true,
  });
});

test("ParsGreen OTP fails closed on a provider rejection", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ R_Success: false }), { status: 200 });
  await assert.rejects(sendParsGreenOtp("+989123456789", "123456", "local-test-token", fetcher));
});

test("branch managers can assign ordinary branch roles but cannot delegate management", () => {
  assert.equal(canAssignMemberRole({
    actorCanManageOrganizationMembers: false,
    roleKey: "inspector",
    rolePermissionKeys: ["inspection.create"],
    scopeType: "branch",
  }), true);
  assert.equal(canAssignMemberRole({
    actorCanManageOrganizationMembers: false,
    roleKey: "branch_manager",
    rolePermissionKeys: ["member.manage"],
    scopeType: "branch",
  }), false);
  assert.equal(canAssignMemberRole({
    actorCanManageOrganizationMembers: false,
    roleKey: "inspector",
    rolePermissionKeys: ["inspection.create"],
    scopeType: "organization",
  }), false);
});

test("organization managers may create branch managers only in branch scope", () => {
  const role = { roleKey: "branch_manager", rolePermissionKeys: ["member.manage"] };
  assert.equal(canAssignMemberRole({ ...role, actorCanManageOrganizationMembers: true, scopeType: "branch" }), true);
  assert.equal(canAssignMemberRole({ ...role, actorCanManageOrganizationMembers: true, scopeType: "organization" }), false);
  assert.equal(canListAssignableMemberRole({ ...role, actorCanManageOrganizationMembers: false }), false);
});

test("branch managers cannot revoke organization or elevated branch managers", () => {
  assert.equal(canRevokeMemberAssignment({ actorCanManageOrganizationMembers: false, targetHasOrganizationRole: false, targetHasElevatedBranchRole: false }), true);
  assert.equal(canRevokeMemberAssignment({ actorCanManageOrganizationMembers: false, targetHasOrganizationRole: true, targetHasElevatedBranchRole: false }), false);
  assert.equal(canRevokeMemberAssignment({ actorCanManageOrganizationMembers: false, targetHasOrganizationRole: false, targetHasElevatedBranchRole: true }), false);
  assert.equal(canRevokeMemberAssignment({ actorCanManageOrganizationMembers: true, targetHasOrganizationRole: true, targetHasElevatedBranchRole: true }), true);
});
