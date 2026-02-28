---
phase: 12-vendor-work-order-management
plan: 03
status: complete
---

# Plan 12-03 Summary: Work Orders & Magic Link (OPS-02, OPS-03)

## What was built
- **Work order API routes**: GET/POST at /api/admin/work-orders, GET/PATCH at /api/admin/work-orders/[id]
- **Admin work order list**: Table with status badges (assigned/scheduled/in_progress/completed/cancelled) and priority badges
- **Admin work order detail**: Status/priority management, vendor assignment, magic link section (copy/regenerate/revoke), cost tracking UI
- **Vendor magic link page**: Server component at /vendor/work-order/[token] showing work order + maintenance request details without tenant PII
- **Token-gated photo route**: /api/vendor/photos/[token]/[photoId] validates token ownership before serving photos

## Key files
- `src/app/api/admin/work-orders/route.ts` — list/create with vendor notification
- `src/app/api/admin/work-orders/[id]/route.ts` — detail/update with token management
- `src/app/(admin)/admin/work-orders/page.tsx` — list page
- `src/app/(admin)/admin/work-orders/[id]/page.tsx` — detail page with integrated cost UI
- `src/app/vendor/work-order/[token]/page.tsx` — public vendor page (server component)
- `src/app/api/vendor/photos/[token]/[photoId]/route.ts` — token-gated photo access

## Decisions
- Magic link uses vendorAccessToken (UUID) as URL slug — no auth session needed
- Vendor page is server component (no "use client") to prevent client-side data leakage
- Photo route validates token -> work order -> maintenance request -> photo chain before serving
- Vendor reassignment generates new token and sends new notification
- Token regenerate/revoke actions available in admin detail page
