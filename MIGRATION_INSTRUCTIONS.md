# Database Migration Instructions

## Problem
The app is trying to use `value_en` and `value_ru` columns that don't exist in your Supabase database yet.

## Solution: Run the Migration Script

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar

### Step 2: Copy and Run This SQL

Copy the entire SQL below and paste it into the SQL Editor, then click "Run":

\`\`\`sql
-- Add new localization columns
ALTER TABLE texts 
ADD COLUMN IF NOT EXISTS value_en TEXT,
ADD COLUMN IF NOT EXISTS value_ru TEXT;

-- Migrate existing data from 'value' to 'value_en'
UPDATE texts 
SET value_en = value 
WHERE value_en IS NULL AND value IS NOT NULL;

-- Verify the migration
SELECT 
  COUNT(*) as total_rows,
  COUNT(value_en) as rows_with_en,
  COUNT(value_ru) as rows_with_ru
FROM texts;
\`\`\`

### Step 3: Verify Success
After running the script, you should see:
- ✅ "Success. No rows returned"
- ✅ A result showing how many rows have `value_en` populated

### Step 4: Refresh Your Admin Panel
- Go back to your admin panel at `/admin`
- Refresh the page
- The errors should now be gone!

## What This Does
1. Adds two new columns: `value_en` (English) and `value_ru` (Russian)
2. Copies existing text from the old `value` column to `value_en`
3. Keeps the old `value` column for backward compatibility

## Troubleshooting

**If you still see the "Tenant or user not found" error:**
- Make sure you're logged into the correct Supabase project
- Check that you have the right permissions (you should be the project owner)

**If the columns already exist:**
- The script uses `IF NOT EXISTS`, so it's safe to run multiple times
- Just run it again - it won't cause any errors

**If you see "Could not find the 'value_en' column" after migration:**
- Wait 30 seconds for Supabase's cache to refresh
- Hard refresh your admin panel (Ctrl+Shift+R or Cmd+Shift+R)
- If still not working, restart your Vercel deployment

## Need Help?
Check the console logs in your browser (F12 → Console tab) for more detailed error messages.
