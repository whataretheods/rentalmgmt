"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "sonner"
import { ClipboardList } from "lucide-react"
import Link from "next/link"

const STATUS_STYLES: Record<string, string> = {
  assigned: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  scheduled: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  in_progress: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  completed: "bg-green-100 text-green-800 hover:bg-green-100",
  cancelled: "bg-gray-100 text-gray-600 hover:bg-gray-100",
}

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 hover:bg-gray-100",
  medium: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  high: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  emergency: "bg-red-100 text-red-800 hover:bg-red-100",
}

interface WorkOrder {
  id: string
  status: string
  priority: string
  scheduledDate: string | null
  createdAt: string
  vendorCompanyName: string | null
  requestCategory: string
  requestDescription: string
  unitNumber: string
}

export default function AdminWorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWorkOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/work-orders")
      if (!res.ok) throw new Error("Failed to fetch work orders")
      const data = await res.json()
      setWorkOrders(data.workOrders)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkOrders()
  }, [fetchWorkOrders])

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
        <p className="mt-4 text-gray-500">Loading work orders...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="mt-1 text-gray-600">
            Track vendor assignments and maintenance work.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/maintenance">
            Create from Maintenance Request
          </Link>
        </Button>
      </div>

      {workOrders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={ClipboardList}
            title="No work orders yet"
            description="Create a work order from a maintenance request to assign vendors and track work."
          />
        </div>
      ) : (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {wo.requestCategory}
                  </TableCell>
                  <TableCell>{wo.unitNumber}</TableCell>
                  <TableCell className="text-gray-600">
                    {wo.vendorCompanyName || "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_STYLES[wo.status] || ""}
                    >
                      {wo.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={PRIORITY_STYLES[wo.priority] || ""}
                    >
                      {wo.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {wo.scheduledDate
                      ? new Date(wo.scheduledDate).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {new Date(wo.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/work-orders/${wo.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
