import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { units } from "@/db/schema"
import { asc } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const allUnits = await db
    .select({
      id: units.id,
      unitNumber: units.unitNumber,
    })
    .from(units)
    .orderBy(asc(units.unitNumber))

  return NextResponse.json({ units: allUnits })
}
