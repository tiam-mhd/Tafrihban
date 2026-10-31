ALTER TABLE equipment_categories
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  ADD COLUMN archived_at timestamptz;

CREATE INDEX equipment_categories_scope_status_idx
  ON equipment_categories (organization_id, status, name);
