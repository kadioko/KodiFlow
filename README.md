# KodiFlow - Property Management System

KodiFlow is a full-stack property management web app for residential, commercial, and mixed-use rental operations.

## Features

### Property Management

- Residential, commercial, and mixed-use properties.
- Property -> sections -> units organization.
- Section types such as floors, blocks, wings, areas, compounds, market zones, and parking areas.
- Unit types such as apartments, rooms, houses, shops, offices, stalls, kiosks, warehouses, godowns, and parking slots.
- Unit identification codes or door numbers such as `A-101`, `B2-04`, and `SHOP-G01`.

### Tenant Management

- Individual, business, and organization tenants.
- Residential details such as full name, ID number, and emergency contact.
- Commercial details such as business name, TIN, business license, and contact person.
- Tenant list and detail pages show active assigned units with direct unit links.
- Tenant detail pages with linked leases, invoices, payments, assigned units, and balance history.
- Tenant-level withholding tax toggles for 10% rent WHT and 5% service charge WHT.
- Tenant portal foundation scoped by the logged-in tenant email.

### Lease Management

- Lease records connect one tenant to one unit, with unit identifiers visible in selection flows.
- Detail and edit pages for tenants, units, properties, and leases.
- Occupied unit pages show the current tenant with a direct tenant link, helping identify falsely occupied units.
- Lease renewal entry points from lease, tenant, unit, and property history.
- Monthly, quarterly, six-month, and annual billing frequencies.
- Separate monthly rent, service charge, deposit, due day, dates, and lease status.
- Active, expired, terminated, renewed, and pending statuses.
- Unit occupancy updates when active leases are created, moved, or ended.

### Financial Management

- Multi-line invoices with automatic status tracking.
- Invoice items for rent, service charge, utilities, parking, tax, penalty, and other charges.
- Withholding tax deductions as negative invoice tax lines where enabled for the tenant.
- Invoice detail pages support edit, void-with-reason, print, and PDF sharing/download workflows.
- Invoice detail pages can toggle rent, service charge, and full owed breakdown views.
- Payment recording with full and partial payment support.
- Payment screen shows invoice charge breakdown before recording money received.
- Payment records can be viewed, edited, and reversed with an auditable correction trail.
- Payment amount inputs use comma-formatted text entry to reduce number-entry mistakes.
- Expense tracking by property and category.
- Water and electricity meter readings with charge previews.
- TZS default currency with USD, EUR, and GBP preference support.
- TZS money displays as whole shillings with comma separators.
- Financial activity timelines show invoice voids, payment reversals, and maintenance events on related records.
- Tenant statements show invoices, payments, adjustments, credits, and the running balance.

### Dashboard, Reports, And Productivity

- Dashboard metrics for expected rent, collected rent, balances, overdue tenants, and lease alerts.
- Financial, occupancy, tenant mix, deposit, expense, and utility reporting.
- Global search across properties, tenants, units, and invoices.
- Document upload for PDFs and images with metadata, camera capture, downloads, and storage cleanup.
- Dashboard work queue for overdue balances, leases ending soon, vacancies, and unassigned tenants.
- Owner report exports in CSV and PDF.
- WhatsApp payment reminders open a pre-filled draft to the tenant's recorded phone number until a provider is configured; configured providers send automatically.
- Maintenance request lifecycle with priorities, assignees, costs, attachments, and linked expenses.

### Mobile, Branding, And PWA

- Shared KodiFlow brand/logo component and PWA icon assets.
- Desktop sidebar navigation.
- Mobile header menu drawer.
- Mobile bottom navigation and quick actions for core daily workflows.
- Installable PWA with add-to-home-screen help in Settings.
- Light and dark mode controls in Settings.

### Security

- Supabase Auth with email/password.
- Row Level Security on user-owned tables.
- Server-side and database-level validation for financial records.
- Private document storage through Supabase Storage.
- Operational roles: viewer, property manager, accountant, maintenance manager, admin, and super admin.

## Tech Stack

- **Framework**: Next.js 16 App Router
- **Runtime**: React 19
- **Language**: TypeScript 6
- **Styling**: Tailwind CSS 4
- **Database/Auth/Storage**: Supabase
- **Icons**: Lucide React
- **Deployment**: Vercel

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a project on [Supabase](https://supabase.com).
2. Follow [docs/deployment/supabase-cli.md](docs/deployment/supabase-cli.md) to install and link the CLI.
3. Apply `supabase/schema.sql` for a new project, or apply migrations in `supabase/migrations/` for an existing project.
4. Go to Project Settings -> API and copy the project URL and anon public key.

### 3. Configure Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_APP_NAME=KodiFlow
NEXT_PUBLIC_DEFAULT_CURRENCY=TZS
# Optional: automatic WhatsApp delivery. Without these, KodiFlow opens a pre-filled WhatsApp draft instead.
WHATSAPP_API_URL=https://graph.facebook.com/v22.0/your_phone_number_id/messages
WHATSAPP_ACCESS_TOKEN=your_whatsapp_business_access_token
```

For Vercel production, set these in the Vercel dashboard and redeploy after changing any `NEXT_PUBLIC_*` value.

### 4. Run The Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Seed Demo Data

1. Create an account.
2. Get your user ID from Supabase Auth.
3. Replace `USER_ID_HERE` in `supabase/seed.sql`.
4. Run the seed SQL in Supabase SQL Editor.

## Database Schema

Core tables:

1. `profiles`
2. `properties`
3. `property_sections`
4. `units`
5. `tenants`
6. `leases`
7. `charges`
8. `rent_invoices`
9. `invoice_items`
10. `payments`
11. `expenses`
12. `documents`
13. `utility_meter_readings`
14. `activity_log`
15. `maintenance_requests`
16. `maintenance_attachments`

Important database behavior:

- Triggers generate invoice numbers, update totals, and protect active lease overlaps.
- Indexes support dashboard, report, and detail-page queries.
- Unit identifiers are unique per property when provided.
- RLS policies isolate each manager's records by `user_id`.

## Project Structure

```text
kodiflow/
|-- src/
|   |-- app/
|   |   |-- auth/
|   |   |-- dashboard/
|   |   |-- properties/
|   |   |-- sections/
|   |   |-- tenants/
|   |   |-- units/
|   |   |-- leases/
|   |   |-- invoices/
|   |   |-- payments/
|   |   |-- settings/
|   |   `-- reports/
|   |-- components/
|   |   |-- brand/
|   |   |-- layout/
|   |   |-- pwa/
|   |   `-- theme/
|   |-- lib/supabase/
|   |-- types/
|   `-- utils/
|-- supabase/
|   |-- schema.sql
|   |-- migrations/
|   `-- seed.sql
|-- docs/
`-- README.md
```

## Key Pages

| Page | Description |
| --- | --- |
| `/dashboard` | Metrics and alerts |
| `/properties` | Property list and management |
| `/properties/[id]` | Property details with related sections, units, leases, invoices, and payments |
| `/tenants` | Tenant management |
| `/tenants/[id]` | Tenant details, active assigned unit links, lease history, invoices, payments, and balance |
| `/units` | Unit management |
| `/units/[id]` | Unit details with active tenant/lease links and cascade delete confirmation |
| `/leases` | Lease agreements |
| `/leases/new` | Create a lease with rent, service charge, deposit, and billing frequency |
| `/leases/[id]` | Lease detail, linked records, renew, terminate, and edit actions |
| `/leases/[id]/edit` | Edit lease tenant, unit, rent, service charge, dates, billing, and status |
| `/invoices` | Invoice management |
| `/invoices/[id]` | Invoice details, owed breakdown toggles, line items, payments, edit/void, print, and PDF sharing |
| `/invoices/[id]/edit` | Edit invoice dates, notes, line items, subtotal, and status |
| `/payments` | Payment list |
| `/payments/new` | Record payment with invoice charge breakdown |
| `/payments/[id]` | Payment details |
| `/payments/[id]/edit` | Edit or reverse an existing payment |
| `/maintenance` | Maintenance request queue, assignment, costs, attachments, and expense links |
| `/tenants/[id]/statement` | Tenant account statement and running balance |
| `/admin` | Team users, operational roles, and platform administration |
| `/documents` | Uploads and document metadata |
| `/utilities` | Water/electricity readings |
| `/tenant-portal` | Tenant self-service portal |
| `/reports` | Financial and operational reports |
| `/settings` | Currency, language, late fee, PWA install help, and light/dark mode |

## Documentation

- [Documentation index](docs/README.md)
- [App user guide](docs/user-guides/app-user-guide.md)
- [Local setup](docs/development/local-setup.md)
- [Supabase setup](docs/deployment/supabase-setup.md)
- [Vercel deployment](docs/deployment/vercel-deployment.md)
- [Tech stack](docs/architecture/tech-stack.md)
- [Dora Tower import SQL](supabase/imports/dora_tower_clients.sql)

## Common Commands

```bash
npm run dev
npm run type-check
npm run build
npm run test
npm run db:types
```

## Customization

### Currency

Set `NEXT_PUBLIC_DEFAULT_CURRENCY` and review `src/utils/currency.ts`.

### Unit Types

Update `UNIT_TYPES` in `src/utils/constants.ts`.

### Billing Frequencies

Billing frequency options live in `src/utils/constants.ts` and billing calculations live in `src/utils/billing.ts`.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

ISC. See `package.json`.
