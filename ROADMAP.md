# KodiFlow Roadmap

## Overview

KodiFlow is a modern property management system for residential and commercial rental operations.

**Current Status**: v0.5.0 - Core platform, financial workflows, reporting, utilities, documents, PWA, and tenant self-service foundation complete  
**Stack**: Next.js 16 + React 19 + TypeScript 6 + Tailwind CSS 4 + Supabase PostgreSQL/Auth/Storage

---

## Completed Features ✅

### Foundation and Platform

- [x] Next.js 16 App Router project setup
- [x] TypeScript and Tailwind CSS setup
- [x] Supabase client/server/middleware integration
- [x] Supabase Auth login, registration, and forgot password flows
- [x] PostgreSQL schema with RLS policies
- [x] Generated database types workflow
- [x] Sidebar dashboard layout
- [x] Responsive UI foundation
- [x] GitHub and Vercel deployment foundation

### Property and Tenant Management

- [x] Property CRUD for residential, commercial, and mixed-use properties
- [x] Property sections for floors, blocks, wings, areas, compounds, market zones, and parking areas
- [x] Unit management with unit type, usage type, status, rent, size, and section support
- [x] Tenant management for individuals, businesses, and organizations
- [x] Tenant portal foundation for tenant-linked accounts
- [x] Dashboard property visibility controls persisted to user profile

### Lease Management

- [x] Lease creation and detail pages
- [x] Active, expired, terminated, renewed, and pending lease statuses
- [x] Lease expiry warnings
- [x] Lease renewal workflow
- [x] Rent escalation fields and renewal support
- [x] Monthly, quarterly, six-month, and annual billing frequencies
- [x] Security deposit tracking fields and reporting summaries

### Invoices, Payments, and Billing

- [x] Invoice generation page for active leases
- [x] Bulk invoice generation
- [x] Invoice auto-numbering
- [x] Invoice item support
- [x] Six-month billing invoice calculations
- [x] Full and partial payment recording
- [x] Payment prefill from invoice pages
- [x] Automatic invoice balance calculations
- [x] Invoice statuses: unpaid, partially paid, paid, overdue, cancelled
- [x] Payment reminder action links
- [x] Late-fee rate settings and report estimates

### Financial Management and Reporting

- [x] TZS currency formatting
- [x] Multi-currency preference foundation for TZS, USD, EUR, and GBP
- [x] Expense tracking data model and reporting integration
- [x] Monthly collection reporting
- [x] Outstanding balances by tenant
- [x] Property income summaries
- [x] Expense reports
- [x] Net income calculations
- [x] Charts for collection performance and occupancy
- [x] Tenant mix reporting
- [x] CSV export for property reports

### Search, Lists, and Productivity

- [x] Functional header/global search
- [x] Search across properties, tenants, units, and invoices
- [x] List filtering and pagination for tenants, units, invoices, payments, and leases
- [x] Document upload backed by Supabase Storage
- [x] Document metadata listing, editing, download, deletion, and storage cleanup
- [x] Document upload limits for compact PDFs and images
- [x] Utility management for water and electricity meter readings with charge previews
- [x] Core menu route stabilization for sections, expenses, payments, units, and tenants

### Internationalization Foundation

- [x] English and Swahili language preference setting
- [x] Translation helper foundation

### Automated Tests

- [x] Vitest test setup
- [x] Billing helper tests
- [x] Registration profile payload test
- [x] Payment balance helper test
- [x] Late fee and net income helper tests

---

## Current Priorities 🚧

### Phase 8: Property Operations

- [ ] **Maintenance Requests** - Track repair requests, status, priority, and assignments
- [ ] **Inspection Scheduling** - Property inspection calendar and inspection records
- [ ] **Vendor Management** - Track contractors, contacts, categories, and service history
- [ ] **Inventory Tracking** - Track furniture, fixtures, appliances, and unit assets

### Phase 9: Commercial Lease Enhancements

- [ ] **Percentage Rent** - Retail tenant rent based on reported sales
- [ ] **CAM Charges** - Common Area Maintenance budgets and reconciliations
- [ ] **Sales Reporting** - Track tenant sales for percentage-rent leases
- [ ] **Commercial Lease Templates** - Commercial-specific clauses and generated templates

### Phase 10: Integrations and Automation

- [ ] **Mobile Money Integration** - M-Pesa, Tigo Pesa, and Airtel Money payment flows
- [ ] **Bank Integration** - Import statements and reconcile payments
- [ ] **SMS Gateway** - Twilio or Africa's Talking reminder delivery
- [ ] **Email Service** - SendGrid, Resend, or AWS SES transactional email
- [ ] **Calendar Integration** - Google/Outlook sync for inspections and reminders
- [ ] **Accounting Export** - QuickBooks/Xero-compatible exports

### Phase 11: Mobile and PWA

- [x] **Progressive Web App** - Installable app and basic offline support
- [x] **Push Notifications** - Real-time alerts for overdue invoices and lease events
- [x] **Camera Integration** - Photo capture for inspections, documents, and maintenance
- [ ] **Mobile App** - React Native or Flutter app after PWA validation

### Phase 12: Advanced Platform Features

- [ ] **Role-Based Access Control** - Admin, manager, accountant, viewer, and tenant roles
- [ ] **Audit Logging** - Track sensitive financial and data changes
- [ ] **Two-Factor Authentication** - Stronger account security
- [ ] **AI-Powered Insights** - Predict rent, churn, occupancy, and collections risk
- [ ] **Tenant Support Chatbot** - Tenant FAQs and support automation
- [ ] **Digital Signatures** - DocuSign/Adobe Sign integration
- [ ] **Background Checks** - Tenant screening integration
- [ ] **Insurance Integration** - Property and tenant insurance workflows

---

## Technical Backlog 🔧

### Performance

- [ ] Server-side pagination for very large tables
- [ ] Database query optimization and query plan review
- [ ] Caching strategy for dashboard and report aggregates
- [ ] Image optimization and previews for uploaded documents
- [ ] Lazy loading for heavy report widgets

### Testing

- [ ] Integration tests for Supabase flows
- [ ] E2E tests with Playwright
- [ ] Test database seed/reset workflow
- [ ] Regression tests for invoice generation and payment allocation
- [ ] Utility meter reading tests
- [ ] Tenant portal access tests

### Database and DevOps

- [ ] Apply all pending Supabase migrations to production, especially `202605140025_ensure_utility_meter_readings.sql`
- [ ] Automate `database.types.ts` regeneration after schema changes
- [ ] Staging Supabase project and staging Vercel environment
- [ ] Backup verification workflow
- [ ] Monitoring and error tracking with Sentry or equivalent
- [ ] CI checks for tests, type-check, lint, and build

### Security and Compliance

- [ ] Rate limiting on auth and sensitive form actions
- [ ] RLS policy audit after every schema change
- [ ] Storage policy audit for uploaded documents
- [ ] Data retention and deletion policy
- [ ] Local compliance review for property and tenant records

---

## Recommended Next Sprint 🎯

1. **Maintenance Requests** - Add maintenance request CRUD, status tracking, and dashboard alerts.
2. **Vendor Management** - Add vendor directory and link vendors to expenses/maintenance.
3. **Inspection Scheduling** - Add inspection records and calendar-style upcoming inspection list.
4. **SMS Gateway Integration** - Replace reminder deep links with actual SMS delivery.
5. **Production Migration Pass** - Apply pending Supabase migrations and regenerate database types from the live schema.

---

## Architecture Decisions

### Frontend

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4 with custom utility classes
- **State**: Server Components for data-heavy pages, Client Components for forms and interactions
- **Charts**: Recharts
- **Validation**: TypeScript-first with targeted helper tests; form validation should be expanded with Zod where needed

### Backend

- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth with JWT
- **Storage**: Supabase Storage for documents
- **Security**: Row Level Security on user-owned tables
- **Migrations**: SQL migrations under `supabase/migrations`

### Deployment

- **Frontend**: Vercel
- **Database/Auth/Storage**: Supabase
- **CI/CD**: GitHub-backed deployment workflow

---

## Success Metrics

- [ ] 100+ properties managed
- [ ] 500+ tenants managed
- [ ] 1000+ monthly invoices generated
- [ ] 95%+ payment allocation accuracy from reconciled imports
- [ ] < 2s median dashboard load time
- [ ] 95% uptime
- [ ] Mobile Lighthouse score > 90

---

## Notes

- Default currency: TZS, with USD/EUR/GBP preference support.
- Language foundation: English and Swahili preferences are stored; full UI translation rollout remains iterative.
- Billing frequencies: monthly, quarterly, semi-annually, and annually.
- Migrations should be applied before relying on newly added schema fields in production.
- If production shows `Could not find the table ... in the schema cache`, apply the relevant migration and run `NOTIFY pgrst, 'reload schema';`.
- `database.types.ts` should be regenerated after every schema migration.

**Last Updated**: May 2026
