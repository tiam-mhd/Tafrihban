export type PermissionGrant = {
  grantsAllPermissions: boolean;
  permissionKeys: ReadonlySet<string>;
};

export function grantsPermission(role: PermissionGrant, permission: string): boolean {
  return role.grantsAllPermissions || role.permissionKeys.has(permission);
}
