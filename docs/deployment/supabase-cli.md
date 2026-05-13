# Supabase CLI Setup

The Supabase CLI provides powerful tools for local development, database migrations, and managing your Supabase project from the command line.

## Installation

### macOS

Using Homebrew:

```bash
brew install supabase/tap/supabase
```

### Windows

Using Scoop:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Or download directly from [GitHub releases](https://github.com/supabase/cli/releases).

### Linux

```bash
npm install -g supabase
```

Or download the binary:

```bash
# x86_64
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz supabase

# ARM64
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_arm64.tar.gz | tar -xz supabase

# Move to PATH
sudo mv supabase /usr/local/bin/
```

## Verify Installation

```bash
supabase --version
```

## Initialize Supabase in Your Project

```bash
# Navigate to your project
cd kodiflow

# Initialize Supabase
supabase init
```

This creates a `supabase/` directory with:

- `config.toml` - Configuration file
- `migrations/` - Database migration files
- `seed.sql` - Seed data (optional)

## Link to Your Supabase Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

Find your project ref in your Supabase dashboard URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`

## Common CLI Commands

### Database

```bash
# Pull database changes from remote
supabase db pull

# Push local migrations to remote
supabase db push

# Reset local database
supabase db reset

# Generate TypeScript types from database schema
supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > src/types/supabase.ts
```

### Local Development

```bash
# Start local Supabase stack
supabase start

# Stop local Supabase stack
supabase stop

# View status
supabase status
```

### Migrations

```bash
# Create a new migration
supabase migration new add_new_column

# List all migrations
supabase migration list

# Apply pending migrations
supabase migration up

# Rollback last migration
supabase migration down
```

### Authentication

```bash
# List users
supabase auth list

# Create user
supabase auth create user --email user@example.com --password password123

# Delete user
supabase auth delete user USER_ID
```

### Storage

```bash
# List buckets
supabase storage list

# Create bucket
supabase storage create documents

# Upload file
supabase storage upload documents/my-file.pdf ./local-file.pdf
```

## Workflow for Database Changes

### Method 1: Using Migrations (Recommended)

1. **Create a new migration**:

   ```bash
   supabase migration new add_tenant_notes
   ```

2. **Edit the migration file** in `supabase/migrations/`:

   ```sql
   ALTER TABLE tenants ADD COLUMN notes TEXT;
   ```

3. **Apply to local database**:

   ```bash
   supabase db reset
   ```

4. **Test your changes locally**

5. **Push to production**:

   ```bash
   supabase db push
   ```

### Method 2: Using SQL Editor + CLI

1. **Make changes in Supabase SQL Editor** (test first)

2. **Pull changes to local**:

   ```bash
   supabase db pull
   ```

3. **Review the generated migration**

4. **Commit and push**:

   ```bash
   git add supabase/migrations/
   git commit -m "Add new database migration"
   git push
   ```

## Environment Variables

The CLI uses these environment variables:

```bash
# In .env.local or shell
SUPABASE_ACCESS_TOKEN=your-access-token
SUPABASE_DB_PASSWORD=your-database-password
SUPABASE_PROJECT_ID=your-project-ref
```

## Configuration (config.toml)

Edit `supabase/config.toml` for local development settings:

```toml
[api]
enabled = true
port = 54321
schemas = ["public", "storage", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323
api_url = "http://localhost"

[inbucket]
enabled = true
port = 54324
```

## GitHub Actions Integration

Add this to your `.github/workflows/deploy.yml`:

```yaml
- name: Setup Supabase CLI
  uses: supabase/setup-cli@v1
  with:
    version: latest

- name: Verify Supabase Connection
  run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

## Troubleshooting

### CLI Not Found

```bash
# Check if in PATH
which supabase

# If not found, add to PATH
export PATH="$PATH:/path/to/supabase/binary"
```

### Connection Issues

```bash
# Re-link project
supabase unlink
supabase link --project-ref YOUR_PROJECT_REF

# Check login status
supabase projects list
```

### Migration Conflicts

```bash
# View migration status
supabase migration list

# Repair if needed
supabase migration repair --status reverted 20240101000000
```

### Local Stack Issues

```bash
# Reset everything
supabase stop
supabase start

# Check Docker is running
docker ps
```

## Best Practices

1. **Always test migrations locally** before pushing to production
2. **Commit migration files** to version control
3. **Use descriptive migration names**: `add_user_preferences`, `create_invoices_table`
4. **Backup before major changes** using Supabase dashboard
5. **Generate types regularly** to keep TypeScript in sync with database

## Next Steps

- [Local Development Setup](../development/local-setup.md)
- [Supabase Setup Guide](./supabase-setup.md)
- [Vercel Deployment](./vercel-deployment.md)
- [Supabase CLI Docs](https://supabase.com/docs/reference/cli)

---

**Last Updated**: May 2026
