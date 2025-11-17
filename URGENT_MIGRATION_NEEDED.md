# ⚠️ MIGRATION REQUIRED

## Error You're Seeing
\`\`\`
Could not find the 'value_en' column of 'texts' in the schema cache
\`\`\`

## Why This Happens
The code has been updated to support localization (English + Russian), but your database still has the old schema.

## Fix This Now (2 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project: https://supabase.com/dashboard/project/koswecgikibbsxrpscir
2. Click **SQL Editor** in the left sidebar
3. Click **New query**

### Step 2: Run This SQL
Copy and paste this entire block, then click **Run**:

\`\`\`sql
-- Add localization columns
ALTER TABLE texts ADD COLUMN IF NOT EXISTS value_en TEXT;
ALTER TABLE texts ADD COLUMN IF NOT EXISTS value_ru TEXT;

-- Copy existing data to English column
UPDATE texts SET value_en = value WHERE value_en IS NULL;

-- Update timestamps
UPDATE texts SET updated_at = NOW();
\`\`\`

### Step 3: Verify
Run this to check it worked:

\`\`\`sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'texts' 
ORDER BY ordinal_position;
\`\`\`

You should see `value_en` and `value_ru` in the list.

### Step 4: Refresh Admin Panel
- Go back to your admin panel
- Refresh the page (Cmd+R / Ctrl+R)
- The error should be gone!

## What Changed
- **Before:** One `value` column for all text
- **After:** `value_en` for English source + `value_ru` for Russian translation

## Still Having Issues?
Check `MIGRATION_LOCALIZATION.md` for detailed troubleshooting.
