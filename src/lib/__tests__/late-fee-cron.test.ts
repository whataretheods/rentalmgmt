import { describe, it, expect } from "vitest"

/**
 * Pure function: determines whether a late fee should be assessed for a tenant.
 *
 * Logic:
 * - If pendingPaymentsCents > 0 → false (payment in flight, skip)
 * - If balanceCents <= 0 → false (tenant current or has credit)
 * - Otherwise → true (tenant owes money)
 */
export function shouldAssessLateFee(
  balanceCents: number,
  pendingPaymentsCents: number
): boolean {
  if (pendingPaymentsCents > 0) return false
  if (balanceCents <= 0) return false
  return true
}

describe("shouldAssessLateFee", () => {
  it("returns true when balance > 0 and no pending payments", () => {
    expect(shouldAssessLateFee(100, 0)).toBe(true)
  })

  it("returns false when balance is zero (tenant fully paid)", () => {
    expect(shouldAssessLateFee(0, 0)).toBe(false)
  })

  it("returns false when balance is negative (tenant has credit)", () => {
    expect(shouldAssessLateFee(-500, 0)).toBe(false)
  })

  it("returns true for partial payment — $1 paid on $1,500 rent leaves $1,499 balance", () => {
    // Partial payment loophole: tenant paid $1 on $1,500 rent
    // Balance = 150000 - 100 = 149900 cents ($1,499.00)
    expect(shouldAssessLateFee(149900, 0)).toBe(true)
  })

  it("returns false when pending payment exists — skip regardless of balance", () => {
    // Pending ACH payment of $1.00 (100 cents) — skip late fee
    expect(shouldAssessLateFee(150000, 100)).toBe(false)
  })

  it("returns true when no payment at all — full balance owed", () => {
    expect(shouldAssessLateFee(150000, 0)).toBe(true)
  })
})
