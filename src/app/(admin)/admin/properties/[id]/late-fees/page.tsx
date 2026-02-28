import { db } from "@/db"
import { properties } from "@/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { LateFeeConfigForm } from "@/components/admin/LateFeeConfigForm"
import Link from "next/link"

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminLateFeeSettingsPage({ params }: Props) {
  const { id } = await params

  const [property] = await db
    .select({
      id: properties.id,
      name: properties.name,
    })
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1)

  if (!property) {
    notFound()
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/dashboard"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Late Fee Settings</h1>
      <p className="mt-2 text-gray-600">
        Configure automatic late fee rules for {property.name}
      </p>

      <div className="mt-6 max-w-xl">
        <LateFeeConfigForm
          propertyId={property.id}
          propertyName={property.name}
        />
      </div>
    </div>
  )
}
