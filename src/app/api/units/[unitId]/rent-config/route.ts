import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { units } from "@/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const rentConfigSchema = z.object({
  rentAmountCents: z.number().int().min(0).max(10000000),  // max $100,000
  rentDueDay: z.number().int().min(1).max(28),              // 1-28 to avoid month-end issues
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  // Auth check — admin only
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { unitId } = await params

  // Validate request body
  const body = await req.json()
  const parsed = rentConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Update unit
  const [updated] = await db
    .update(units)
    .set({
      rentAmountCents: parsed.data.rentAmountCents,
      rentDueDay: parsed.data.rentDueDay,
      updatedAt: new Date(),
    })
    .where(eq(units.id, unitId))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 })
  }

  return NextResponse.json({ unit: updated })
}
