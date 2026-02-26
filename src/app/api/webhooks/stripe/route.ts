import { Stripe } from "stripe"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { db } from "@/db"
import { payments, units, user } from "@/db/schema"
import { eq } from "drizzle-orm"
import { resend } from "@/lib/resend"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export async function POST(req: Request) {
  let event: Stripe.Event

  try {
    const stripeSignature = (await headers()).get("stripe-signature")
    event = stripe.webhooks.constructEvent(
      await req.text(),
      stripeSignature as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Webhook signature verification failed:", errorMessage)
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const { tenantUserId, unitId, billingPeriod } = session.metadata || {}

        if (!tenantUserId || !unitId || !billingPeriod) {
          console.error(
            "Missing metadata in checkout session:",
            session.id
          )
          break
        }

        if (session.payment_status === "paid") {
          // Card payment — immediately confirmed
          await db
            .insert(payments)
            .values({
              tenantUserId,
              unitId,
              amountCents: session.amount_total!,
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent as string,
              paymentMethod: "card",
              status: "succeeded",
              billingPeriod,
              paidAt: new Date(),
            })
            .onConflictDoNothing() // idempotent — stripeSessionId is unique

          // Send confirmation email
          await sendPaymentConfirmation(
            tenantUserId,
            unitId,
            session.amount_total!,
            billingPeriod
          )
        } else if (session.payment_status === "unpaid") {
          // ACH — pending bank verification/settlement (3-5 business days)
          await db
            .insert(payments)
            .values({
              tenantUserId,
              unitId,
              amountCents: session.amount_total!,
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent as string,
              paymentMethod: "ach",
              status: "pending",
              billingPeriod,
            })
            .onConflictDoNothing()
        }
        break
      }

      case "checkout.session.async_payment_succeeded": {
        // ACH payment settled successfully
        const session = event.data.object as Stripe.Checkout.Session
        const { tenantUserId, unitId, billingPeriod } = session.metadata || {}

        await db
          .update(payments)
          .set({
            status: "succeeded",
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payments.stripeSessionId, session.id))

        if (tenantUserId && unitId && billingPeriod) {
          await sendPaymentConfirmation(
            tenantUserId,
            unitId,
            session.amount_total!,
            billingPeriod
          )
        }
        break
      }

      case "checkout.session.async_payment_failed": {
        // ACH payment failed
        const session = event.data.object as Stripe.Checkout.Session
        await db
          .update(payments)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(payments.stripeSessionId, session.id))
        break
      }

      default:
        // Unhandled event type — log but don't error
        console.log("Unhandled webhook event type:", event.type)
    }
  } catch (err) {
    console.error("Webhook handler error:", err)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true }, { status: 200 })
}

// Helper: send payment confirmation email
async function sendPaymentConfirmation(
  tenantUserId: string,
  unitId: string,
  amountCents: number,
  billingPeriod: string
) {
  try {
    // Fetch user email using Drizzle schema (type-safe, no SQL injection risk)
    const [tenantUser] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, tenantUserId))

    if (!tenantUser?.email) {
      console.warn(
        "Could not find user email for payment confirmation:",
        tenantUserId
      )
      return
    }

    // Fetch unit number
    const [unit] = await db
      .select()
      .from(units)
      .where(eq(units.id, unitId))
    const unitNumber = unit?.unitNumber || "Unknown"

    const amount = `$${(amountCents / 100).toFixed(2)}`

    // Fire and forget email — do NOT let email failure block webhook response
    void resend.emails.send({
      from: "RentalMgmt <noreply@rentalmgmt.com>",
      to: tenantUser.email,
      subject: "Payment Confirmation",
      html: `
        <h2>Payment Confirmed</h2>
        <p>Hi ${tenantUser.name || "Tenant"},</p>
        <p>Your rent payment has been received and confirmed.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">Amount</td><td style="font-weight: bold;">${amount}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">Unit</td><td style="font-weight: bold;">${unitNumber}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">Period</td><td style="font-weight: bold;">${billingPeriod}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #666;">Date</td><td style="font-weight: bold;">${new Date().toLocaleDateString()}</td></tr>
        </table>
        <p style="color: #666; font-size: 14px;">Thank you for your payment.</p>
      `,
    })
  } catch (err) {
    // Email failures should NOT block webhook processing
    console.error("Failed to send payment confirmation email:", err)
  }
}
