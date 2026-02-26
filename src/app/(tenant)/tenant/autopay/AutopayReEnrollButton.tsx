"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function AutopayReEnrollButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleReEnroll() {
    setLoading(true)
    try {
      const res = await fetch("/api/autopay/re-enroll", { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        if (data.requiresFullEnrollment) {
          toast.error(
            "Your saved payment method is no longer valid. Please set up a new one below."
          )
        } else {
          toast.error(data.error || "Failed to re-enable autopay")
        }
        return
      }

      toast.success("Autopay has been re-enabled!")
      router.refresh()
    } catch {
      toast.error("Failed to re-enable autopay. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleReEnroll}
      disabled={loading}
      className="bg-green-600 hover:bg-green-700 text-white font-semibold"
    >
      {loading ? "Re-enabling..." : "Re-enable Autopay"}
    </Button>
  )
}
