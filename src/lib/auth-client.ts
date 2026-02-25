import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"

// forgetPassword and resetPassword exist at runtime (from emailAndPassword on server)
// but are not in the client TypeScript types because the client can't infer server config.
// We augment the type to expose them for type-safe usage in auth forms.
type PasswordMethods = {
  forgetPassword: (params: {
    email: string
    redirectTo: string
  }) => Promise<{ data: unknown; error: { message?: string; status: number } | null }>
  resetPassword: (params: {
    newPassword: string
    token: string
  }) => Promise<{ data: unknown; error: { message?: string; status: number } | null }>
}

const _authClient = createAuthClient({
  plugins: [adminClient()],
})

export const authClient = _authClient as typeof _authClient & PasswordMethods

// Convenience re-exports for common operations
export const { signIn, signUp, signOut, useSession } = authClient
