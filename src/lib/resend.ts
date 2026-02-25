import { Resend } from "resend"

// Lazy initialization to prevent build failures when RESEND_API_KEY is not yet set.
// The Resend constructor validates the API key, which breaks Next.js builds during
// page data collection if the key is missing.
let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

// For convenience, export a proxy that lazily creates the Resend instance
export const resend = new Proxy({} as Resend, {
  get(_target, prop, receiver) {
    return Reflect.get(getResend(), prop, receiver)
  },
})
