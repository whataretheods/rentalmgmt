// Fee calculation utilities for autopay enrollment
// Card: Stripe charges 2.9% + $0.30
// ACH: Stripe charges 0.8%, capped at $5.00

export function calculateCardFee(amountCents: number): number {
  const totalCents = Math.ceil((amountCents + 30) / (1 - 0.029))
  return totalCents - amountCents
}

export function calculateAchFee(amountCents: number): number {
  const fee = Math.ceil(amountCents * 0.008)
  return Math.min(fee, 500) // capped at $5.00
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function getPaymentMethodLabel(
  type: string,
  brand: string | null,
  last4: string
): string {
  if (type === "us_bank_account") return `Bank account ****${last4}`
  return `${brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "Card"} ****${last4}`
}
