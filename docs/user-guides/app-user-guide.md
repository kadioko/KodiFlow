# KodiFlow App User Guide

This guide explains how to use KodiFlow day to day for property, tenant, unit, lease, invoice, payment, expense, utility, document, and reporting workflows.

## 1. Sign In And Open The Dashboard

1. Open KodiFlow in your browser.
2. Sign in with your email and password.
3. After login, KodiFlow opens the dashboard.

The dashboard gives you a quick view of expected rent, collected rent, outstanding balances, overdue tenants, lease alerts, and property performance.

Use the left sidebar on desktop to move between pages. On mobile, tap the menu button in the top bar to open the navigation drawer.

## 2. Recommended Setup Order

For the cleanest workflow, add records in this order:

1. **Properties**
2. **Sections** if the property has floors, blocks, wings, market zones, parking areas, or similar divisions
3. **Units**
4. **Tenants**
5. **Leases** to connect tenants to units
6. **Invoices**
7. **Payments**
8. **Expenses, utilities, documents, and reports**

The most important relationship is:

```text
Property -> Section -> Unit -> Lease -> Tenant
                            -> Invoices -> Payments
```

A unit is occupied by a tenant through an active lease. If a unit has no active lease, it should normally be vacant.

KodiFlow links these records together across detail pages, so you can move from a property to its units, from a unit to its tenant lease, and from a tenant to their invoices and payments.

## 3. Properties

Use **Properties** to create and manage buildings, sites, compounds, commercial spaces, or mixed-use properties.

To add a property:

1. Go to **Properties**.
2. Click **Add Property**.
3. Enter the property name, type, address, and other details.
4. Save the property.

Open a property to view its sections, units, leases, invoices, payments, and expenses connected to that property.

## 4. Sections

Sections help organize large properties. Examples include floors, blocks, wings, areas, market zones, parking areas, and compounds.

To add a section:

1. Go to **Sections** or open a property and choose the section action.
2. Click **Add Section**.
3. Select the property.
4. Enter the section name and type.
5. Save.

Sections are optional. You can create units directly under a property if sections are not needed.

## 5. Units

Units are rentable spaces such as apartments, rooms, houses, shops, offices, stalls, kiosks, warehouses, godowns, parking slots, or land spaces.

To add a unit:

1. Go to **Units**.
2. Click **Add Unit**.
3. Select the property and optional section.
4. Enter the unit name, type, usage type, rent, size, and status.
5. Save.

Unit status meanings:

- **Vacant**: Available for a new lease.
- **Occupied**: Has an active tenant lease.
- **Reserved**: Held but not yet occupied.
- **Under Maintenance**: Not ready to rent.
- **Inactive**: Not currently used.

When you create an active lease for a unit, KodiFlow marks the unit as occupied. When a lease is terminated or moved away from a unit, KodiFlow can mark that unit vacant if no other active lease remains.

## 6. Tenants

Tenants can be individuals, businesses, or organizations.

To add a tenant:

1. Go to **Tenants**.
2. Click **Add Tenant**.
3. Choose the tenant type.
4. Enter contact details.
5. Add ID, TIN, license, emergency contact, address, and notes where relevant.
6. Save.

Open a tenant to view their leases, invoices, payments, and balance history.

## 7. Leases

Leases connect a tenant to a unit. This is how KodiFlow knows which tenant occupies which unit.

To create a lease:

1. Go to **Leases**.
2. Click **Create Lease**.
3. Select the tenant.
4. Select a vacant unit.
5. Set the lease type, billing frequency, start date, end date, rent, service charge, deposit, rent due day, and notes.
6. Save.

Billing frequency options are **Monthly**, **Quarterly**, **Every 6 Months**, and **Annually**.

You can also create leases from a vacant unit page or from a tenant page. KodiFlow supports preselecting the tenant or unit when you start from those pages.

To edit a lease:

1. Go to **Leases**.
2. Open a lease or click **Edit** from the lease table.
3. Update the tenant, unit, dates, rent, service charge, deposit, billing settings, status, or notes.
4. Save.

Lease status meanings:

- **Active**: The lease is current and the unit is occupied.
- **Pending**: Created but not active yet.
- **Expired**: End date has passed.
- **Terminated**: Ended early.
- **Renewed**: Replaced by a renewed lease.

From a lease detail page you can:

- View the tenant.
- View the property.
- View the unit.
- Edit the lease.
- Renew an active lease.
- Terminate an active lease.

To renew a previous lease, open the lease, tenant, unit, or property history and use **Renew** or **New Lease**. KodiFlow preselects the tenant and unit where possible so the new lease stays connected to the right records.

## 8. Invoices And Rent

Invoices track rent and other charges due from tenants.

Use **Invoices** to:

- View issued invoices.
- Open invoice details.
- Review rent and service charge as separate invoice lines.
- Track paid, partially paid, pending, and overdue invoices.
- Record payments against invoices.

Invoice balances feed tenant balances, reports, and dashboard metrics.

## 9. Payments

Payments record money received from tenants.

To record a payment:

1. Go to **Payments**.
2. Click **Record Payment** or open an invoice and use the payment action.
3. Select the invoice.
4. Review the charge breakdown, including monthly rent and service charge.
5. Enter amount, date, method, and reference details.
6. Save.

Payments update invoice balances and collection totals.

## 10. Expenses

Use **Expenses** to record property costs such as maintenance, utilities, repairs, services, or operating costs.

To add an expense:

1. Go to **Expenses**.
2. Click the add action.
3. Select the property.
4. Enter category, amount, date, vendor, and notes.
5. Save.

Expenses are used in financial reporting.

## 11. Utilities

Use **Utilities** for meter readings and utility billing support.

Typical workflow:

1. Select the property or unit.
2. Add meter readings for water or electricity.
3. Review usage and charge calculations.
4. Use the utility information when preparing invoices or reports.

## 12. Documents

Use **Documents** to store files such as lease agreements, tenant IDs, receipts, property photos, inspection records, or supporting paperwork.

On supported mobile browsers, you can capture photos from the camera.

Keep file names clear so documents are easy to find later.

## 13. Reports

Use **Reports** to understand collection, income, balances, expenses, tenant mix, and property performance.

Important reports include:

- Monthly collection.
- Outstanding balances.
- Property income.
- Expense summaries.
- Tenant mix.
- Lease and occupancy insights.

## 14. Search

Use the search bar to find properties, tenants, units, and invoices quickly.

Good searches include:

- Tenant name
- Property name
- Unit name
- Invoice number

## 15. Settings

Use **Settings** to configure app preferences.

Available settings include:

- Default currency.
- Language preference.
- Late fee rate.
- App installation controls.
- Light and dark mode.

### Add KodiFlow To Your Phone App Screen

On mobile:

1. Go to **Settings**.
2. Find **App Experience**.
3. Tap **Install KodiFlow** if available.
4. If the install button is not available, tap **Show Install Help** and use your browser menu to choose **Add to Home screen** or **Install app**.

After installation, KodiFlow opens like a standalone app from your phone app screen.

### Light And Dark Mode

1. Go to **Settings**.
2. Find **Appearance**.
3. Choose **Light** or **Dark**.

Your choice is saved on the current device.

## 16. Notifications

KodiFlow can request browser notification permission for reminders such as overdue invoices and lease events.

If your browser asks for permission, allow notifications if you want alerts on that device.

## 17. Common Workflows

### Add A New Tenant Into A Vacant Unit

1. Add or confirm the property exists.
2. Add or confirm the unit exists and is vacant.
3. Add the tenant.
4. Create a lease and select that tenant and unit.
5. Confirm the unit shows as occupied.
6. Generate or manage invoices for rent.
7. Record payments when money is received.

If the tenant pays a service charge, enter it on the lease. Generated invoices will show rent and service charge separately.

### Move A Tenant To Another Unit

1. Open the current lease.
2. Edit the lease.
3. Change the unit to the new unit.
4. Save.
5. Confirm the old unit is vacant if it has no active lease.
6. Confirm the new unit is occupied.

### End A Tenant Occupancy

1. Open the active lease.
2. Click **Terminate**.
3. Confirm the action.
4. The lease becomes terminated.
5. The unit becomes vacant if no other active lease exists.

### Review A Tenant Balance

1. Open **Tenants**.
2. Open the tenant.
3. Review invoices, payments, and balance information.
4. Open individual invoices or payments for more detail.

## 18. Troubleshooting

### A Tenant Or Unit Says "Not Found"

This usually means one of these:

- The record was deleted.
- The URL contains the wrong ID.
- You are signed in as a different user.
- The record belongs to another account.

Go back to the list page and open the record from there.

The same guidance applies if a property or lease says "Not Found".

### A Unit Does Not Show As Occupied

Check that the unit has an active lease. A tenant occupies a unit through a lease, not just by existing as a tenant.

### A Unit Is Missing From Lease Creation

The create lease screen shows vacant units. If the unit is occupied, reserved, under maintenance, or inactive, edit the unit status or edit the existing lease first.

When renewing from a previous lease, KodiFlow can still preselect the related unit so the renewal flow stays connected.

### Install Button Does Not Appear

Some browsers do not expose the install prompt directly. Use the browser menu and select **Add to Home screen** or **Install app**.

### Dark Mode Did Not Apply Everywhere

Refresh the page. If it still looks wrong, go to **Settings**, switch to Light, then switch back to Dark.

## 19. Good Habits

- Create properties and units before creating leases.
- Use leases to connect tenants to units.
- Keep unit statuses accurate.
- Record payments as soon as they are received.
- Add documents to support important records.
- Review reports regularly.
- Use notes for unusual agreements or tenant-specific arrangements.
