import test from "node:test";
import assert from "node:assert/strict";
import { parsePlatformPasswordInput } from "../src/modules/identity/platform-password";

test("platform password input validates policy without extending a refined Zod schema", () => {
  assert.equal(parsePlatformPasswordInput({
    currentPassword: "temporary-password",
    newPassword: "new-password-1234",
    confirmation: "new-password-1234",
  }).success, true);

  assert.equal(parsePlatformPasswordInput({
    currentPassword: "temporary-password",
    newPassword: "short",
    confirmation: "short",
  }).success, false);
  assert.equal(parsePlatformPasswordInput({
    currentPassword: "temporary-password",
    newPassword: "new-password-1234",
    confirmation: "different-password",
  }).success, false);
  assert.equal(parsePlatformPasswordInput({
    currentPassword: "same-password-1234",
    newPassword: "same-password-1234",
    confirmation: "same-password-1234",
  }).success, false);
});
