import { MaintenanceRequestDetail } from "@/components/tenant/MaintenanceRequestDetail"

export default async function MaintenanceRequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <MaintenanceRequestDetail requestId={id} />
}
