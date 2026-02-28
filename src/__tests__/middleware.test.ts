import { describe, it, expect } from "vitest"
import { getSessionCookie } from "better-auth/cookies"

describe("middleware cookie detection", () => {
  it("getSessionCookie is importable from better-auth/cookies", () => {
    expect(typeof getSessionCookie).toBe("function")
  })

  it("returns null when no session cookie is present", () => {
    const headers = new Headers()
    const result = getSessionCookie(headers)
    expect(result).toBeNull()
  })

  it("detects unprefixed session cookie (development)", () => {
    const headers = new Headers()
    headers.set("cookie", "better-auth.session_token=test-session-value")
    const result = getSessionCookie(headers)
    expect(result).toBe("test-session-value")
  })

  it("detects __Secure- prefixed session cookie (production HTTPS)", () => {
    const headers = new Headers()
    headers.set("cookie", "__Secure-better-auth.session_token=secure-session-value")
    const result = getSessionCookie(headers)
    expect(result).toBe("secure-session-value")
  })
})
