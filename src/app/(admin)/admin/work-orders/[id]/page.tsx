"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Copy, RefreshCw, XCircle } from "lucide-react"

const STATUS_OPTIONS = [
  { value: "assigned", label: "Assigned" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "emergency", label: "Emergency" },
]

const COST_CATEGORY_LABELS: Record<string, string> = {
  labor: "Labor",
  materials: "Materials",
  permits: "Permits",
  other: "Other",
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface WorkOrderData {
  workOrder: {
    id: string
    maintenanceRequestId: string
    vendorId: string | null
    status: string
    priority: string
    scheduledDate: string | null
    completedDate: string | null
    notes: string | null
    vendorAccessToken: string | null
    createdAt: string
    updatedAt: string
  }
  maintenanceRequest: {
    id: string
    category: string
    description: string
    status: string
    createdAt: string
  } | null
  vendor: {
    id: string
    companyName: string
    contactName: string | null
    email: string | null
    phone: string | null
    specialty: string | null
  } | null
  unit: {
    id: string
    unitNumber: string
  } | null
  photos: Array<{
    id: string
    filePath: string
    fileName: string
    storageBackend: string
    s3Key: string | null
  }>
}

interface Vendor {
  id: string
  companyName: string
  status: string
}

interface CostItem {
  id: string
  description: string
  amountCents: number
  category: string
  createdAt: string
}

export default function WorkOrderDetailPage() {
  const params = useParams()
  const workOrderId = params.id as string

  const [data, setData] = useState<WorkOrderData | null>(null)
  const [activeVendors, setActiveVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  // Cost tracking state
  const [costs, setCosts] = useState<CostItem[]>([])
  const [totalCents, setTotalCents] = useState(0)
  const [costForm, setCostForm] = useState({
    description: "",
    amount: "",
    category: "labor",
    billToTenant: false,
  })
  const [addingCost, setAddingCost] = useState(false)

  const fetchWorkOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/work-orders/${workOrderId}`)
      if (!res.ok) throw new Error("Failed to fetch work order")
      const json = await res.json()
      setData(json)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/vendors?status=active")
      if (!res.ok) return
      const json = await res.json()
      setActiveVendors(json.vendors)
    } catch {
      // non-critical
    }
  }, [])

  const fetchCosts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/work-orders/${workOrderId}/costs`
      )
      if (!res.ok) return
      const json = await res.json()
      setCosts(json.costs)
      setTotalCents(json.totalCents)
    } catch {
      // non-critical
    }
  }, [workOrderId])

  useEffect(() => {
    fetchWorkOrder()
    fetchVendors()
    fetchCosts()
  }, [fetchWorkOrder, fetchVendors, fetchCosts])

  async function handleStatusChange(status: string) {
    try {
      const res = await fetch(`/api/admin/work-orders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast.success(`Status updated to ${status.replace("_", " ")}`)
      fetchWorkOrder()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    }
  }

  async function handlePriorityChange(priority: string) {
    try {
      const res = await fetch(`/api/admin/work-orders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      })
      if (!res.ok) throw new Error("Failed to update priority")
      toast.success(`Priority updated to ${priority}`)
      fetchWorkOrder()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    }
  }

  async function handleVendorAssign(vendorId: string) {
    try {
      const res = await fetch(`/api/admin/work-orders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: vendorId || null }),
      })
      if (!res.ok) throw new Error("Failed to assign vendor")
      toast.success("Vendor assigned")
      fetchWorkOrder()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    }
  }

  async function handleTokenAction(action: "regenerate_token" | "revoke_token") {
    try {
      const res = await fetch(`/api/admin/work-orders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(`Failed to ${action.replace("_", " ")}`)
      toast.success(
        action === "regenerate_token"
          ? "Magic link regenerated"
          : "Magic link revoked"
      )
      fetchWorkOrder()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    }
  }

  function copyMagicLink() {
    if (!data?.workOrder.vendorAccessToken) return
    const url = `${window.location.origin}/vendor/work-order/${data.workOrder.vendorAccessToken}`
    navigator.clipboard.writeText(url)
    toast.success("Magic link copied to clipboard")
  }

  async function handleAddCost() {
    if (!costForm.description.trim()) {
      toast.error("Description is required")
      return
    }
    const amountDollars = parseFloat(costForm.amount)
    if (isNaN(amountDollars) || amountDollars <= 0) {
      toast.error("Amount must be a positive number")
      return
    }

    setAddingCost(true)
    try {
      const res = await fetch(
        `/api/admin/work-orders/${workOrderId}/costs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: costForm.description.trim(),
            amountCents: Math.round(amountDollars * 100),
            category: costForm.category,
            billToTenant: costForm.billToTenant,
          }),
        }
      )
      if (!res.ok) throw new Error("Failed to add cost")
      toast.success("Cost added")
      setCostForm({ description: "", amount: "", category: "labor", billToTenant: false })
      fetchCosts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setAddingCost(false)
    }
  }

  async function handleDeleteCost(costId: string) {
    if (!window.confirm("Delete this cost item?")) return
    try {
      const res = await fetch(
        `/api/admin/work-orders/${workOrderId}/costs?costId=${costId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete cost")
      toast.success("Cost deleted")
      fetchCosts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    }
  }

  async function handleNotesUpdate(notes: string) {
    try {
      const res = await fetch(`/api/admin/work-orders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error("Failed to update notes")
      toast.success("Notes updated")
      fetchWorkOrder()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    }
  }

  if (loading || !data) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Work Order Detail</h1>
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    )
  }

  const { workOrder: wo, maintenanceRequest: mr, vendor, unit, photos } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/work-orders">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Work Order Detail</h1>
      </div>

      {/* Maintenance Request Info */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Request</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Category:</span>{" "}
              {mr?.category || "-"}
            </p>
            <p>
              <span className="font-medium">Unit:</span>{" "}
              {unit?.unitNumber || "-"}
            </p>
            <p>
              <span className="font-medium">Description:</span>{" "}
              {mr?.description || "-"}
            </p>
            <p>
              <span className="font-medium">Request Status:</span>{" "}
              {mr?.status || "-"}
            </p>
          </div>
          {photos.length > 0 && (
            <div className="mt-4">
              <p className="font-medium mb-2">Photos:</p>
              <div className="flex gap-2 flex-wrap">
                {photos.map((photo) => (
                  <img
                    key={photo.id}
                    src={`/api/uploads/${photo.filePath}`}
                    alt={photo.fileName}
                    className="w-24 h-24 object-cover rounded border"
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work Order Status & Priority */}
      <Card>
        <CardHeader>
          <CardTitle>Work Order</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={wo.status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={wo.priority}
                onValueChange={handlePriorityChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              defaultValue={wo.notes || ""}
              onBlur={(e) => {
                if (e.target.value !== (wo.notes || "")) {
                  handleNotesUpdate(e.target.value)
                }
              }}
              rows={3}
              placeholder="Add notes about this work order..."
            />
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Created: {new Date(wo.createdAt).toLocaleDateString()} |{" "}
            {wo.completedDate
              ? `Completed: ${new Date(wo.completedDate).toLocaleDateString()}`
              : "Not yet completed"}
          </div>
        </CardContent>
      </Card>

      {/* Vendor Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Assigned Vendor</Label>
              <Select
                value={wo.vendorId || "none"}
                onValueChange={(v) => handleVendorAssign(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a vendor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {activeVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {vendor && (
              <div className="text-sm text-gray-600">
                <p>
                  Contact: {vendor.contactName || "-"} |{" "}
                  {vendor.email || "-"} | {vendor.phone || "-"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Magic Link */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Magic Link</CardTitle>
        </CardHeader>
        <CardContent>
          {wo.vendorAccessToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-gray-100 rounded text-sm truncate">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/vendor/work-order/${wo.vendorAccessToken}`
                    : `/vendor/work-order/${wo.vendorAccessToken}`}
                </code>
                <Button variant="outline" size="sm" onClick={copyMagicLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTokenAction("regenerate_token")}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleTokenAction("revoke_token")}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Revoke
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">
              No magic link active. Assign a vendor to generate one.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cost Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Costs</span>
            <span className="text-lg font-semibold">
              Total: {formatCents(totalCents)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {costs.length > 0 && (
            <div className="mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium text-right">Amount</th>
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((cost) => (
                    <tr key={cost.id} className="border-b">
                      <td className="py-2">{cost.description}</td>
                      <td className="py-2">
                        <Badge variant="secondary">
                          {COST_CATEGORY_LABELS[cost.category] || cost.category}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {formatCents(cost.amountCents)}
                      </td>
                      <td className="py-2 text-gray-600">
                        {new Date(cost.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteCost(cost.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="font-medium mb-3">Add Cost</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1">
                <Input
                  placeholder="Description"
                  value={costForm.description}
                  onChange={(e) =>
                    setCostForm({ ...costForm, description: e.target.value })
                  }
                />
              </div>
              <div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Amount ($)"
                  value={costForm.amount}
                  onChange={(e) =>
                    setCostForm({ ...costForm, amount: e.target.value })
                  }
                />
              </div>
              <div>
                <Select
                  value={costForm.category}
                  onValueChange={(v) =>
                    setCostForm({ ...costForm, category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COST_CATEGORY_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button
                  onClick={handleAddCost}
                  disabled={addingCost}
                  className="w-full"
                >
                  {addingCost ? "Adding..." : "Add Cost"}
                </Button>
              </div>
              <div className="flex items-center gap-2 md:col-span-4">
                <input
                  type="checkbox"
                  id="billToTenant"
                  checked={costForm.billToTenant}
                  onChange={(e) =>
                    setCostForm({ ...costForm, billToTenant: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="billToTenant" className="text-sm font-normal">
                  Bill to Tenant
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
