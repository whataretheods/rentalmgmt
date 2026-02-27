# Phase 11: Admin UX & KPI Dashboard - Research

**Researched:** 2026-02-26
**Domain:** Admin dashboard KPI metrics, empty states, mobile-responsive layout
**Confidence:** HIGH

## Summary

Phase 11 transforms the admin dashboard from a simple link page into a data-driven KPI dashboard, polishes all admin list views with contextual empty states, and makes the admin layout fully mobile-responsive with a collapsible sidebar.

The current admin layout (`src/app/(admin)/layout.tsx`) uses a horizontal nav bar with inline links -- no sidebar exists yet (the Phase 7 sidebar hasn't been built). The dashboard page (`src/app/(admin)/admin/dashboard/page.tsx`) is a placeholder with navigation links only. Empty states are inconsistent -- some pages have basic "no data" messages (units page), others have no handling at all.

**Primary recommendation:** Build KPI data aggregation as server-side queries in the dashboard page (Server Component), create a reusable `KpiCard` component using existing shadcn Card, implement a unified `EmptyState` enhancement (existing component at `src/components/ui/empty-state.tsx` has good bones), and convert the admin layout to a sidebar-based responsive design using shadcn Sheet for mobile overlay.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUX-02 | Admin dashboard displays KPI metric cards (collection rate, total outstanding, occupancy rate, open maintenance requests, overdue tenants) | Server-side SQL aggregation queries in dashboard page using existing schema tables (payments, units, tenantUnits, maintenanceRequests). KPI cards built with shadcn Card components. Data derived from live database -- no new tables needed. |
| AUX-03 | All admin tables and lists show polished empty states with contextual guidance | Existing `EmptyState` component at `src/components/ui/empty-state.tsx` provides icon + title + description + action pattern. Each admin page needs page-specific empty state messages with contextual CTA (e.g., "Generate an invite" on tenants page). |
| AUX-04 | Admin layout is mobile-responsive with collapsible sidebar and touch-friendly targets | Replace horizontal nav in `src/app/(admin)/layout.tsx` with sidebar layout. Use shadcn Sheet component for mobile overlay. Sidebar persists on desktop (>=1024px), collapses to hamburger on mobile. Touch targets minimum 44x44px per Apple HIG. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5 | App Router, Server Components for KPI queries | Already in project; Server Components ideal for data-heavy dashboard |
| Drizzle ORM | 0.45.1 | SQL aggregation queries for KPI metrics | Already in project; `sql` template for COUNT/SUM/AVG |
| shadcn/ui | latest | Card, Sheet, Button components | Already in project; consistent design system |
| Tailwind CSS | 4.2.1 | Responsive breakpoints, mobile-first layout | Already in project; `lg:` prefix for desktop sidebar |
| Lucide React | 0.575.0 | KPI icons, empty state icons, menu icon | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.0.7 | Toast notifications for actions | Already in project; for error feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom KPI cards | Tremor/Recharts dashboard library | Overkill for 5 static metric cards; shadcn Card is sufficient |
| Custom mobile drawer | Radix Dialog/Drawer | shadcn Sheet wraps Radix internally; use Sheet directly |
| Client-side data fetching for KPIs | SWR/React Query | Server Components handle this natively; no client JS needed for initial render |

**Installation:**
```bash
npx shadcn@latest add sheet
```
Note: Card, Button, Skeleton already installed. Sheet may need to be added for mobile sidebar.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(admin)/
│   ├── layout.tsx               # Sidebar layout (responsive)
│   └── admin/
│       └── dashboard/
│           └── page.tsx         # KPI dashboard (Server Component)
├── components/
│   ├── admin/
│   │   ├── AdminSidebar.tsx     # Sidebar nav component
│   │   ├── KpiCard.tsx          # Reusable KPI metric card
│   │   └── MobileSidebar.tsx    # Mobile hamburger + Sheet overlay
│   └── ui/
│       └── empty-state.tsx      # Enhanced empty state component
├── lib/
│   └── kpi-queries.ts           # Server-side KPI aggregation functions
```

### Pattern 1: Server Component KPI Dashboard
**What:** Fetch all KPI metrics directly in the Server Component using Drizzle ORM queries
**When to use:** Dashboard page that shows aggregated data on initial load
**Example:**
```typescript
// src/lib/kpi-queries.ts
import { db } from "@/db"
import { payments, units, tenantUnits, maintenanceRequests } from "@/db/schema"
import { eq, sql, and, ne } from "drizzle-orm"

export async function getKpiMetrics() {
  const currentPeriod = new Date().toISOString().slice(0, 7)

  // Collection rate: units with payment / total occupied units for current period
  // Total outstanding: sum of (rent - paid) for all occupied units
  // Occupancy rate: occupied units / total units
  // Open maintenance: count where status != 'resolved'
  // Overdue tenants: occupied units with no payment for current period past due day

  // Execute queries in parallel
  const [occupancy, maintenance, collection] = await Promise.all([
    getOccupancyMetrics(),
    getMaintenanceMetrics(),
    getCollectionMetrics(currentPeriod),
  ])

  return { ...occupancy, ...maintenance, ...collection }
}
```

### Pattern 2: Responsive Sidebar with Sheet
**What:** Desktop sidebar is always visible; mobile sidebar uses Sheet overlay triggered by hamburger
**When to use:** Admin layout needs to work on all screen sizes
**Example:**
```typescript
// Desktop: sidebar is visible via lg:block
// Mobile: sidebar hidden, hamburger button triggers Sheet
<div className="flex min-h-screen">
  {/* Desktop sidebar - hidden on mobile */}
  <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r bg-white">
    <AdminSidebar />
  </aside>

  {/* Mobile sidebar - Sheet overlay */}
  <MobileSidebar /> {/* hamburger + Sheet wrapping AdminSidebar */}

  {/* Main content */}
  <div className="flex-1">
    <header className="lg:hidden ...">
      {/* Mobile header with hamburger */}
    </header>
    <main className="p-6">{children}</main>
  </div>
</div>
```

### Pattern 3: Contextual Empty States
**What:** Each admin page has a unique empty state with specific guidance text and CTA
**When to use:** Any list/table view that can be empty
**Example:**
```typescript
// Existing EmptyState component already supports icon, title, description, action
<EmptyState
  icon={Users}
  title="No tenants yet"
  description="Generate an invite code to onboard your first tenant"
  action={<Button asChild><Link href="/admin/invites">Generate Invite</Link></Button>}
/>
```

### Anti-Patterns to Avoid
- **Fetching KPI data client-side:** Dashboard metrics should load on initial render via Server Components; no loading spinners needed for first paint
- **Single monolithic sidebar component:** Separate sidebar content from mobile wrapper for reuse
- **Generic "No data" messages:** Every empty state must have page-specific context and a clear next action
- **Fixed pixel widths for sidebar:** Use responsive classes, not hardcoded widths that break between breakpoints

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mobile sidebar overlay | Custom CSS drawer with backdrop | shadcn Sheet component | Handles focus trapping, backdrop, animation, accessibility |
| KPI number formatting | Manual string formatting | Intl.NumberFormat | Handles currency, percentages, locale-aware formatting |
| Responsive visibility | Custom media query hooks | Tailwind `hidden lg:block` classes | CSS-only, no JS needed, no hydration mismatch |
| Touch-friendly tap targets | Custom padding calculations | `min-h-[44px] min-w-[44px]` Tailwind classes | Apple HIG standard, consistent sizing |

**Key insight:** The project already has shadcn/ui components (Card, Button, Skeleton) and Lucide icons. All KPI and empty state work is composition of existing pieces, not new library adoption.

## Common Pitfalls

### Pitfall 1: KPI Queries N+1 Problem
**What goes wrong:** Running separate queries for each KPI metric leads to 5+ database round trips on every dashboard load
**Why it happens:** Each metric seems independent so developers write separate queries
**How to avoid:** Use `Promise.all()` to parallelize independent queries; combine related metrics into single queries using SQL CASE/WHEN and subqueries
**Warning signs:** Dashboard page takes >500ms to load

### Pitfall 2: Hydration Mismatch on Sidebar State
**What goes wrong:** Server renders sidebar as open, client JavaScript initializes it as closed (or vice versa), causing React hydration error
**Why it happens:** Sidebar state depends on viewport width which is unknown server-side
**How to avoid:** Use CSS-only responsive visibility (`hidden lg:block`) for desktop/mobile toggle; keep Sheet component client-side only. Never use `typeof window` checks for initial render
**Warning signs:** React console warning about hydration mismatch

### Pitfall 3: Stale KPI Data with Static Rendering
**What goes wrong:** Next.js caches the dashboard page and shows stale KPI numbers
**Why it happens:** Server Components are statically rendered by default in production
**How to avoid:** Add `export const dynamic = 'force-dynamic'` to dashboard page, or use `unstable_noStore()` from `next/cache`
**Warning signs:** KPI numbers don't change after recording a payment

### Pitfall 4: Empty State Flash on Loading
**What goes wrong:** User briefly sees empty state before data loads
**Why it happens:** Client components show empty state before API response arrives
**How to avoid:** For server-rendered pages, this is a non-issue. For client-rendered lists, use Skeleton loading states (already have `skeleton.tsx` component)
**Warning signs:** Flickering between empty state and data display

### Pitfall 5: Mobile Sidebar Not Closing on Navigation
**What goes wrong:** User taps a link in mobile sidebar but sidebar stays open
**Why it happens:** Next.js client navigation doesn't cause Sheet to close
**How to avoid:** Use `usePathname()` hook to detect route changes and close the Sheet via state setter
**Warning signs:** User has to manually close sidebar after every navigation

## Code Examples

### KPI Collection Rate Query
```typescript
// Count of occupied units that have payment >= rent for current period / total occupied units
const collectionResult = await db
  .select({
    totalOccupied: sql<number>`COUNT(DISTINCT ${tenantUnits.unitId})`.as("total_occupied"),
    paidCount: sql<number>`COUNT(DISTINCT CASE
      WHEN COALESCE(p.total_paid, 0) >= ${units.rentAmountCents}
      THEN ${tenantUnits.unitId}
    END)`.as("paid_count"),
    totalOutstandingCents: sql<number>`COALESCE(SUM(
      GREATEST(${units.rentAmountCents} - COALESCE(p.total_paid, 0), 0)
    ), 0)`.as("total_outstanding"),
  })
  .from(tenantUnits)
  .innerJoin(units, eq(tenantUnits.unitId, units.id))
  .leftJoin(
    sql`(SELECT unit_id, SUM(amount_cents) as total_paid FROM payments WHERE billing_period = ${period} AND status = 'succeeded' GROUP BY unit_id) p`,
    sql`p.unit_id = ${units.id}`
  )
  .where(and(eq(tenantUnits.isActive, true), sql`${units.rentAmountCents} IS NOT NULL`))
```

### Occupancy Rate Query
```typescript
const [totalUnits] = await db
  .select({ count: sql<number>`COUNT(*)::int` })
  .from(units)

const [occupiedUnits] = await db
  .select({ count: sql<number>`COUNT(DISTINCT ${tenantUnits.unitId})::int` })
  .from(tenantUnits)
  .where(eq(tenantUnits.isActive, true))

const occupancyRate = totalUnits.count > 0
  ? (occupiedUnits.count / totalUnits.count) * 100
  : 0
```

### Open Maintenance Count
```typescript
const [openMaintenance] = await db
  .select({ count: sql<number>`COUNT(*)::int` })
  .from(maintenanceRequests)
  .where(ne(maintenanceRequests.status, "resolved"))
```

### Overdue Tenants Query
```typescript
// Tenants whose rent due day has passed for current month with no payment
const today = new Date()
const currentDay = today.getDate()
const currentPeriod = today.toISOString().slice(0, 7)

const overdueResult = await db
  .select({ count: sql<number>`COUNT(*)::int` })
  .from(tenantUnits)
  .innerJoin(units, eq(tenantUnits.unitId, units.id))
  .leftJoin(
    sql`(SELECT unit_id FROM payments WHERE billing_period = ${currentPeriod} AND status = 'succeeded') p`,
    sql`p.unit_id = ${units.id}`
  )
  .where(and(
    eq(tenantUnits.isActive, true),
    sql`${units.rentDueDay} IS NOT NULL`,
    sql`${units.rentDueDay} < ${currentDay}`,
    sql`p.unit_id IS NULL`
  ))
```

### KPI Card Component
```typescript
import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: "up" | "down" | "neutral"
}

export function KpiCard({ title, value, subtitle, icon: Icon }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 pt-6">
        <div className="rounded-lg bg-gray-100 p-3">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
```

### Empty State Mapping Per Page
```typescript
// Map of admin pages to their empty state configuration
const emptyStates = {
  users: {
    icon: Users,
    title: "No tenants yet",
    description: "Generate an invite to onboard your first tenant",
    actionLabel: "Generate Invite",
    actionHref: "/admin/invites",
  },
  units: {
    icon: Building,
    title: "No units configured",
    description: "Add a property and units to get started with rent collection",
    actionLabel: "Add Property",
    actionHref: "/admin/properties", // Will exist after Phase 10
  },
  payments: {
    icon: CreditCard,
    title: "No payments recorded",
    description: "Payments will appear here once tenants start paying rent",
  },
  maintenance: {
    icon: Wrench,
    title: "No maintenance requests",
    description: "Maintenance requests from tenants will appear here",
  },
  documents: {
    icon: FileText,
    title: "No documents yet",
    description: "Request documents from tenants or wait for them to upload",
  },
  invites: {
    icon: Mail,
    title: "No units available for invites",
    description: "Create units first, then generate invite codes for tenants",
  },
  notifications: {
    icon: Bell,
    title: "No notifications yet",
    description: "System notifications will appear as activity occurs",
  },
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side dashboard data fetching | Server Components with direct DB access | Next.js 13+ (2023) | No loading states needed for initial KPI render |
| Custom responsive sidebar JS | CSS-only `hidden lg:block` + Sheet overlay | Tailwind v3+ | No hydration issues, no JS for viewport detection |
| Generic "empty" divs | Structured EmptyState component with CTA | Project convention | Consistent UX, guides users to next action |

## Open Questions

1. **Phase 8 charges table dependency**
   - What we know: KPI queries currently must use the `payments` table since charges table doesn't exist yet. Phase 11 depends on Phase 8 which creates the charges/ledger tables.
   - What's unclear: Will the charges table have a different schema for computing "outstanding balance" vs using rentAmountCents - payments?
   - Recommendation: Plan KPI queries against the data model that will exist AFTER Phase 8 completes (charges table). If charges table isn't available, fall back to current payments + units.rentAmountCents approach. The planner should assume Phase 8 is complete.

2. **Phase 7 sidebar dependency**
   - What we know: Phase 7 roadmap lists "persistent collapsible sidebar navigation" (AUX-01). Phase 11 adds mobile responsiveness to it (AUX-04).
   - What's unclear: Whether Phase 7 will have built the sidebar or if Phase 11 must build it from scratch.
   - Recommendation: Plan assumes Phase 7 built a basic desktop sidebar. Phase 11 enhances it with mobile responsiveness. If Phase 7 sidebar is minimal, Phase 11 may need to replace/rebuild it. The plan should check current layout state and adapt.

3. **Phase 10 portfolio data for occupancy**
   - What we know: Phase 10 adds property/unit CRUD and tenant lifecycle. Occupancy rate needs total units vs occupied units.
   - What's unclear: Whether Phase 10 adds any archiving (soft delete) columns that affect occupancy count.
   - Recommendation: Plan should count only non-archived units (if archive column exists) and active tenantUnits.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --grep "admin" --headed=false` |
| Full suite command | `npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUX-02 | KPI cards display on admin dashboard with computed values | e2e | `npx playwright test tests/admin-dashboard.spec.ts` | No - Wave 0 |
| AUX-03 | Empty states show contextual guidance on admin pages | e2e | `npx playwright test tests/admin-empty-states.spec.ts` | No - Wave 0 |
| AUX-04 | Mobile sidebar collapses to hamburger; touch targets >= 44px | e2e | `npx playwright test tests/admin-mobile.spec.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test tests/admin-dashboard.spec.ts --headed=false`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before verify-work

### Wave 0 Gaps
- [ ] `tests/admin-dashboard.spec.ts` -- covers AUX-02
- [ ] `tests/admin-empty-states.spec.ts` -- covers AUX-03
- [ ] `tests/admin-mobile.spec.ts` -- covers AUX-04

## Sources

### Primary (HIGH confidence)
- Project codebase analysis -- layout.tsx, dashboard page, all admin pages, schema, API routes
- shadcn/ui Card component -- already installed and used in project
- shadcn/ui EmptyState component -- already built at src/components/ui/empty-state.tsx

### Secondary (MEDIUM confidence)
- Next.js App Router Server Components documentation -- data fetching patterns
- Tailwind CSS responsive design -- `hidden lg:block` pattern for sidebar

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies (except possibly shadcn Sheet)
- Architecture: HIGH - follows existing project patterns (Server Components, Drizzle queries, shadcn components)
- Pitfalls: HIGH - well-known Next.js patterns, documented in official docs

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (30 days - stable stack)
