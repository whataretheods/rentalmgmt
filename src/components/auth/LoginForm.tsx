"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl")
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    setIsLoading(true)
    const { data, error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })
    setIsLoading(false)

    if (error) {
      toast.error(error.message ?? "Sign in failed. Check your credentials.")
      return
    }

    const role = (data?.user as { role?: string } | undefined)?.role
    const dest = callbackUrl
      ?? (role === "admin" ? "/admin/dashboard" : "/tenant/dashboard")
    router.push(dest)
    router.refresh()
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

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="********"
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  )
}
