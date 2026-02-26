"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ManualPaymentForm } from "./ManualPaymentForm"

interface UnitPaymentStatus {
  unitId: string
  unitNumber: string
  propertyName: string
  tenantName: string | null
  tenantEmail: string | null
  rentAmountCents: number | null
  amountPaidCents: number
  status: "paid" | "unpaid" | "partial" | "pending"
  lastPaymentDate: string | null
}

export function PaymentDashboard({
  initialData,
  initialPeriod,
}: {
  initialData: UnitPaymentStatus[]
  initialPeriod: string
}) {
  const [period, setPeriod] = useState(initialPeriod)
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/payments-overview?period=${p}`)
      if (res.ok) {
        const json = await res.json()
        setData(json.units)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  function navigateMonth(delta: number) {
    const [year, month] = period.split("-").map(Number)
    const d = new Date(year, month - 1 + delta, 1)
    const newPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    setPeriod(newPeriod)
    fetchData(newPeriod)
  }

  const statusStyles: Record<string, string> = {
    paid: "bg-green-100 text-green-800",
    unpaid: "bg-red-100 text-red-800",
    partial: "bg-amber-100 text-amber-800",
    pending: "bg-yellow-100 text-yellow-800",
  }

  const periodLabel = new Date(period + "-01").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
          Previous
        </Button>
        <span className="text-lg font-semibold">{periodLabel}</span>
        <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
          Next
        </Button>
      </div>

      {/* Status Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm font-medium text-gray-500">
              <th className="pb-3 pr-4">Unit</th>
              <th className="pb-3 pr-4">Tenant</th>
              <th className="pb-3 pr-4">Amount Due</th>
              <th className="pb-3 pr-4">Amount Paid</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Last Payment</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((unit) => (
              <tr key={unit.unitId} className="border-b">
                <td className="py-3 pr-4 font-medium">{unit.unitNumber}</td>
                <td className="py-3 pr-4 text-gray-600">
                  {unit.tenantName || unit.tenantEmail || (
                    <span className="text-gray-400">No tenant</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {unit.rentAmountCents != null ? (
                    `$${(unit.rentAmountCents / 100).toFixed(2)}`
                  ) : (
                    <span className="text-gray-400">Not set</span>
                  )}
                </td>
                <td className="py-3 pr-4 font-medium">
                  ${(unit.amountPaidCents / 100).toFixed(2)}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[unit.status]}`}
                  >
                    {unit.status.charAt(0).toUpperCase() + unit.status.slice(1)}
                  </span>
                </td>
                <td className="py-3 pr-4 text-sm text-gray-500">
                  {unit.lastPaymentDate || "\u2014"}
                </td>
                <td className="py-3">
                  {unit.tenantName || unit.tenantEmail ? (
                    <ManualPaymentForm
                      unitId={unit.unitId}
                      unitNumber={unit.unitNumber}
                      onPaymentRecorded={() => fetchData(period)}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No units found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
