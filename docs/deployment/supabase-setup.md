# Supabase Setup Guide

This guide walks you through setting up Supabase for KodiFlow.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Enter project details:
   - **Name**: `kodiflow` (or your preferred name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users (e.g., `South Africa (Cape Town)` for TZ)
5. Click "Create New Project"

Wait 2-3 minutes for the project to initialize.

## 2. Get API Credentials

1. In your project dashboard, go to **Project Settings** (gear icon)
2. Click **API** in the sidebar
3. Copy these values:
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret**: `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## 3. Run Database Schema

1. In the left sidebar, click **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the SQL Editor
5. Click **Run** (play button)

This will create:

- All 12 tables
- Indexes for performance
- Triggers for automation
- RLS policies for security
- Functions for business logic

## 4. Configure Authentication

### Email Auth (Default)

1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. Under **Email Templates**, you can customize:
   - Confirmation emails
   - Password reset emails
   - Magic link emails

### Site URL (Important!)

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: Your production URL (e.g., `https://kodiflow.vercel.app`)
3. Add **Redirect URLs**:

   - `http://localhost:3000/auth/callback` (for local dev)
   - `https://yourdomain.com/auth/callback` (for production)

## 5. Configure Storage (Optional - for Documents)

1. Go to **Storage** in the sidebar
2. Create a new bucket called `documents`
3. Set bucket permissions:

   - Click the bucket → **Policies**
   - Add policies for SELECT, INSERT, DELETE
   - Example policy: `(bucket_id = 'documents' AND auth.uid() = owner)`

## 6. Environment Variables

Create `.env.local` in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App Configuration
NEXT_PUBLIC_APP_NAME=KodiFlow
NEXT_PUBLIC_DEFAULT_CURRENCY=TZS
```

**Never commit `.env.local` to git!** It's already in `.gitignore`.

## 7. Test Connection

1. Start your dev server:

   ```bash
   npm run dev
   ```

2. Go to `http://localhost:3000`

3. Try to register a new account

4. Check Supabase **Table Editor** → **profiles** to see if your user was created

## 8. Seed Demo Data (Optional)

After creating your account:

1. Get your user ID:
   - Go to **Authentication** → **Users**
   - Copy your user's UUID

2. Edit `supabase/seed.sql`:
   - Replace all `USER_ID_HERE` with your actual user ID

3. Run the seed SQL:
   - Go to **SQL Editor**
   - Paste the modified `seed.sql`
   - Click **Run**

This will create:

- 3 sample properties (residential, commercial, mixed)
- 20+ units across sections
- 10 sample tenants
- Active leases
- Sample invoices and payments

## 9. Database Migrations (Future Changes)

When you need to update the schema:

### Option A: SQL Editor (Simple)

1. Go to **SQL Editor**
2. Write your ALTER TABLE statements
3. Run them
4. Document changes in `docs/database-changes.md`

### Option B: Migration Files (Recommended for teams)

Create migration files in `supabase/migrations/`:

```sql
-- 20240513_add_new_column.sql
ALTER TABLE properties ADD COLUMN new_field TEXT;
```

## 10. Monitoring

### Database Stats

- Go to **Database** → **Statistics**
- Monitor connection usage
- Check slow queries

### Authentication Stats

- Go to **Authentication** → **Users**
- See sign-up rates
- Monitor failed logins

### Logs

- Go to **Logs** → **Postgres**
- View database queries
- Debug issues

## Troubleshooting

### "Failed to fetch" errors

- Check if Supabase URL is correct
- Ensure you're using the correct key (anon, not service_role)
- Check browser console for CORS errors

### RLS Policy Violations

- Check that your user is authenticated
- Verify RLS policies allow the operation
- Test with service_role key temporarily to isolate issue

### Database Connection Errors

- Check if database is paused (free tier pauses after inactivity)
- Resume from Supabase dashboard
- Check connection limits

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] No service_role key in client-side code
- [ ] Strong database password
- [ ] Site URL configured correctly
- [ ] Redirect URLs set for production
- [ ] Document bucket has proper policies

## Next Steps

1. [Vercel Deployment Guide](vercel-deployment.md)
2. [Environment Variables Guide](environment-variables.md)
3. Return to [main docs](../README.md)

---

**Support**: [Supabase Documentation](https://supabase.com/docs)

**Last Updated**: May 2026
