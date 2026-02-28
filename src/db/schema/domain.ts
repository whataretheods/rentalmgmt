import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),  // IANA timezone identifier
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),  // null = active, non-null = archived (soft-deleted)
})

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "restrict" })
    .notNull(),
  unitNumber: text("unit_number").notNull(),
  rentAmountCents: integer("rent_amount_cents"),  // nullable until Phase 3 configures it
  rentDueDay: integer("rent_due_day"),             // day of month 1-28, nullable until Phase 3
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),  // null = active, non-null = archived (soft-deleted)
})

// Links a user (tenant) to a unit -- supports historical tenancy records
export const tenantUnits = pgTable("tenant_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),              // references Better Auth user.id (text, NOT uuid)
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "restrict" })
    .notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),                 // null = active/current tenancy
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Invite tokens — single-use, time-limited QR code invitations linking tenants to units
export const inviteTokens = pgTable("invite_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "restrict" })
    .notNull(),
  tokenHash: text("token_hash").notNull().unique(),  // SHA-256 hash of raw token
  status: text("status", { enum: ["pending", "used", "expired"] })
    .default("pending")
    .notNull(),
  usedByUserId: text("used_by_user_id"),  // populated when consumed (text matches Better Auth user.id type)
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
})

// Payments — tracks all rent payments (Stripe and manual/offline)
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),     // Better Auth user.id (text, NOT uuid)
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "restrict" })
    .notNull(),
  amountCents: integer("amount_cents").notNull(),      // amount in cents (e.g., 150000 = $1,500.00)
  stripeSessionId: text("stripe_session_id").unique(), // null for manual payments, unique to prevent duplicates
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentMethod: text("payment_method", {
    enum: ["card", "ach", "cash", "check", "venmo", "other"],
  }).notNull(),
  status: text("status", {
    enum: ["pending", "succeeded", "failed"],
  }).notNull(),
  billingPeriod: text("billing_period").notNull(),     // "2026-03" YYYY-MM format
  note: text("note"),                                   // for manual payment descriptions
  paidAt: timestamp("paid_at"),                         // when payment was confirmed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ==================== Phase 4: Maintenance, Documents, Profiles ====================

// Maintenance requests with 4-stage status progression
export const maintenanceRequests = pgTable("maintenance_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),   // Better Auth user.id (text, NOT uuid)
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "restrict" })
    .notNull(),
  category: text("category", {
    enum: ["plumbing", "electrical", "hvac", "appliance", "pest_control", "structural", "general"],
  }).notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["submitted", "acknowledged", "in_progress", "resolved"],
  }).default("submitted").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
})

// Photos attached to maintenance requests (up to 5 per request)
export const maintenancePhotos = pgTable("maintenance_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .references(() => maintenanceRequests.id, { onDelete: "cascade" })
    .notNull(),
  filePath: text("file_path").notNull(),       // relative path from uploads root
  fileName: text("file_name").notNull(),       // original filename
  fileSize: integer("file_size").notNull(),    // bytes
  mimeType: text("mime_type").notNull(),
  storageBackend: text("storage_backend").default("local").notNull(),  // "local" or "s3"
  s3Key: text("s3_key"),  // S3 object key, null for local files
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Threaded comments on maintenance requests (tenant + admin)
export const maintenanceComments = pgTable("maintenance_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .references(() => maintenanceRequests.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id").notNull(),           // can be tenant or admin
  content: text("content").notNull(),
  isStatusChange: boolean("is_status_change").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Tenant documents (uploaded files)
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),
  documentType: text("document_type", {
    enum: ["government_id", "proof_of_income_insurance", "general"],
  }).notNull(),
  filePath: text("file_path").notNull(),       // relative path from uploads root
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),    // bytes
  mimeType: text("mime_type").notNull(),
  storageBackend: text("storage_backend").default("local").notNull(),  // "local" or "s3"
  s3Key: text("s3_key"),  // S3 object key, null for local files
  requestId: uuid("request_id"),               // links to admin request if this was requested
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Admin document requests
export const documentRequests = pgTable("document_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),
  documentType: text("document_type", {
    enum: ["government_id", "proof_of_income_insurance", "general"],
  }).notNull(),
  message: text("message"),                    // optional admin note
  status: text("status", {
    enum: ["pending", "submitted"],
  }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  fulfilledAt: timestamp("fulfilled_at"),
})

// Emergency contacts for tenants
export const emergencyContacts = pgTable("emergency_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),  // one emergency contact per tenant
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ==================== Phase 5: Notifications and Messaging ====================

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),           // Better Auth user.id (text)
  type: text("type", {
    enum: ["rent_reminder", "payment_confirmation", "broadcast", "maintenance_update", "system"],
  }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  channel: text("channel", {
    enum: ["in_app", "email", "sms"],
  }).default("in_app").notNull(),
  readAt: timestamp("read_at"),                // null = unread
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ==================== Phase 6: Autopay and Polish ====================

// Autopay enrollment — one per tenant, saves Stripe payment method for recurring charges
export const autopayEnrollments = pgTable("autopay_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull().unique(), // one enrollment per tenant
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "restrict" })
    .notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
  paymentMethodType: text("payment_method_type", {
    enum: ["card", "us_bank_account"],
  }).notNull(),
  paymentMethodLast4: text("payment_method_last4").notNull(),
  paymentMethodBrand: text("payment_method_brand"), // "visa", "mastercard", null for ACH
  status: text("status", {
    enum: ["active", "paused", "payment_failed", "cancelled"],
  }).default("active").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  cancelledAt: timestamp("cancelled_at"),
  lastChargeAt: timestamp("last_charge_at"),
  nextChargeDate: text("next_charge_date"),  // "2026-03-01" ISO date string for display
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ==================== Phase 9: Automated Operations ====================

// Late fee rules — per-property configuration for automatic late fee assessment
export const lateFeeRules = pgTable("late_fee_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull()
    .unique(),  // one rule set per property
  enabled: boolean("enabled").default(false).notNull(),  // MUST default OFF
  gracePeriodDays: integer("grace_period_days").notNull().default(5),
  feeType: text("fee_type", { enum: ["flat", "percentage"] }).notNull().default("flat"),
  feeAmountCents: integer("fee_amount_cents").notNull().default(5000),  // $50 flat OR 500 = 5% for percentage
  maxFeeAmountCents: integer("max_fee_amount_cents"),  // optional cap for percentage fees
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ==================== Phase 8: Financial Ledger ====================

// Charges — append-only ledger of financial obligations (what is owed)
export const charges = pgTable("charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantUserId: text("tenant_user_id").notNull(),        // Better Auth user.id (text, NOT uuid)
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "restrict" })
    .notNull(),
  type: text("type", {
    enum: ["rent", "late_fee", "one_time", "credit", "adjustment"],
  }).notNull(),
  description: text("description").notNull(),             // e.g., "Rent for 2026-03", "Late fee", "Parking fee"
  amountCents: integer("amount_cents").notNull(),          // positive = charge/debit, negative = credit/adjustment
  billingPeriod: text("billing_period"),                   // YYYY-MM format for rent charges, null for one-time
  createdBy: text("created_by"),                           // admin user ID for manual entries, null for system-generated
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// Stripe webhook event deduplication
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),                             // Stripe event ID (e.g., "evt_xxx") — NOT uuid
  type: text("type").notNull(),                            // Stripe event type (e.g., "payment_intent.succeeded")
  processedAt: timestamp("processed_at").defaultNow().notNull(),
})

// ==================== Phase 12: Vendor & Work Order Management ====================

// Vendor directory
export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  specialty: text("specialty", {
    enum: ["plumbing", "electrical", "hvac", "appliance", "pest_control",
           "general_maintenance", "painting", "cleaning", "landscaping", "other"],
  }),
  notes: text("notes"),
  status: text("status", { enum: ["active", "inactive"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Work orders linking vendors to maintenance requests
export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  maintenanceRequestId: uuid("maintenance_request_id")
    .references(() => maintenanceRequests.id, { onDelete: "restrict" })
    .notNull(),
  vendorId: uuid("vendor_id")
    .references(() => vendors.id, { onDelete: "set null" }),
  assignedByUserId: text("assigned_by_user_id").notNull(),
  status: text("status", {
    enum: ["assigned", "scheduled", "in_progress", "completed", "cancelled"],
  }).default("assigned").notNull(),
  priority: text("priority", {
    enum: ["low", "medium", "high", "emergency"],
  }).default("medium").notNull(),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  notes: text("notes"),
  vendorAccessToken: text("vendor_access_token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Cost line items on work orders
export const workOrderCosts = pgTable("work_order_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workOrderId: uuid("work_order_id")
    .references(() => workOrders.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category", {
    enum: ["labor", "materials", "permits", "other"],
  }).notNull(),
  receiptPath: text("receipt_path"),  // S3 key for receipt upload (Phase 7)
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
