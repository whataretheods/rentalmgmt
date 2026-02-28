/**
 * Late fee calculation — pure functions, no external dependencies.
 */

export interface LateFeeRule {
  feeType: "flat" | "percentage"
  feeAmountCents: number
  maxFeeAmountCents: number | null
}

/**
 * Calculate the late fee amount in cents.
 *
 * - Flat: returns feeAmountCents directly
 * - Percentage: feeAmountCents stores basis points (500 = 5%).
 *   Calculates rentAmountCents * feeAmountCents / 10000, capped by maxFeeAmountCents if set.
 *
 * Always returns an integer (cents).
 */
export function calculateLateFee(
  rentAmountCents: number,
  rule: LateFeeRule
): number {
  if (rule.feeType === "flat") {
    return rule.feeAmountCents
  }

  // Percentage: feeAmountCents is basis points (500 = 5%)
  const percentageFee = Math.round(
    (rentAmountCents * rule.feeAmountCents) / 10000
  )

  if (rule.maxFeeAmountCents != null) {
    return Math.min(percentageFee, rule.maxFeeAmountCents)
  }

  return percentageFee
}

/**
 * Format an amount in cents as a dollar string (e.g., 5000 => "$50.00").
 */
export function formatCentsAsDollars(cents: number): string {
  const dollars = Math.abs(cents) / 100
  const sign = cents < 0 ? "-" : ""
  return `${sign}$${dollars.toFixed(2)}`
}
