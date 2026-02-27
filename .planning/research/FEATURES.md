# Feature Research: v2.0 Production-Ready

**Domain:** Residential property management portal -- small landlord (5-50 units)
**Researched:** 2026-02-26
**Confidence:** MEDIUM-HIGH (multiple PMS platforms analyzed, cross-referenced with industry sources)

**Scope:** This document covers v2.0 NEW features only. v1 features (auth, payments, maintenance, documents, notifications) are already shipped and validated. See git history for prior v1 FEATURES.md.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any property management system graduating from MVP to production-grade must have. Without these, the system feels unfinished and the admin cannot trust it for real financial operations.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Ledger-based financial model (charges table)** | Every production PMS (AppFolio, Buildium, Stessa, Rentec Direct) tracks tenant finances as a ledger of charges and credits with a running balance -- not just a payments log. Without a charges table, you cannot represent "what is owed" separately from "what was paid." The current payments table only records what was paid, with no concept of what was due. | HIGH | Requires new `charges` table with types: rent, late_fee, utility, credit, adjustment. Running balance computed per tenant. Must retroactively reconcile existing payment records. Every financial feature downstream depends on this. |
| **Late fee automation** | Industry standard: 5% of rent after a grace period (typically 3-5 days). Every competitor automates this. Manual late fee tracking is error-prone and creates landlord-tenant friction. 30-40% of PMS platforms report late fee automation as a top-3 feature request. | MEDIUM | Configurable per-property: grace period days, fee type (flat vs percentage), fee amount. CRON job posts late fee charges to the ledger after grace period expires. Must respect state laws (California has specific rules). |
| **Running balance visibility** | Tenants and admins both need to see "what is owed right now." AppFolio, TenantCloud, and Stessa all show running balances on tenant dashboards and admin views. Without this, every month starts with confusion about outstanding amounts. | MEDIUM | Computed from charges table: sum(charges) - sum(payments) = balance. Display on tenant dashboard ("You owe $X") and admin dashboard ("Unit 3 owes $X"). Must handle partial payments correctly. |
| **Property and unit CRUD** | Admin must be able to add, edit, and archive properties and units without developer intervention. Current system has properties and units in the database but no admin UI to manage them. Every PMS has this as a basic admin function. | MEDIUM | Create/edit property (name, address). Create/edit unit (number, rent amount, due day). Archive (soft delete) rather than hard delete to preserve historical data. Must not break existing tenant associations. |
| **Tenant move-out workflow** | AppFolio, Buildium, and Rentec Direct all have structured move-out processes. Without one, admins must manually: set end dates, cancel autopay, handle final charges, and there is no audit trail. Month-to-month tenancies make move-outs frequent. | HIGH | Multi-step process: (1) set move-out date on tenantUnit, (2) auto-cancel autopay enrollment, (3) post final charges/credits to ledger, (4) mark tenantUnit as inactive, (5) retain read-only historical access for past tenant. Must handle edge cases: mid-month move-out with prorated rent, outstanding balance after move-out. |
| **S3-compatible cloud storage** | Local file storage (uploads/ directory) is a single point of failure and does not scale. Production systems store files in cloud storage (S3, R2, GCS). Files are currently auth-gated via API routes serving from disk, which ties file availability to server uptime. | MEDIUM | Migrate maintenance photos and documents to S3-compatible storage (AWS S3 or Cloudflare R2). Generate presigned URLs for secure access. Update all file upload/download paths. Must migrate existing files. |
| **Admin dashboard with KPIs** | Every production PMS has a dashboard with key metrics. The current admin view is a list of tables. Production dashboards show: rent collection rate, outstanding balances, maintenance response time, occupancy rate. Small landlords need 5-7 metrics, not 20. | MEDIUM | KPI cards at top: total collected this month, total outstanding, occupancy rate, open maintenance requests, overdue tenants count. Below: recent activity feed, units needing attention. Sidebar navigation for admin sections. |
| **Edge-level role authorization** | Current auth check happens at the API route level. Production systems reject unauthorized requests at the middleware/edge level before hitting application code. Faster rejection, smaller attack surface. | MEDIUM | JWT claims include role. Middleware checks role before routing to admin pages/API routes. Must work with Better Auth session model. Fallback to API-level checks for granular permissions. |

### Differentiators (Competitive Advantage)

Features that go beyond table stakes. Not every PMS has these, but they add significant value for the self-hosted small landlord use case.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Vendor assignment for maintenance** | Connect maintenance requests directly to vendors/contractors. DoorLoop, Buildium, and AppFolio all have vendor management, but it is often a premium feature. For a 5-unit building, the landlord has 2-3 trusted vendors. Simple assignment (not a vendor marketplace) saves phone calls and creates an audit trail. | MEDIUM | Vendor table (name, trade/specialty, phone, email). Assign vendor to maintenance request. Optional: vendor gets email/SMS notification with request details and limited-view link (no login required). Track vendor assignment history. |
| **Work order cost tracking** | Tie maintenance costs to specific units and properties. Most small landlords track this in spreadsheets. Having it in the PMS creates a maintenance expense history per unit -- valuable for tax time and identifying money-pit units. | LOW | Add cost fields to maintenance request or separate work_order table linked to request. Track: vendor, labor cost, materials cost, total. Roll up to per-unit and per-property expense reports. |
| **Tenant unit transfer** | Move a tenant from one unit to another within the same building without losing their payment/maintenance history. AppFolio and Property Matrix support this. Uncommon in small landlord tools but valuable when it happens. | MEDIUM | End current tenantUnit record, create new one for target unit. Preserve user account and all history. Handle mid-cycle transfers: prorate rent for both units. Update autopay to reference new unit. |
| **Past-tenant read-only history** | After move-out, retain the tenant's payment history, maintenance requests, and documents in an accessible but read-only state. Most PMS platforms archive tenant data; few give the past tenant continued portal access. This reduces "can you send me my payment records?" requests. | LOW | When tenantUnit.isActive = false and endDate is set, tenant can still log in but sees read-only historical data. No payment buttons, no maintenance submission. Admin can view full history for any past tenant. |
| **Timezone-aware CRON scheduling** | Rent reminders and late fee calculations should use the property's local timezone, not UTC. A reminder sent at midnight UTC arrives at 4pm PST the day before -- confusing. Most PMS platforms handle this silently. | LOW | Store timezone on property record. CRON job converts "3 days before due date" to property-local time. Prevents premature or delayed notifications. Critical for late fee accuracy (was rent actually late in the property's timezone?). |
| **Self-service invite token entry** | New tenants who lost their QR code or received the unit code verbally can enter it manually on their dashboard. Reduces admin overhead for re-issuing invites. No competitor has QR onboarding at all, so this extends the existing differentiator. | LOW | Empty-state dashboard shows "Enter your unit invite code" input. Validates token, links tenant to unit. Same flow as QR scan but manual entry. |
| **Persistent sidebar navigation** | Replace the current admin nav with a sidebar layout. Industry standard for admin dashboards (AppFolio, Buildium, DoorLoop all use sidebar). Sidebar shows: Dashboard, Properties, Tenants, Payments, Maintenance, Documents, Vendors, Settings. Collapsible on mobile. | LOW | Layout component change, not a feature per se. But it transforms admin UX from "page-hopping" to "workspace." Should be built early as it affects all subsequent admin UI work. |

### Anti-Features (Commonly Requested, Often Problematic)

Features to explicitly NOT build in v2.0. These are scope traps.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full double-entry accounting** | Landlords want one system for everything (income, expenses, P&L, tax reporting). | Double-entry accounting is a separate product. The tenant ledger is single-entry (charges and credits against a running balance). Adding GL accounts, journal entries, and chart of accounts creates a parallel accounting system that will never be as good as QuickBooks. The ledger should track what tenants owe and have paid -- not run the landlord's books. | Single-entry tenant ledger with charges/credits/running balance. Export transaction data (CSV) for import into accounting software. |
| **Security deposit management** | Move-out workflow naturally raises the question of deposit tracking and refunds. | Security deposits have complex state-specific legal requirements (California: 21 days to return, itemized deductions with receipts, interest accrual in some jurisdictions). Building compliant deposit management is a legal minefield that requires per-state configuration. The current system has no deposit concept. | Track deposits offline or in accounting software. The ledger can record a "deposit refund" credit as part of move-out, but the deposit lifecycle (collection, holding, deduction, return) should stay manual for now. |
| **Vendor portal with login** | Vendors want their own dashboard to see assigned work orders, submit invoices, track payments. DoorLoop offers unlimited vendor accounts. | For a 5-unit building with 2-3 vendors, a full vendor portal is overengineered. The vendor login, permission system, and separate UI is significant scope. Vendors are contacted infrequently. | Send vendors an email/SMS notification with work order details and a limited-view shareable link (magic link, no account needed). If portfolio grows to 50+ units with 10+ vendors, reconsider. |
| **Automated prorated rent calculation** | When tenants move in or out mid-month, the system should auto-calculate prorated rent. | Proration methods vary (daily, 30-day month, actual days in month) and landlord preferences differ. Auto-calculating wrong creates disputes. | Admin manually enters a one-time charge for prorated rent amount in the ledger. The ledger supports arbitrary charge amounts -- proration is just a specific charge entry. |
| **Rent increase scheduling** | Schedule future rent changes with automatic effective dates. | For 5 units on month-to-month, rent changes are infrequent and require notice periods (California: 30 days for <10% increase, 90 days for >10%). Auto-applying a scheduled increase without proper notice creates legal risk. | Admin manually updates unit rent amount in property/unit CRUD when a rent change takes effect. Log the change in the ledger as a note. |
| **Tenant-facing financial disputes** | Let tenants flag charges they disagree with, triggering a dispute workflow. | Creates an adversarial dynamic and a complex approval/rejection workflow. Most disputes at small scale are resolved via direct conversation. | Tenants contact admin directly (phone/text/maintenance comment). Admin can apply credits or adjustments to the ledger to resolve disputes. |
| **Multi-currency support** | Support properties in different countries or currencies. | All current and planned properties are US-based, USD-only. Multi-currency adds complexity to every financial calculation, display, and Stripe integration. | USD only. Revisit only if portfolio expands internationally (unlikely for residential). |

---

## Feature Dependencies

```
Charges Table (Ledger)
    |
    |-- Late Fee Automation
    |       └──requires──> Charges Table (posts late fee charges)
    |       └──requires──> Timezone-aware CRON (accurate due date calculation)
    |       └──requires──> Per-unit rent config (knows what's due and when)
    |
    |-- Running Balance Visibility
    |       └──requires──> Charges Table (balance = charges - payments)
    |
    |-- Tenant Move-Out Workflow
    |       └──requires──> Charges Table (final charges/credits)
    |       └──requires──> Autopay system (cancel enrollment)
    |       └──requires──> tenantUnit end date support (already in schema)
    |
    |-- Work Order Cost Tracking
            └──requires──> Charges Table (optional: post repair costs as tenant charges)
            └──requires──> Vendor Assignment (links cost to vendor)

Property/Unit CRUD
    |
    |-- Tenant Unit Transfer
    |       └──requires──> Property/Unit CRUD (target unit must exist)
    |       └──requires──> Charges Table (prorate if mid-cycle)
    |
    |-- Tenant Move-Out Workflow
            └──requires──> Property/Unit CRUD (unit status after move-out)

Vendor Table
    |
    |-- Vendor Assignment for Maintenance
    |       └──requires──> Vendor Table
    |       └──requires──> Maintenance Requests (already exists)
    |
    |-- Work Order Cost Tracking
            └──requires──> Vendor Assignment

S3 Cloud Storage
    (independent -- no downstream dependencies, but should be done early
     to avoid accumulating more local files)

Edge-Level Auth
    (independent -- security hardening, can be done in parallel)

Admin Sidebar + KPI Dashboard
    |
    |-- All admin UI improvements
            └──enhances──> Every admin feature

Self-Service Invite Token Entry
    (independent -- minor enhancement to existing onboarding)
```

### Dependency Notes

- **Charges Table is the root dependency for v2.0.** Late fees, running balances, move-out workflow, and cost tracking all depend on having a ledger of charges separate from the payments table. This must be built first.
- **Property/Unit CRUD is the second foundation.** Tenant transfers and move-out workflows need the ability to manage units. The schema already supports properties and units, but there is no admin UI.
- **Late Fee Automation requires both the charges table AND timezone-aware CRON.** The CRON job must know the property timezone to determine if rent is actually late. The late fee charge must be posted to the ledger.
- **Vendor Assignment and Work Order Cost Tracking are a natural pair.** Build vendor table, then add assignment to maintenance requests, then add cost tracking. This is an additive chain.
- **S3 Migration and Edge Auth are independent of the financial features.** They can be done in parallel without blocking or being blocked by ledger work.
- **Admin Sidebar should be built early** because every subsequent admin feature inherits its layout. Building features in the old layout and then migrating is wasted effort.

---

## v2.0 Priority Definition

### Phase 1: Financial Foundation (P1 -- Must Have)

Build the ledger and running balance. Everything financial depends on this.

- [ ] **Charges table with entry types** -- rent, late_fee, utility, credit, adjustment, one_time
- [ ] **Running balance computation** -- per-tenant, per-unit, displayed to tenant and admin
- [ ] **Reconciliation with existing payments** -- link historical payments to charge records
- [ ] **Admin charge management** -- manually post charges and credits
- [ ] **Tenant balance view** -- "You owe $X" on tenant dashboard

### Phase 2: Infrastructure Hardening (P1 -- Must Have)

Security and storage improvements that reduce technical debt.

- [ ] **S3 cloud storage migration** -- move maintenance photos and documents off local disk
- [ ] **Edge-level JWT role authorization** -- reject unauthorized requests at middleware
- [ ] **Webhook hardening** -- strict Stripe intent ID matching for ACH edge cases

### Phase 3: Portfolio Management (P1 -- Must Have)

Admin control over properties, units, and tenant lifecycle.

- [ ] **Property CRUD** -- create, edit, archive properties
- [ ] **Unit CRUD** -- create, edit, archive units with rent config
- [ ] **Tenant move-out workflow** -- structured process with autopay cancellation
- [ ] **Past-tenant read-only view** -- historical access after move-out

### Phase 4: Automation and Operations (P2 -- Should Have)

Leverage the ledger for automated operations.

- [ ] **Late fee automation** -- configurable rules, CRON-driven, timezone-aware
- [ ] **Timezone-aware CRON** -- property-local time for all scheduled operations
- [ ] **Vendor table and assignment** -- assign vendors to maintenance requests
- [ ] **Work order cost tracking** -- labor/materials costs tied to requests

### Phase 5: Admin UX Overhaul (P2 -- Should Have)

Professional admin experience.

- [ ] **Persistent sidebar navigation** -- admin workspace layout
- [ ] **KPI dashboard** -- 5-7 key metrics with trend indicators
- [ ] **Mobile-responsive admin polish** -- sidebar collapses, touch-friendly
- [ ] **Polished empty states** -- guidance when sections have no data

### Deferred (P3 -- Future)

- [ ] **Tenant unit transfer** -- defer until an actual transfer is needed
- [ ] **Self-service invite token entry** -- minor enhancement, low urgency
- [ ] **Expense reporting per unit/property** -- valuable at 20+ units, overkill at 5

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Charges table (ledger) | HIGH | HIGH | P1 | Financial Foundation |
| Running balance visibility | HIGH | MEDIUM | P1 | Financial Foundation |
| Late fee automation | HIGH | MEDIUM | P2 | Automation |
| Property/Unit CRUD | HIGH | MEDIUM | P1 | Portfolio Mgmt |
| Tenant move-out workflow | HIGH | HIGH | P1 | Portfolio Mgmt |
| S3 cloud storage migration | HIGH | MEDIUM | P1 | Infrastructure |
| Edge-level JWT auth | HIGH | MEDIUM | P1 | Infrastructure |
| Webhook hardening | HIGH | LOW | P1 | Infrastructure |
| Admin sidebar navigation | MEDIUM | LOW | P2 | Admin UX |
| KPI dashboard | MEDIUM | MEDIUM | P2 | Admin UX |
| Vendor assignment | MEDIUM | MEDIUM | P2 | Automation |
| Work order cost tracking | MEDIUM | LOW | P2 | Automation |
| Timezone-aware CRON | MEDIUM | LOW | P2 | Automation |
| Past-tenant read-only view | MEDIUM | LOW | P1 | Portfolio Mgmt |
| Tenant unit transfer | LOW | MEDIUM | P3 | Deferred |
| Self-service invite token | LOW | LOW | P3 | Deferred |
| Mobile admin polish | MEDIUM | LOW | P2 | Admin UX |

**Priority key:**
- P1: Must have for v2.0 production readiness
- P2: Should have, adds significant operational value
- P3: Nice to have, defer until actual need arises

---

## Competitor Feature Analysis (v2.0 Features)

| Feature | AppFolio | Buildium | Stessa | TenantCloud | Our v2.0 Approach |
|---------|----------|----------|--------|-------------|-------------------|
| **Financial ledger** | Full GL with double-entry, tenant ledger, owner statements | Full accounting with GL | Tenant ledger with automated rent charges, running balance | Tenant ledger with automated charges | Single-entry tenant ledger: charges, credits, running balance. No GL, no owner statements. Export for accounting software. |
| **Late fee automation** | Yes, configurable rules | Yes, automated posting | Yes, automated based on lease terms | Yes, automated with grace period | CRON-driven: configurable grace period + flat/percentage fee, posted as ledger charge |
| **Tenant move-out** | Full workflow: notice, charges, deposit refund, forwarding address | Structured move-out with deposit disposition | Basic: end lease, record deposit return | Move-out with deposit handling | Structured workflow: set end date, cancel autopay, post final charges, archive tenantUnit. No deposit management (tracked offline). |
| **Property/Unit management** | Full CRUD with detailed property profiles | Full CRUD with photos, amenities | Property and unit management | Full CRUD | Focused CRUD: name, address, units with rent config. No photos/amenities (not needed at 5 units). Archive support. |
| **Vendor management** | Full vendor portal with unlimited accounts, dispatch, invoicing | Vendor directory, assignment, communication | No vendor feature | Basic vendor assignment | Lightweight: vendor table (name, trade, contact), assign to request, email/SMS notification with limited-view link. No vendor login. |
| **Work order costs** | Full cost tracking, vendor invoicing, owner billing | Cost tracking tied to work orders | No cost tracking | Basic cost tracking | Cost fields on work order: vendor, labor, materials, total. Per-unit expense rollup. |
| **Admin dashboard KPIs** | Comprehensive dashboard with financial reports | Dashboard with KPI cards | Dashboard with financial summary | Basic dashboard | 5-7 KPI cards: collection rate, outstanding balance, occupancy, open requests, overdue count. Activity feed below. |
| **Cloud file storage** | Cloud-native, all files in cloud | Cloud storage | Cloud storage | Cloud storage | Migrate from local uploads/ to S3-compatible (R2 or S3). Presigned URLs. |
| **Pricing** | $280/mo minimum | $55/mo minimum | Free (basic) | $15-45/mo | Self-hosted, operational cost only (~$20/mo for DB + storage + SMS) |

---

## Detailed Feature Specifications

### 1. Financial Ledger (Charges Table)

**How production PMS platforms implement this:**

The tenant ledger is the central financial record. It is NOT the payments table. It is a separate table of all financial events affecting a tenant's account.

**Entry types (from Rentec Direct, Stessa, TenantCloud):**
- **Rent charge** -- recurring, auto-posted on due date (or 1st of month)
- **Late fee** -- auto-posted after grace period, or manually added
- **One-time charge** -- utility, repair, cleaning, etc.
- **Credit/Adjustment** -- discount, waiver, concession, correction
- **Payment received** -- linked to payment record (Stripe or manual)

**Running balance formula:**
```
balance = SUM(charges WHERE type IN ('rent', 'late_fee', 'one_time', 'utility'))
        - SUM(charges WHERE type IN ('credit', 'adjustment'))
        - SUM(payments WHERE status = 'succeeded')
```

**Key design decisions:**
- Charges and payments are separate tables (charges = what is owed, payments = what was paid)
- Running balance is computed, not stored (avoids sync issues)
- Each charge has: tenant_id, unit_id, type, amount_cents, description, due_date, created_at
- Partial payments: payment amount < charge amount, balance reflects remainder
- Overpayment: creates negative balance (credit), applied to next month

### 2. Late Fee Automation

**How it works in production:**
- CRON job runs daily (or at property-local midnight)
- For each unit: check if rent charge exists for current period
- If rent is past due (due_date + grace_period_days) AND no succeeded payment covers it
- Post a late_fee charge to the ledger
- Notify tenant via configured channels

**Configuration (per-property or global):**
- Grace period: 3-5 days (industry standard, state-dependent)
- Fee type: flat ($50) or percentage (5% of rent)
- Fee amount: the dollar value or percentage
- One-time vs daily: most small landlords use one-time flat fee
- Maximum cap: some states cap late fees (California does not cap explicitly but requires "reasonable")

### 3. Tenant Move-Out Workflow

**AppFolio's workflow (industry standard):**
1. Admin enters move-out date and reason
2. System collects forwarding address (optional)
3. Admin posts final charges (cleaning, damages) and credits to ledger
4. System cancels autopay enrollment
5. System marks tenantUnit as inactive, sets end date
6. Past tenant retains read-only portal access
7. Admin can view complete tenant history

**Our implementation scope:**
- Steps 1-6 are table stakes
- Step 7 (past-tenant view) is a differentiator
- Security deposit handling is explicitly out of scope (tracked offline)
- Prorated final rent: admin posts manual charge for prorated amount

### 4. Property and Unit CRUD

**Standard implementation:**
- Properties: name, address, timezone, late fee config
- Units: unit number, rent amount (cents), rent due day, status (active/archived)
- Archive instead of delete (preserve history)
- Validation: cannot archive unit with active tenant

**Our additions beyond basic CRUD:**
- Late fee configuration at property level (grace period, fee type, amount)
- Timezone setting at property level (for CRON scheduling)

### 5. Vendor Assignment and Work Orders

**DoorLoop/Buildium model (simplified for small scale):**
- Vendor record: name, company, trade/specialty, phone, email
- Assignment: link vendor to maintenance request
- Notification: send vendor an email/SMS with request details
- Limited-view link: shareable URL showing request details, photos, unit info (no tenant PII)
- Cost tracking: labor cost, materials cost, total, linked to request

**What vendors see (limited view):**
- Property address and unit number
- Issue category and description
- Photos
- Status
- What vendors do NOT see: tenant name, phone, email, payment history

### 6. Admin Dashboard KPIs

**Recommended metrics for a 5-unit building (from industry research):**

| KPI | Formula | Display |
|-----|---------|---------|
| Rent Collection Rate | (Rent collected this month / Rent due this month) x 100 | Percentage with trend arrow |
| Total Outstanding | SUM(running balances where balance > 0) | Dollar amount, red if > 0 |
| Occupancy Rate | (Active tenants / Total units) x 100 | Percentage |
| Open Maintenance Requests | COUNT(requests WHERE status != 'resolved') | Number with link to queue |
| Overdue Tenants | COUNT(tenants WHERE balance > 0 AND past due date) | Number, red highlight |
| Average Maintenance Resolution | AVG(resolved_at - created_at) for last 30 days | Days |
| Monthly Revenue | SUM(payments this month WHERE status = 'succeeded') | Dollar amount with trend |

**Dashboard layout:**
- Top row: 4-5 KPI cards with numbers and trend indicators
- Middle: "Units needing attention" list (overdue, open requests)
- Bottom: Recent activity feed (payments, requests, move-ins/outs)
- Sidebar: persistent navigation to all admin sections

---

## Sources

- [What is a Tenant Ledger -- TenantCloud](https://www.tenantcloud.com/blog/what-is-a-tenant-ledger) (MEDIUM confidence -- vendor source with detailed ledger structure)
- [Tenant Ledger: How to Track Charges, Payments & Balances -- Stessa](https://support.stessa.com/en/articles/4806958-tenant-ledger-how-to-track-charges-payments-balances) (MEDIUM confidence -- vendor docs, specific implementation details)
- [Understanding Tenant Related Transactions -- Rentec Direct](https://help.rentecdirect.com/article/524-understanding-tenant-related-transactions) (MEDIUM confidence -- vendor knowledge base, detailed transaction types)
- [Understanding Ledgers and Transaction Types -- Rentec Direct](https://help.rentecdirect.com/article/523-understanding-ledgers-and-transaction-types) (MEDIUM confidence -- vendor knowledge base)
- [Moving Out Tenants in AppFolio -- APM Help](https://www.apmhelp.com/blog/move-outs-in-appfolio) (MEDIUM confidence -- third-party guide documenting AppFolio workflow)
- [Late Fees on Late Rent -- TrueDoor PM](https://www.truedoorpm.com/late-fee-on-late-rent/) (MEDIUM confidence -- industry guide with state-specific details)
- [Late Fees for Rent: State Limits -- Baselane](https://www.baselane.com/resources/late-fees-for-rent) (MEDIUM confidence -- cross-referenced with multiple sources)
- [Best Practices for Rent Collection and Late Fees -- UtilityProfit](https://www.utilityprofit.com/blog/best-practices-for-rent-collection-and-late-fees-a-property-managers-guide) (MEDIUM confidence)
- [Top 12 Property Management KPIs -- Revela](https://www.revela.co/resources/property-management-kpis) (MEDIUM confidence -- industry KPI reference with formulas)
- [Property Management Dashboard -- DataBrain](https://www.usedatabrain.com/blog/property-management-dashboard) (MEDIUM confidence -- dashboard design guidelines)
- [11 Property Management KPIs -- Buildium](https://www.buildium.com/blog/property-management-kpis-to-track/) (MEDIUM confidence -- vendor blog with KPI definitions)
- [Work Orders -- DoorLoop](https://www.doorloop.com/features/work-orders) (MEDIUM confidence -- vendor feature page with workflow details)
- [Establishing Transfer Policies -- Buildium](https://www.buildium.com/blog/establishing-transfer-policies-for-multi-unit-properties/) (MEDIUM confidence -- vendor blog on unit transfers)
- [How to Move a Tenant -- Property Matrix](https://help.propertymatrix.com/en/articles/401361-how-to-move-a-tenant-to-a-different-unit) (MEDIUM confidence -- vendor help doc)
- [Pros and Cons of Resident Unit Transfers -- AppFolio](https://www.appfolio.com/blog/pros-and-cons-of-resident-unit-transfers/) (MEDIUM confidence -- vendor blog)

---

*Feature research for: RentalMgmt v2.0 -- Production-ready property management portal*
*Researched: 2026-02-26*
