/**
 * Pure function that builds the values object for an ACH payment UPSERT.
 *
 * Used by webhook handlers for checkout.session.async_payment_succeeded and
 * checkout.session.async_payment_failed to construct the INSERT ... ON CONFLICT
 * DO UPDATE payload. Handles out-of-order webhook delivery — if the async event
 * arrives before checkout.session.completed, the payment record is INSERTed;
 * if it arrives after, the existing record is UPDATEd via ON CONFLICT.
 */

export interface AchPaymentUpsertValues {
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

export function buildAchPaymentUpsert(
  session: { id: string; amount_total: number; payment_intent: string | null },
  metadata: { tenantUserId: string; unitId: string; billingPeriod: string },
  status: "succeeded" | "failed"
): AchPaymentUpsertValues {
  return {
    tenantUserId: metadata.tenantUserId,
    unitId: metadata.unitId,
    amountCents: session.amount_total,
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent,
    paymentMethod: "ach",
    status,
    billingPeriod: metadata.billingPeriod,
    paidAt: status === "succeeded" ? new Date() : null,
  }
}
