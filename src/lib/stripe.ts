import Stripe from "stripe"

// Lazy initialization to prevent build failures when STRIPE_SECRET_KEY is not yet set.
// Matches the pattern used by db (src/db/index.ts) and resend (src/lib/resend.ts).
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Please set it in .env.local to your Stripe secret key."
      )
    }
    _stripe = new Stripe(secretKey)
  }
  return _stripe
}

// Export a proxy that lazily creates the Stripe instance on first access.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver)
  },
})
