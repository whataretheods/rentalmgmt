import { CircleCheck, AlertCircle, CreditCard } from "lucide-react"

interface BalanceCardProps {
  balanceCents: number
  hasPendingPayments: boolean
}

export function BalanceCard({ balanceCents, hasPendingPayments }: BalanceCardProps) {
  if (balanceCents > 0) {
    // Tenant owes money
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Amount Due</p>
            <p className="mt-1 text-3xl font-bold text-amber-900">
              You owe ${(balanceCents / 100).toFixed(2)}
            </p>
            {hasPendingPayments && (
              <p className="mt-2 text-sm text-amber-700">
                Pending payment processing
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (balanceCents < 0) {
    // Tenant has a credit
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Account Credit</p>
            <p className="mt-1 text-3xl font-bold text-blue-900">
              Credit: ${(Math.abs(balanceCents) / 100).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Balance is zero
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-5">
      <div className="flex items-start gap-3">
        <CircleCheck className="mt-0.5 h-5 w-5 text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">Balance</p>
          <p className="mt-1 text-3xl font-bold text-green-900">
            All caught up!
          </p>
          <p className="mt-1 text-sm text-green-700">$0.00</p>
        </div>
      </div>
    </div>
  )
}
