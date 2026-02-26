import { config } from "dotenv"
config({ path: ".env.local" })
import { db } from "@/db"
import { tenantUnits } from "@/db/schema"
import { user } from "@/db/schema/auth"
import { eq } from "drizzle-orm"

async function main() {
  const rows = await db
    .select({
      userId: tenantUnits.userId,
      unitId: tenantUnits.unitId,
      isActive: tenantUnits.isActive,
    })
    .from(tenantUnits)

  console.log("tenant_units rows:", JSON.stringify(rows, null, 2))

  for (const row of rows) {
    const [u] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, row.userId))
    if (u) console.log("  Linked user:", u.email, "(", u.name, ")")
  }

  process.exit(0)
}

main()
