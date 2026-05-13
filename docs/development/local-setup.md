# Local Development Setup

Get KodiFlow running locally for development.

## Prerequisites

- Node.js 20+ recommended
- npm
- Git
- A Supabase account
- Supabase CLI

## Setup

### 1. Clone The Repository

```bash
git clone https://github.com/YOUR_USERNAME/kodiflow.git
cd kodiflow
```

### 2. Install Dependencies

```bash
npm install
```

This installs Next.js 16, React 19, TypeScript 6, Tailwind CSS 4, Supabase client libraries, Lucide icons, and app dependencies.

### 3. Install Supabase CLI

See [Supabase CLI setup](../deployment/supabase-cli.md), or install with one of these commands:

```bash
brew install supabase/tap/supabase
```

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

```bash
npm install -g supabase
```

Verify:

```bash
supabase --version
```

### 4. Set Up Supabase

Follow [Supabase setup](../deployment/supabase-setup.md), then link your project if you use the CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 5. Configure Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_NAME=KodiFlow
NEXT_PUBLIC_DEFAULT_CURRENCY=TZS
```

Never commit `.env.local`.

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Create First Account

1. Go to `http://localhost:3000/auth/register`.
2. Create your admin account.
3. Verify email if confirmation is enabled.
4. Log in.

### 8. Seed Demo Data

1. Get your user ID from Supabase Auth -> Users.
2. Replace `USER_ID_HERE` in `supabase/seed.sql`.
3. Run the seed SQL in Supabase SQL Editor.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript compiler |
| `npm run test` | Run Vitest tests |
| `npm run db:types` | Regenerate Supabase database types |

## Development Workflow

1. Start the dev server with `npm run dev`.
2. Make changes in `src/`.
3. Test in desktop and mobile viewports.
4. Run `npm run type-check`.
5. Run `npm run build` before larger merges or deployments.

## Project Structure

```text
src/
|-- app/                    # Next.js App Router pages
|   |-- auth/               # Login, register, forgot password
|   |-- dashboard/          # Dashboard metrics and alerts
|   |-- properties/         # Property CRUD and details
|   |-- sections/           # Property section CRUD
|   |-- units/              # Unit CRUD and related records
|   |-- tenants/            # Tenant CRUD and balances
|   |-- leases/             # Lease create, detail, edit, renewal
|   |-- invoices/           # Invoice list, detail, generation
|   |-- payments/           # Payment list, detail, recording
|   |-- settings/           # Preferences, install help, theme controls
|   `-- reports/            # Financial and operational reports
|-- components/
|   |-- brand/              # Logo and brand mark
|   |-- layout/             # Header, sidebar, mobile navigation
|   |-- pwa/                # PWA provider
|   |-- theme/              # Light/dark theme provider
|   `-- ui/                 # Reusable UI helpers
|-- lib/supabase/           # Supabase clients and generated types
|-- types/                  # App-level TypeScript types
`-- utils/                  # Constants, currency, billing, reminders
```

## Database Changes

1. Create or update a migration in `supabase/migrations/`.
2. Apply the migration locally or in Supabase.
3. Run `npm run db:types`.
4. Update app-level helper types in `src/types/index.ts` only when needed.
5. Test RLS policies with authenticated users.
6. Run `npm run type-check` and `npm run build`.

## UI Testing Checklist

- Desktop sidebar navigation works.
- Mobile header menu opens and closes.
- Settings PWA install help appears on mobile.
- Light and dark mode toggle correctly.
- Tenant, unit, property, and lease detail/edit routes load from list links.
- Lease creation and editing preserve tenant, unit, rent, service charge, deposit, billing frequency, and status.
- Invoice and payment screens show charge line items clearly.

## Troubleshooting

### Port Already In Use

```bash
npm run dev -- --port 3001
```

### Type Errors

```bash
npm run type-check
```

### Module Not Found

```bash
rm -rf node_modules package-lock.json
npm install
```

### Supabase Connection Issues

- Check `.env.local`.
- Confirm the project is active.
- Confirm the anon key is used in browser code.
- Check RLS policies for the current user.

## Next Steps

1. [Deploy to Vercel](../deployment/vercel-deployment.md).
2. Read the [app user guide](../user-guides/app-user-guide.md).
3. Review the [tech stack](../architecture/tech-stack.md).

**Last Updated**: May 2026
