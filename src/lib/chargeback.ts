import { db } from "@/db"
import { charges, maintenanceRequests, workOrders } from "@/db/schema"
import { eq } from "drizzle-orm"

/**
 * Resolve tenant from work order -> maintenance request chain
 * and post a one_time charge to their ledger.
 * Returns true if a charge was posted, false if tenant could not be resolved.
 */
export async function resolveAndPostChargeback(
  workOrderId: string,
  description: string,
  amountCents: number,
  createdBy: string
): Promise<boolean> {
  const [maintReq] = await db
    .select({
      tenantUserId: maintenanceRequests.tenantUserId,
      unitId: maintenanceRequests.unitId,
    })
    .from(maintenanceRequests)
    .innerJoin(workOrders, eq(workOrders.maintenanceRequestId, maintenanceRequests.id))
    .where(eq(workOrders.id, workOrderId))

  if (!maintReq) return false

  await db.insert(charges).values({
    tenantUserId: maintReq.tenantUserId,
    unitId: maintReq.unitId,
    type: "one_time",
    description: `Work order cost: ${description.trim()}`,
    amountCents,
    createdBy,
  })
  return true
}
