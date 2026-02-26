"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
})

type ForgotValues = z.infer<typeof forgotSchema>

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: ForgotValues) {
    setIsLoading(true)
    await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/auth/reset-password",
    })
    setIsLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <p className="text-sm text-gray-600 text-center">
        If that email is registered, you will receive a password reset link shortly.
      </p>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  )
}
