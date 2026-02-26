"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface PayRentButtonProps {
  unitId: string
  rentAmountCents: number | null
}

export function PayRentButton({ unitId, rentAmountCents }: PayRentButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handlePayRent() {
    if (!rentAmountCents) {
      toast.error("Rent amount not configured. Contact your landlord.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/payments/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, amountCents: rentAmountCents }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to start payment")
        return
      }

      const { url } = await res.json()
      // Redirect to Stripe Checkout
      window.location.href = url
    } catch {
      toast.error("Failed to start payment. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="lg"
      onClick={handlePayRent}
      disabled={loading || !rentAmountCents}
      className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold text-lg px-8 py-3"
    >
      {loading ? "Starting Payment..." : rentAmountCents
        ? `Pay Rent — $${(rentAmountCents / 100).toFixed(2)}`
        : "Rent Not Configured"}
    </Button>
  )
}
