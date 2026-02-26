"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface UnitWithStatus {
  id: string
  unitNumber: string
  propertyName: string
  hasPendingInvite: boolean
  inviteExpiresAt: string | null
}

interface GeneratedInvite {
  token: string
  inviteUrl: string
  qrDataUrl: string
  expiresAt: string
  unitNumber: string
}

export function InviteManager({ units }: { units: UnitWithStatus[] }) {
  const [generating, setGenerating] = useState<string | null>(null)
  const [invite, setInvite] = useState<GeneratedInvite | null>(null)

  async function handleGenerate(unitId: string) {
    setGenerating(unitId)
    try {
      const res = await fetch("/api/invites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? "Failed to generate invite")
        return
      }

      const data: GeneratedInvite = await res.json()
      setInvite(data)
      toast.success(`Invite generated for Unit ${data.unitNumber}`)
    } catch {
      toast.error("Network error — could not generate invite")
    } finally {
      setGenerating(null)
    }
  }

  function handleCopyLink() {
    if (!invite) return
    navigator.clipboard.writeText(invite.inviteUrl)
    toast.success("Invite link copied to clipboard")
  }

  function handleDownloadQR() {
    if (!invite) return
    // Use the QR API endpoint for a clean PNG download
    const downloadUrl = `/api/invites/qr/${invite.token}`
    const a = document.createElement("a")
    a.href = downloadUrl
    a.download = `invite-${invite.token.slice(0, 8)}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      {/* Units table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Unit
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Property
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Invite Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {units.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No units found. Create units first via the seed script.
                </td>
              </tr>
            ) : (
              units.map((unit) => (
                <tr key={unit.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {unit.unitNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {unit.propertyName}
                  </td>
                  <td className="px-4 py-3">
                    {unit.hasPendingInvite ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                        Pending (expires{" "}
                        {new Date(unit.inviteExpiresAt!).toLocaleDateString()})
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        No invite
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      onClick={() => handleGenerate(unit.id)}
                      disabled={generating === unit.id}
                    >
                      {generating === unit.id
                        ? "Generating..."
                        : "Generate Invite"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Generated invite display */}
      {invite && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Invite for Unit {invite.unitNumber}
          </h2>
          <p className="text-sm text-gray-600">
            This QR code and link are valid until{" "}
            {new Date(invite.expiresAt).toLocaleDateString()}. Print or share
            with the tenant.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/* QR Code preview */}
            <div className="shrink-0">
              <img
                src={invite.qrDataUrl}
                alt={`QR code for Unit ${invite.unitNumber}`}
                className="h-48 w-48 rounded border"
              />
            </div>

            {/* Link and actions */}
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">
                  Invite Link
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={invite.inviteUrl}
                    className="flex-1 rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700 font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button size="sm" variant="outline" onClick={handleCopyLink}>
                    Copy
                  </Button>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleDownloadQR}>
                Download QR Code
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
