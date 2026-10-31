const ELEVATED_MEMBER_PERMISSIONS = new Set([
  "organization.manage",
  "branch.manage",
  "member.manage",
  "role.manage",
]);

export function canAssignMemberRole(input: {
  actorCanManageOrganizationMembers: boolean;
  roleKey: string;
  rolePermissionKeys: readonly string[];
  scopeType: "organization" | "branch";
}): boolean {
  if (input.roleKey === "organization_manager") return false;
  if (input.scopeType === "organization" && !input.actorCanManageOrganizationMembers) return false;
  if (input.roleKey === "branch_manager" && (!input.actorCanManageOrganizationMembers || input.scopeType !== "branch")) return false;
  if (!input.actorCanManageOrganizationMembers && input.rolePermissionKeys.some((key) => ELEVATED_MEMBER_PERMISSIONS.has(key))) return false;
  return true;
}

export function canListAssignableMemberRole(input: {
  actorCanManageOrganizationMembers: boolean;
  roleKey: string;
  rolePermissionKeys: readonly string[];
}): boolean {
  return canAssignMemberRole({ ...input, scopeType: "branch" });
}

export function canRevokeMemberAssignment(input: {
  actorCanManageOrganizationMembers: boolean;
  targetHasOrganizationRole: boolean;
  targetHasElevatedBranchRole: boolean;
}): boolean {
  if (input.actorCanManageOrganizationMembers) return true;
  return !input.targetHasOrganizationRole && !input.targetHasElevatedBranchRole;
}
