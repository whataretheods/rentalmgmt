interface PaymentSummaryCardProps {
  rentAmountCents: number | null
  rentDueDay: number | null
  lastPayment: {
    amountCents: number
    status: string
    paidAt: Date | null
    paymentMethod: string
  } | null
}

export function PaymentSummaryCard({ rentAmountCents, rentDueDay, lastPayment }: PaymentSummaryCardProps) {
  // Calculate next due date
  const now = new Date()
  let nextDueDate: string = "Not set"
  if (rentDueDay) {
    const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), rentDueDay)
    const dueDate = dueThisMonth > now
      ? dueThisMonth
      : new Date(now.getFullYear(), now.getMonth() + 1, rentDueDay)
    nextDueDate = dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Current Balance */}
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-gray-500">Rent Amount</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {rentAmountCents != null
            ? `$${(rentAmountCents / 100).toFixed(2)}`
            : "Not set"}
        </p>
      </div>

      {/* Next Due Date */}
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-gray-500">Next Due Date</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{nextDueDate}</p>
      </div>

      {/* Last Payment */}
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-gray-500">Last Payment</p>
        {lastPayment ? (
          <div>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              ${(lastPayment.amountCents / 100).toFixed(2)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={lastPayment.status} />
              <span className="text-xs text-gray-500">
                {lastPayment.paidAt
                  ? new Date(lastPayment.paidAt).toLocaleDateString()
                  : "Processing"}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-lg text-gray-400">No payments yet</p>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
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
