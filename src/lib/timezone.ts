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
 */
export function getLocalDate(timezone: string): LocalDate {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })

  const parts = formatter.formatToParts(new Date())
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
 * Calculate days elapsed since rent was due this month.
 * Returns 0 on due day, positive after, negative before.
 * Simplified: only considers within the current month.
 */
export function daysSinceRentDue(rentDueDay: number, timezone: string): number {
  const { day } = getLocalDate(timezone)
  return day - rentDueDay
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
