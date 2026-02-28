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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface UnitFormProps {
  mode: "create" | "edit"
  unit?: {
    id: string
    unitNumber: string
    propertyId: string
    rentAmountCents: number | null
    rentDueDay: number | null
  }
  properties: { id: string; name: string }[]
  onSuccess: () => void
  trigger: React.ReactNode
}

export function UnitForm({
  mode,
  unit,
  properties,
  onSuccess,
  trigger,
}: UnitFormProps) {
  const [open, setOpen] = useState(false)
  const [unitNumber, setUnitNumber] = useState(unit?.unitNumber ?? "")
  const [propertyId, setPropertyId] = useState(unit?.propertyId ?? "")
  const [rentDollars, setRentDollars] = useState(
    unit?.rentAmountCents != null
      ? (unit.rentAmountCents / 100).toFixed(2)
      : ""
  )
  const [rentDueDay, setRentDueDay] = useState(
    unit?.rentDueDay?.toString() ?? ""
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!unitNumber.trim()) {
      toast.error("Unit number is required")
      return
    }

    if (mode === "create" && !propertyId) {
      toast.error("Property is required")
      return
    }

    const rentAmountCents = rentDollars
      ? Math.round(parseFloat(rentDollars) * 100)
      : undefined
    const dueDayNum = rentDueDay ? parseInt(rentDueDay, 10) : undefined

    if (rentAmountCents !== undefined && (isNaN(rentAmountCents) || rentAmountCents < 0)) {
      toast.error("Invalid rent amount")
      return
    }

    if (dueDayNum !== undefined && (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 28)) {
      toast.error("Due day must be between 1 and 28")
      return
    }

    setLoading(true)
    try {
      const url =
        mode === "create"
          ? "/api/admin/units"
          : `/api/admin/units/${unit!.id}`
      const method = mode === "create" ? "POST" : "PUT"

      const payload: Record<string, unknown> = {
        unitNumber: unitNumber.trim(),
      }
      if (mode === "create") payload.propertyId = propertyId
      if (rentAmountCents !== undefined) payload.rentAmountCents = rentAmountCents
      if (dueDayNum !== undefined) payload.rentDueDay = dueDayNum

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save unit")
      }

      toast.success(mode === "create" ? "Unit created" : "Unit updated")
      setOpen(false)
      if (mode === "create") {
        setUnitNumber("")
        setPropertyId("")
        setRentDollars("")
        setRentDueDay("")
      }
      onSuccess()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Unit" : "Edit Unit"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new unit to a property."
              : "Update unit details and rent configuration."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "create" && (
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="unit-number">Unit Number</Label>
            <Input
              id="unit-number"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="e.g., 101, A1, Suite 200"
              disabled={loading}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rent-amount">Rent Amount ($)</Label>
              <Input
                id="rent-amount"
                type="number"
                step="0.01"
                min="0"
                value={rentDollars}
                onChange={(e) => setRentDollars(e.target.value)}
                placeholder="e.g., 1500.00"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rent-due-day">Due Day (1-28)</Label>
              <Input
                id="rent-due-day"
                type="number"
                min="1"
                max="28"
                value={rentDueDay}
                onChange={(e) => setRentDueDay(e.target.value)}
                placeholder="e.g., 1"
                disabled={loading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Saving..."
                : mode === "create"
                  ? "Create Unit"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
