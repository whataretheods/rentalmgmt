import Link from "next/link"
import { getPaymentMethodLabel, calculateCardFee, calculateAchFee, formatCents } from "@/lib/autopay-fees"

interface AutopayStatusCardProps {
  enrollment: {
    status: string
    paymentMethodType: string
    paymentMethodLast4: string
    paymentMethodBrand: string | null
    nextChargeDate: string | null
    enrolledAt: Date
  } | null
  rentAmountCents: number | null
}

export function AutopayStatusCard({ enrollment, rentAmountCents }: AutopayStatusCardProps) {
  const isActive = enrollment?.status === "active"

  if (isActive && enrollment) {
    const methodLabel = getPaymentMethodLabel(
      enrollment.paymentMethodType,
      enrollment.paymentMethodBrand,
      enrollment.paymentMethodLast4
    )

    // Calculate fee estimate
    let feeEstimate: string | null = null
    let totalEstimate: string | null = null
    if (rentAmountCents) {
      const fee = enrollment.paymentMethodType === "us_bank_account"
        ? calculateAchFee(rentAmountCents)
        : calculateCardFee(rentAmountCents)
      feeEstimate = formatCents(fee)
      totalEstimate = formatCents(rentAmountCents + fee)
    }

    return (
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Autopay</h3>
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
            Autopay Active
          </span>
        </div>

        <div className="space-y-1 text-sm text-gray-600">
          <p>
            <span className="text-gray-500">Method:</span>{" "}
            <span className="font-medium text-gray-900">{methodLabel}</span>
          </p>
          {enrollment.nextChargeDate && (
            <p>
              <span className="text-gray-500">Next charge:</span>{" "}
              <span className="font-medium text-gray-900">
                {new Date(enrollment.nextChargeDate + "T00:00:00").toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </p>
          )}
          {rentAmountCents && totalEstimate && feeEstimate && (
            <p>
              <span className="text-gray-500">Amount:</span>{" "}
              <span className="font-medium text-gray-900">
                {formatCents(rentAmountCents)} + {feeEstimate} fee = {totalEstimate}
              </span>
            </p>
          )}
        </div>

        <Link
          href="/tenant/autopay"
          className="inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Manage Autopay
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Autopay</h3>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
          Autopay Not Active
        </span>
      </div>

      <p className="text-sm text-gray-500">
        Never miss a payment -- enroll in automatic rent payments
      </p>

      <Link
        href="/tenant/autopay"
        className="inline-block text-sm font-medium text-blue-600 hover:underline"
      >
        Set Up Autopay
      </Link>
    </div>
  )
}
