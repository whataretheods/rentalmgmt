import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { charges, tenantUnits } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { z } from "zod"

const chargeSchema = z.object({
  tenantUserId: z.string().min(1),
  unitId: z.string().uuid(),
  type: z.enum(["rent", "late_fee", "one_time", "credit", "adjustment"]),
  description: z.string().min(1).max(500),
  amountCents: z.number().int().min(1).max(10000000), // Always positive — sign is determined by type
  billingPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(), // Required for rent, optional for others
})

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = chargeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { tenantUserId, unitId, type, description, amountCents, billingPeriod } =
    parsed.data

  // For rent charges, billingPeriod is required
  if (type === "rent" && !billingPeriod) {
    return NextResponse.json(
      { error: "billingPeriod is required for rent charges" },
      { status: 400 }
    )
  }

  // Verify the tenant has an active tenancy for the given unit
  const [activeTenancy] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, tenantUserId),
        eq(tenantUnits.unitId, unitId),
        eq(tenantUnits.isActive, true)
      )
    )
    .limit(1)

  if (!activeTenancy) {
    return NextResponse.json(
      { error: "No active tenancy for this tenant/unit combination" },
      { status: 400 }
    )
  }

  // Credits and adjustments are stored as negative amountCents
  const storedAmountCents =
    type === "credit" || type === "adjustment" ? -amountCents : amountCents

  const [charge] = await db
    .insert(charges)
    .values({
      tenantUserId,
      unitId,
      type,
      description,
      amountCents: storedAmountCents,
      billingPeriod: billingPeriod || null,
      createdBy: session.user.id,
    })
    .returning()

  return NextResponse.json({ charge }, { status: 201 })
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const tenantUserId = url.searchParams.get("tenantUserId")

  if (!tenantUserId) {
    return NextResponse.json(
      { error: "tenantUserId query parameter is required" },
      { status: 400 }
    )
  }

  const unitId = url.searchParams.get("unitId")

  const conditions = [eq(charges.tenantUserId, tenantUserId)]
  if (unitId) {
    conditions.push(eq(charges.unitId, unitId))
  }

  const result = await db
    .select()
    .from(charges)
    .where(and(...conditions))
    .orderBy(desc(charges.createdAt))
    .limit(100)

  return NextResponse.json({ charges: result })
}
