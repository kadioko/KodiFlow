# KodiFlow Roadmap

## Current Product State

KodiFlow is a property operations system for residential and commercial rentals. It now covers property structure, tenant and lease lifecycle, frequency-aware invoicing, payments, financial history, maintenance, reporting, mobile operations, and administration labels.

**Stack**: Next.js 16, React 19, TypeScript 6, Tailwind CSS 4, Supabase PostgreSQL/Auth/Storage, and Vercel.

## Delivered

- Property, section, unit, tenant, and lease management with linked detail pages.
- Lease expiry and renewal logic, including billing-frequency-based renewal terms and opening balance or credit carry-forward.
- Atomic invoice generation and payment recording guards, separate rent/service-charge lines, withholding tax, PDF export, and tenant access to their invoices.
- Financial integrity tools: invoice void reasons, payment reversals, activity timelines, and tenant statements with running balances.
- Dashboard work queue, reports, charts, owner report CSV/PDF exports, and mobile list cards, navigation, global search, and quick actions.
- Maintenance requests with status lifecycle, priority, tenant/unit reporting, assignment, estimated and actual cost, attachments, and expense links.
- Operational role labels: viewer, property manager, accountant, maintenance manager, admin, and super admin, with team-user management.
- WhatsApp reminders that open a pre-filled tenant-specific draft without provider credentials and use automatic delivery once credentials are configured.

## Current Priorities

### Shared Operations

- [ ] Add shared saved filter views across invoices, payments, leases, units, and tenants.
- [ ] Replace per-record list queries with joined queries, views, or RPCs for large portfolios.
- [ ] Add a vendor directory and connect it fully to maintenance requests and expenses.
- [ ] Add inspections, calendar scheduling, and unit condition reports.

### Notifications And Integrations

- [ ] Configure a WhatsApp provider sender, approved templates, and credentials for automatic reminder delivery.
- [ ] Add email reminders and a configurable daily manager summary.
- [ ] Add mobile-money and bank-statement payment reconciliation.
- [ ] Add calendar integration for inspections and maintenance appointments.

### Administration And Security

- [ ] Build organization/team membership and assignment policies. Current operational roles are account labels; portfolio sharing still needs intentional RLS design.
- [ ] Add two-factor authentication and sensitive-action rate limits.
- [ ] Define data retention, backup verification, and document deletion policy.
- [ ] Complete recurring RLS and Supabase Storage policy audits.

### Quality And Scale

- [ ] Regenerate `database.types.ts` after every migration and replace remaining handwritten query casts with typed mappers.
- [ ] Add Supabase integration tests and Playwright mobile/E2E tests for invoicing, payments, renewals, voids, and maintenance.
- [ ] Add server-side pagination, dashboard aggregate caching, and monitoring/error tracking.
- [ ] Establish a staging Supabase project and Vercel preview validation workflow.

## Recommended Next Sprint

1. Configure a WhatsApp provider and validate automatic delivery with approved message templates.
2. Deliver shared filters and saved views so dashboard work-queue links open exact actionable records.
3. Add vendor management and inspection scheduling to complete the maintenance workflow.
4. Design organization membership and RLS before allowing staff to work across a manager's portfolio.
5. Add integration and browser tests around financial history and tenant statements.

## Notes

- Default currency is TZS; USD, EUR, and GBP preferences are available.
- Billing frequencies are monthly, quarterly, semi-annually, and annually; invoice periods are calculated from each lease's actual start date.
- Apply migrations before deploying code that depends on a new database function or table, then regenerate database types.

**Last Updated**: July 2026
