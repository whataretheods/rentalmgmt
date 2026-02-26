import Link from "next/link"

interface Payment {
  id: string
  amountCents: number
  paymentMethod: string
  status: string
  billingPeriod: string
  paidAt: Date | null
  createdAt: Date
}

interface PaymentHistoryTableProps {
  payments: Payment[]
}

export function PaymentHistoryTable({ payments }: PaymentHistoryTableProps) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No payments yet. Pay your first rent to see it here.
      </div>
    )
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b text-left text-sm font-medium text-gray-500">
          <th className="pb-3 pr-4">Date</th>
          <th className="pb-3 pr-4">Amount</th>
          <th className="pb-3 pr-4">Method</th>
          <th className="pb-3 pr-4">Status</th>
          <th className="pb-3">Period</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => (
          <tr key={payment.id} className="border-b hover:bg-gray-50">
            <td className="py-3 pr-4">
              <Link href={`/tenant/payments/${payment.id}`} className="text-blue-600 hover:underline">
                {payment.paidAt
                  ? new Date(payment.paidAt).toLocaleDateString()
                  : new Date(payment.createdAt).toLocaleDateString()}
              </Link>
            </td>
            <td className="py-3 pr-4 font-medium">
              ${(payment.amountCents / 100).toFixed(2)}
            </td>
            <td className="py-3 pr-4 text-gray-600 capitalize">
              {payment.paymentMethod === "ach" ? "ACH Bank Transfer" : payment.paymentMethod}
            </td>
            <td className="py-3 pr-4">
              <PaymentStatusBadge status={payment.status} />
            </td>
            <td className="py-3 text-gray-600">{payment.billingPeriod}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    failed: "bg-red-100 text-red-800",
  }
  const labels: Record<string, string> = {
    succeeded: "Paid",
    pending: "Processing",
    failed: "Failed",
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {labels[status] || status}
    </span>
  )
}
