import { NextRequest, NextResponse } from "next/server"

import { requireRoles } from "@/lib/auth/guards"
import { getSiteSetting, upsertSiteSetting } from "@/lib/site-settings"
import { DEFAULT_GOALS_SECTION_SETTINGS, GOALS_SECTION_SETTINGS_ID } from "@/lib/site-settings-constants"

export const revalidate = 300

const goalsSectionCacheHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
}

type GoalSectionItem = {
  icon: string
  value: string
  label: string
  caption: string
}

function normalizeItems(value: unknown): GoalSectionItem[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_GOALS_SECTION_SETTINGS]
  }

  const items = value
    .map((item) => {
      const candidate = item && typeof item === "object" ? (item as Record<string, unknown>) : {}

      return {
        icon: String(candidate.icon || "users").trim() || "users",
        value: String(candidate.value || "").trim(),
        label: String(candidate.label || "").trim(),
        caption: String(candidate.caption || "").trim(),
      }
    })
    .filter((item) => item.value && item.label && item.caption)

  if (items.length !== DEFAULT_GOALS_SECTION_SETTINGS.length) {
    return [...DEFAULT_GOALS_SECTION_SETTINGS]
  }

  return items
}

export async function GET() {
  try {
    const value = await getSiteSetting(GOALS_SECTION_SETTINGS_ID, DEFAULT_GOALS_SECTION_SETTINGS)
    return NextResponse.json({ items: normalizeItems(value) }, { headers: goalsSectionCacheHeaders })
  } catch (error) {
    console.error("[goals-section][GET]", error)
    return NextResponse.json({ items: DEFAULT_GOALS_SECTION_SETTINGS }, { headers: goalsSectionCacheHeaders })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireRoles(request, ["admin", "supervisor"])
    if ("response" in auth) {
      return auth.response
    }

    if (Number(auth.session.accountNumber) !== 2) {
      return NextResponse.json({ error: "غير مصرح لك بتعديل هذه البطاقات" }, { status: 403 })
    }

    const body = await request.json()
    const items = normalizeItems(body?.items)
    const { data, error } = await upsertSiteSetting(GOALS_SECTION_SETTINGS_ID, items)

    if (error) {
      console.error("[goals-section][PATCH]", error)
      return NextResponse.json({ error: "فشل في حفظ الإعدادات" }, { status: 500 })
    }

    return NextResponse.json({ success: true, items: data.value })
  } catch (error) {
    console.error("[goals-section][PATCH]", error)
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 })
  }
}