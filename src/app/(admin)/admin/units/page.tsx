import { db } from "@/db"
import { units, properties } from "@/db/schema"
import { eq } from "drizzle-orm"
import { RentConfigForm } from "@/components/admin/RentConfigForm"

export default async function AdminUnitsPage() {
  // Fetch all units with their property info
  const allUnits = await db
    .select({
      id: units.id,
      unitNumber: units.unitNumber,
      rentAmountCents: units.rentAmountCents,
      rentDueDay: units.rentDueDay,
      propertyName: properties.name,
      propertyAddress: properties.address,
    })
    .from(units)
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .orderBy(units.unitNumber)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Units & Rent Configuration</h1>
      <p className="mt-2 text-gray-600">
        Set the rent amount and due date for each unit. Tenants will see this amount when paying rent.
      </p>

      <div className="mt-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm font-medium text-gray-500">
              <th className="pb-3 pr-4">Unit</th>
              <th className="pb-3 pr-4">Property</th>
              <th className="pb-3 pr-4">Current Rent</th>
              <th className="pb-3">Configuration</th>
            </tr>
          </thead>
          <tbody>
            {allUnits.map((unit) => (
              <tr key={unit.id} className="border-b">
                <td className="py-4 pr-4 font-medium">{unit.unitNumber}</td>
                <td className="py-4 pr-4 text-gray-600">{unit.propertyName}</td>
                <td className="py-4 pr-4">
                  {unit.rentAmountCents != null ? (
                    <span className="text-gray-900">
                      ${(unit.rentAmountCents / 100).toFixed(2)} / due day {unit.rentDueDay}
                    </span>
                  ) : (
                    <span className="text-amber-600 text-sm">Not configured</span>
                  )}
                </td>
                <td className="py-4">
                  <RentConfigForm
                    unitId={unit.id}
                    initialAmountCents={unit.rentAmountCents}
                    initialDueDay={unit.rentDueDay}
                  />
                </td>
              </tr>
            ))}
            {allUnits.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  No units found. Add properties and units first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
