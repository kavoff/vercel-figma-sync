-- Create texts table for TextSync
CREATE TABLE IF NOT EXISTS texts (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ru',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved')),
  sources JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_texts_status ON texts(status);

-- Create index for search
CREATE INDEX IF NOT EXISTS idx_texts_value ON texts USING gin(to_tsvector('russian', value));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_texts_updated_at
  BEFORE UPDATE ON texts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
