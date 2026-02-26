"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function AutopayCancelButton() {
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch("/api/autopay/cancel", { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to cancel autopay")
        return
      }
      toast.success("Autopay has been cancelled")
      router.refresh()
    } catch {
      toast.error("Failed to cancel autopay. Please try again.")
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
        <p className="text-sm text-red-800 font-medium">
          Are you sure you want to cancel autopay? You will need to pay rent
          manually each month.
        </p>
        <div className="flex gap-3">
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={loading}
            size="sm"
          >
            {loading ? "Cancelling..." : "Yes, Cancel Autopay"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirming(false)}
            disabled={loading}
            size="sm"
          >
            Keep Autopay
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      onClick={() => setConfirming(true)}
      className="text-red-600 border-red-200 hover:bg-red-50"
    >
      Cancel Autopay
    </Button>
  )
}
