-- Remove legacy columns from texts table
ALTER TABLE texts DROP COLUMN IF EXISTS value;
ALTER TABLE texts DROP COLUMN IF EXISTS lang;

-- Ensure proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_texts_project_id ON texts(project_id);
CREATE INDEX IF NOT EXISTS idx_texts_status ON texts(status);
CREATE INDEX IF NOT EXISTS idx_texts_key ON texts(key);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);

-- Add constraint to ensure at least one value exists
ALTER TABLE texts ADD CONSTRAINT check_has_value CHECK (
  value_en IS NOT NULL OR value_ru IS NOT NULL
);
