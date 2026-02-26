import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { payments, units } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const { id } = await params

  // Fetch payment — must belong to the logged-in tenant
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.tenantUserId, session.user.id)))

  if (!payment) {
    notFound()
  }

  // Fetch unit info
  const [unit] = await db.select().from(units).where(eq(units.id, payment.unitId))

  const amount = `$${(payment.amountCents / 100).toFixed(2)}`

  const statusStyles: Record<string, string> = {
    succeeded: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    failed: "bg-red-100 text-red-800",
  }
  const statusLabels: Record<string, string> = {
    succeeded: "Paid",
    pending: "Processing",
    failed: "Failed",
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>
        <Link
          href="/tenant/payments"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to History
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Amount</span>
          <span className="text-xl font-bold">{amount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Status</span>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusStyles[payment.status] || "bg-gray-100"}`}>
            {statusLabels[payment.status] || payment.status}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Unit</span>
          <span>{unit?.unitNumber || "Unknown"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Payment Method</span>
          <span className="capitalize">{payment.paymentMethod === "ach" ? "ACH Bank Transfer" : payment.paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Billing Period</span>
          <span>{payment.billingPeriod}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Date</span>
          <span>{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : new Date(payment.createdAt).toLocaleDateString()}</span>
        </div>
        {payment.note && (
          <div className="flex justify-between">
            <span className="text-gray-500">Note</span>
            <span>{payment.note}</span>
          </div>
        )}
      </div>

      {payment.status === "succeeded" && (
        <div className="mt-4">
          <a
            href={`/api/payments/receipt/${payment.id}`}
            className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            download
          >
            Download Receipt (PDF)
          </a>
        </div>
      )}
    </div>
  )
}
