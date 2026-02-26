import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { DocumentList } from "@/components/tenant/DocumentList"
import Link from "next/link"

export default async function TenantDocumentsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload and manage your documents. Fulfill requests from your
            landlord.
          </p>
        </div>
        <Link
          href="/tenant/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to Dashboard
        </Link>
      </div>
      <div className="mt-6">
        <DocumentList />
      </div>
    </div>
  )
}
