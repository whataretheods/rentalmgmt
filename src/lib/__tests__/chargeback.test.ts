import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock db module
const mockSelect = vi.fn()
const mockInsert = vi.fn()
vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}))
vi.mock("@/db/schema", () => ({
  charges: Symbol("charges"),
  maintenanceRequests: { tenantUserId: "tenantUserId", unitId: "unitId" },
  workOrders: { maintenanceRequestId: "maintenanceRequestId", id: "id" },
}))
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }))

import { resolveAndPostChargeback } from "../chargeback"

describe("resolveAndPostChargeback", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("posts a one_time charge when maintenance request is found", async () => {
    // Setup: select chain returns tenant info
    const fromMock = vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ tenantUserId: "t1", unitId: "u1" }]),
      }),
    })
    mockSelect.mockReturnValue({ from: fromMock })
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })

    const result = await resolveAndPostChargeback("wo1", "Plumbing repair", 5000, "admin1")
    expect(result).toBe(true)
    expect(mockInsert).toHaveBeenCalled()
  })

  it("returns false when maintenance request not found", async () => {
    const fromMock = vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })
    mockSelect.mockReturnValue({ from: fromMock })

    const result = await resolveAndPostChargeback("wo-none", "Test", 1000, "admin1")
    expect(result).toBe(false)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("includes description in charge text", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined)
    const fromMock = vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ tenantUserId: "t1", unitId: "u1" }]),
      }),
    })
    mockSelect.mockReturnValue({ from: fromMock })
    mockInsert.mockReturnValue({ values: valuesMock })

    await resolveAndPostChargeback("wo1", "  Broken window  ", 8000, "admin1")
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Work order cost: Broken window" })
    )
  })
})
