import { NextResponse } from "next/server"
import {
  getLocalDate,
  getLocalBillingPeriod,
  daysSinceRentDue,
  US_TIMEZONES,
} from "@/lib/timezone"
import { calculateLateFee, formatCentsAsDollars } from "@/lib/late-fees"

/**
 * Dev-only test endpoint for timezone and late fee utility functions.
 * Returns 404 in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const nyDate = getLocalDate("America/New_York")
  const laDate = getLocalDate("America/Los_Angeles")
  const hiDate = getLocalDate("Pacific/Honolulu")

  const billingPeriod = getLocalBillingPeriod("America/New_York")

  const daysSince1 = daysSinceRentDue(1, "America/New_York")
  const daysSince15 = daysSinceRentDue(15, "America/New_York")
  const daysSince28 = daysSinceRentDue(28, "America/New_York")

  const flatFee = calculateLateFee(150000, {
    feeType: "flat",
    feeAmountCents: 5000,
    maxFeeAmountCents: null,
  })

  const percentageFee = calculateLateFee(150000, {
    feeType: "percentage",
    feeAmountCents: 500,
    maxFeeAmountCents: null,
  })

  const cappedFee = calculateLateFee(150000, {
    feeType: "percentage",
    feeAmountCents: 1000, // 10%
    maxFeeAmountCents: 10000, // $100 cap
  })

  return NextResponse.json({
    dates: {
      newYork: nyDate,
      losAngeles: laDate,
      honolulu: hiDate,
    },
    billingPeriod,
    daysSinceRentDue: {
      dueDay1: daysSince1,
      dueDay15: daysSince15,
      dueDay28: daysSince28,
    },
    lateFees: {
      flat50: flatFee,
      percentage5: percentageFee,
      percentage10Capped100: cappedFee,
    },
    formatting: {
      flat50: formatCentsAsDollars(flatFee),
      percentage5: formatCentsAsDollars(percentageFee),
    },
    usTimezones: US_TIMEZONES,
    usTimezoneCount: US_TIMEZONES.length,
  })
}
