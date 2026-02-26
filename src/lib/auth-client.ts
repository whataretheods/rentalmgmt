import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [adminClient()],
})

// Convenience re-exports for common operations
export const { signIn, signUp, signOut, useSession } = authClient
