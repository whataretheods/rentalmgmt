import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-5 w-24" />
      </div>
      {/* Payment summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      {/* Pay rent button */}
      <Skeleton className="h-12 w-full sm:w-48 rounded-lg" />
      {/* Quick links */}
      <Skeleton className="h-5 w-36" />
    </div>
  )
}
