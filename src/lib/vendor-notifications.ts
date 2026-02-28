import { resend } from "@/lib/resend"
import { getTwilioClient } from "@/lib/twilio"

interface VendorContact {
  email: string | null
  phone: string | null
  companyName: string
}

/**
 * Notify a vendor that they have been assigned to a work order.
 * Sends email and/or SMS directly (fire-and-forget).
 * Vendors have no user accounts, so we cannot use sendNotification().
 */
export async function notifyVendorAssignment(
  vendor: VendorContact,
  workOrderUrl: string,
  requestSummary: string
): Promise<void> {
  const emailFrom = process.env.EMAIL_FROM || "RentalMgmt <noreply@rentalmgmt.com>"

  // Email notification (if vendor has email)
  if (vendor.email) {
    try {
      void resend.emails.send({
        from: emailFrom,
        to: vendor.email,
        subject: "New Work Order Assignment - RentalMgmt",
        html: `
          <h2>New Work Order Assignment</h2>
          <p>Hello ${vendor.companyName},</p>
          <p>You have been assigned a new work order:</p>
          <p><strong>${requestSummary}</strong></p>
          <p><a href="${workOrderUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">View Work Order Details</a></p>
          <p style="color:#6b7280;font-size:0.875rem;">This link provides access to the work order details. No login required.</p>
        `,
      })
    } catch (err) {
      console.error("Failed to send vendor email notification:", err)
    }
  }

  // SMS notification (if vendor has phone)
  if (vendor.phone) {
    try {
      void getTwilioClient().messages.create({
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
        to: vendor.phone,
        body: `RentalMgmt: New work order assigned - ${requestSummary}. View details: ${workOrderUrl}`,
      })
    } catch (err) {
      console.error("Failed to send vendor SMS notification:", err)
    }
  }
}
