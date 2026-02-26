"use client"

import Link from "next/link"
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

export interface MaintenanceRequestData {
  id: string
  category: string
  description: string
  status: string
  unitId: string
  unitNumber: string
  tenantUserId: string
  tenantName: string
  tenantEmail: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  photoCount: number
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

interface MaintenanceCardProps {
  request: MaintenanceRequestData
}

export function MaintenanceCard({ request }: MaintenanceCardProps) {
  const catConfig =
    CATEGORY_CONFIG[request.category] || CATEGORY_CONFIG.general
  const Icon = catConfig.icon

  return (
    <Link href={`/admin/maintenance/${request.id}`}>
      <div className="bg-white rounded-lg shadow-sm border p-3 hover:shadow-md transition-shadow cursor-pointer space-y-2">
        {/* Category + Unit */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon className="size-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-700">
              {catConfig.label}
            </span>
          </div>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            Unit {request.unitNumber}
          </span>
        </div>

        {/* Description preview */}
        <p className="text-sm text-gray-600 line-clamp-2">
          {request.description}
        </p>

        {/* Tenant + meta */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="truncate max-w-[60%]">{request.tenantName}</span>
          <div className="flex items-center gap-2">
            {request.photoCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Camera className="size-3" />
                {request.photoCount}
              </span>
            )}
            <span>{timeAgo(request.createdAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
