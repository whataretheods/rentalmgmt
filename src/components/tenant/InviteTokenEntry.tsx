"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function InviteTokenEntry() {
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/invites/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Invalid invite code")

      toast.success(`Successfully linked to Unit ${data.unitNumber}!`)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Welcome!</CardTitle>
        <CardDescription>
          Enter the invite code from your landlord to connect your account to
          your unit and access all tenant features.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Enter invite code"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={loading}
              className="font-mono"
            />
            <p className="mt-1 text-xs text-gray-500">
              This code was provided in your welcome letter or by your property
              manager.
            </p>
          </div>
          <Button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full"
          >
            {loading ? "Linking..." : "Link to Unit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
