import Link from "next/link"

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams

  return (
    <div className="max-w-md mx-auto text-center py-12">
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Payment Submitted</h1>
      <p className="mt-3 text-gray-600">
        Your rent payment has been submitted successfully.
        {session_id
          ? " You will receive a confirmation email shortly."
          : ""}
      </p>
      <p className="mt-2 text-sm text-gray-500">
        If you paid via bank transfer (ACH), your payment may take 3-5 business
        days to process.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/tenant/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Back to Dashboard
        </Link>
        <Link
          href="/tenant/payments"
          className="inline-flex items-center justify-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          View Payment History
        </Link>
      </div>
    </div>
  )
}
