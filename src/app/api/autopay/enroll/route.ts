import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { db } from "@/db"
import { tenantUnits, autopayEnrollments } from "@/db/schema/domain"
import { eq, and } from "drizzle-orm"

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify tenant has an active unit link
  const [link] = await db
    .select()
    .from(tenantUnits)
    .where(
      and(
        eq(tenantUnits.userId, session.user.id),
        eq(tenantUnits.isActive, true)
      )
    )

  if (!link) {
    return NextResponse.json(
      { error: "No active unit found" },
      { status: 400 }
    )
  }

  // Check for existing enrollment
  const [existing] = await db
    .select()
    .from(autopayEnrollments)
    .where(eq(autopayEnrollments.tenantUserId, session.user.id))

  if (existing?.status === "active") {
    return NextResponse.json(
      { error: "Already enrolled in autopay" },
      { status: 409 }
    )
  }

  // Reuse existing Stripe customer or create a new one
  let stripeCustomerId = existing?.stripeCustomerId

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name,
      metadata: { tenantUserId: session.user.id },
    })
    stripeCustomerId = customer.id
  }

  // Create SetupIntent for saving a payment method
  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card", "us_bank_account"],
  })

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    stripeCustomerId,
  })
}
