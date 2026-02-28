import { Card, CardContent } from "@/components/ui/card"
import { type LucideIcon } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  iconBgColor?: string
  iconColor?: string
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = "bg-gray-100",
  iconColor = "text-gray-600",
}: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={`rounded-lg ${iconBgColor} p-3`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
