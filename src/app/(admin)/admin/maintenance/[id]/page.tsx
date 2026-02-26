import { AdminMaintenanceDetail } from "@/components/admin/AdminMaintenanceDetail"

export default async function AdminMaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <AdminMaintenanceDetail requestId={id} />
}
