import { charges } from "@/db/schema"

/**
 * Post an NSF (non-sufficient funds) fee charge to the tenant's ledger.
 * Reads NSF_FEE_CENTS from env. Returns true if a charge was posted.
 *
 * @param tx - A drizzle db instance or transaction
 * @param tenantUserId - Tenant user ID from payment metadata
 * @param unitId - Unit ID from payment metadata
 * @param billingPeriod - Optional billing period string
 */
export async function postNsfFee(
  tx: { insert: (table: typeof charges) => { values: (v: Record<string, unknown>) => Promise<unknown> } },
  tenantUserId: string,
  unitId: string,
  billingPeriod?: string | null
): Promise<boolean> {
  const nsfFeeCents = parseInt(process.env.NSF_FEE_CENTS || "0", 10)
  if (nsfFeeCents <= 0) return false

  await tx.insert(charges).values({
    tenantUserId,
    unitId,
    type: "one_time",
    description: billingPeriod
      ? `NSF fee - returned payment for ${billingPeriod}`
      : "NSF fee - returned payment",
    amountCents: nsfFeeCents,
    billingPeriod: billingPeriod || null,
    createdBy: null, // system-generated
  })
  return true
}
