import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/db/schema", () => ({
  charges: Symbol("charges"),
}))

import { postNsfFee } from "../nsf"

describe("postNsfFee", () => {
  const originalEnv = process.env.NSF_FEE_CENTS

  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => {
    if (originalEnv !== undefined) process.env.NSF_FEE_CENTS = originalEnv
    else delete process.env.NSF_FEE_CENTS
  })

  function makeMockTx() {
    const valuesMock = vi.fn().mockResolvedValue(undefined)
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock })
    return { insert: insertMock, valuesMock }
  }

  it("posts a charge when NSF_FEE_CENTS is set and positive", async () => {
    process.env.NSF_FEE_CENTS = "2500"
    const { insert, valuesMock } = makeMockTx()
    const result = await postNsfFee({ insert }, "t1", "u1", "2026-03")
    expect(result).toBe(true)
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 2500, tenantUserId: "t1", unitId: "u1" })
    )
  })

  it("returns false when NSF_FEE_CENTS is 0", async () => {
    process.env.NSF_FEE_CENTS = "0"
    const { insert } = makeMockTx()
    const result = await postNsfFee({ insert }, "t1", "u1")
    expect(result).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it("returns false when NSF_FEE_CENTS is unset", async () => {
    delete process.env.NSF_FEE_CENTS
    const { insert } = makeMockTx()
    const result = await postNsfFee({ insert }, "t1", "u1")
    expect(result).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it("includes billing period in description when available", async () => {
    process.env.NSF_FEE_CENTS = "2500"
    const { insert, valuesMock } = makeMockTx()
    await postNsfFee({ insert }, "t1", "u1", "2026-03")
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "NSF fee - returned payment for 2026-03" })
    )
  })

  it("uses generic description when billing period is missing", async () => {
    process.env.NSF_FEE_CENTS = "2500"
    const { insert, valuesMock } = makeMockTx()
    await postNsfFee({ insert }, "t1", "u1")
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "NSF fee - returned payment" })
    )
  })
})
