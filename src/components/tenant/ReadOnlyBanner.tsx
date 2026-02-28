import { Card, CardContent } from "@/components/ui/card"

interface ReadOnlyBannerProps {
  unitNumber: string
  endDate: Date | null
}

export function ReadOnlyBanner({ unitNumber, endDate }: ReadOnlyBannerProps) {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="py-3 px-4">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Read-only access</span> -- Your tenancy
          for Unit {unitNumber} ended
          {endDate ? ` on ${new Date(endDate).toLocaleDateString()}` : ""}.
          You can view your payment and maintenance history below.
        </p>
      </CardContent>
    </Card>
  )
}
