"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface ManualPaymentFormProps {
  unitId: string
  unitNumber: string
  onPaymentRecorded: () => void
}

export function ManualPaymentForm({
  unitId,
  unitNumber,
  onPaymentRecorded,
}: ManualPaymentFormProps) {
  const [amountDollars, setAmountDollars] = useState("")
  const [method, setMethod] = useState<"cash" | "check" | "venmo" | "other">(
    "cash"
  )
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const billingPeriod = new Date().toISOString().slice(0, 7)

  async function handleSubmit() {
    const cents = Math.round(parseFloat(amountDollars) * 100)
    if (isNaN(cents) || cents <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          amountCents: cents,
          paymentMethod: method,
          billingPeriod,
          note: note || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to record payment")
        return
      }

      toast.success(`Manual payment recorded for Unit ${unitNumber}`)
      setAmountDollars("")
      setNote("")
      setOpen(false)
      onPaymentRecorded()
    } catch {
      toast.error("Failed to record payment")
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Record Payment
      </Button>
    )
  }

  return (
    <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
      <p className="text-sm font-medium">
        Record Manual Payment — Unit {unitNumber}
      </p>
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
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          className="rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="venmo">Venmo</option>
          <option value="other">Other</option>
        </select>
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
