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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" })
    .notNull(),
  unitNumber: text("unit_number").notNull(),
  rentAmountCents: integer("rent_amount_cents"),  // nullable until Phase 3 configures it
  rentDueDay: integer("rent_due_day"),             // day of month 1-28, nullable until Phase 3
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Links a user (tenant) to a unit -- supports historical tenancy records
export const tenantUnits = pgTable("tenant_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),              // references Better Auth user.id (text, NOT uuid)
  unitId: uuid("unit_id")
    .references(() => units.id, { onDelete: "cascade" })
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
    .references(() => units.id, { onDelete: "cascade" })
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
    .references(() => units.id, { onDelete: "cascade" })
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
    .references(() => units.id, { onDelete: "cascade" })
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
