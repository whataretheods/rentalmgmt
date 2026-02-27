import { db } from "@/db"
import { sql } from "drizzle-orm"

/**
 * Compute the running balance for a tenant's unit.
 * Balance = SUM(charges.amountCents) - SUM(succeeded payments.amountCents)
 * Positive = tenant owes money. Zero = all caught up. Negative = tenant has credit.
 */
export async function getTenantBalance(
  tenantUserId: string,
  unitId: string
): Promise<number> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(
        (SELECT SUM(amount_cents) FROM charges
         WHERE tenant_user_id = ${tenantUserId} AND unit_id = ${unitId}),
        0
      )
      -
      COALESCE(
        (SELECT SUM(amount_cents) FROM payments
         WHERE tenant_user_id = ${tenantUserId} AND unit_id = ${unitId}
         AND status = 'succeeded'),
        0
      )
      AS balance_cents
  `)
  const row = result.rows[0] as { balance_cents: string } | undefined
  return Number(row?.balance_cents ?? 0)
}

/**
 * Format balance for display.
 * Returns { text: string, status: "owed" | "credit" | "current" }
 */
export function formatBalance(balanceCents: number): {
  text: string
  status: "owed" | "credit" | "current"
} {
  if (balanceCents > 0) {
    return {
      text: `$${(balanceCents / 100).toFixed(2)}`,
      status: "owed",
    }
  } else if (balanceCents < 0) {
    return {
      text: `$${(Math.abs(balanceCents) / 100).toFixed(2)}`,
      status: "credit",
    }
  }
  return { text: "$0.00", status: "current" }
}
