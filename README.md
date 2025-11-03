# TextSync - Figma ↔ Admin ↔ GitHub

A custom workflow system for synchronizing text content between Figma, an admin panel, and GitHub.

## Features

- **Figma Plugin**: Export texts from Figma and pull approved texts back
- **Admin Panel**: Edit, review, and approve texts with a web interface
- **GitHub Integration**: Automatically sync approved texts to GitHub (optional)
- **Key Generation**: Automatic unique key generation for text content
- **Deduplication**: Same text = same key across all instances
- **Status Workflow**: draft → in_review → approved

## Architecture

\`\`\`
[Figma Plugin] ⇄ [TextSync API + Database] ⇄ [GitHub JSON Repo]
       ↑                    ↑
  (Designer)          (Copywriter)
\`\`\`

## Quick Start

### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### 2. Set Environment Variables

Required:
- `ADMIN_PASSWORD` - Password for admin panel access
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

Optional (for GitHub Direct PR Mode):
- `GITHUB_TOKEN` - GitHub personal access token
- `GITHUB_OWNER` - GitHub repository owner
- `GITHUB_REPO` - GitHub repository name
- `GITHUB_BRANCH` - Target branch (default: main)
- `GITHUB_PATH` - Path to JSON file (default: content/ru.json)

### 3. Run Database Migration

The SQL script in `scripts/001_create_texts_table.sql` needs to be executed in your Supabase database.

### 4. Install Figma Plugin

1. Open Figma → Plugins → Development → Import plugin from manifest
2. Select `figma-plugin/manifest.json`
3. Build the plugin: `tsc figma-plugin/code.ts --outDir figma-plugin --target es2017`

## Usage

### For Designers (Figma)

1. Open the TextSync plugin in Figma
2. Enter your API URL (e.g., `https://your-app.vercel.app`)
3. Click **Export to Admin** to send all texts
4. After copywriters approve, click **Pull Approved** to update Figma

### For Copywriters (Admin Panel)

1. Go to `https://your-app.vercel.app/login`
2. Enter admin password
3. Edit texts, change status to "approved"
4. Texts automatically sync to GitHub (if configured)
5. Click **Export JSON** to download manually

### For Developers

**Artifact Mode** (default):
- Download JSON from admin panel: `https://your-app.vercel.app/api/export/json?lang=ru`

**Direct PR Mode** (optional):
- Set GitHub environment variables
- Approved texts automatically commit to GitHub

## API Endpoints

- `POST /api/auth/login` - Admin login
- `POST /api/texts/bulk-upsert` - Bulk import from Figma
- `GET /api/texts` - List texts with filters
- `PUT /api/texts/[key]` - Update individual text
- `GET /api/export/json` - Export approved texts as JSON

## Database Schema

\`\`\`sql
CREATE TABLE texts (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ru',
  status TEXT NOT NULL DEFAULT 'draft',
  sources JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
\`\`\`

## Key Format

Keys are stored in Figma layer names with format: `T:<key>`

Example: `T:upload_photo_button_a3f2`

## Status Workflow

1. **draft** - New text from Figma, not reviewed
2. **in_review** - Copywriter is working on it
3. **approved** - Final version, synced to GitHub, available for Figma pull

## GitHub Integration Modes

### Artifact Mode (Minimum)
- No GitHub configuration needed
- Download JSON manually from admin panel
- Developers integrate JSON into their workflow

### Direct PR Mode (Optional)
- Configure GitHub environment variables
- Approved texts automatically commit to repository
- Can be extended to create PRs instead of direct commits

## Development

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Build Figma plugin
cd figma-plugin
tsc code.ts --outDir . --target es2017
\`\`\`

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Simple password-based sessions
- **Deployment**: Vercel
- **Plugin**: Figma Plugin API, TypeScript

## License

MIT
