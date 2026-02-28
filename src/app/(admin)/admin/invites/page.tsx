import { db } from "@/db"
import { units, properties, inviteTokens } from "@/db/schema"
import { eq, desc, and, isNull } from "drizzle-orm"
import { InviteManager } from "@/components/admin/InviteManager"
import { EmptyState } from "@/components/ui/empty-state"
import { Mail } from "lucide-react"

export default async function AdminInvitesPage() {
  // Fetch all active (non-archived) units with their property name
  const allUnits = await db
    .select({
      id: units.id,
      unitNumber: units.unitNumber,
      propertyName: properties.name,
      propertyId: units.propertyId,
    })
    .from(units)
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .where(and(isNull(units.archivedAt), isNull(properties.archivedAt)))
    .orderBy(units.unitNumber)

  // Fetch latest invite for each unit (pending only)
  const pendingInvites = await db
    .select({
      unitId: inviteTokens.unitId,
      status: inviteTokens.status,
      expiresAt: inviteTokens.expiresAt,
      createdAt: inviteTokens.createdAt,
    })
    .from(inviteTokens)
    .where(eq(inviteTokens.status, "pending"))
    .orderBy(desc(inviteTokens.createdAt))

  // Build unit data with invite status
  const unitsWithStatus = allUnits.map((unit) => {
    const invite = pendingInvites.find((inv) => inv.unitId === unit.id)
    return {
      id: unit.id,
      unitNumber: unit.unitNumber,
      propertyName: unit.propertyName,
      hasPendingInvite: !!invite,
      inviteExpiresAt: invite?.expiresAt?.toISOString() ?? null,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invite Tenants</h1>
        <p className="mt-1 text-sm text-gray-600">
          Generate QR code invites for each unit. Tenants scan the code to
          create their account and get linked automatically.
        </p>
      </div>
      {unitsWithStatus.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No units available for invites"
          description="Create properties and units first, then you can generate invite codes for tenants."
        />
      ) : (
        <InviteManager units={unitsWithStatus} />
      )}
    </div>
  )
}
