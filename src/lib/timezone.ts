/**
 * Timezone-aware date utilities for property-local time calculations.
 * Uses built-in Intl.DateTimeFormat — no external date libraries.
 */

export interface LocalDate {
  year: number
  month: number  // 1-12
  day: number    // 1-31
}

/**
 * Get the current local date in a specific IANA timezone.
 * Uses Intl.DateTimeFormat.formatToParts() for reliable timezone conversion.
 * @param referenceDate Optional date to convert (defaults to now). Used for testability.
 */
export function getLocalDate(timezone: string, referenceDate?: Date): LocalDate {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })

  const parts = formatter.formatToParts(referenceDate ?? new Date())
  const partMap: Record<string, string> = {}
  for (const part of parts) {
    partMap[part.type] = part.value
  }

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
  }
}

/**
 * Get the current billing period (YYYY-MM) in the property's local timezone.
 */
export function getLocalBillingPeriod(timezone: string): string {
  const { year, month } = getLocalDate(timezone)
  return `${year}-${String(month).padStart(2, "0")}`
}

/**
 * Calculate days elapsed since the most recent rent due date occurrence.
 * Returns 0 on due day, positive after. Always returns >= 0 by using the
 * previous month's due date when current day is before the due day.
 * Handles February clamping and 31-day month variations.
 * @param referenceDate Optional date for testability (defaults to now).
 */
export function daysSinceRentDue(
  rentDueDay: number,
  timezone: string,
  referenceDate?: Date
): number {
  const { year, month, day } = getLocalDate(timezone, referenceDate)

  // Determine the most recent due date occurrence
  let dueYear = year
  let dueMonth = month

  if (day < rentDueDay) {
    // Due date hasn't occurred this month yet -- use last month's due date
    dueMonth -= 1
    if (dueMonth < 1) {
      dueMonth = 12
      dueYear -= 1
    }
  }

  // Clamp due day to actual days in the due month
  const daysInDueMonth = new Date(dueYear, dueMonth, 0).getDate()
  const clampedDueDay = Math.min(rentDueDay, daysInDueMonth)

  // Calculate difference using Date objects for correct calendar math
  const currentDate = new Date(year, month - 1, day)
  const dueDate = new Date(dueYear, dueMonth - 1, clampedDueDay)
  const diffMs = currentDate.getTime() - dueDate.getTime()

  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * US timezone options for property configuration dropdown.
 */
export const US_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
]
