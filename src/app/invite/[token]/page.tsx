import { db } from "@/db"
import { inviteTokens, units } from "@/db/schema"
import { hashToken } from "@/lib/tokens"
import { eq } from "drizzle-orm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InviteRegisterForm } from "@/components/auth/InviteRegisterForm"
import Link from "next/link"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const tokenHash = hashToken(token)

  // Look up invite by hash
  const [invite] = await db
    .select({
      id: inviteTokens.id,
      unitId: inviteTokens.unitId,
      status: inviteTokens.status,
      expiresAt: inviteTokens.expiresAt,
    })
    .from(inviteTokens)
    .where(eq(inviteTokens.tokenHash, tokenHash))
    .limit(1)

  // State 4: Invalid token (not found)
  if (!invite) {
    return (
      <InviteLayout>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invalid invite link</CardTitle>
            <CardDescription>
              This invite link is not recognized. Please contact your property
              manager for a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/auth/login"
              className="text-sm text-blue-600 hover:underline"
            >
              Already have an account? Sign in
            </Link>
          </CardContent>
        </Card>
      </InviteLayout>
    )
  }

  // State 2: Used token
  if (invite.status === "used") {
    return (
      <InviteLayout>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invite already used</CardTitle>
            <CardDescription>
              This invite has already been used to create an account. Each invite
              can only be used once.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/auth/login"
              className="text-sm text-blue-600 hover:underline"
            >
              Sign in to your account
            </Link>
          </CardContent>
        </Card>
      </InviteLayout>
    )
  }

  // State 3: Expired token
  const now = new Date()
  if (invite.expiresAt < now) {
    return (
      <InviteLayout>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invite expired</CardTitle>
            <CardDescription>
              This invite link has expired. Please contact your property manager
              for a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/auth/login"
              className="text-sm text-blue-600 hover:underline"
            >
              Already have an account? Sign in
            </Link>
          </CardContent>
        </Card>
      </InviteLayout>
    )
  }

  // Fetch unit info for display
  const [unit] = await db
    .select({ unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.id, invite.unitId))
    .limit(1)

  // State 1: Valid token — show registration form
  return (
    <InviteLayout>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            You are registering for Unit {unit?.unitNumber ?? "Unknown"}. Create
            your account to access the tenant portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InviteRegisterForm
            inviteToken={token}
            unitNumber={unit?.unitNumber ?? "Unknown"}
          />
          <div className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-blue-600 hover:underline"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </InviteLayout>
  )
}

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      {children}
    </div>
  )
}
