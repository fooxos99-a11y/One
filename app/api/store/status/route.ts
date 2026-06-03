import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/auth/guards"
import { getSiteSetting, upsertSiteSetting } from "@/lib/site-settings"
import { DEFAULT_STORE_STATUS_SETTINGS, STORE_STATUS_SETTING_ID } from "@/lib/site-settings-constants"
import { normalizeStoreStatus } from "@/lib/store-status"

export async function GET() {
  try {
    const value = await getSiteSetting(STORE_STATUS_SETTING_ID, DEFAULT_STORE_STATUS_SETTINGS)
    return NextResponse.json(normalizeStoreStatus(value))
  } catch (error) {
    console.error("[store-status][GET]", error)
    return NextResponse.json(normalizeStoreStatus(DEFAULT_STORE_STATUS_SETTINGS))
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminPermission(request, "إدارة المتجر")
    if ("response" in auth) {
      return auth.response
    }

    const body = await request.json()
    const nextStatus = normalizeStoreStatus(body)
    const { data, error } = await upsertSiteSetting(STORE_STATUS_SETTING_ID, nextStatus)

    if (error) {
      console.error("[store-status][PATCH]", error)
      return NextResponse.json({ error: "فشل في حفظ حالة المتجر" }, { status: 500 })
    }

    return NextResponse.json({ success: true, value: normalizeStoreStatus(data?.value) })
  } catch (error) {
    console.error("[store-status][PATCH]", error)
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 })
  }
}