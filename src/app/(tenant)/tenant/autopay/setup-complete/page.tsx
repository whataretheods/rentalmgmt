"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, useStripe } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

function SetupCompleteContent() {
  const stripe = useStripe()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<
    "loading" | "success" | "processing" | "error"
  >("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!stripe) return

    const clientSecret = searchParams.get("setup_intent_client_secret")
    const setupIntentId = searchParams.get("setup_intent")

    if (!clientSecret || !setupIntentId) {
      setStatus("error")
      setMessage("Missing setup information. Please try again.")
      return
    }

    async function checkAndSave() {
      try {
        // Verify setup intent status client-side
        const { setupIntent } = await stripe!.retrieveSetupIntent(clientSecret!)

        if (!setupIntent) {
          setStatus("error")
          setMessage("Unable to verify setup. Please try again.")
          return
        }

        if (setupIntent.status === "succeeded") {
          // Save enrollment to database
          const res = await fetch("/api/autopay/setup-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ setupIntentId }),
          })

          if (res.ok) {
            setStatus("success")
            setMessage(
              "Autopay has been set up successfully! Your rent will be charged automatically each month."
            )
            // Redirect to autopay page after 2 seconds
            setTimeout(() => {
              window.location.href = "/tenant/autopay"
            }, 2000)
          } else {
            const data = await res.json()
            setStatus("error")
            setMessage(data.error || "Failed to save enrollment. Please try again.")
          }
        } else if (setupIntent.status === "processing") {
          setStatus("processing")
          setMessage(
            "Your bank account verification is still in progress. This may take 1-2 business days. We will activate autopay once verified."
          )
        } else {
          setStatus("error")
          setMessage(
            `Setup was not completed (status: ${setupIntent.status}). Please try again.`
          )
        }
      } catch {
        setStatus("error")
        setMessage("An unexpected error occurred. Please try again.")
      }
    }

    checkAndSave()
  }, [stripe, searchParams])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Autopay Setup</h1>
      <div className="rounded-lg border bg-white p-6 space-y-4">
        {status === "loading" && (
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            <p className="text-gray-600">Verifying your setup...</p>
          </div>
        )}

        {status === "success" && (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 text-lg">
                ✓
              </span>
              <h2 className="text-lg font-semibold text-green-800">
                Setup Complete
              </h2>
            </div>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-400">
              Redirecting to autopay page...
            </p>
          </>
        )}

        {status === "processing" && (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 text-lg">
                ⏳
              </span>
              <h2 className="text-lg font-semibold text-yellow-800">
                Verification In Progress
              </h2>
            </div>
            <p className="text-gray-600">{message}</p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/tenant/autopay")}
              className="mt-2"
            >
              Return to Autopay
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 text-lg">
                ✗
              </span>
              <h2 className="text-lg font-semibold text-red-800">
                Setup Failed
              </h2>
            </div>
            <p className="text-gray-600">{message}</p>
            <Button
              onClick={() => (window.location.href = "/tenant/autopay")}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Try Again
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default function SetupCompletePage() {
  // We need the Elements wrapper for useStripe() but don't have a clientSecret
  // for creating new elements. We use the setup_intent_client_secret from URL.
  // However, Elements requires either clientSecret or mode in options.
  // Since we already have the client_secret from the redirect, we can pass it.
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
  const clientSecret = searchParams?.get("setup_intent_client_secret") ?? undefined

  if (!clientSecret) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Autopay Setup</h1>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-gray-600">
            Missing setup information. Please{" "}
            <a href="/tenant/autopay" className="text-green-600 underline">
              return to autopay
            </a>{" "}
            and try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#16a34a" },
        },
      }}
    >
      <SetupCompleteContent />
    </Elements>
  )
}
