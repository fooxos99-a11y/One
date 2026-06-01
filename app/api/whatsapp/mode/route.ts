import { NextResponse } from "next/server"
import { requireRoles } from "@/lib/auth/guards"
import {
  normalizeWhatsAppDeliveryMode,
  readWhatsAppDeliveryMode,
  writeWhatsAppDeliveryMode,
} from "@/lib/whatsapp-delivery-mode"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireRoles(request, ["admin", "supervisor"])
  if ("response" in auth) {
    return auth.response
  }

  const mode = await readWhatsAppDeliveryMode()
  return NextResponse.json({ mode })
}

export async function PATCH(request: Request) {
  const auth = await requireRoles(request, ["admin", "supervisor"])
  if ("response" in auth) {
    return auth.response
  }

  try {
    const body = await request.json().catch(() => ({}))
    const mode = normalizeWhatsAppDeliveryMode(body?.mode)
    const savedMode = await writeWhatsAppDeliveryMode(mode)
    return NextResponse.json({ success: true, mode: savedMode })
  } catch (error) {
    console.error("[WhatsApp] Mode update error:", error)
    return NextResponse.json({ error: "تعذر تحديث وضع الإرسال" }, { status: 500 })
  }
}
