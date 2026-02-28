import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { properties, units } from "@/db/schema/domain"
import { isNull, count, sql } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      timezone: properties.timezone,
      createdAt: properties.createdAt,
      updatedAt: properties.updatedAt,
      unitCount: count(units.id),
    })
    .from(properties)
    .leftJoin(
      units,
      sql`${units.propertyId} = ${properties.id} AND ${units.archivedAt} IS NULL`
    )
    .where(isNull(properties.archivedAt))
    .groupBy(properties.id)
    .orderBy(properties.name)

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { name?: string; address?: string; timezone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { name, address } = body
  if (!name?.trim() || !address?.trim()) {
    return NextResponse.json(
      { error: "Name and address are required" },
      { status: 400 }
    )
  }

  const [property] = await db
    .insert(properties)
    .values({
      name: name.trim(),
      address: address.trim(),
      ...(body.timezone?.trim() ? { timezone: body.timezone.trim() } : {}),
    })
    .returning()

  return NextResponse.json(property, { status: 201 })
}
