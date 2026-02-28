"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { UnitForm } from "@/components/admin/UnitForm"
import { MoveOutDialog } from "@/components/admin/MoveOutDialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Building2 } from "lucide-react"

interface Unit {
  id: string
  unitNumber: string
  propertyId: string
  propertyName: string
  propertyAddress: string
  rentAmountCents: number | null
  rentDueDay: number | null
  currentTenantUserId: string | null
  currentTenantName: string | null
  currentTenantEmail: string | null
  createdAt: string
}

interface Property {
  id: string
  name: string
}

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/units")
      if (!res.ok) throw new Error("Failed to fetch units")
      const data = await res.json()
      setUnits(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/properties")
      if (!res.ok) throw new Error("Failed to fetch properties")
      const data = await res.json()
      setProperties(data.map((p: Property & { address: string }) => ({ id: p.id, name: p.name })))
    } catch {
      // Properties list is for the create dialog, non-critical
    }
  }, [])

  useEffect(() => {
    fetchUnits()
    fetchProperties()
  }, [fetchUnits, fetchProperties])

  async function handleArchive(id: string, unitNumber: string) {
    try {
      const res = await fetch(`/api/admin/units/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to archive unit")
      }
      toast.success(`Unit ${unitNumber} archived`)
      fetchUnits()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Units & Rent Configuration
        </h1>
        <p className="mt-4 text-gray-500">Loading units...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Units & Rent Configuration
          </h1>
          <p className="mt-1 text-gray-600">
            Manage units, set rent amounts, and configure due days.
          </p>
        </div>
        <UnitForm
          mode="create"
          properties={properties}
          onSuccess={() => {
            fetchUnits()
            fetchProperties()
          }}
          trigger={<Button>Add Unit</Button>}
        />
      </div>

      {units.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Building2}
            title="No units configured"
            description="Add properties and units to start managing rent collection. Each unit can have its own rent amount and due date."
          />
        </div>
      ) : (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Current Tenant</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">
                    {unit.unitNumber}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {unit.propertyName}
                  </TableCell>
                  <TableCell>
                    {unit.rentAmountCents != null ? (
                      <span>
                        ${(unit.rentAmountCents / 100).toFixed(2)}
                        {unit.rentDueDay ? ` / due day ${unit.rentDueDay}` : ""}
                      </span>
                    ) : (
                      <span className="text-amber-600 text-sm">
                        Not configured
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {unit.currentTenantName ? (
                      <div>
                        <span className="text-gray-900">
                          {unit.currentTenantName}
                        </span>
                        <br />
                        <span className="text-xs text-gray-500">
                          {unit.currentTenantEmail}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Vacant</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <UnitForm
                        mode="edit"
                        unit={unit}
                        properties={properties}
                        onSuccess={fetchUnits}
                        trigger={
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        }
                      />
                      {unit.currentTenantName && unit.currentTenantUserId && (
                        <MoveOutDialog
                          tenant={{
                            userId: unit.currentTenantUserId,
                            name: unit.currentTenantName,
                            email: unit.currentTenantEmail || "",
                          }}
                          unit={{
                            id: unit.id,
                            unitNumber: unit.unitNumber,
                          }}
                          onSuccess={fetchUnits}
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              Move Out
                            </Button>
                          }
                        />
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            Archive
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Archive Unit {unit.unitNumber}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will hide Unit {unit.unitNumber} from active
                              lists. Financial and maintenance history will be
                              preserved. This action cannot be easily undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleArchive(unit.id, unit.unitNumber)
                              }
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Archive
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
