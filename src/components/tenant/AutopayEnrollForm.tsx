"use client"

import { useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  calculateCardFee,
  calculateAchFee,
  formatCents,
} from "@/lib/autopay-fees"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

const appearance = {
  theme: "stripe" as const,
  variables: { colorPrimary: "#16a34a" },
}

interface AutopayEnrollFormProps {
  rentAmountCents: number
  unitNumber: string
}

function SetupForm() {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!stripe || !elements) return

    setLoading(true)
    try {
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/tenant/autopay/setup-complete`,
        },
      })

      // If error, it means the redirect didn't happen
      if (error) {
        toast.error(error.message ?? "Setup failed. Please try again.")
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={!stripe || !elements || loading}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
        >
          {loading ? "Setting up..." : "Confirm Autopay Setup"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (window.location.href = "/tenant/dashboard")}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function AutopayEnrollForm({
  rentAmountCents,
  unitNumber,
}: AutopayEnrollFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const cardFee = calculateCardFee(rentAmountCents)
  const achFee = calculateAchFee(rentAmountCents)

  async function handleStartEnrollment() {
    setLoading(true)
    try {
      const res = await fetch("/api/autopay/enroll", { method: "POST" })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to start enrollment")
        return
      }

      const { clientSecret: secret } = await res.json()
      setClientSecret(secret)
    } catch {
      toast.error("Failed to start enrollment. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Fee transparency */}
      <div className="rounded-lg border bg-gray-50 p-4 space-y-2">
        <h3 className="font-semibold text-sm text-gray-700">
          Processing Fees for Unit {unitNumber}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border bg-white p-3">
            <p className="font-medium">Card Payment</p>
            <p className="text-gray-600">
              {formatCents(rentAmountCents)} + {formatCents(cardFee)} fee
            </p>
            <p className="font-semibold text-green-700">
              Total: {formatCents(rentAmountCents + cardFee)}
            </p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="font-medium">Bank Account (ACH)</p>
            <p className="text-gray-600">
              {formatCents(rentAmountCents)} + {formatCents(achFee)} fee
            </p>
            <p className="font-semibold text-green-700">
              Total: {formatCents(rentAmountCents + achFee)}
            </p>
          </div>
        </div>
      </div>

      {/* Enrollment form or start button */}
      {clientSecret ? (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance }}
        >
          <SetupForm />
        </Elements>
      ) : (
        <Button
          size="lg"
          onClick={handleStartEnrollment}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-lg py-3"
        >
          {loading ? "Starting Setup..." : "Set Up Autopay"}
        </Button>
      )}
    </div>
  )
}
