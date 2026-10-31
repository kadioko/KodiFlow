# KodiFlow App User Guide

This guide explains how to use KodiFlow day to day for property, tenant, unit, lease, invoice, payment, expense, utility, document, and reporting workflows.

## 1. Sign In And Open The Dashboard

1. Open KodiFlow in your browser.
2. Choose **English** or **Kiswahili** from the language menu on the public home page if you prefer.
3. Sign in with your email and password.
4. After login, KodiFlow opens the dashboard. A language chosen before sign-in is saved to your account.

The dashboard gives you a quick view of expected rent, collected rent, outstanding balances, overdue tenants, lease alerts, and property performance.

Use the left sidebar on desktop to move between pages. On mobile, use the bottom navigation for Dashboard, Invoices, Payments, and Leases; tap **More** for the full drawer. The central add action opens common tasks.

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
4. Enter the unit name, unit ID or door number, type, usage type, rent, size, and status.
5. Save.

Unit status meanings:

- **Vacant**: Available for a new lease.
- **Occupied**: Has an active tenant lease.
- **Reserved**: Held but not yet occupied.
- **Under Maintenance**: Not ready to rent.
- **Inactive**: Not currently used.

When you create an active lease for a unit, KodiFlow marks the unit as occupied. Lease expiry alone does not mean the tenant has moved out, so KodiFlow does not automatically make an expired lease's unit available. After the tenant hands over the unit, close out the expired lease using **Mark Vacant**. KodiFlow checks for other active leases first. When terminating a lease, the status automation also leaves the unit alone if another active or expired lease is linked. Reserved or maintenance status is preserved.

Use **Unit ID / Door Number** for the building code printed on doors or plans, such as `A-101`, `B2-04`, or `SHOP-G01`. This helps distinguish similar unit names inside the same building.

## 6. Tenants

Tenants can be individuals, businesses, or organizations.

To add a tenant:

1. Go to **Tenants**.
2. Click **Add Tenant**.
3. Choose the tenant type.
4. Enter contact details.
5. Add ID, TIN, license, emergency contact, address, and notes where relevant.
6. Choose whether the tenant has rent or service charge withholding tax deductions.
7. Save.

Open a tenant to view their leases, invoices, payments, and balance history.

### Tenant Withholding Tax

Some tenants deduct withholding tax when they pay. Turn this on per tenant only when it applies:

- **Rent WHT** deducts 10% from rent invoice lines.
- **Service Charge WHT** deducts 5% from service charge invoice lines.

When invoice generation runs, KodiFlow adds those deductions as negative tax lines so the tenant balance reflects the net payable amount.

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
- **Terminated**: Closed after an early end or confirmed move-out.
- **Renewed**: Replaced by a renewed lease.

From a lease detail page you can:

- View the tenant.
- View the property.
- View the unit.
- Edit the lease.
- Renew an active or expired lease before move-out is confirmed.
- Terminate an active lease.

To renew a previous lease, open the lease, tenant, unit, or property history and use **Renew** or **New Lease**. KodiFlow preselects the tenant and unit, calculates the natural next term from the chosen billing frequency, and previews any carried Opening Balance or Opening Credit before you confirm.

### When A Lease Expires And The Tenant Is Leaving

Expiry and move-out are separate events. An expired lease now presents both choices, even if the unit is already marked vacant. Unit vacancy alone does not record the tenant's move-out decision. Use this decision:

- **Same tenant is staying:** choose **Renew** and review the billing frequency, new term, and any Opening Balance or Opening Credit. The renewal carries the old lease's balance according to the preview.
- **Tenant is leaving:** do not renew. After keys and possession are handed back, open the expired lease and choose **Confirm Move-Out**. This closes the expired lease and marks the unit vacant only when no other active or expired lease remains. The lease's invoices, payments, deposit, and remaining balance are preserved.
- **Tenant left before the agreed end date:** use **Terminate** on the active lease to record the early end. The unit is released only when no other active lease uses it.

After marking a departing tenant's unit vacant, open the unit and create a **new lease** for the incoming tenant. The previous tenant's unpaid balance stays on their old lease and statement; it is not added to the new tenant's account. Handle any security-deposit settlement against the departing tenant's records separately.

## 8. Invoices And Rent

Invoices track rent and other charges due from tenants.

Use **Invoices** to:

- View issued invoices.
- Open invoice details.
- Review rent and service charge as separate invoice lines.
- Review withholding tax deduction lines where enabled for that tenant.
- Track paid, partially paid, pending, and overdue invoices.
- Record payments against invoices.
- Download or share an invoice PDF.
- Void an incorrect invoice with a reason instead of deleting financial history.
- Use WhatsApp to prepare a payment reminder for the tenant's recorded phone number.

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

Payments update invoice balances and collection totals. To correct a recorded payment, use **Reverse** so KodiFlow retains the original transaction and records the correction in the activity timeline.

## 10. Tenant Statements And Financial History

Open a tenant and choose **Statement** to review invoices, payments, opening balances, credits, voids, reversals, and the running balance in date order. Use this during renewal or when resolving a balance question.

## 11. Maintenance

Use **Maintenance** to record issues reported by a tenant or found at a unit. Set a priority, assign a person or vendor, add photos or documents, track the request from **New** through **Closed**, and link the final cost to an expense where needed.

## 12. Expenses

Use **Expenses** to record property costs such as maintenance, utilities, repairs, services, or operating costs.

To add an expense:

1. Go to **Expenses**.
2. Click the add action.
3. Select the property.
4. Enter category, amount, date, vendor, and notes.
5. Save.

Expenses are used in financial reporting.

## 13. Utilities

Use **Utilities** for meter readings and utility billing support.

Typical workflow:

1. Select the property or unit.
2. Add meter readings for water or electricity.
3. Review usage and charge calculations.
4. Use the utility information when preparing invoices or reports.

### Manual Electricity Tracking

The **Electricity** workspace is for properties that track prepaid electricity manually, such as Dora Tower. It tracks meter units and LUKU top-ups; KodiFlow does not purchase tokens, collect token payments, or disconnect power remotely.

Owners can create a submeter account for a unit/client or a floor main meter. A client submeter is cumulative: record its starting reading and date, then record later readings as the number goes up. Set any client opening units and the low-balance threshold. A shared TANESCO main LUKU meter is different: its remaining prepaid credit goes down as the building uses electricity and may rise after a recharge. Do not record it as a rising client reading. After creating a main meter, record its first remaining-credit snapshot under **Meters and balances**. The default early-warning threshold is 50 kWh; the owner can set a different threshold per main meter there. Alerts appear at the threshold and twice the threshold.

Owners can use **Edit submeter** under **Meters and balances** to update a client/display name without changing that meter's readings or token history. If the unit has a new tenant, select the new tenant and complete the handoff using the physical cumulative reading, its date, and the new tenant's opening units. KodiFlow records the final reading for the former tenant, archives that account, and starts a separate ledger for the new tenant in one transaction. Old readings and token records remain attached to the former tenant. The new tenant starts at zero opening units by default; the former tenant's credit or deficit is not carried over. Review the new starting balance before saving. Use **Archive** when a submeter is no longer needed rather than deleting it. Archived records remain available below the active meters and can be reactivated only when that unit has no other active submeter.

When entering Electricity, use the workspace tabs for **Overview**, **Record readings**, **Record LUKU**, **Meters and balances**, and **Ledger and reports**. Staff also have a **Staff help** tab with quick steps and guidance for warnings; stop and contact the owner/manager rather than guessing when a reading or balance looks wrong. Owners can set up meters and opening balances, configure warning thresholds, make dated client-unit corrections, rename or hand off submeters, and archive or reactivate them. Owners also have **Staff access**: they can create Staff IDs, assign properties, reset PINs, deactivate/reactivate accounts, and review staff sign-ins and latest data entries. To create a staff login, an owner opens **Staff access**, enters a unique Staff ID, name, 8-12 digit PIN, and selects the specific properties the staff member may work on. Staff sign in with the Staff ID and PIN provided privately by the owner; they only see assigned properties.

For each client-submeter visit, staff enter the current cumulative reading and date. KodiFlow calculates consumption from the previous reading and updates the client-unit estimate. For each main-meter visit, staff record the TANESCO LUKU credit remaining and the kWh added since the previous check. Enter main balance snapshots oldest to newest. KodiFlow calculates main use as **previous credit + units added - current credit**, then compares it against client-submeter use for the same dates. A recent usage rate may also show an estimated number of days until the main credit runs out. The **Ledger and reports** view updates as client readings are saved and lists previous/current readings, brought-forward units, usage, reported and verified client LUKU units, cut-off readings, balance corrections, and carried-forward units. Set the weekly target to two or three readings per active client meter; the coverage list counts the last seven days and flags clients who still need a check. Filter the ledger by date, then export CSV or print it for sharing/filing.

When a tenant reports a LUKU purchase, staff enter the purchased units and full 20-digit token twice. The entries must match before saving. KodiFlow stores the complete token so authorized staff can retrieve it if a token was not entered into the meter or an issue needs investigation. The history masks the token until **Show full token** is tapped; it can then be copied. Reusing a token already recorded is rejected. The entry remains reported until the meter check is verified; unverified units do not increase the estimated balance. Older records show only their saved suffix because the missing digits cannot be reconstructed.

Owners can use **Adjust unit balance** on a client submeter to correct a balance after a physical recheck. Enter a signed amount (positive adds units; negative reduces them), the date, and a reason. KodiFlow preserves the correction with the owner and timestamp, shows it in the report, and applies it to the next meter reading rather than rewriting prior history. Staff cannot make these balance corrections.

The **Main meter reconciliation** section compares calculated TANESCO credit depletion against the sum of active client submeters for matching start and end dates. A floor is marked incomplete until every active submeter has a reading for that exact period; no final missing-unit amount is shown for partial periods. Positive variance means main use exceeds tenant submeter use (unaccounted units); negative variance means submeters report more use than the main supply. Older imported main-balance rows do not include recharge amounts, so KodiFlow marks those periods unknown instead of inventing consumption. Once staff record a new balance and the units added since the prior check, later periods can be reconciled. An unexplained balance increase is flagged for a missed recharge/token or a mistyped reading. A zero LUKU reading requires an on-screen confirmation so it is not entered by accident; it remains recordable to document a real outage. Alerts help staff act early but cannot stop the physical TANESCO credit from being consumed.

**Floor LUKU coverage**, on Overview and Meters and balances, is a separate comparison of the main meter's last recorded remaining credit against the sum of positive estimated client balances on that floor. It shows the client-credit shortfall and an estimated top-up needed to cover those credits plus a safety reserve. The reserve uses the main meter's warning threshold, which an owner can change under Meters and balances. Negative client balances do not reduce other clients' credits. Reported but unconfirmed purchases are excluded and flagged for review.

Coverage is provisional when readings are missing, over four days old, dated on different days, records are truncated, a client has a negative balance or unconfirmed purchase, or a client cannot be matched to exactly one main meter. The app matches floor labels, not physical wiring; confirm each submeter is connected to the indicated main meter before relying on the estimate. A warning does not automatically notify anyone or add LUKU: staff must check the meters and arrange a physical recharge before the main credit reaches zero.

The **Main meter quick reference** lists each configured floor meter number near the top of the Electricity workspace; tap its copy button when staff need the number quickly. For Dora Tower readings, confirm the meter name is **Daniel Mariki** before recording.

When a tenant buys LUKU, staff can record the purchased units, purchase value, and complete token. A reported top-up does not increase the available balance until staff verify it. If verification happens after a reading in that purchase period, KodiFlow reconciles it into the first applicable reading and recalculates later balances. The attention queue highlights low, exhausted, or overdue-for-reading meters and can draft a tenant reminder.

If staff physically disconnect or restore a meter, record that action and its reason in the account timeline. This is an audit record only; KodiFlow never controls the meter switch. Owners can manage staff IDs, reset PINs, and deactivate staff access from the Electricity workspace.

Confirming a client LUKU entry records the confirmer and confirmation time; both appear in the purchase history. Staff and owners can correct readings, purchases, main-meter balances, and manual cutoff entries from **Entries & corrections** and must provide a reason. Balance adjustments can be corrected only by the property owner. KodiFlow keeps the before-and-after values and recalculates affected client balances. Only the property owner can reverse an entry; reversal is recorded with its reason and timestamp and does not delete the original record.

Use **History & search** for older LUKU purchases, submeter readings, main-meter snapshots, balance adjustments, cutoff actions, and correction/confirmation records. Filter by record type, meter, date range, and status; search LUKU token digits or a record note/reason. Results are paginated. Full token digits remain masked until you reveal them.

Staff can report a meter problem through **Issues & history** by selecting the specific main meter or client submeter, setting priority, and describing the problem. Staff and owners assigned to that property can comment on the ticket. The owner manages its status and must record what was done before resolving it; a resolved ticket can then be closed. The ticket keeps its comments, status changes, and resolution history for follow-up.

## 14. Documents

Use **Documents** to store files such as lease agreements, tenant IDs, receipts, property photos, inspection records, or supporting paperwork.

On supported mobile browsers, you can capture photos from the camera.

Keep file names clear so documents are easy to find later.

## 15. Reports

Use **Reports** to understand collection, income, balances, expenses, tenant mix, and property performance.

Important reports include:

- Monthly collection.
- Outstanding balances.
- Property income.
- Expense summaries.
- Tenant mix.
- Lease and occupancy insights.

## 16. Search

Use the search bar to find properties, tenants, units, and invoices quickly.

Good searches include:

- Tenant name
- Property name
- Unit name
- Unit ID or door number
- Invoice number

## 17. Settings

Use **Settings** to configure app preferences.

Choose English or Kiswahili from the language selector in the top app bar. The choice is saved to your account, applies immediately, and follows you across devices. Electricity staff accounts have their own language preference too, so one staff member's choice does not change another user's language. You can also change it under **Settings**.

Available settings include:

- Default currency.
- Language preference (English or Kiswahili).
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

## 18. Notifications And WhatsApp Reminders

KodiFlow can request browser notification permission for reminders such as overdue invoices and lease events. The WhatsApp action creates a pre-filled payment reminder for the invoice's tenant phone number. When a WhatsApp provider is configured by the administrator, the same action sends automatically instead.

## 19. Common Workflows

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
5. The unit becomes vacant only if no other active or expired lease remains and the unit is currently occupied. Reserved or maintenance status is preserved. If it remains occupied, review the lease records and confirm move-out with **Mark Vacant**.

### Tenant Leaves When The Lease Expires

1. Open the lease and verify it is **Expired**. Expiry does not confirm the tenant has vacated.
2. Complete the move-out handover and any inspection or meter checks.
3. If the same tenant is staying, use **Renew** and review the carry-forward preview. If they are leaving, do not renew.
4. For a departing tenant, click **Confirm Move-Out** and confirm. KodiFlow records the decision and marks the unit vacant only when no other active or expired lease remains.
5. Open the vacant unit and create a new lease for the incoming tenant.
6. Review the old tenant's balance on their original lease or statement. It does not transfer to an unrelated new tenant.

### Review A Tenant Balance

1. Open **Tenants**.
2. Open the tenant.
3. Review invoices, payments, and balance information.
4. Open individual invoices or payments for more detail.

## 20. Troubleshooting

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

### An Expired Lease's Unit Still Shows As Occupied

This is intentional: the end date passing does not confirm that keys were returned or the tenant moved out. Open the expired lease and choose **Renew** or **Confirm Move-Out**. A unit already marked vacant still needs an explicit choice for that lease. Move-out confirmation changes the lease to terminated; the unit is made vacant only when no other active or expired lease remains. Reserved or maintenance status is preserved and should be changed only when the unit is ready to rent.

### A Unit Is Missing From Lease Creation

The create lease screen shows vacant units. If the unit is occupied, reserved, under maintenance, or inactive, edit the unit status or edit the existing lease first.

When renewing from a previous lease, KodiFlow can still preselect the related unit so the renewal flow stays connected.

### Install Button Does Not Appear

Some browsers do not expose the install prompt directly. Use the browser menu and select **Add to Home screen** or **Install app**.

### Dark Mode Did Not Apply Everywhere

Refresh the page. If it still looks wrong, go to **Settings**, switch to Light, then switch back to Dark.

## 21. Good Habits

- Create properties and units before creating leases.
- Use leases to connect tenants to units.
- Keep unit statuses accurate.
- Do not mark a unit vacant until move-out is confirmed; keep a departing tenant's balance on their original lease.
- Record payments as soon as they are received.
- Add documents to support important records.
- Review reports regularly.
- Use notes for unusual agreements or tenant-specific arrangements.
