import { NextRequest } from "next/server"
import { generateQRCodeBuffer } from "@/lib/qr"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const inviteUrl = `${appUrl}/invite/${token}`

  const buffer = await generateQRCodeBuffer(inviteUrl)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="invite-${token.slice(0, 8)}.png"`,
      "Cache-Control": "no-store",
    },
  })
}
