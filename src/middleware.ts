import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin routes: full session validation with role check
  if (pathname.startsWith("/admin")) {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/tenant/dashboard", request.url))
    }

    return NextResponse.next()
  }

  // Tenant routes: lightweight cookie check (full validation in page components)
  if (pathname.startsWith("/tenant")) {
    const sessionCookie = request.cookies.get("better-auth.session_token")

    if (!sessionCookie) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }

  // All other routes: pass through
  return NextResponse.next()
}

export const config = {
  runtime: "nodejs", // Stable in Next.js 15.5 — allows auth.api.getSession()
  matcher: [
    // Match page routes only. Exclude API routes, static files, images, favicon.
    // API routes handle their own auth — middleware would double the latency cost.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
