import { db } from "@/db"
import { workOrders, maintenanceRequests, maintenancePhotos, units } from "@/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"

export default async function VendorWorkOrderPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Look up work order by vendor access token
  const [workOrder] = await db
    .select({
      id: workOrders.id,
      maintenanceRequestId: workOrders.maintenanceRequestId,
      status: workOrders.status,
      priority: workOrders.priority,
      scheduledDate: workOrders.scheduledDate,
      notes: workOrders.notes,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .where(eq(workOrders.vendorAccessToken, token))

  if (!workOrder) {
    notFound()
  }

  // Fetch maintenance request details (NO tenant PII -- no join to user table)
  const [maintReq] = await db
    .select({
      id: maintenanceRequests.id,
      category: maintenanceRequests.category,
      description: maintenanceRequests.description,
      status: maintenanceRequests.status,
      unitId: maintenanceRequests.unitId,
      createdAt: maintenanceRequests.createdAt,
    })
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.id, workOrder.maintenanceRequestId))

  // Fetch unit number only (no tenant info)
  const [unit] = maintReq
    ? await db
        .select({ unitNumber: units.unitNumber })
        .from(units)
        .where(eq(units.id, maintReq.unitId))
    : [null]

  // Fetch photos
  const photos = maintReq
    ? await db
        .select({
          id: maintenancePhotos.id,
          fileName: maintenancePhotos.fileName,
        })
        .from(maintenancePhotos)
        .where(eq(maintenancePhotos.requestId, maintReq.id))
    : []

  const statusColors: Record<string, string> = {
    assigned: "bg-blue-100 text-blue-800",
    scheduled: "bg-purple-100 text-purple-800",
    in_progress: "bg-orange-100 text-orange-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-600",
  }

  const priorityColors: Record<string, string> = {
    low: "bg-gray-100 text-gray-600",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    emergency: "bg-red-100 text-red-800",
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">RentalMgmt</h1>
        <p className="text-sm text-gray-500">Work Order Details</p>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Work Order Status */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Work Order</h2>
          <div className="flex gap-3 mb-4">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                statusColors[workOrder.status] || "bg-gray-100 text-gray-600"
              }`}
            >
              {workOrder.status.replace("_", " ")}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                priorityColors[workOrder.priority] || "bg-gray-100 text-gray-600"
              }`}
            >
              {workOrder.priority} priority
            </span>
          </div>
          {workOrder.scheduledDate && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Scheduled:</span>{" "}
              {new Date(workOrder.scheduledDate).toLocaleDateString()}
            </p>
          )}
          {workOrder.notes && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700">Notes:</p>
              <p className="text-sm text-gray-600 mt-1">{workOrder.notes}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">
            Created: {new Date(workOrder.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Maintenance Request Details */}
        {maintReq && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">
              Maintenance Request Details
            </h2>
            <div className="space-y-3">
              <p>
                <span className="font-medium text-gray-700">Category:</span>{" "}
                <span className="capitalize">{maintReq.category}</span>
              </p>
              <p>
                <span className="font-medium text-gray-700">Unit:</span>{" "}
                {unit?.unitNumber || "-"}
              </p>
              <div>
                <p className="font-medium text-gray-700">Description:</p>
                <p className="mt-1 text-gray-600">{maintReq.description}</p>
              </div>
              <p>
                <span className="font-medium text-gray-700">
                  Request Status:
                </span>{" "}
                <span className="capitalize">{maintReq.status}</span>
              </p>
              <p className="text-xs text-gray-400">
                Submitted:{" "}
                {new Date(maintReq.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Photos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo) => (
                <img
                  key={photo.id}
                  src={`/api/vendor/photos/${token}/${photo.id}`}
                  alt={photo.fileName}
                  className="w-full h-32 object-cover rounded border"
                />
              ))}
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-gray-400 pb-8">
          Powered by RentalMgmt
        </footer>
      </main>
    </div>
  )
}
