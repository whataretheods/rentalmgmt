import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/db"
import { tenantUnits, units, autopayEnrollments } from "@/db/schema/domain"
import { eq, and } from "drizzle-orm"
import {
  calculateCardFee,
  calculateAchFee,
  formatCents,
  getPaymentMethodLabel,
} from "@/lib/autopay-fees"
import { AutopayEnrollForm } from "@/components/tenant/AutopayEnrollForm"
import { AutopayCancelButton } from "./AutopayCancelButton"
import { AutopayReEnrollButton } from "./AutopayReEnrollButton"

export default async function AutopayPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  // Get tenant's active unit link
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.isActive, true)
      )
    )

  if (!link) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Autopay</h1>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-gray-600">
            You are not currently linked to a unit. Contact your landlord for
            an invitation.
          </p>
        </div>
      </div>
    )
  }

  const [unit] = await db
    .select()
    .from(units)
    .where(eq(units.id, link.unitId))

  if (!unit || !unit.rentAmountCents) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Autopay</h1>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-gray-600">
            Rent amount has not been configured for your unit. Contact your
            landlord.
          </p>
        </div>
      </div>
    )
  }

  // Check existing enrollment
  const [enrollment] = await db
    .select()
    .from(autopayEnrollments)
    .where(eq(autopayEnrollments.tenantUserId, session.user.id))

  const rentAmountCents = unit.rentAmountCents

  // Active enrollment view
  if (enrollment?.status === "active") {
    const fee =
      enrollment.paymentMethodType === "card"
        ? calculateCardFee(rentAmountCents)
        : calculateAchFee(rentAmountCents)

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Autopay</h1>
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              Active
            </span>
            <span className="text-sm text-gray-500">
              Enrolled{" "}
              {enrollment.enrolledAt
                ? new Date(enrollment.enrolledAt).toLocaleDateString()
                : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Payment Method</p>
              <p className="font-medium">
                {getPaymentMethodLabel(
                  enrollment.paymentMethodType,
                  enrollment.paymentMethodBrand,
                  enrollment.paymentMethodLast4
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Next Charge Date</p>
              <p className="font-medium">
                {enrollment.nextChargeDate ?? "Not scheduled"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Rent Amount</p>
              <p className="font-medium">{formatCents(rentAmountCents)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Processing Fee</p>
              <p className="font-medium">
                {formatCents(fee)} (
                {enrollment.paymentMethodType === "card" ? "Card" : "ACH"})
              </p>
            </div>
          </div>

          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <p className="text-gray-600">
              Total per month:{" "}
              <span className="font-semibold text-gray-900">
                {formatCents(rentAmountCents + fee)}
              </span>
            </p>
          </div>

          <AutopayCancelButton />
        </div>
      </div>
    )
  }

  // Previously enrolled (cancelled or payment_failed)
  if (
    enrollment &&
    (enrollment.status === "cancelled" || enrollment.status === "payment_failed")
  ) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Autopay</h1>
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
              {enrollment.status === "cancelled" ? "Cancelled" : "Payment Failed"}
            </span>
          </div>

          <div>
            <p className="text-sm text-gray-500">Previous Payment Method</p>
            <p className="font-medium">
              {getPaymentMethodLabel(
                enrollment.paymentMethodType,
                enrollment.paymentMethodBrand,
                enrollment.paymentMethodLast4
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <AutopayReEnrollButton />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-3">
              Or set up a new payment method:
            </p>
            <AutopayEnrollForm
              rentAmountCents={rentAmountCents}
              unitNumber={unit.unitNumber}
            />
          </div>
        </div>
      </div>
    )
  }

  // Never enrolled
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Autopay</h1>
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <p className="text-gray-600">
          Set up automatic rent payments so you never have to remember to pay.
          Your rent will be charged automatically each month on the due date.
        </p>

        <AutopayEnrollForm
          rentAmountCents={rentAmountCents}
          unitNumber={unit.unitNumber}
        />
      </div>
    </div>
  )
}
