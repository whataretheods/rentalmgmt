"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const inviteRegisterSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type InviteRegisterValues = z.infer<typeof inviteRegisterSchema>

interface InviteRegisterFormProps {
  inviteToken: string
  unitNumber: string
}

export function InviteRegisterForm({
  inviteToken,
  unitNumber,
}: InviteRegisterFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<InviteRegisterValues>({
    resolver: zodResolver(inviteRegisterSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  async function onSubmit(values: InviteRegisterValues) {
    setIsLoading(true)
    const { error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: values.name,
      callbackURL: "/tenant/dashboard",
      // Extra field — Better Auth forwards this in the request body.
      // The after-signup hook in auth.ts reads ctx.body.inviteToken
      inviteToken: inviteToken,
    } as Parameters<typeof authClient.signUp.email>[0] & { inviteToken: string })
    setIsLoading(false)

    if (error) {
      toast.error(error.message ?? "Registration failed. Try a different email.")
      return
    }

    toast.success(`Account created! You are now linked to Unit ${unitNumber}.`)
    router.push("/tenant/dashboard")
    router.refresh()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-name">Full name</Label>
        <Input
          id="invite-name"
          placeholder="Jane Smith"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-600">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="you@example.com"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-600">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-password">Password</Label>
        <Input
          id="invite-password"
          type="password"
          placeholder="********"
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-red-600">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-confirmPassword">Confirm password</Label>
        <Input
          id="invite-confirmPassword"
          type="password"
          placeholder="********"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-red-600">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Creating account..." : "Create account"}
      </Button>
    </form>
  )
}
