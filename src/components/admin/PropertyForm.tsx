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

interface PropertyFormProps {
  mode: "create" | "edit"
  property?: { id: string; name: string; address: string }
  onSuccess: () => void
  trigger: React.ReactNode
}

export function PropertyForm({
  mode,
  property,
  onSuccess,
  trigger,
}: PropertyFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(property?.name ?? "")
  const [address, setAddress] = useState(property?.address ?? "")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !address.trim()) {
      toast.error("Name and address are required")
      return
    }

    setLoading(true)
    try {
      const url =
        mode === "create"
          ? "/api/admin/properties"
          : `/api/admin/properties/${property!.id}`
      const method = mode === "create" ? "POST" : "PUT"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), address: address.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save property")
      }

      toast.success(
        mode === "create" ? "Property created" : "Property updated"
      )
      setOpen(false)
      if (mode === "create") {
        setName("")
        setAddress("")
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
            {mode === "create" ? "Add Property" : "Edit Property"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new property to your portfolio."
              : "Update property details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="property-name">Property Name</Label>
            <Input
              id="property-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Oak Street Apartments"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-address">Address</Label>
            <Input
              id="property-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 123 Oak Street, City, ST 12345"
              disabled={loading}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Saving..."
                : mode === "create"
                  ? "Create Property"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
