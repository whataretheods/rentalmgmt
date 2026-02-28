import { describe, it, expect } from "vitest"

/**
 * Pure function that builds the values object for an ACH payment UPSERT.
 * This extracts the decision logic from the webhook handler so it can be
 * unit-tested without mocking HTTP, Stripe signature verification, or DB.
 */
interface AchPaymentUpsertValues {
  tenantUserId: string
  unitId: string
  amountCents: number
  stripeSessionId: string
  stripePaymentIntentId: string | null
  paymentMethod: "ach"
  status: "succeeded" | "failed"
  billingPeriod: string
  paidAt: Date | null
}

// Import will be created in Task 2 (GREEN phase)
import { buildAchPaymentUpsert } from "@/lib/webhook-upsert"

describe("buildAchPaymentUpsert — ACH out-of-order webhook handling", () => {
  const baseSession = {
    id: "cs_test_abc123",
    amount_total: 150000, // $1,500.00
    payment_intent: "pi_test_xyz789",
  }

  const baseMetadata = {
    tenantUserId: "user_tenant_001",
    unitId: "unit_uuid_001",
    billingPeriod: "2026-03",
  }

  it("async_payment_succeeded before completed — should INSERT new payment with status succeeded", () => {
    const result = buildAchPaymentUpsert(baseSession, baseMetadata, "succeeded")

    expect(result.tenantUserId).toBe("user_tenant_001")
    expect(result.unitId).toBe("unit_uuid_001")
    expect(result.amountCents).toBe(150000)
    expect(result.stripeSessionId).toBe("cs_test_abc123")
    expect(result.stripePaymentIntentId).toBe("pi_test_xyz789")
    expect(result.paymentMethod).toBe("ach")
    expect(result.status).toBe("succeeded")
    expect(result.billingPeriod).toBe("2026-03")
    expect(result.paidAt).toBeInstanceOf(Date)
  })

  it("async_payment_succeeded after completed — should UPDATE existing pending payment to succeeded", () => {
    // Same function call — the UPSERT values are identical regardless of whether
    // the record exists. The INSERT vs UPDATE decision is made by Postgres via
    // ON CONFLICT, not by our application code. We just verify the values are correct.
    const result = buildAchPaymentUpsert(baseSession, baseMetadata, "succeeded")

    expect(result.status).toBe("succeeded")
    expect(result.paidAt).toBeInstanceOf(Date)
    // The ON CONFLICT SET clause only updates status, paidAt, updatedAt —
    // immutable fields (tenantUserId, unitId, amountCents) are NOT overwritten.
    // That logic is in the Drizzle query, not in this function.
  })

  it("async_payment_failed before completed — should INSERT new payment with status failed", () => {
    const result = buildAchPaymentUpsert(baseSession, baseMetadata, "failed")

    expect(result.tenantUserId).toBe("user_tenant_001")
    expect(result.unitId).toBe("unit_uuid_001")
    expect(result.amountCents).toBe(150000)
    expect(result.stripeSessionId).toBe("cs_test_abc123")
    expect(result.stripePaymentIntentId).toBe("pi_test_xyz789")
    expect(result.paymentMethod).toBe("ach")
    expect(result.status).toBe("failed")
    expect(result.billingPeriod).toBe("2026-03")
    expect(result.paidAt).toBeNull()
  })

  it("async_payment_failed after completed — should UPDATE existing pending payment to failed", () => {
    const result = buildAchPaymentUpsert(baseSession, baseMetadata, "failed")

    expect(result.status).toBe("failed")
    expect(result.paidAt).toBeNull()
  })

  it("duplicate async_payment_succeeded — second call is idempotent via event dedup", () => {
    // The stripe_events table dedup prevents the handler from running twice.
    // If it somehow does run twice, the UPSERT produces the same values both times,
    // so the second INSERT ... ON CONFLICT DO UPDATE is a no-op (same status, same paidAt).
    const first = buildAchPaymentUpsert(baseSession, baseMetadata, "succeeded")
    const second = buildAchPaymentUpsert(baseSession, baseMetadata, "succeeded")

    expect(first.status).toBe(second.status)
    expect(first.stripeSessionId).toBe(second.stripeSessionId)
    expect(first.amountCents).toBe(second.amountCents)
    expect(first.tenantUserId).toBe(second.tenantUserId)
    // paidAt will differ slightly (new Date() each call), but the important thing
    // is that both produce "succeeded" status — the DB UPSERT is safe either way.
  })

  it("null payment_intent — should set stripePaymentIntentId to null", () => {
    const sessionNoPI = { ...baseSession, payment_intent: null }
    const result = buildAchPaymentUpsert(sessionNoPI, baseMetadata, "succeeded")

    expect(result.stripePaymentIntentId).toBeNull()
    // All other fields should still be correct
    expect(result.status).toBe("succeeded")
    expect(result.amountCents).toBe(150000)
  })
})
