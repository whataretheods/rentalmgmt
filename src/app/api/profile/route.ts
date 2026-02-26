import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { user as userTable } from "@/db/schema/auth"
import { emergencyContacts } from "@/db/schema/domain"
import { eq } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get user record for phone field (session.user may not include additionalFields)
  const [userData] = await db
    .select({
      name: userTable.name,
      email: userTable.email,
      phone: userTable.phone,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))

  // Get emergency contact
  const [ec] = await db
    .select({
      contactName: emergencyContacts.contactName,
      contactPhone: emergencyContacts.contactPhone,
    })
    .from(emergencyContacts)
    .where(eq(emergencyContacts.userId, session.user.id))

  return NextResponse.json({
    name: userData?.name ?? "",
    email: userData?.email ?? session.user.email,
    phone: userData?.phone ?? null,
    emergencyContact: ec ? { contactName: ec.contactName, contactPhone: ec.contactPhone } : null,
  })
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    name?: string
    phone?: string | null
    emergencyContact?: { contactName: string; contactPhone: string }
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Validate inputs
  if (body.name !== undefined && typeof body.name === "string" && body.name.trim() === "") {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
  }

  // Update name and/or phone on user table
  const userUpdate: Record<string, unknown> = {}
  if (body.name !== undefined) {
    userUpdate.name = body.name.trim()
  }
  if (body.phone !== undefined) {
    userUpdate.phone = body.phone ? body.phone.trim() : null
  }

  if (Object.keys(userUpdate).length > 0) {
    userUpdate.updatedAt = new Date()
    await db.update(userTable).set(userUpdate).where(eq(userTable.id, session.user.id))
  }

  // Upsert emergency contact
  if (body.emergencyContact) {
    const { contactName, contactPhone } = body.emergencyContact

    if (!contactName || !contactPhone) {
      return NextResponse.json(
        { error: "Emergency contact requires both name and phone" },
        { status: 400 }
      )
    }

    await db
      .insert(emergencyContacts)
      .values({
        userId: session.user.id,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
      })
      .onConflictDoUpdate({
        target: emergencyContacts.userId,
        set: {
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          updatedAt: new Date(),
        },
      })
  }

  // Return updated profile
  const [updatedUser] = await db
    .select({
      name: userTable.name,
      email: userTable.email,
      phone: userTable.phone,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))

  const [ec] = await db
    .select({
      contactName: emergencyContacts.contactName,
      contactPhone: emergencyContacts.contactPhone,
    })
    .from(emergencyContacts)
    .where(eq(emergencyContacts.userId, session.user.id))

  return NextResponse.json({
    name: updatedUser?.name ?? "",
    email: updatedUser?.email ?? session.user.email,
    phone: updatedUser?.phone ?? null,
    emergencyContact: ec ? { contactName: ec.contactName, contactPhone: ec.contactPhone } : null,
  })
}
