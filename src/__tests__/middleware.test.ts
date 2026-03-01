import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth module before importing middleware
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}))

import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"

// Dynamically import middleware after mocks are set up
const { middleware } = await import("@/middleware")

function createRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"))
}

describe("middleware session validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("tenant routes", () => {
    it("allows access with valid session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "t1", role: "user", email: "tenant@test.com", name: "Tenant" },
        session: { id: "s1" },
      } as never)

      const response = await middleware(createRequest("/tenant/dashboard"))
      // NextResponse.next() has no Location header
      expect(response.headers.get("Location")).toBeNull()
    })

    it("redirects to login with callbackUrl when session is null (expired/revoked)", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never)

      const response = await middleware(createRequest("/tenant/dashboard"))
      const location = response.headers.get("Location")
      expect(location).toContain("/auth/login")
      expect(location).toContain("callbackUrl=%2Ftenant%2Fdashboard")
    })

    it("redirects to login for nested tenant routes when session is invalid", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never)

      const response = await middleware(createRequest("/tenant/payments/history"))
      const location = response.headers.get("Location")
      expect(location).toContain("/auth/login")
      expect(location).toContain("callbackUrl=%2Ftenant%2Fpayments%2Fhistory")
    })
  })

  describe("admin routes", () => {
    it("allows access with valid admin session", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "a1", role: "admin", email: "admin@test.com", name: "Admin" },
        session: { id: "s2" },
      } as never)

      const response = await middleware(createRequest("/admin/dashboard"))
      expect(response.headers.get("Location")).toBeNull()
    })

    it("redirects non-admin to tenant dashboard", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "t1", role: "user", email: "tenant@test.com", name: "Tenant" },
        session: { id: "s3" },
      } as never)

      const response = await middleware(createRequest("/admin/dashboard"))
      const location = response.headers.get("Location")
      expect(location).toContain("/tenant/dashboard")
    })

    it("redirects to login when admin session is null", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never)

      const response = await middleware(createRequest("/admin/settings"))
      const location = response.headers.get("Location")
      expect(location).toContain("/auth/login")
      expect(location).toContain("callbackUrl=%2Fadmin%2Fsettings")
    })
  })

  describe("non-protected routes", () => {
    it("passes through for non-admin/non-tenant routes", async () => {
      const response = await middleware(createRequest("/auth/login"))
      expect(response.headers.get("Location")).toBeNull()
      // getSession should not be called for non-protected routes
      expect(auth.api.getSession).not.toHaveBeenCalled()
    })
  })
})
