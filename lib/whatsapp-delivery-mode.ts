import { createAdminClient } from "@/lib/supabase/admin"
import { WHATSAPP_DELIVERY_MODE_SETTING_ID } from "@/lib/whatsapp-site-config"

export type WhatsAppDeliveryMode = "local" | "cloud"

const DEFAULT_MODE: WhatsAppDeliveryMode = "cloud"

export function normalizeWhatsAppDeliveryMode(value: unknown): WhatsAppDeliveryMode {
  return value === "cloud" ? "cloud" : "local"
}

export async function readWhatsAppDeliveryMode() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("id", WHATSAPP_DELIVERY_MODE_SETTING_ID)
      .maybeSingle()

    if (error) {
      return DEFAULT_MODE
    }

    return normalizeWhatsAppDeliveryMode(data?.value)
  } catch {
    return DEFAULT_MODE
  }
}

export async function writeWhatsAppDeliveryMode(mode: WhatsAppDeliveryMode) {
  const normalizedMode = normalizeWhatsAppDeliveryMode(mode)
  const supabase = createAdminClient()

  const { error } = await supabase.from("site_settings").upsert(
    {
      id: WHATSAPP_DELIVERY_MODE_SETTING_ID,
      value: normalizedMode,
    },
    { onConflict: "id" },
  )

  if (error) {
    throw error
  }

  return normalizedMode
}
