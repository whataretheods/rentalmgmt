import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { vendors } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get("status")

  const conditions = []
  if (statusFilter) {
    conditions.push(eq(vendors.status, statusFilter as "active" | "inactive"))
  }

  const result = await db
    .select()
    .from(vendors)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(vendors.createdAt))

  return NextResponse.json({ vendors: result })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { companyName, contactName, email, phone, specialty, notes } = body

  if (!companyName || typeof companyName !== "string" || companyName.trim() === "") {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 })
  }

  const validSpecialties = [
    "plumbing", "electrical", "hvac", "appliance", "pest_control",
    "general_maintenance", "painting", "cleaning", "landscaping", "other",
  ]
  if (specialty && !validSpecialties.includes(specialty)) {
    return NextResponse.json({ error: "Invalid specialty" }, { status: 400 })
  }

  const [vendor] = await db
    .insert(vendors)
    .values({
      companyName: companyName.trim(),
      contactName: contactName?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      specialty: specialty || null,
      notes: notes?.trim() || null,
    })
    .returning()

  return NextResponse.json({ vendor }, { status: 201 })
}
