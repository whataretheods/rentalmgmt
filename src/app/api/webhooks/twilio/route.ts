import { NextResponse } from "next/server"
import twilio from "twilio"
import { db } from "@/db"
import { user } from "@/db/schema/auth"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  // Parse form-encoded body from Twilio
  const formData = await req.formData()
  const params: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    params[key] = value.toString()
  }

  // Validate Twilio request signature
  const signature = req.headers.get("x-twilio-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 403 })
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`
  const isValid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    webhookUrl,
    params
  )

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  // Handle STOP/START opt-out keywords
  const optOutType = params.OptOutType
  const fromPhone = params.From

  if (optOutType === "STOP" && fromPhone) {
    await db
      .update(user)
      .set({ smsOptIn: false, updatedAt: new Date() })
      .where(eq(user.phone, fromPhone))
  } else if (optOutType === "START" && fromPhone) {
    await db
      .update(user)
      .set({
        smsOptIn: true,
        smsOptInAt: new Date().toISOString(),
        updatedAt: new Date(),
      })
      .where(eq(user.phone, fromPhone))
  }
  // HELP and other keywords: no-op (Twilio handles HELP response automatically)

  // Return empty TwiML response
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "text/xml" } }
  )
}
