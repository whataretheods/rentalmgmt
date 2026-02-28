/**
 * Calculate prorated rent based on actual days in the month.
 * @param monthlyRentCents - Full month's rent in cents
 * @param moveDate - Move-in or move-out date
 * @param type - "move_in" (charges remaining days) or "move_out" (charges elapsed days)
 * @returns Prorated amount in cents (integer)
 */
export function calculateProratedRent(
  monthlyRentCents: number,
  moveDate: Date,
  type: "move_in" | "move_out"
): number {
  const year = moveDate.getFullYear()
  const month = moveDate.getMonth() // 0-indexed
  const day = moveDate.getDate()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  if (type === "move_in") {
    // Charge for remaining days including move-in day
    const remainingDays = daysInMonth - day + 1
    return Math.round((monthlyRentCents * remainingDays) / daysInMonth)
  } else {
    // Charge for elapsed days including move-out day
    return Math.round((monthlyRentCents * day) / daysInMonth)
  }
}
