# Localization Migration Guide

## Current Issue
The database schema still uses the old `value` column, but the code now expects `value_en` and `value_ru` for localization support.

## Steps to Apply Migration

### Option 1: Run SQL Script (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file `scripts/004_add_localization.sql`
4. Copy the entire SQL script
5. Paste it into the SQL Editor
6. Click **Run** to execute

The script will:
- Add `value_en` column (English source text)
- Add `value_ru` column (Russian translation)
- Migrate existing `value` data to `value_en`
- Keep backward compatibility

### Option 2: Manual SQL Commands

Run these commands in Supabase SQL Editor:

\`\`\`sql
-- Add new columns
ALTER TABLE texts ADD COLUMN IF NOT EXISTS value_en TEXT;
ALTER TABLE texts ADD COLUMN IF NOT EXISTS value_ru TEXT;

-- Migrate existing data
UPDATE texts SET value_en = value WHERE value_en IS NULL;

-- Update timestamps
UPDATE texts SET updated_at = NOW();
\`\`\`

### Verify Migration

After running the migration, verify it worked:

\`\`\`sql
-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'texts';

-- Should show: key, value, value_en, value_ru, lang, status, sources, updated_at, created_at
\`\`\`

## After Migration

Once the migration is complete:
1. Refresh your admin panel
2. You should see two columns: "Value (EN)" and "Value (RU)"
3. All existing texts will be in the English column
4. You can now add Russian translations

## Rollback (if needed)

If something goes wrong:

\`\`\`sql
-- Remove new columns
ALTER TABLE texts DROP COLUMN IF EXISTS value_en;
ALTER TABLE texts DROP COLUMN IF EXISTS value_ru;
\`\`\`

## Questions?

Check the main README.md or SETUP_GUIDE.md for more information.
