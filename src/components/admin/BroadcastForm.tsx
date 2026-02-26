"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

interface UnitOption {
  id: string
  unitNumber: string
  propertyName?: string
}

export function BroadcastForm() {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [recipientType, setRecipientType] = useState<"all" | "specific">("all")
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [channels, setChannels] = useState<{ email: boolean; sms: boolean }>({ email: true, sms: false })
  const [units, setUnits] = useState<UnitOption[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (recipientType === "specific") {
      fetchUnits()
    }
  }, [recipientType])

  async function fetchUnits() {
    try {
      const res = await fetch("/api/admin/units")
      if (res.ok) {
        const data = await res.json()
        // Handle both array and object response shapes
        const unitsList = Array.isArray(data) ? data : data.units || []
        setUnits(unitsList)
      }
    } catch {
      toast.error("Failed to load units")
    }
  }

  function toggleUnit(unitId: string) {
    setSelectedUnits((prev) =>
      prev.includes(unitId)
        ? prev.filter((id) => id !== unitId)
        : [...prev, unitId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required")
      return
    }

    const channelList: string[] = []
    if (channels.email) channelList.push("email")
    if (channels.sms) channelList.push("sms")

    if (channelList.length === 0) {
      toast.error("Select at least one channel")
      return
    }

    if (recipientType === "specific" && selectedUnits.length === 0) {
      toast.error("Select at least one unit")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          recipients: recipientType === "all" ? "all" : selectedUnits,
          channels: channelList,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to send broadcast")
      }

      const data = await res.json()
      toast.success(`Broadcast sent to ${data.sent} recipient(s)`)

      // Reset form
      setSubject("")
      setBody("")
      setRecipientType("all")
      setSelectedUnits([])
      setChannels({ email: true, sms: false })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send broadcast")
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Message subject"
          maxLength={200}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Message</Label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your message here..."
          maxLength={2000}
          required
          rows={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <p className="text-xs text-gray-500">{body.length}/2000 characters</p>
      </div>

      <div className="space-y-3">
        <Label>Recipients</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="recipientType"
              value="all"
              checked={recipientType === "all"}
              onChange={() => setRecipientType("all")}
              className="h-4 w-4"
            />
            <span className="text-sm">All Tenants</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="recipientType"
              value="specific"
              checked={recipientType === "specific"}
              onChange={() => setRecipientType("specific")}
              className="h-4 w-4"
            />
            <span className="text-sm">Specific Units</span>
          </label>
        </div>

        {recipientType === "specific" && (
          <Card>
            <CardContent className="py-3">
              {units.length === 0 ? (
                <p className="text-sm text-gray-500">Loading units...</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {units.map((unit) => (
                    <label key={unit.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUnits.includes(unit.id)}
                        onChange={() => toggleUnit(unit.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm">Unit {unit.unitNumber}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <Label>Channels</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={channels.email}
              onChange={(e) => setChannels((prev) => ({ ...prev, email: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">Email</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={channels.sms}
              onChange={(e) => setChannels((prev) => ({ ...prev, sms: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm">SMS</span>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          SMS will only be sent to tenants who have opted in to text notifications.
        </p>
      </div>

      <Button type="submit" disabled={sending} className="w-full">
        {sending ? "Sending..." : "Send Broadcast"}
      </Button>
    </form>
  )
}
