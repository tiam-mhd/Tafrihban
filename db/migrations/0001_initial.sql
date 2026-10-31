-- Tafrihban MVP schema. All timestamps represent UTC instants.

CREATE TABLE organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  timezone text NOT NULL DEFAULT 'Asia/Tehran',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE branches (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  code text NOT NULL,
  address text,
  timezone text NOT NULL DEFAULT 'Asia/Tehran',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (id, organization_id)
);

-- Platform identity is isolated from operational identity and sessions.
CREATE TABLE platform_admins (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_admins_email_lower_unique ON platform_admins (lower(email));

CREATE TABLE platform_admin_sessions (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE
);
CREATE INDEX platform_admin_sessions_user_idx ON platform_admin_sessions(user_id);

CREATE TABLE platform_admin_accounts (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, account_id)
);
CREATE INDEX platform_admin_accounts_user_idx ON platform_admin_accounts(user_id);

CREATE TABLE platform_admin_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX platform_admin_verifications_identifier_idx ON platform_admin_verifications(identifier);

CREATE TABLE platform_admin_two_factors (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES platform_admins(id) ON DELETE CASCADE,
  secret text NOT NULL,
  backup_codes text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  failed_verification_count integer NOT NULL DEFAULT 0 CHECK (failed_verification_count >= 0),
  locked_until timestamptz
);

CREATE TABLE users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  locale text NOT NULL DEFAULT 'fa' CHECK (locale IN ('fa', 'en')),
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

CREATE TABLE user_sessions (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX user_sessions_user_idx ON user_sessions(user_id);

CREATE TABLE user_accounts (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, account_id)
);
CREATE INDEX user_accounts_user_idx ON user_accounts(user_id);

CREATE TABLE user_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX user_verifications_identifier_idx ON user_verifications(identifier);

CREATE TABLE organization_memberships (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  organization_id text NOT NULL REFERENCES organizations(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id),
  UNIQUE (id, organization_id)
);
CREATE INDEX organization_memberships_user_idx ON organization_memberships(user_id, status);
CREATE INDEX organization_memberships_org_idx ON organization_memberships(organization_id, status);

CREATE TABLE branch_memberships (
  id text PRIMARY KEY,
  membership_id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (membership_id, organization_id) REFERENCES organization_memberships(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id) ON DELETE CASCADE,
  UNIQUE (membership_id, branch_id),
  UNIQUE (membership_id, branch_id, organization_id)
);
CREATE INDEX branch_memberships_branch_idx ON branch_memberships(branch_id, status);

CREATE TABLE permissions (
  key text PRIMARY KEY,
  module text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE operational_roles (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system_role boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key),
  UNIQUE (id, organization_id)
);

CREATE TABLE operational_role_permissions (
  role_id text NOT NULL REFERENCES operational_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);
CREATE INDEX operational_role_permissions_key_idx ON operational_role_permissions(permission_key);

CREATE TABLE membership_role_assignments (
  id text PRIMARY KEY,
  membership_id text NOT NULL,
  organization_id text NOT NULL,
  role_id text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('organization', 'branch')),
  branch_id text,
  assigned_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (membership_id, organization_id) REFERENCES organization_memberships(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (role_id, organization_id) REFERENCES operational_roles(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, branch_id, organization_id) REFERENCES branch_memberships(membership_id, branch_id, organization_id) ON DELETE CASCADE,
  CHECK ((scope_type = 'organization' AND branch_id IS NULL) OR (scope_type = 'branch' AND branch_id IS NOT NULL)),
  UNIQUE NULLS NOT DISTINCT (membership_id, role_id, scope_type, branch_id)
);
CREATE INDEX membership_role_assignments_scope_idx ON membership_role_assignments(membership_id, organization_id, branch_id);

CREATE TABLE equipment_categories (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name),
  UNIQUE (id, organization_id)
);

CREATE TABLE equipment (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  category_id text,
  public_qr_id text NOT NULL UNIQUE,
  asset_code text NOT NULL,
  name text NOT NULL,
  manufacturer text,
  model text,
  serial_number text,
  location text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'archived')),
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
  FOREIGN KEY (category_id, organization_id) REFERENCES equipment_categories(id, organization_id),
  UNIQUE (organization_id, asset_code),
  UNIQUE (id, organization_id),
  UNIQUE (id, branch_id, organization_id)
);
CREATE INDEX equipment_scope_idx ON equipment(organization_id, branch_id, status);
CREATE INDEX equipment_category_idx ON equipment(category_id, organization_id);

CREATE TABLE equipment_status_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  equipment_id text NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  note text,
  actor_user_id text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (equipment_id, branch_id, organization_id) REFERENCES equipment(id, branch_id, organization_id),
  UNIQUE (id, organization_id)
);

CREATE TABLE checklist_templates (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id)
);

CREATE TABLE checklist_template_versions (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  template_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  change_note text,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  FOREIGN KEY (template_id, organization_id) REFERENCES checklist_templates(id, organization_id) ON DELETE CASCADE,
  UNIQUE (template_id, version),
  UNIQUE (id, organization_id)
);

CREATE TABLE checklist_questions (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  template_version_id text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  prompt text NOT NULL,
  guidance text,
  required boolean NOT NULL DEFAULT true,
  fail_creates_defect boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (template_version_id, organization_id) REFERENCES checklist_template_versions(id, organization_id) ON DELETE CASCADE,
  UNIQUE (template_version_id, position),
  UNIQUE (id, organization_id)
);

CREATE TABLE inspection_schedules (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  equipment_id text NOT NULL,
  checklist_version_id text NOT NULL,
  assigned_user_id text REFERENCES users(id),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
  interval_days integer CHECK (interval_days IS NULL OR interval_days BETWEEN 1 AND 3650),
  next_due_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (equipment_id, branch_id, organization_id) REFERENCES equipment(id, branch_id, organization_id),
  FOREIGN KEY (checklist_version_id, organization_id) REFERENCES checklist_template_versions(id, organization_id),
  UNIQUE (id, organization_id),
  CHECK ((frequency = 'custom' AND interval_days IS NOT NULL) OR (frequency <> 'custom' AND interval_days IS NULL))
);
CREATE INDEX inspection_schedules_due_idx ON inspection_schedules(organization_id, branch_id, next_due_at) WHERE is_active;

CREATE TABLE inspections (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  equipment_id text NOT NULL,
  schedule_id text,
  checklist_version_id text NOT NULL,
  inspector_id text NOT NULL REFERENCES users(id),
  outcome text NOT NULL CHECK (outcome IN ('no_findings', 'findings')),
  notes text,
  client_event_id text NOT NULL,
  local_occurred_at timestamptz NOT NULL,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (equipment_id, branch_id, organization_id) REFERENCES equipment(id, branch_id, organization_id),
  FOREIGN KEY (schedule_id, organization_id) REFERENCES inspection_schedules(id, organization_id),
  FOREIGN KEY (checklist_version_id, organization_id) REFERENCES checklist_template_versions(id, organization_id),
  UNIQUE (organization_id, client_event_id),
  UNIQUE (id, organization_id, branch_id),
  UNIQUE (id, organization_id)
);
CREATE INDEX inspections_equipment_time_idx ON inspections(equipment_id, created_at DESC);
CREATE INDEX inspections_scope_idx ON inspections(organization_id, branch_id, created_at DESC);

CREATE TABLE inspection_answers (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  inspection_id text NOT NULL,
  question_id text NOT NULL,
  answer text NOT NULL CHECK (answer IN ('pass', 'fail', 'na')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (inspection_id, organization_id) REFERENCES inspections(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id, organization_id) REFERENCES checklist_questions(id, organization_id),
  UNIQUE (inspection_id, question_id),
  UNIQUE (id, organization_id),
  UNIQUE (id, inspection_id, organization_id)
);

CREATE TABLE corrective_actions (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  defect_id text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'closed')),
  owner_user_id text REFERENCES users(id),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
  UNIQUE (defect_id),
  UNIQUE (id, organization_id, branch_id)
);

CREATE TABLE defects (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  equipment_id text NOT NULL,
  inspection_id text,
  answer_id text,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  reported_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (equipment_id, branch_id, organization_id) REFERENCES equipment(id, branch_id, organization_id),
  FOREIGN KEY (inspection_id, organization_id, branch_id) REFERENCES inspections(id, organization_id, branch_id),
  FOREIGN KEY (answer_id, inspection_id, organization_id) REFERENCES inspection_answers(id, inspection_id, organization_id),
  UNIQUE (id, organization_id, branch_id)
);
CREATE INDEX defects_scope_status_idx ON defects(organization_id, branch_id, status, created_at DESC);

ALTER TABLE corrective_actions
  ADD CONSTRAINT corrective_actions_defect_fk
  FOREIGN KEY (defect_id, organization_id, branch_id) REFERENCES defects(id, organization_id, branch_id) ON DELETE CASCADE;

CREATE TABLE work_orders (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  equipment_id text NOT NULL,
  defect_id text NOT NULL,
  corrective_action_id text NOT NULL,
  title text NOT NULL,
  instructions text,
  assigned_to text REFERENCES users(id),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'in_progress', 'completed', 'closed')),
  due_at timestamptz,
  completion_note text,
  completed_by text REFERENCES users(id),
  completed_at timestamptz,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (equipment_id, branch_id, organization_id) REFERENCES equipment(id, branch_id, organization_id),
  FOREIGN KEY (defect_id, organization_id, branch_id) REFERENCES defects(id, organization_id, branch_id),
  FOREIGN KEY (corrective_action_id, organization_id, branch_id) REFERENCES corrective_actions(id, organization_id, branch_id),
  UNIQUE (corrective_action_id),
  UNIQUE (id, organization_id, branch_id)
);
CREATE INDEX work_orders_scope_status_idx ON work_orders(organization_id, branch_id, status, due_at);

CREATE TABLE work_order_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  work_order_id text NOT NULL,
  actor_user_id text NOT NULL REFERENCES users(id),
  event_type text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (work_order_id, organization_id, branch_id) REFERENCES work_orders(id, organization_id, branch_id) ON DELETE CASCADE
);

CREATE TABLE file_objects (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  sha256 text NOT NULL,
  uploaded_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
  UNIQUE (id, organization_id, branch_id)
);

CREATE TABLE inspection_attachments (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  inspection_id text NOT NULL,
  file_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (inspection_id, organization_id, branch_id) REFERENCES inspections(id, organization_id, branch_id) ON DELETE CASCADE,
  FOREIGN KEY (file_id, organization_id, branch_id) REFERENCES file_objects(id, organization_id, branch_id),
  UNIQUE (inspection_id, file_id)
);

CREATE TABLE work_order_attachments (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  work_order_id text NOT NULL,
  file_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (work_order_id, organization_id, branch_id) REFERENCES work_orders(id, organization_id, branch_id) ON DELETE CASCADE,
  FOREIGN KEY (file_id, organization_id, branch_id) REFERENCES file_objects(id, organization_id, branch_id),
  UNIQUE (work_order_id, file_id)
);

CREATE TABLE offline_sync_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  client_event_id text NOT NULL,
  actor_user_id text NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK (event_type IN ('inspection.submit')),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  local_event_time timestamptz NOT NULL,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('synced', 'conflict', 'failed')),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  payload_sha256 text NOT NULL,
  result_inspection_id text,
  FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
  FOREIGN KEY (result_inspection_id, organization_id) REFERENCES inspections(id, organization_id),
  UNIQUE (organization_id, client_event_id)
);
CREATE INDEX offline_sync_events_actor_idx ON offline_sync_events(actor_user_id, server_received_at DESC);

CREATE TABLE audit_events (
  id text PRIMARY KEY,
  actor_user_id text REFERENCES users(id),
  organization_id text NOT NULL,
  branch_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id)
);
CREATE INDEX audit_events_scope_time_idx ON audit_events(organization_id, branch_id, created_at DESC);

CREATE TABLE platform_permissions (
  key text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_admin_roles (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  grants_all_permissions boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_role_permissions (
  role_id text NOT NULL REFERENCES platform_admin_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES platform_permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE platform_admin_role_assignments (
  id text PRIMARY KEY,
  platform_admin_id text NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES platform_admin_roles(id) ON DELETE RESTRICT,
  assigned_by text REFERENCES platform_admins(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_admin_id, role_id)
);

CREATE TABLE platform_admin_audit_events (
  id text PRIMARY KEY,
  actor_platform_admin_id text REFERENCES platform_admins(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  reason text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_admin_audit_time_idx ON platform_admin_audit_events(created_at DESC);

CREATE TABLE platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by text REFERENCES platform_admins(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feature_flags (
  key text NOT NULL,
  organization_id text REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id text,
  enabled boolean NOT NULL DEFAULT false,
  updated_by text REFERENCES platform_admins(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, organization_id) REFERENCES branches(id, organization_id),
  CHECK (branch_id IS NULL OR organization_id IS NOT NULL),
  UNIQUE NULLS NOT DISTINCT (key, organization_id, branch_id)
);

INSERT INTO permissions (key, module, description) VALUES
  ('dashboard.read', 'dashboard', 'View the scoped dashboard'),
  ('organization.manage', 'organization', 'Manage organization settings'),
  ('branch.manage', 'branch', 'Manage branches'),
  ('member.manage', 'identity', 'Manage organization and branch members'),
  ('role.manage', 'authorization', 'Manage operational roles and assignments'),
  ('equipment.read', 'equipment', 'View equipment records'),
  ('equipment.manage', 'equipment', 'Create, update, and archive equipment'),
  ('checklist.read', 'checklist', 'View published checklists'),
  ('checklist.manage', 'checklist', 'Create and publish checklist versions'),
  ('inspection_schedule.manage', 'inspection', 'Create branch inspection schedules'),
  ('inspection.read', 'inspection', 'View scoped inspections'),
  ('inspection.create', 'inspection', 'Submit inspections'),
  ('defect.manage', 'defect', 'Manage defects and corrective actions'),
  ('work_order.manage', 'maintenance', 'Create and progress work orders'),
  ('work_order.close', 'maintenance', 'Review and close completed work orders'),
  ('report.export', 'reports', 'Export scoped reports'),
  ('audit.read', 'audit', 'View scoped audit history');

INSERT INTO platform_permissions (key, description) VALUES
  ('organization.read', 'View all organizations and branches'),
  ('organization.manage', 'Create and manage organizations and branches'),
  ('platform_admin.manage', 'Create and manage platform administrators and roles'),
  ('operational_account.recover', 'Set a temporary password and revoke sessions for an operational account'),
  ('platform_settings.manage', 'Manage global platform settings'),
  ('platform_audit.read', 'View global platform audit events');

INSERT INTO platform_admin_roles (id, key, name, description, grants_all_permissions)
VALUES
  ('system-superadmin', 'SUPERADMIN', 'مدیر کل پلتفرم', 'دسترسی سراسری به مجوزهای فعال و آینده.', true),
  ('system-platform-operator', 'PLATFORM_OPERATOR', 'مدیر پلتفرم', 'مدیریت سازمان‌ها با مجوزهای محدود.', false);

INSERT INTO platform_role_permissions (role_id, permission_key) VALUES
  ('system-platform-operator', 'organization.read'),
  ('system-platform-operator', 'organization.manage'),
  ('system-platform-operator', 'platform_audit.read');

INSERT INTO platform_settings (key, value) VALUES
  ('default_timezone', '"Asia/Tehran"'::jsonb),
  ('platform_name', '"تفریح‌بان"'::jsonb);
