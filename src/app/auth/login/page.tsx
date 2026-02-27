import { Suspense } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/auth/LoginForm"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your email and password to access your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense>
            <LoginForm />
          </Suspense>
          <div className="text-center text-sm">
            <Link href="/auth/forgot-password" className="text-blue-600 hover:underline">
              Forgot your password?
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
