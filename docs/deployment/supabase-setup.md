# Supabase Setup Guide

This guide walks through setting up Supabase for KodiFlow.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com).
2. Sign up or log in.
3. Click **New Project**.
4. Enter project details:
   - **Name**: `kodiflow` or your preferred name
   - **Database Password**: generate a strong password
   - **Region**: choose the closest region to your users
5. Click **Create New Project**.

Wait a few minutes for the project to initialize.

## 2. Get API Credentials

1. Open **Project Settings**.
2. Go to **API**.
3. Copy:
   - **Project URL** as `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** as `SUPABASE_SERVICE_ROLE_KEY`

Keep the service role key secret. It must never be used in browser code.

## 3. Run Database Schema

For a new project:

1. Open **SQL Editor**.
2. Create a new query.
3. Paste `supabase/schema.sql`.
4. Run the query.

For an existing project:

1. Apply pending files in `supabase/migrations/`.
2. Regenerate database types with `npm run db:types`.
3. Run `NOTIFY pgrst, 'reload schema';` if PostgREST schema cache needs a refresh.

The schema includes properties, sections, units, tenants, leases, recurring charges, invoice items, payments, expenses, documents, utilities, profiles, triggers, indexes, and RLS policies.

## 4. Configure Authentication

### Email Auth

1. Go to **Authentication** -> **Providers**.
2. Ensure **Email** is enabled.
3. Customize confirmation, password reset, and magic-link templates if needed.

### Site URL And Redirects

1. Go to **Authentication** -> **URL Configuration**.
2. Set **Site URL** to your production URL.
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback`

## 5. Configure Storage

KodiFlow uses Supabase Storage for private documents.

1. Go to **Storage**.
2. Create a bucket named `documents`.
3. Add policies that allow authenticated users to manage their own files.
4. Keep uploaded files scoped to user-owned paths.

## 6. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_NAME=KodiFlow
NEXT_PUBLIC_DEFAULT_CURRENCY=TZS
```

Never commit `.env.local`.

## 7. Test Connection

1. Start the app:

   ```bash
   npm run dev
   ```

2. Open `http://localhost:3000`.
3. Register a new account.
4. Check **Table Editor** -> **profiles** to confirm the profile was created.

## 8. Seed Demo Data

1. Get your user ID from **Authentication** -> **Users**.
2. Replace `USER_ID_HERE` in `supabase/seed.sql`.
3. Run the seed SQL in SQL Editor.

Seed data can include sample properties, sections, units, tenants, active leases, invoices, payments, expenses, documents, and utility records depending on the current seed file.

## 9. Migration Workflow

1. Create a migration in `supabase/migrations/`.
2. Test locally or in a staging Supabase project.
3. Apply with SQL Editor or `supabase db push`.
4. Regenerate types with `npm run db:types`.
5. Redeploy the frontend when app code depends on new schema.

## 10. Schema Areas Used By Current Features

- `properties`, `property_sections`, and `units` power property structure and occupancy.
- `tenants` stores individual, business, and organization tenants.
- `leases` links tenants to units and stores rent, deposit, billing frequency, dates, and status.
- `charges` stores recurring extras such as service charge.
- `rent_invoices` and `invoice_items` keep rent and service charge as separate invoice lines.
- `payments` records full and partial payments against invoices.
- `documents` and the `documents` storage bucket support uploads.
- `utility_meter_readings` supports water/electricity tracking.

## Troubleshooting

### Failed To Fetch

- Check `NEXT_PUBLIC_SUPABASE_URL`.
- Confirm the browser uses the anon key, not the service role key.
- Check the browser console for network or CORS errors.

### RLS Policy Violations

- Confirm the user is authenticated.
- Confirm records include the correct `user_id`.
- Test with a known user-owned record.

### Missing Table In Schema Cache

- Apply the missing migration.
- Run `NOTIFY pgrst, 'reload schema';`.
- Confirm the table appears in Table Editor.

## Security Checklist

- [ ] RLS enabled on user-owned tables.
- [ ] No service role key in client-side code.
- [ ] Strong database password.
- [ ] Site URL configured correctly.
- [ ] Redirect URLs set for local and production.
- [ ] Storage policies restrict document access.
- [ ] `database.types.ts` regenerated after schema changes.

## Next Steps

1. [Vercel deployment](vercel-deployment.md)
2. [Supabase CLI setup](supabase-cli.md)
3. [Main docs](../README.md)

**Support**: [Supabase Documentation](https://supabase.com/docs)

**Last Updated**: May 2026
