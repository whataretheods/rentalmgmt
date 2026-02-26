import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-5 w-72" />
      <div className="mt-6 grid gap-8 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-8 w-36" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
