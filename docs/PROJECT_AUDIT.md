# KodiFlow Project Audit

Last reviewed: 2026-05-13

## Improvements completed

- Updated the landing page copyright year to use the current year automatically.
- Updated report year selection to stay current instead of using a fixed year list.
- Cleaned documentation navigation so it only links to files that exist in this repository.
- Confirmed the production build passes after recent dashboard and Supabase fixes.

## High-priority next improvements

- Add global search behavior to the header search input or remove the inactive field until it is implemented.
- Add pagination and filters to large list pages for tenants, units, invoices, payments, and leases.
- Add persisted dashboard preferences in the database if property hide/show should sync across browsers.
- Add automated tests for Supabase data flows, especially registration, invoice generation, and payments.
- Regenerate `database.types.ts` from Supabase after every schema change.

## Documentation cleanup decisions

- Keep `README.md` as the primary project overview.
- Keep `docs/README.md` as the documentation index.
- Keep deployment guides for Vercel, Supabase setup, and Supabase CLI.
- Keep `docs/development/local-setup.md` for onboarding.
- Keep `docs/architecture/tech-stack.md` as the current architecture reference.
- Avoid deleting old roadmap/planning docs until each planned feature is either implemented or intentionally removed.
