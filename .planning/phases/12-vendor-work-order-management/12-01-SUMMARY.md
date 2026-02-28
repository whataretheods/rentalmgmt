---
phase: 12-vendor-work-order-management
plan: 01
status: complete
---

# Plan 12-01 Summary: Schemas & Notification Helper

## What was built
- **vendors** table: companyName, contactName, email, phone, specialty (10-value enum), notes, status (active/inactive), timestamps
- **workOrders** table: maintenanceRequestId (onDelete restrict), vendorId (onDelete set null), assignedByUserId, status (5 values), priority (4 values), scheduledDate, completedDate, notes, vendorAccessToken (unique), timestamps
- **workOrderCosts** table: workOrderId (onDelete cascade), description, amountCents, category (labor/materials/permits/other), receiptPath, createdAt
- **vendor-notifications.ts**: Fire-and-forget email (Resend) and SMS (Twilio) notification function for vendor assignment with try-catch safety

## Key files
- `src/db/schema/domain.ts` — 3 new tables added
- `src/lib/vendor-notifications.ts` — notifyVendorAssignment()
- `drizzle/0007_familiar_viper.sql` — migration

## Decisions
- vendorAccessToken uses crypto.randomUUID() for magic link authentication
- Notifications wrapped in try-catch to prevent crashes when Twilio/Resend credentials are not configured
