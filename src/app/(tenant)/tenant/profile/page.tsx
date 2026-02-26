import { ProfileForm } from "@/components/tenant/ProfileForm"
import Link from "next/link"

export default function ProfilePage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <Link
          href="/tenant/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to Dashboard
        </Link>
      </div>
      <div className="mt-6 max-w-2xl">
        <ProfileForm />
      </div>
    </div>
  )
}
