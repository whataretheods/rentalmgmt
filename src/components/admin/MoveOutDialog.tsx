"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { calculateProratedRent } from "@/lib/proration"

interface FinalCharge {
  description: string
  amountDollars: string
}

interface MoveOutDialogProps {
  tenant: { userId: string; name: string; email: string }
  unit: { id: string; unitNumber: string; rentAmountCents: number | null }
  onSuccess: () => void
  trigger: React.ReactNode
}

export function MoveOutDialog({
  tenant,
  unit,
  onSuccess,
  trigger,
}: MoveOutDialogProps) {
  const [open, setOpen] = useState(false)
  const [moveOutDate, setMoveOutDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [finalCharges, setFinalCharges] = useState<FinalCharge[]>([])
  const [loading, setLoading] = useState(false)

  function addCharge() {
    setFinalCharges([...finalCharges, { description: "", amountDollars: "" }])
  }

  function removeCharge(index: number) {
    setFinalCharges(finalCharges.filter((_, i) => i !== index))
  }

  function updateCharge(
    index: number,
    field: keyof FinalCharge,
    value: string
  ) {
    const updated = [...finalCharges]
    updated[index] = { ...updated[index], [field]: value }
    setFinalCharges(updated)
  }

  function addProratedCharge() {
    if (!unit.rentAmountCents || !moveOutDate) return

    const moveDate = new Date(moveOutDate + "T00:00:00") // Parse YYYY-MM-DD without timezone shift
    const proratedCents = calculateProratedRent(unit.rentAmountCents, moveDate, "move_out")
    const proratedDollars = (proratedCents / 100).toFixed(2)

    // Add as a pre-filled final charge that admin can review/adjust
    setFinalCharges([
      ...finalCharges,
      {
        description: `Prorated rent through ${moveOutDate}`,
        amountDollars: proratedDollars,
      },
    ])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate final charges
    const validCharges = finalCharges
      .filter((c) => c.description.trim() && c.amountDollars)
      .map((c) => ({
        description: c.description.trim(),
        amountCents: Math.round(parseFloat(c.amountDollars) * 100),
      }))

    // Check for invalid amounts
    if (validCharges.some((c) => isNaN(c.amountCents) || c.amountCents <= 0)) {
      toast.error("All final charge amounts must be valid positive numbers")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/move-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantUserId: tenant.userId,
          unitId: unit.id,
          moveOutDate,
          finalCharges: validCharges.length > 0 ? validCharges : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Move-out failed")
      }

      toast.success(`${tenant.name} moved out of Unit ${unit.unitNumber}`)
      setOpen(false)
      setFinalCharges([])
      onSuccess()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const totalCents = finalCharges.reduce((sum, c) => {
    const cents = Math.round(parseFloat(c.amountDollars || "0") * 100)
    return sum + (isNaN(cents) ? 0 : cents)
  }, 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Move Out Tenant</DialogTitle>
          <DialogDescription>
            End {tenant.name}&apos;s tenancy for Unit {unit.unitNumber}. This
            will cancel any active autopay and post final charges.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Move-out date */}
          <div className="space-y-2">
            <Label htmlFor="move-out-date">Move-Out Date</Label>
            <Input
              id="move-out-date"
              type="date"
              value={moveOutDate}
              onChange={(e) => setMoveOutDate(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Final charges */}
          <div className="space-y-2">
            <Label>Final Charges (optional)</Label>
            {finalCharges.map((charge, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Description (e.g., Cleaning fee)"
                  value={charge.description}
                  onChange={(e) => updateCharge(i, "description", e.target.value)}
                  disabled={loading}
                  className="flex-1"
                />
                <Input
                  placeholder="Amount ($)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={charge.amountDollars}
                  onChange={(e) =>
                    updateCharge(i, "amountDollars", e.target.value)
                  }
                  disabled={loading}
                  className="w-28"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCharge(i)}
                  disabled={loading}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCharge}
                disabled={loading}
              >
                + Add Final Charge
              </Button>
              {unit.rentAmountCents && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProratedCharge}
                  disabled={loading}
                >
                  Calculate Prorated Rent
                </Button>
              )}
            </div>
            {totalCents > 0 && (
              <p className="text-sm text-gray-600">
                Total final charges: ${(totalCents / 100).toFixed(2)}
              </p>
            )}
          </div>

          {/* Confirmation warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              This will end {tenant.name}&apos;s tenancy, cancel any active
              autopay,
              {finalCharges.length > 0
                ? ` post ${finalCharges.length} final charge(s),`
                : ""}
              {" "}and archive the tenancy record. This cannot be undone.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? "Processing..." : "Confirm Move-Out"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
