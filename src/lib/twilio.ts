import Twilio from "twilio"

// Lazy initialization: the Twilio constructor validates credentials at call time,
// which breaks Next.js builds when TWILIO_ACCOUNT_SID/AUTH_TOKEN are not yet configured.
// Using a getter ensures the client is only created when actually used.
let _client: ReturnType<typeof Twilio> | null = null

export function getTwilioClient() {
  if (!_client) {
    _client = Twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
  }
  return _client
}
