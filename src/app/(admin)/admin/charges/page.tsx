"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { toast } from "sonner"

type ChargeType = "rent" | "late_fee" | "one_time" | "credit" | "adjustment"

interface TenantUnitPair {
  tenantUserId: string
  unitId: string
  tenantName: string
  tenantEmail: string
  unitNumber: string
}

interface Charge {
  id: string
  tenantUserId: string
  unitId: string
  type: ChargeType
  description: string
  amountCents: number
  billingPeriod: string | null
  createdBy: string | null
  createdAt: string
}

const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  rent: "Rent",
  late_fee: "Late Fee",
  one_time: "One-Time Charge",
  credit: "Credit",
  adjustment: "Adjustment",
}

const CREDIT_TYPES: ChargeType[] = ["credit", "adjustment"]

function formatCents(cents: number): string {
  const abs = Math.abs(cents)
  return `$${(abs / 100).toFixed(2)}`
}

export default function AdminChargesPage() {
  const [tenantPairs, setTenantPairs] = useState<TenantUnitPair[]>([])
  const [selectedPair, setSelectedPair] = useState<string>("") // "tenantUserId|unitId"
  const [chargeType, setChargeType] = useState<ChargeType>("rent")
  const [description, setDescription] = useState("")
  const [amountDollars, setAmountDollars] = useState("")
  const [billingPeriod, setBillingPeriod] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [submitting, setSubmitting] = useState(false)
  const [recentCharges, setRecentCharges] = useState<Charge[]>([])
  const [loadingCharges, setLoadingCharges] = useState(false)
  const [loadingTenants, setLoadingTenants] = useState(true)

  // Fetch active tenant-unit pairs on mount
  useEffect(() => {
    async function fetchTenantUnits() {
      try {
        const res = await fetch("/api/admin/tenant-units")
        if (!res.ok) return
        const json = await res.json()
        setTenantPairs(json.tenantUnits)
      } catch {
        // Network error — leave empty
      } finally {
        setLoadingTenants(false)
      }
    }
    fetchTenantUnits()
  }, [])

  const fetchRecentCharges = useCallback(async (tenantUserId: string, unitId: string) => {
    setLoadingCharges(true)
    try {
      const res = await fetch(
        `/api/admin/charges?tenantUserId=${tenantUserId}&unitId=${unitId}`
      )
      if (res.ok) {
        const json = await res.json()
        setRecentCharges(json.charges)
      }
    } finally {
      setLoadingCharges(false)
    }
  }, [])

  // When selected pair changes, fetch recent charges
  useEffect(() => {
    if (!selectedPair) {
      setRecentCharges([])
      return
    }
    const [tenantUserId, unitId] = selectedPair.split("|")
    if (tenantUserId && unitId) {
      fetchRecentCharges(tenantUserId, unitId)
    }
  }, [selectedPair, fetchRecentCharges])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedPair) {
      toast.error("Please select a tenant")
      return
    }

    const cents = Math.round(parseFloat(amountDollars) * 100)
    if (isNaN(cents) || cents <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    const [tenantUserId, unitId] = selectedPair.split("|")

    const payload: Record<string, unknown> = {
      tenantUserId,
      unitId,
      type: chargeType,
      description,
      amountCents: cents,
    }

    if (chargeType === "rent" || chargeType === "late_fee") {
      payload.billingPeriod = billingPeriod
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to post charge")
        return
      }

      const label = CREDIT_TYPES.includes(chargeType) ? "Credit" : "Charge"
      toast.success(`${label} posted successfully`)

      // Reset form (keep tenant selected)
      setDescription("")
      setAmountDollars("")
      setChargeType("rent")

      // Refetch recent charges
      if (tenantUserId && unitId) {
        fetchRecentCharges(tenantUserId, unitId)
      }
    } catch {
      toast.error("Failed to post charge")
    } finally {
      setSubmitting(false)
    }
  }

  const isCredit = CREDIT_TYPES.includes(chargeType)
  const showBillingPeriod = chargeType === "rent" || chargeType === "late_fee"

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Charge Management</h1>
      <p className="mt-2 text-gray-600">
        Post charges, credits, and adjustments to tenant ledgers.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Charge Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {isCredit ? "Post Credit / Adjustment" : "Post Charge"}
            </CardTitle>
            <CardDescription>
              {isCredit
                ? "Reduce a tenant's balance with a credit or adjustment."
                : "Add a charge to a tenant's ledger."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tenant Selection */}
              <div className="space-y-2">
                <Label htmlFor="tenant-select">Tenant</Label>
                {loadingTenants ? (
                  <div className="h-9 w-full animate-pulse rounded-md bg-gray-100" />
                ) : (
                  <select
                    id="tenant-select"
                    value={selectedPair}
                    onChange={(e) => setSelectedPair(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="">Select a tenant...</option>
                    {tenantPairs.map((pair) => (
                      <option
                        key={`${pair.tenantUserId}-${pair.unitId}`}
                        value={`${pair.tenantUserId}|${pair.unitId}`}
                      >
                        {pair.tenantName} ({pair.tenantEmail}) — Unit{" "}
                        {pair.unitNumber}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Charge Type */}
              <div className="space-y-2">
                <Label htmlFor="charge-type">Type</Label>
                <select
                  id="charge-type"
                  value={chargeType}
                  onChange={(e) => setChargeType(e.target.value as ChargeType)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  {(
                    Object.entries(CHARGE_TYPE_LABELS) as [
                      ChargeType,
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    chargeType === "rent"
                      ? "Rent for March 2026"
                      : chargeType === "credit"
                        ? "Overpayment correction"
                        : "Enter description..."
                  }
                  required
                  maxLength={500}
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">
                  {isCredit ? "Credit Amount" : "Amount"}
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountDollars}
                    onChange={(e) => setAmountDollars(e.target.value)}
                    placeholder="1500.00"
                    required
                    className="max-w-xs"
                  />
                </div>
                {isCredit && (
                  <p className="text-xs text-gray-500">
                    This amount will be applied as a credit (reducing the
                    tenant's balance).
                  </p>
                )}
              </div>

              {/* Billing Period */}
              {showBillingPeriod && (
                <div className="space-y-2">
                  <Label htmlFor="billing-period">Billing Period</Label>
                  <Input
                    id="billing-period"
                    type="month"
                    value={billingPeriod}
                    onChange={(e) => setBillingPeriod(e.target.value)}
                    required
                    className="max-w-xs"
                  />
                </div>
              )}

              <Button type="submit" disabled={submitting || !selectedPair}>
                {submitting
                  ? "Posting..."
                  : isCredit
                    ? "Post Credit"
                    : "Post Charge"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Charges */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Charges</CardTitle>
            <CardDescription>
              {selectedPair
                ? "Showing recent ledger entries for the selected tenant."
                : "Select a tenant to view their recent charges."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedPair ? (
              <p className="text-sm text-gray-400">No tenant selected.</p>
            ) : loadingCharges ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 w-full animate-pulse rounded bg-gray-100"
                  />
                ))}
              </div>
            ) : recentCharges.length === 0 ? (
              <p className="text-sm text-gray-400">
                No charges found for this tenant.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-3 font-medium">Date</th>
                      <th className="pb-2 pr-3 font-medium">Type</th>
                      <th className="pb-2 pr-3 font-medium">Description</th>
                      <th className="pb-2 pr-3 text-right font-medium">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCharges.map((charge) => {
                      const isNegative = charge.amountCents < 0
                      return (
                        <tr key={charge.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 text-gray-600">
                            {new Date(charge.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                                isNegative
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {CHARGE_TYPE_LABELS[charge.type as ChargeType] ||
                                charge.type}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-gray-700">
                            {charge.description}
                          </td>
                          <td
                            className={`py-2 text-right font-mono ${
                              isNegative ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {isNegative ? "-" : "+"}
                            {formatCents(charge.amountCents)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
