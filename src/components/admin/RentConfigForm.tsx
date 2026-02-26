"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface RentConfigFormProps {
  unitId: string
  initialAmountCents: number | null
  initialDueDay: number | null
}

export function RentConfigForm({ unitId, initialAmountCents, initialDueDay }: RentConfigFormProps) {
  const [amountDollars, setAmountDollars] = useState(
    initialAmountCents != null ? (initialAmountCents / 100).toFixed(2) : ""
  )
  const [dueDay, setDueDay] = useState(initialDueDay?.toString() ?? "1")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const cents = Math.round(parseFloat(amountDollars) * 100)
    const day = parseInt(dueDay, 10)

    if (isNaN(cents) || cents <= 0) {
      toast.error("Enter a valid rent amount")
      return
    }
    if (isNaN(day) || day < 1 || day > 28) {
      toast.error("Due day must be between 1 and 28")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/units/${unitId}/rent-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentAmountCents: cents, rentDueDay: day }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to save")
        return
      }

      toast.success("Rent configuration saved")
    } catch {
      toast.error("Failed to save rent configuration")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-500">$</span>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amountDollars}
          onChange={(e) => setAmountDollars(e.target.value)}
          className="w-28"
          placeholder="1500.00"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-500">Day</span>
        <Input
          type="number"
          min="1"
          max="28"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
          className="w-16"
          placeholder="1"
        />
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  )
}
