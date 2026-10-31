export const PLATFORM_ADMIN_PERMISSION_QUERY = `
  SELECT DISTINCT r.grants_all_permissions, rp.permission_key
    FROM platform_admin_role_assignments a
    JOIN platform_admin_roles r ON r.id = a.role_id AND r.status = 'active'
    JOIN platform_admins p ON p.id = a.platform_admin_id AND p.status = 'active'
    LEFT JOIN platform_role_permissions rp ON rp.role_id = r.id
   WHERE p.id = $1`;
