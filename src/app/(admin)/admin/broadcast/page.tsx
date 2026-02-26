import Link from "next/link"
import { ArrowLeft, Send } from "lucide-react"
import { BroadcastForm } from "@/components/admin/BroadcastForm"

export default function AdminBroadcastPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="size-5" />
        </Link>
        <Send className="size-6" />
        <h1 className="text-2xl font-bold">Send Broadcast Message</h1>
      </div>
      <p className="text-gray-600">
        Send a message to all tenants or specific units via email and SMS.
      </p>
      <BroadcastForm />
    </div>
  )
}
