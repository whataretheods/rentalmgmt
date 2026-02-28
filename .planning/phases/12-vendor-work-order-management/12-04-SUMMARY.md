---
phase: 12-vendor-work-order-management
plan: 04
status: complete
---

# Plan 12-04 Summary: Cost Tracking & Expense Rollup (OPS-04)

## What was built
- **Cost CRUD API**: GET/POST/DELETE at /api/admin/work-orders/[id]/costs with category validation
- **Per-unit expense rollup API**: GET /api/admin/reports/unit-expenses with labor/materials/other breakdown
- **Cost tracking UI**: Integrated into work order detail page with add form, cost table, and running total

## Key files
- `src/app/api/admin/work-orders/[id]/costs/route.ts` — CRUD for cost line items
- `src/app/api/admin/reports/unit-expenses/route.ts` — per-unit expense rollup
- `src/app/(admin)/admin/work-orders/[id]/page.tsx` — cost UI section (inline, not separate page)

## Decisions
- Dollar-to-cents conversion at UI boundary: form accepts dollars, API stores amountCents as integer
- Expense rollup uses JOIN chain: workOrderCosts -> workOrders -> maintenanceRequests -> units -> properties
- Cost delete verifies the cost belongs to the specified work order before deletion
- Grand total computed server-side from individual unit totals
