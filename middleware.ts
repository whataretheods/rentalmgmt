import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected routes
  if (!sessionCookie) {
    const isProtectedRoute =
      pathname.startsWith("/tenant") ||
      pathname.startsWith("/admin")

    if (isProtectedRoute) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Authenticated users visiting /auth/login or /auth/register -> redirect to their dashboard
  // (prevents re-login when already logged in)
  if (sessionCookie) {
    if (pathname === "/auth/login" || pathname === "/auth/register") {
      // Can't check role here (Edge runtime) -- redirect to tenant by default
      // The tenant layout handles further routing if needed
      return NextResponse.redirect(new URL("/tenant/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes except API auth routes, Next.js internals, and static files
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
