import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { db } from "@/db"
import { units, tenantUnits } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const checkoutSchema = z.object({
  unitId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(10000000), // $0.01 to $100,000
})

export async function POST(req: Request) {
  // Auth check — tenant must be logged in
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { unitId, amountCents } = parsed.data

  // Verify tenant is linked to this unit
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.unitId, unitId),
        eq(tenantUnits.isActive, true)
      )
    )

  if (!link) {
    return NextResponse.json(
      { error: "Not linked to this unit" },
      { status: 403 }
    )
  }

  // Get unit details for checkout display
  const [unit] = await db.select().from(units).where(eq(units.id, unitId))
  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 })
  }

  const origin = req.headers.get("origin") || "http://localhost:3000"
  const billingPeriod = new Date().toISOString().slice(0, 7) // "2026-03"

  // Create Stripe Checkout Session
  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "us_bank_account"],
    mode: "payment",
    customer_email: session.user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Rent - Unit ${unit.unitNumber}`,
            description: `Rent payment for ${billingPeriod}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      tenantUserId: session.user.id,
      unitId: unitId,
      billingPeriod: billingPeriod,
    },
    success_url: `${origin}/tenant/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/tenant/dashboard`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
