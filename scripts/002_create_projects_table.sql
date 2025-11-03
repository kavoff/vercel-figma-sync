-- Create projects table for GitHub configurations
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  github_token TEXT NOT NULL,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  github_branch TEXT NOT NULL DEFAULT 'main',
  github_path TEXT NOT NULL DEFAULT 'locales/ru.json',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one project can be active at a time
CREATE UNIQUE INDEX idx_projects_active ON projects(is_active) WHERE is_active = true;

-- Create updated_at trigger for projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert a default project if GitHub env vars exist
DO $$
BEGIN
  IF current_setting('app.github_token', true) IS NOT NULL THEN
    INSERT INTO projects (name, github_token, github_owner, github_repo, github_branch, github_path, is_active)
    VALUES (
      'Default Project',
      current_setting('app.github_token', true),
      current_setting('app.github_owner', true),
      current_setting('app.github_repo', true),
      COALESCE(current_setting('app.github_branch', true), 'main'),
      COALESCE(current_setting('app.github_path', true), 'locales/ru.json'),
      true
    )
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;
