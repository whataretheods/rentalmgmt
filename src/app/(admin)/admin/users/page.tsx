import { db } from "@/db"
import { user } from "@/db/schema"
import { desc } from "drizzle-orm"
import { UserTable } from "@/components/admin/UserTable"
import { EmptyState } from "@/components/ui/empty-state"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function AdminUsersPage() {
  const users = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-600">
          All registered accounts &mdash; {users.length} total
        </p>
      </div>
      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No tenants yet"
          description="Generate an invite code to onboard your first tenant. They'll create their account and be linked to their unit automatically."
          action={
            <Button asChild>
              <Link href="/admin/invites">Generate Invite</Link>
            </Button>
          }
        />
      ) : (
        <UserTable users={users} />
      )}
    </div>
  )
}
