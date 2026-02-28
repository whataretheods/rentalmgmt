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
import { PropertyForm } from "@/components/admin/PropertyForm"
import Link from "next/link"

interface Property {
  id: string
  name: string
  address: string
  unitCount: number
  createdAt: string
}

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/properties")
      if (!res.ok) throw new Error("Failed to fetch properties")
      const data = await res.json()
      setProperties(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  async function handleArchive(id: string, name: string) {
    try {
      const res = await fetch(`/api/admin/properties/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to archive property")
      }
      toast.success(`${name} archived`)
      fetchProperties()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
        <p className="mt-4 text-gray-500">Loading properties...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="mt-1 text-gray-600">
            Manage your properties. Create, edit, or archive properties in your
            portfolio.
          </p>
        </div>
        <PropertyForm
          mode="create"
          onSuccess={fetchProperties}
          trigger={<Button>Add Property</Button>}
        />
      </div>

      {properties.length === 0 ? (
        <div className="mt-8 text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-500">
            No properties yet. Add your first property to get started.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-center">Units</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">{property.name}</TableCell>
                  <TableCell className="text-gray-600">
                    {property.address}
                  </TableCell>
                  <TableCell className="text-center">
                    {property.unitCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/properties/${property.id}/late-fees`}>
                          Late Fees
                        </Link>
                      </Button>
                      <PropertyForm
                        mode="edit"
                        property={property}
                        onSuccess={fetchProperties}
                        trigger={
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        }
                      />
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
                              Archive {property.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will hide {property.name} from active lists.
                              Units under this property will remain but the
                              property will no longer appear in property
                              selections. This action cannot be easily undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleArchive(property.id, property.name)
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
