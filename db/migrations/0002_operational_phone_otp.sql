-- Operational accounts are provisioned by scoped managers and authenticate by phone OTP.
-- Platform-admin authentication remains unchanged and isolated.

ALTER TABLE users
  ADD COLUMN phone_number text,
  ADD COLUMN phone_number_verified boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT users_phone_number_iranian_e164_check
    CHECK (phone_number IS NULL OR phone_number ~ '^[+]989[0-9]{9}$');

CREATE UNIQUE INDEX users_phone_number_unique
  ON users(phone_number)
  WHERE phone_number IS NOT NULL;

-- Branch managers can add and revoke ordinary members inside their own branch.
INSERT INTO operational_role_permissions (role_id, permission_key)
SELECT id, 'member.manage'
  FROM operational_roles
 WHERE key = 'branch_manager' AND status = 'active'
ON CONFLICT DO NOTHING;

INSERT INTO platform_permissions (key, description)
VALUES ('operational_account.manage', 'Manage operational account status and revoke sessions')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO platform_role_permissions (role_id, permission_key)
SELECT role_id, 'operational_account.manage'
  FROM platform_role_permissions
 WHERE permission_key = 'operational_account.recover'
ON CONFLICT DO NOTHING;

DELETE FROM platform_role_permissions
 WHERE permission_key = 'operational_account.recover';
DELETE FROM platform_permissions
 WHERE key = 'operational_account.recover';
