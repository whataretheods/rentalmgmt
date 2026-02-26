"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import {
  Droplets,
  Zap,
  Thermometer,
  Refrigerator,
  Bug,
  HardHat,
  Wrench,
  Camera,
} from "lucide-react"

interface MaintenanceRequest {
  id: string
  category: string
  description: string
  status: string
  createdAt: string
  photoCount: number
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  plumbing: { label: "Plumbing", icon: Droplets },
  electrical: { label: "Electrical", icon: Zap },
  hvac: { label: "HVAC", icon: Thermometer },
  appliance: { label: "Appliance", icon: Refrigerator },
  pest_control: { label: "Pest Control", icon: Bug },
  structural: { label: "Structural", icon: HardHat },
  general: { label: "General", icon: Wrench },
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  submitted: {
    label: "Submitted",
    className: "bg-yellow-100 text-yellow-800",
  },
  acknowledged: {
    label: "Acknowledged",
    className: "bg-blue-100 text-blue-800",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-orange-100 text-orange-800",
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-100 text-green-800",
  },
}

export function MaintenanceRequestList() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch("/api/maintenance")
        if (res.ok) {
          const data = await res.json()
          setRequests(data.requests)
        }
      } catch {
        // Silently fail -- the empty state will show
      } finally {
        setLoading(false)
      }
    }
    fetchRequests()
  }, [])

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading requests...
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <Wrench className="mx-auto size-12 text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">No maintenance requests yet.</p>
        <Link
          href="/tenant/maintenance/new"
          className="text-sm text-blue-600 hover:underline"
        >
          Submit your first request
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const catConfig = CATEGORY_CONFIG[request.category] || CATEGORY_CONFIG.general
        const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.submitted
        const Icon = catConfig.icon

        return (
          <Link key={request.id} href={`/tenant/maintenance/${request.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <Icon className="size-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {catConfig.label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {request.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                    {request.photoCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Camera className="size-3" />
                        {request.photoCount} photo{request.photoCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
