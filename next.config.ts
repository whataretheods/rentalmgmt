import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/auth/register",
        destination: "/auth/login",
        permanent: false, // 307 — can re-enable registration later
      },
      {
        source: "/login",
        destination: "/auth/login",
        permanent: true, // 308
      },
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: true, // 308
      },
    ]
  },
}

export default nextConfig
