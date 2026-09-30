# End-to-end testing

KodiFlow uses Playwright for browser coverage. Run `npm run test:e2e` locally after setting up a separate Supabase staging project and dedicated test accounts. Never point these tests at production.

`npm run test:e2e:mobile` uses a local test server, a synthetic session, and intercepted Supabase requests. It never writes to a real database. It runs in the iPhone 17 Pro WebKit profile at compact portrait, installed-app portrait, landscape, and tablet viewports.

The suite checks the complete tap target, taps invoice/payment/settings/generation buttons, verifies the requested writes, and confirms that errors and retries remain reachable. It also exercises the lease renewal dialog. The keyboard checks simulate iOS visual viewport changes and cover the keyboard area: Playwright cannot display the physical iPhone keyboard. A final check on the installed iPhone app remains useful after deployment.

Successful Settings saves, blocked duplicate payment taps while a request is pending, and password-reset retries after correcting a mismatch are also covered. Unit tests exercise joined-result mappers alongside financial helpers and profile-role guards. Lint rejects explicit `any` and unused variables with zero warnings allowed.

Do not set `E2E_BASE_URL` for the mocked mobile suite. The local server uses `https://layout-tests.supabase.co` with a placeholder key. For authenticated staging checks, run `npx playwright test financial-workflows.spec.ts` separately with the variables below.

Required authenticated test variables:

```text
E2E_BASE_URL=https://staging.example.com
E2E_EMAIL=manager-test@example.com
E2E_PASSWORD=...
```

The financial workflow checks also use isolated fixture IDs:

```text
E2E_INVOICE_ID=...
E2E_PAYMENT_ID=...
E2E_LEASE_ID=...
E2E_TENANT_EMAIL=tenant-test@example.com
E2E_TENANT_PASSWORD=...
```

The current suite is safe by default: destructive checks only verify that the explicit void/reverse controls are present. Add a disposable staging fixture and an `E2E_RUN_MUTATIONS`-guarded test before exercising confirmed writes, then clean the fixture through the database after each run.
