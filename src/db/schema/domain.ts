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
