-- Add category column to texts table for better organization
ALTER TABLE texts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'uncategorized';

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_texts_category ON texts(category);

-- Create composite index for category + status filtering
CREATE INDEX IF NOT EXISTS idx_texts_category_status ON texts(category, status);
