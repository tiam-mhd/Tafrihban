-- Better Auth's PostgreSQL UUID mode delegates IDs to the database.
-- Keep the text columns used by this schema, but provide a UUID-backed default.
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE user_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE user_accounts ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE user_verifications ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE platform_admins ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE platform_admin_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE platform_admin_accounts ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE platform_admin_verifications ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE platform_admin_two_factors ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
