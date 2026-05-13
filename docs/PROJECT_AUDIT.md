# KodiFlow Project Audit

Last reviewed: 2026-05-14

## Improvements completed

- Updated the landing page copyright year to use the current year automatically.
- Updated report year selection to stay current instead of using a fixed year list.
- Cleaned documentation navigation so it only links to files that exist in this repository.
- Confirmed the production build passes after recent dashboard and Supabase fixes.
- Added the app user guide for day-to-day workflows.
- Added brand/logo components and updated PWA icon assets.
- Added mobile navigation controls so the menu is reachable from small screens.
- Added Settings controls for PWA installation help and light/dark mode.
- Stabilized tenant, unit, property, and lease detail/edit routes that previously showed false "not found" states.
- Connected units, tenants, leases, invoices, and payments more clearly across detail pages.
- Added lease editing, lease renewal entry points, and six-month billing frequency support.
- Added separate service charge entry on leases and charge breakdown visibility while recording payments.

## High-priority next improvements

- Review pagination and filters on large list pages as data volume grows.
- Review dashboard preference sync behavior across browsers and users.
- Add automated tests for Supabase data flows, especially registration, invoice generation, and payments.
- Regenerate `database.types.ts` from Supabase after every schema change.
- Add browser/E2E coverage for mobile navigation, lease renewal, invoice generation, and payment recording.

## Documentation cleanup decisions

- Keep `README.md` as the primary project overview.
- Keep `docs/README.md` as the documentation index.
- Keep deployment guides for Vercel, Supabase setup, and Supabase CLI.
- Keep `docs/development/local-setup.md` for onboarding.
- Keep `docs/architecture/tech-stack.md` as the current architecture reference.
- Keep `docs/user-guides/app-user-guide.md` as the operator guide for non-technical users.
- Avoid deleting old roadmap/planning docs until each planned feature is either implemented or intentionally removed.
