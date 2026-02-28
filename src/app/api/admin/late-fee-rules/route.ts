import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { lateFeeRules } from "@/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const lateFeeRuleSchema = z.object({
  propertyId: z.string().uuid(),
  enabled: z.boolean(),
  gracePeriodDays: z.number().int().min(1, "Grace period must be at least 1 day"),
  feeType: z.enum(["flat", "percentage"]),
  feeAmountCents: z.number().int().min(1, "Fee amount must be greater than 0"),
  maxFeeAmountCents: z.number().int().min(1).nullable().optional(),
})

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const propertyId = url.searchParams.get("propertyId")

  if (!propertyId) {
    return NextResponse.json(
      { error: "propertyId query parameter is required" },
      { status: 400 }
    )
  }

  const [rule] = await db
    .select()
    .from(lateFeeRules)
    .where(eq(lateFeeRules.propertyId, propertyId))
    .limit(1)

  return NextResponse.json({ rule: rule ?? null })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = lateFeeRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { propertyId, enabled, gracePeriodDays, feeType, feeAmountCents, maxFeeAmountCents } =
    parsed.data

  // Upsert: insert or update on conflict of propertyId (unique constraint)
  const [rule] = await db
    .insert(lateFeeRules)
    .values({
      propertyId,
      enabled,
      gracePeriodDays,
      feeType,
      feeAmountCents,
      maxFeeAmountCents: maxFeeAmountCents ?? null,
    })
    .onConflictDoUpdate({
      target: lateFeeRules.propertyId,
      set: {
        enabled,
        gracePeriodDays,
        feeType,
        feeAmountCents,
        maxFeeAmountCents: maxFeeAmountCents ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()

  return NextResponse.json({ rule })
}
