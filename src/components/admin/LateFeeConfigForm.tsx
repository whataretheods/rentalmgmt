"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"

interface LateFeeConfigFormProps {
  propertyId: string
  propertyName: string
}

interface LateFeeRuleData {
  id: string
  propertyId: string
  enabled: boolean
  gracePeriodDays: number
  feeType: "flat" | "percentage"
  feeAmountCents: number
  maxFeeAmountCents: number | null
}

export function LateFeeConfigForm({
  propertyId,
  propertyName,
}: LateFeeConfigFormProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [enabled, setEnabled] = useState(false)
  const [gracePeriodDays, setGracePeriodDays] = useState("5")
  const [feeType, setFeeType] = useState<"flat" | "percentage">("flat")
  const [feeAmountDollars, setFeeAmountDollars] = useState("50.00")
  const [feePercentage, setFeePercentage] = useState("5")
  const [maxFeeDollars, setMaxFeeDollars] = useState("")

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function fetchRule() {
      try {
        const res = await fetch(
          `/api/admin/late-fee-rules?propertyId=${propertyId}`
        )
        if (res.ok) {
          const data = await res.json()
          if (data.rule) {
            const rule: LateFeeRuleData = data.rule
            setEnabled(rule.enabled)
            setGracePeriodDays(String(rule.gracePeriodDays))
            setFeeType(rule.feeType)
            if (rule.feeType === "flat") {
              setFeeAmountDollars((rule.feeAmountCents / 100).toFixed(2))
            } else {
              setFeePercentage(String(rule.feeAmountCents / 100))
            }
            if (rule.maxFeeAmountCents != null) {
              setMaxFeeDollars((rule.maxFeeAmountCents / 100).toFixed(2))
            }
          }
        }
      } catch {
        toast.error("Failed to load late fee settings")
      } finally {
        setLoading(false)
      }
    }
    fetchRule()
  }, [propertyId])

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    const grace = parseInt(gracePeriodDays, 10)
    if (isNaN(grace) || grace < 1) {
      newErrors.gracePeriodDays = "Grace period must be at least 1 day"
    }

    if (feeType === "flat") {
      const amount = parseFloat(feeAmountDollars)
      if (isNaN(amount) || amount <= 0) {
        newErrors.feeAmount = "Fee amount must be greater than $0"
      }
    } else {
      const pct = parseFloat(feePercentage)
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        newErrors.feeAmount = "Percentage must be between 0 and 100"
      }
      if (maxFeeDollars) {
        const maxFee = parseFloat(maxFeeDollars)
        if (isNaN(maxFee) || maxFee <= 0) {
          newErrors.maxFee = "Maximum fee must be greater than $0"
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSave() {
    if (!validate()) return

    setSaving(true)
    try {
      let feeAmountCents: number
      if (feeType === "flat") {
        feeAmountCents = Math.round(parseFloat(feeAmountDollars) * 100)
      } else {
        // Store as basis points: 5% = 500
        feeAmountCents = Math.round(parseFloat(feePercentage) * 100)
      }

      const maxFeeAmountCents = maxFeeDollars
        ? Math.round(parseFloat(maxFeeDollars) * 100)
        : null

      const res = await fetch("/api/admin/late-fee-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          enabled,
          gracePeriodDays: parseInt(gracePeriodDays, 10),
          feeType,
          feeAmountCents,
          maxFeeAmountCents,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to save late fee settings")
        return
      }

      toast.success("Late fee settings saved")
    } catch {
      toast.error("Failed to save late fee settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          Loading late fee settings...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Late Fee Settings</CardTitle>
        <CardDescription>{propertyName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enabled" className="text-base font-medium">
              Enable Late Fees
            </Label>
            <p className="text-sm text-gray-500">
              Automatically assess late fees for unpaid rent
            </p>
          </div>
          <button
            id="enabled"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              enabled ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {!enabled && (
          <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-600">
            Late fees are currently disabled for this property. Tenants will not
            be automatically charged late fees.
          </div>
        )}

        {enabled && (
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">
            When enabled, tenants with unpaid rent will be automatically charged
            a late fee after the grace period.
          </div>
        )}

        {/* Grace Period */}
        <div className={!enabled ? "opacity-50 pointer-events-none" : ""}>
          <Label htmlFor="gracePeriod">Grace Period (days)</Label>
          <p className="mb-2 text-sm text-gray-500">
            Days after due date before a late fee is assessed
          </p>
          <Input
            id="gracePeriod"
            type="number"
            min="1"
            value={gracePeriodDays}
            onChange={(e) => setGracePeriodDays(e.target.value)}
            className="w-24"
            disabled={!enabled}
          />
          {errors.gracePeriodDays && (
            <p className="mt-1 text-sm text-red-600">
              {errors.gracePeriodDays}
            </p>
          )}
        </div>

        {/* Fee Type */}
        <div className={!enabled ? "opacity-50 pointer-events-none" : ""}>
          <Label>Fee Type</Label>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="feeType"
                value="flat"
                checked={feeType === "flat"}
                onChange={() => setFeeType("flat")}
                disabled={!enabled}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm">Flat Amount</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="feeType"
                value="percentage"
                checked={feeType === "percentage"}
                onChange={() => setFeeType("percentage")}
                disabled={!enabled}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm">Percentage of Rent</span>
            </label>
          </div>
        </div>

        {/* Fee Amount */}
        <div className={!enabled ? "opacity-50 pointer-events-none" : ""}>
          <Label htmlFor="feeAmount">
            {feeType === "flat" ? "Fee Amount ($)" : "Fee Percentage (%)"}
          </Label>
          {feeType === "flat" ? (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-sm text-gray-500">$</span>
              <Input
                id="feeAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={feeAmountDollars}
                onChange={(e) => setFeeAmountDollars(e.target.value)}
                className="w-32"
                disabled={!enabled}
                placeholder="50.00"
              />
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-1">
              <Input
                id="feeAmount"
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={feePercentage}
                onChange={(e) => setFeePercentage(e.target.value)}
                className="w-24"
                disabled={!enabled}
                placeholder="5"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          )}
          {errors.feeAmount && (
            <p className="mt-1 text-sm text-red-600">{errors.feeAmount}</p>
          )}
        </div>

        {/* Maximum Fee (percentage only) */}
        {feeType === "percentage" && (
          <div className={!enabled ? "opacity-50 pointer-events-none" : ""}>
            <Label htmlFor="maxFee">Maximum Fee Cap (optional)</Label>
            <p className="mb-2 text-sm text-gray-500">
              Cap the percentage-based fee at a dollar amount
            </p>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500">$</span>
              <Input
                id="maxFee"
                type="number"
                step="0.01"
                min="0.01"
                value={maxFeeDollars}
                onChange={(e) => setMaxFeeDollars(e.target.value)}
                className="w-32"
                disabled={!enabled}
                placeholder="100.00"
              />
            </div>
            {errors.maxFee && (
              <p className="mt-1 text-sm text-red-600">{errors.maxFee}</p>
            )}
          </div>
        )}

        {/* Legal compliance note */}
        <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-700">
          Ensure late fee amounts comply with your local jurisdiction&apos;s
          regulations.
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  )
}
