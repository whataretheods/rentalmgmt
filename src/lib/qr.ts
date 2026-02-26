import QRCode from "qrcode"

/** Generate a QR code PNG buffer for an invite URL */
export async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: "H",  // High — withstands print damage
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  })
}

/** Generate a QR code as a data URL (for inline display) */
export async function generateQRCodeDataURL(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    width: 400,
    margin: 2,
  })
}
