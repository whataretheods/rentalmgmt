import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { payments, units } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { renderToBuffer } from "@react-pdf/renderer"
import { ReceiptDocument } from "@/lib/pdf/receipt"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { paymentId } = await params

  // Fetch payment — must belong to the logged-in tenant
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantUserId, session.user.id)))

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  if (payment.status !== "succeeded") {
    return NextResponse.json({ error: "Receipt only available for completed payments" }, { status: 400 })
  }

  // Fetch unit info
  const [unit] = await db.select().from(units).where(eq(units.id, payment.unitId))

  // Generate PDF
  const pdfBuffer = await renderToBuffer(
    ReceiptDocument({
      receiptId: payment.id,
      unitNumber: unit?.unitNumber || "Unknown",
      amount: `$${(payment.amountCents / 100).toFixed(2)}`,
      paymentMethod: payment.paymentMethod === "ach" ? "ACH Bank Transfer" : payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1),
      billingPeriod: payment.billingPeriod,
      date: payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : new Date(payment.createdAt).toLocaleDateString(),
      status: "Paid",
    })
  )

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${payment.id.slice(0, 8)}.pdf"`,
    },
  })
}
