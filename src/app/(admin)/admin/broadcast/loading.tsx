import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-5 w-72" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-32 w-full rounded-md" />
        <Skeleton className="h-10 w-full sm:w-32 rounded-md" />
      </div>
    </div>
  )
}
