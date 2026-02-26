"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"
import { User, Phone, Mail, Shield } from "lucide-react"

interface ProfileData {
  name: string
  email: string
  phone: string | null
  emergencyContact: {
    contactName: string
    contactPhone: string
  } | null
}

export function ProfileForm() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileData | null>(null)

  // Personal info form state
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [savingPersonal, setSavingPersonal] = useState(false)

  // Email change form state
  const [newEmail, setNewEmail] = useState("")
  const [showEmailChange, setShowEmailChange] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  // Emergency contact form state
  const [ecName, setEcName] = useState("")
  const [ecPhone, setEcPhone] = useState("")
  const [savingEmergency, setSavingEmergency] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile")
      if (!res.ok) throw new Error("Failed to load profile")
      const data: ProfileData = await res.json()
      setProfile(data)
      setName(data.name)
      setPhone(data.phone ?? "")
      setEcName(data.emergencyContact?.contactName ?? "")
      setEcPhone(data.emergencyContact?.contactPhone ?? "")
    } catch {
      toast.error("Failed to load profile data")
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePersonal(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSavingPersonal(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update")
      }
      const data: ProfileData = await res.json()
      setProfile(data)
      toast.success("Personal information updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update personal information")
    } finally {
      setSavingPersonal(false)
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim()) {
      toast.error("Please enter a new email address")
      return
    }
    setSavingEmail(true)
    try {
      const result = await authClient.changeEmail({
        newEmail: newEmail.trim(),
        callbackURL: "/tenant/profile",
      })
      if (result.error) {
        throw new Error(result.error.message || "Failed to change email")
      }
      toast.success(`Verification email sent to ${newEmail.trim()}`)
      setNewEmail("")
      setShowEmailChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change email")
    } finally {
      setSavingEmail(false)
    }
  }

  async function handleSaveEmergency(e: React.FormEvent) {
    e.preventDefault()
    if (!ecName.trim() || !ecPhone.trim()) {
      toast.error("Both contact name and phone are required")
      return
    }
    setSavingEmergency(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emergencyContact: {
            contactName: ecName.trim(),
            contactPhone: ecPhone.trim(),
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update")
      }
      const data: ProfileData = await res.json()
      setProfile(data)
      toast.success("Emergency contact updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update emergency contact")
    } finally {
      setSavingEmergency(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-9 bg-gray-200 rounded mb-3" />
              <div className="h-9 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!profile) {
    return <p className="text-gray-600">Unable to load profile data.</p>
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Personal Information
          </CardTitle>
          <CardDescription>Update your name and phone number</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePersonal} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-gray-500 shrink-0" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <Button type="submit" disabled={savingPersonal}>
              {savingPersonal ? "Saving..." : "Save Personal Info"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Email Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            Email Address
          </CardTitle>
          <CardDescription>
            Your current email: <span className="font-medium text-gray-900">{profile.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showEmailChange ? (
            <Button variant="outline" onClick={() => setShowEmailChange(true)}>
              Change Email Address
            </Button>
          ) : (
            <form onSubmit={handleChangeEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail">New Email Address</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  required
                />
                <p className="text-xs text-gray-500">
                  A verification email will be sent to the new address. Your email will not change until you verify it.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={savingEmail}>
                  {savingEmail ? "Sending..." : "Send Verification Email"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEmailChange(false)
                    setNewEmail("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Emergency Contact
          </CardTitle>
          <CardDescription>
            Someone we can reach in case of an emergency at your unit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveEmergency} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ecName">Contact Name</Label>
              <Input
                id="ecName"
                type="text"
                value={ecName}
                onChange={(e) => setEcName(e.target.value)}
                placeholder="Contact full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ecPhone">Contact Phone</Label>
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-gray-500 shrink-0" />
                <Input
                  id="ecPhone"
                  type="tel"
                  value={ecPhone}
                  onChange={(e) => setEcPhone(e.target.value)}
                  placeholder="(555) 987-6543"
                />
              </div>
            </div>
            <Button type="submit" disabled={savingEmergency}>
              {savingEmergency ? "Saving..." : "Save Emergency Contact"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
