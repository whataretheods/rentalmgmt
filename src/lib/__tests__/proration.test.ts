import { describe, it, expect } from "vitest"
import { calculateProratedRent } from "../proration"

describe("calculateProratedRent", () => {
  const rent = 150000 // $1,500.00

  describe("move_in", () => {
    it("charges remaining days including move-in day", () => {
      // Jan 15: 17 remaining days out of 31
      expect(calculateProratedRent(rent, new Date(2026, 0, 15), "move_in"))
        .toBe(Math.round(rent * 17 / 31))
    })

    it("returns full month for move-in on 1st", () => {
      expect(calculateProratedRent(rent, new Date(2026, 0, 1), "move_in"))
        .toBe(rent)
    })

    it("returns one day for move-in on last day", () => {
      expect(calculateProratedRent(rent, new Date(2026, 0, 31), "move_in"))
        .toBe(Math.round(rent / 31))
    })

    it("handles February (28 days)", () => {
      expect(calculateProratedRent(rent, new Date(2026, 1, 1), "move_in"))
        .toBe(rent) // full month
    })

    it("handles leap year February (29 days)", () => {
      // 2028 is a leap year
      expect(calculateProratedRent(rent, new Date(2028, 1, 1), "move_in"))
        .toBe(rent) // full month
    })
  })

  describe("move_out", () => {
    it("charges elapsed days including move-out day", () => {
      // Jan 15: 15 elapsed days out of 31
      expect(calculateProratedRent(rent, new Date(2026, 0, 15), "move_out"))
        .toBe(Math.round(rent * 15 / 31))
    })

    it("returns full month for move-out on last day", () => {
      // Jan 31: 31/31 = full
      expect(calculateProratedRent(rent, new Date(2026, 0, 31), "move_out"))
        .toBe(rent)
    })

    it("returns one day for move-out on 1st", () => {
      expect(calculateProratedRent(rent, new Date(2026, 0, 1), "move_out"))
        .toBe(Math.round(rent / 31))
    })
  })

  it("returns 0 for zero rent", () => {
    expect(calculateProratedRent(0, new Date(2026, 0, 15), "move_in")).toBe(0)
  })

  it("always returns integer", () => {
    const result = calculateProratedRent(rent, new Date(2026, 0, 15), "move_in")
    expect(Number.isInteger(result)).toBe(true)
  })
})
