# KodiFlow Architecture - Tech Stack

## Overview

KodiFlow follows a modern serverless architecture with separation between the frontend application and Supabase backend services.

## Architecture Diagram

```text
Browser / PWA
    |
    v
Vercel Edge Network
    |
    v
Next.js 16 App Router
    |-- Server Components for data-heavy pages
    |-- Client Components for forms and interactions
    |-- Tailwind CSS 4 for styling
    |-- PWA manifest and service worker assets
    |-- Theme provider for light/dark appearance
    |
    v
Supabase Platform
    |-- PostgreSQL database with RLS
    |-- Supabase Auth sessions
    |-- Supabase Storage documents bucket
    |-- PostgREST API and schema cache
```

## Technology Choices

### Frontend

#### Next.js 16 App Router

- **Why**: Server rendering, file-based routing, Turbopack production builds, and React Server Component support.
- **Benefits**: Strong performance, simplified data fetching, and modern deployment workflow.
- **Pattern**: Server Components for data-heavy pages and Client Components for forms, filters, uploads, and browser APIs.

#### React 19

- **Why**: Current React runtime used by the app.
- **Pattern**: Client components are explicitly marked with `'use client'` only where browser state or events are needed.

#### TypeScript 6

- **Why**: Type safety, better IDE support, and fewer runtime errors.
- **Usage**: Application-level types live in `src/types/index.ts`; generated Supabase types live in `src/lib/supabase/database.types.ts`.

#### Tailwind CSS 4

- **Why**: Utility-first styling and fast UI iteration.
- **Integration**: Tailwind CSS 4 is wired through `@tailwindcss/postcss`.
- **Pattern**: Shared visual primitives such as cards, buttons, badges, and tables are styled in `src/app/globals.css`.

#### Lucide React

- **Why**: Clean, consistent icon set with tree-shakable imports.
- **Usage**: Icons are used across navigation, cards, tables, notifications, uploads, and actions.

### Backend

#### Supabase PostgreSQL

- **Why**: Relational data model, SQL constraints, triggers, and managed hosting.
- **Features used**:
  - Foreign keys for data integrity.
  - Generated columns for utility usage and totals.
  - Indexes for common dashboard/report queries.
  - SQL migrations under `supabase/migrations`.

#### Supabase Auth

- **Why**: Email/password authentication with JWT-backed sessions.
- **Pattern**: The app uses `@supabase/ssr` clients for browser/server auth state.

#### Supabase Storage

- **Why**: Private document storage for leases, IDs, receipts, inspection reports, and photos.
- **Pattern**: Files are stored under user-owned paths, and metadata is stored in the `documents` table.
- **Limits**: PDFs are limited to 5 MB and images are limited to 3 MB in the app UI.

#### Row Level Security

- **Why**: Database-level tenant isolation.
- **Pattern**: User-owned tables include `user_id` and RLS policies compare against `auth.uid()`.
- **Important**: Apply and audit RLS policies when adding tables or changing access patterns.

## Data Flow

### Authentication Flow

```text
User -> Login Form -> Supabase Auth -> Session Cookie -> Middleware/SSR Client
```

### Server Data Fetching Flow

```text
Page Request -> Server Component -> Supabase Server Client -> PostgreSQL -> Rendered HTML
```

### Client Mutation Flow

```text
Form Submit -> Client Component -> Supabase Browser Client -> PostgreSQL/Storage -> Refresh UI
```

### Migration Flow

```text
SQL Migration -> Supabase Database -> NOTIFY pgrst, 'reload schema' -> App Uses New Schema
```

## File Structure

```text
src/
 app/                    # Next.js App Router
    auth/               # Login, registration, forgot password
    dashboard/          # Dashboard metrics and alerts
    settings/           # Preferences, install help, theme controls
    properties/         # Property CRUD and detail pages
    sections/           # Property section list/create/edit pages
    units/              # Unit list/detail/create/edit pages
    tenants/            # Tenant list/detail/create/edit pages
    leases/             # Lease list/detail/create/edit pages
    invoices/           # Invoice list/detail/generation pages
    payments/           # Payment list/detail/record pages
    expenses/           # Expense list page
    documents/          # Storage-backed document uploads
    utilities/          # Utility meter readings
    tenant-portal/      # Tenant-scoped self-service portal
    reports/            # Financial and operational reports
 components/
    brand/              # Shared logo and brand mark
    layout/             # Header and sidebar
    notifications/      # Notification manager
    pwa/                # PWA provider
    theme/              # Light/dark theme provider
    ui/                 # Reusable UI helpers
 lib/
    supabase/           # Supabase clients and generated types
 types/                  # Application types
 utils/                  # Constants, currency, billing, reminders
```

## Key Runtime Areas

### Manager Pages

- **Properties**: Property cards with sections, units, vacancy, and occupancy summaries.
- **Sections**: Floors, blocks, wings, areas, compounds, market zones, and parking areas.
- **Units**: Unit identifiers, statuses, rent, section, property, active tenant display, and linked lease history.
- **Tenants**: Tenant contact details, withholding tax settings, active lease counts, linked units, invoices, payments, and outstanding balance summaries.
- **Leases**: Tenant/unit/property links, active status tracking, editing, renewal entry points, rent, deposits, service charges, and billing frequency.
- **Invoices**: Monthly, quarterly, six-month, and annual invoice summaries, status filtering, reminders, rent/service/tax line items, and payment links.
- **Payments**: Payment list, payment details, invoice references, tenant/property context, and invoice charge breakdowns.
- **Expenses**: Expense listing and financial reporting integration.
- **Utilities**: Water/electricity readings with auto previous reading and charge previews.
- **Documents**: PDF/image uploads, metadata editing, downloads, and delete cleanup.
- **Reports**: Monthly financial, occupancy, tenant mix, deposit, expense, and utility summaries.
- **Settings**: Currency, language, late fees, PWA install help, and light/dark mode.

### Navigation And Branding

- Desktop navigation uses the persistent sidebar.
- Mobile navigation uses the header menu drawer.
- Shared brand presentation lives in `src/components/brand/BrandLogo.tsx`.
- PWA icons and manifest assets live under `public/icons` and `public/manifest.json`.

### Tenant Portal

- Tenant portal access is scoped by the logged-in user's email matching a tenant record.
- Tenant portal pages show tenant-linked leases and invoices only.
- Manager-only invoice detail links are intentionally not exposed in the portal table.

## Security Architecture

### Authentication

- JWT-based authentication through Supabase Auth.
- SSR/browser clients are created with `@supabase/ssr`.
- Middleware refreshes sessions where needed.

### Authorization

- RLS is the primary authorization boundary.
- Manager-owned data is filtered by `user_id`.
- Tenant portal data is filtered by the matched tenant profile.

### Data Protection

- Secrets must stay in environment variables.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser code.
- Public browser Supabase access uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` only.
- Private documents are accessed through signed URLs.

## Performance Considerations

### Frontend

- Server Components reduce client-side JavaScript.
- Route-level code splitting is provided by Next.js.
- Tailwind CSS keeps styling lightweight.
- Mobile navigation avoids loading a separate mobile app shell.
- Heavy report widgets should be lazy-loaded if reports grow.

### Backend

- Important columns are indexed through schema and migrations.
- Large list pages should move to server-side pagination as data volume grows.
- Dashboard and report aggregate queries should be reviewed as property count grows.

### Storage

- Document upload limits reduce storage growth.
- File paths are organized by user, document type, and year.
- Deleting a document removes both metadata and the stored file where possible.

## Database and Migration Rules

- Full schema for new projects lives in `supabase/schema.sql`.
- Incremental changes live in `supabase/migrations`.
- Apply migrations before deploying frontend code that uses new tables or columns.
- Regenerate `src/lib/supabase/database.types.ts` after schema changes.
- Run `NOTIFY pgrst, 'reload schema';` after manual SQL changes that add tables or columns.
- If production shows `Could not find the table ... in the schema cache`, apply the missing migration and reload the schema cache.

## Deployment Architecture

### Frontend

- Hosted on Vercel.
- GitHub pushes to `main` trigger production deployment.
- `NEXT_PUBLIC_*` environment variables are baked into the frontend build and require redeploy after changes.

### Backend

- Hosted on Supabase.
- PostgreSQL stores application records.
- Supabase Auth manages users and sessions.
- Supabase Storage stores private documents.

### Required Production Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_NAME=KodiFlow
NEXT_PUBLIC_DEFAULT_CURRENCY=TZS
```

## Troubleshooting Notes

### Invalid API Key

- Confirm `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the anon public key.
- Do not use service-role keys, JWT secrets, or CLI access tokens for the browser anon key.
- Redeploy Vercel after changing `NEXT_PUBLIC_*` variables.

### Missing Table in Schema Cache

- Apply the relevant migration in Supabase SQL Editor or with `supabase db push`.
- Run `NOTIFY pgrst, 'reload schema';`.
- Confirm the table exists in Supabase Table Editor.

## Monitoring and Backups

### Current Sources

- Vercel deployment and function logs.
- Supabase PostgreSQL logs.
- Supabase Auth logs.
- Supabase dashboard metrics.

### Recommended Additions

- Sentry or equivalent error tracking.
- Vercel Analytics.
- Backup verification workflow.
- CI checks for test, type-check, and build.

## Development Workflow

1. **Local development**
   - Run the Next.js dev server.
   - Use a linked Supabase project or local Supabase stack.
   - Keep `.env.local` out of git.

2. **Testing**
   - Run `npm test`.
   - Run `npm run type-check`.
   - Run `npm run build` before pushing major changes.

3. **Database changes**
   - Add a migration under `supabase/migrations`.
   - Apply it to the target Supabase project.
   - Regenerate database types.
   - Redeploy the frontend after schema-dependent app changes.

4. **Deployment**
   - Commit and push to GitHub.
   - Confirm Vercel build succeeds.
   - Confirm Supabase migrations and environment variables match the deployed code.

## Technology Trade-offs

### Chosen

| Decision | Reason |
| --- | --- |
| Next.js over Create React App | Server rendering, App Router, and deployment fit |
| Supabase over Firebase | SQL, RLS, storage, and open-source ecosystem |
| Tailwind over CSS-in-JS | Performance, consistency, and fast iteration |
| Server Components | Reduced client bundle and direct server-side data fetching |

### Not Chosen Yet

| Technology | Why Not Now | When to Reconsider |
| --- | --- | --- |
| tRPC | Current Supabase access patterns are enough | Complex internal APIs |
| Prisma | Supabase client and SQL migrations are sufficient | More complex schema workflow |
| Redux | Current state needs are mostly local/server-driven | Large cross-page client state |
| React Query | Server Components handle most fetching | More client-heavy real-time screens |

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Last Updated**: May 2026
