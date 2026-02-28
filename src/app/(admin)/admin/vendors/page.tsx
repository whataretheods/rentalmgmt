"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "sonner"
import { HardHat } from "lucide-react"

const SPECIALTY_LABELS: Record<string, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  appliance: "Appliance",
  pest_control: "Pest Control",
  general_maintenance: "General Maintenance",
  painting: "Painting",
  cleaning: "Cleaning",
  landscaping: "Landscaping",
  other: "Other",
}

interface Vendor {
  id: string
  companyName: string
  contactName: string | null
  email: string | null
  phone: string | null
  specialty: string | null
  notes: string | null
  status: string
  createdAt: string
  updatedAt: string
}

const EMPTY_FORM = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  specialty: "",
  notes: "",
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/vendors")
      if (!res.ok) throw new Error("Failed to fetch vendors")
      const data = await res.json()
      setVendors(data.vendors)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVendors()
  }, [fetchVendors])

  function openAddDialog() {
    setEditingVendor(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEditDialog(vendor: Vendor) {
    setEditingVendor(vendor)
    setForm({
      companyName: vendor.companyName,
      contactName: vendor.contactName || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      specialty: vendor.specialty || "",
      notes: vendor.notes || "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.companyName.trim()) {
      toast.error("Company name is required")
      return
    }

    setSaving(true)
    try {
      if (editingVendor) {
        const res = await fetch(`/api/admin/vendors/${editingVendor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error("Failed to update vendor")
        toast.success("Vendor updated")
      } else {
        const res = await fetch("/api/admin/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error("Failed to add vendor")
        toast.success("Vendor added")
      }
      setDialogOpen(false)
      fetchVendors()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(vendor: Vendor) {
    const newStatus = vendor.status === "active" ? "inactive" : "active"
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}`, {
        method: vendor.status === "active" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update vendor status")
      toast.success(
        newStatus === "inactive"
          ? `${vendor.companyName} deactivated`
          : `${vendor.companyName} reactivated`
      )
      fetchVendors()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vendor Directory</h1>
        <p className="mt-4 text-gray-500">Loading vendors...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Directory</h1>
          <p className="mt-1 text-gray-600">
            Manage vendors for maintenance work orders.
          </p>
        </div>
        <Button onClick={openAddDialog}>Add Vendor</Button>
      </div>

      {vendors.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={HardHat}
            title="No vendors yet"
            description="Add your first vendor to get started. Vendors can be assigned to maintenance work orders."
          />
        </div>
      ) : (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">
                    {vendor.companyName}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {vendor.contactName || "-"}
                  </TableCell>
                  <TableCell>
                    {vendor.specialty
                      ? SPECIALTY_LABELS[vendor.specialty] || vendor.specialty
                      : "-"}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {vendor.phone || "-"}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {vendor.email || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={vendor.status === "active" ? "default" : "secondary"}
                      className={
                        vendor.status === "active"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                      }
                    >
                      {vendor.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(vendor)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={
                          vendor.status === "active"
                            ? "text-red-600 hover:text-red-700"
                            : "text-green-600 hover:text-green-700"
                        }
                        onClick={() => handleToggleStatus(vendor)}
                      >
                        {vendor.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVendor ? "Edit Vendor" : "Add Vendor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) =>
                  setForm({ ...form, companyName: e.target.value })
                }
                placeholder="e.g., Quick Fix Plumbing"
              />
            </div>
            <div>
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(e) =>
                  setForm({ ...form, contactName: e.target.value })
                }
                placeholder="e.g., John Smith"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="vendor@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 555-123-4567"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="specialty">Specialty</Label>
              <Select
                value={form.specialty}
                onValueChange={(value) =>
                  setForm({ ...form, specialty: value })
                }
              >
                <SelectTrigger id="specialty">
                  <SelectValue placeholder="Select specialty..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SPECIALTY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes about this vendor..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? "Saving..."
                : editingVendor
                ? "Update Vendor"
                : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
