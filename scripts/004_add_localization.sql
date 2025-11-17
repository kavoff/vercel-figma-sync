-- Migration: Add localization support
-- Add English and Russian text columns to the texts table

-- Add new columns
ALTER TABLE texts ADD COLUMN IF NOT EXISTS value_en TEXT;
ALTER TABLE texts ADD COLUMN IF NOT EXISTS value_ru TEXT;

-- Migrate existing data from 'value' to 'value_en'
UPDATE texts SET value_en = value WHERE value_en IS NULL AND value IS NOT NULL;

-- Update timestamp
ALTER TABLE texts ALTER COLUMN updated_at SET DEFAULT NOW();
