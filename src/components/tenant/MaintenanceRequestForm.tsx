"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Camera, Upload, X, Wrench } from "lucide-react"

const CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "appliance", label: "Appliance" },
  { value: "pest_control", label: "Pest Control" },
  { value: "structural", label: "Structural" },
  { value: "general", label: "General / Other" },
] as const

const MAX_PHOTOS = 5

interface PhotoPreview {
  file: File
  url: string
}

export function MaintenanceRequestForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const remaining = MAX_PHOTOS - photos.length
    const toAdd = files.slice(0, remaining)

    if (files.length > remaining) {
      toast.warning(`Only ${remaining} more photo(s) allowed. First ${remaining} selected.`)
    }

    const newPreviews = toAdd.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }))

    setPhotos((prev) => [...prev, ...newPreviews])

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const removed = prev[index]
      URL.revokeObjectURL(removed.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!category) {
      toast.error("Please select a category")
      return
    }
    if (!description.trim()) {
      toast.error("Please enter a description")
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append("category", category)
      formData.append("description", description.trim())
      for (const photo of photos) {
        formData.append("photos", photo.file)
      }

      const res = await fetch("/api/maintenance", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to submit request")
        return
      }

      toast.success("Maintenance request submitted")
      router.push("/tenant/maintenance")
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">
          <Wrench className="size-4" />
          Category
        </Label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select a category...</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue in detail..."
          rows={4}
          className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Photo Upload */}
      <div className="space-y-2">
        <Label>
          <Camera className="size-4" />
          Photos (optional, up to {MAX_PHOTOS})
        </Label>

        {/* Thumbnail Previews */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                <img
                  src={photo.url}
                  alt={`Preview ${index + 1}`}
                  className="aspect-square w-full rounded-md object-cover border"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
          >
            <Upload className="size-4" />
            {photos.length === 0
              ? "Click to add photos"
              : `Add more photos (${photos.length}/${MAX_PHOTOS})`}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Submit */}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Submitting..." : "Submit Request"}
      </Button>
    </form>
  )
}
