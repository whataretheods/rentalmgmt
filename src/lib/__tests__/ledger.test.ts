import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the @/db module before importing ledger
vi.mock("@/db", () => ({
  db: { execute: vi.fn() },
}))

import { db } from "@/db"
import { getTenantBalance, formatBalance } from "@/lib/ledger"

const mockExecute = db.execute as ReturnType<typeof vi.fn>

describe("getTenantBalance", () => {
  beforeEach(() => {
    mockExecute.mockReset()
  })

  it("returns { balanceCents: 0, pendingPaymentsCents: 0 } when no data", async () => {
    mockExecute.mockResolvedValue({
      rows: [{ balance_cents: "0", pending_payments_cents: "0" }],
    })

    const result = await getTenantBalance("user-1", "unit-1")

    expect(result).toEqual({ balanceCents: 0, pendingPaymentsCents: 0 })
  })

  it("returns correct balanceCents with charges and succeeded payments", async () => {
    // charges = 3000, payments = 1500 -> balance = 1500
    mockExecute.mockResolvedValue({
      rows: [{ balance_cents: "1500", pending_payments_cents: "0" }],
    })

    const result = await getTenantBalance("user-1", "unit-1")

    expect(result.balanceCents).toBe(1500)
    expect(result.pendingPaymentsCents).toBe(0)
  })

  it("returns pendingPaymentsCents from pending payments sum", async () => {
    mockExecute.mockResolvedValue({
      rows: [{ balance_cents: "3000", pending_payments_cents: "1500" }],
    })

    const result = await getTenantBalance("user-1", "unit-1")

    expect(result.balanceCents).toBe(3000)
    expect(result.pendingPaymentsCents).toBe(1500)
  })

  it("returns numbers, not strings from SQL", async () => {
    mockExecute.mockResolvedValue({
      rows: [{ balance_cents: "500", pending_payments_cents: "250" }],
    })

    const result = await getTenantBalance("user-1", "unit-1")

    expect(typeof result.balanceCents).toBe("number")
    expect(typeof result.pendingPaymentsCents).toBe("number")
  })

  it("handles undefined row gracefully", async () => {
    mockExecute.mockResolvedValue({ rows: [] })

    const result = await getTenantBalance("user-1", "unit-1")

    expect(result).toEqual({ balanceCents: 0, pendingPaymentsCents: 0 })
  })
})

describe("formatBalance", () => {
  it("returns owed status for positive balance", () => {
    const result = formatBalance(1500)
    expect(result.status).toBe("owed")
    expect(result.text).toBe("$15.00")
  })

  it("returns credit status for negative balance", () => {
    const result = formatBalance(-500)
    expect(result.status).toBe("credit")
    expect(result.text).toBe("$5.00")
  })

  it("returns current status for zero balance", () => {
    const result = formatBalance(0)
    expect(result.status).toBe("current")
    expect(result.text).toBe("$0.00")
  })
})
