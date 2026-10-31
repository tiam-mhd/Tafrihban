import test from "node:test";
import assert from "node:assert/strict";
import { grantsPermission } from "../src/modules/authorization/permissions";

test("SUPERADMIN wildcard grants permissions added after its role was assigned", () => {
  const futurePermission = "platform.release.approve";
  assert.equal(grantsPermission({ grantsAllPermissions: true, permissionKeys: new Set() }, futurePermission), true);
});

test("ordinary roles require an explicit permission", () => {
  const role = { grantsAllPermissions: false, permissionKeys: new Set(["equipment.read"]) };
  assert.equal(grantsPermission(role, "equipment.read"), true);
  assert.equal(grantsPermission(role, "equipment.manage"), false);
});
