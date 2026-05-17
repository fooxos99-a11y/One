import { NextResponse } from "next/server"

import { isTeacherRole, requireRoles } from "@/lib/auth/guards"
import { insertNotificationsAndSendPush } from "@/lib/push-notifications"
import { createAdminClient } from "@/lib/supabase/admin"

function normalizeHalaqah(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase()
}

function isValidAccountNumber(value: string) {
  return /^\d+$/.test(value)
}

function getErrorMessage(error: unknown) {
  if (!error) return "حدث خطأ غير معروف"
  if (error instanceof Error) return error.message || "حدث خطأ غير معروف"
  if (typeof error === "object") {
    const candidate = error as { message?: string; details?: string; hint?: string; code?: string }
    return candidate.message || candidate.details || candidate.hint || candidate.code || JSON.stringify(candidate)
  }
  return String(error)
}

function parseBooleanFlag(value: string | null) {
  if (!value) return false
  return ["1", "true", "yes"].includes(String(value).trim().toLowerCase())
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(String(value || "").trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

export async function GET(request: Request) {
  try {
    const auth = await requireRoles(request, ["student", "teacher", "deputy_teacher", "admin", "supervisor"])
    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = parseBooleanFlag(searchParams.get("unreadOnly"))
    const countOnly = parseBooleanFlag(searchParams.get("countOnly"))
    const limit = Math.min(parsePositiveInteger(searchParams.get("limit"), 20), 100)
    const createdAt = String(searchParams.get("createdAt") || "").trim()

    const supabase = createAdminClient()
    let query = supabase
      .from("notifications")
      .select(countOnly ? "id" : "id,message,is_read,created_at", { count: "exact" })
      .eq("user_account_number", String(auth.session.accountNumber))

    if (unreadOnly) {
      query = query.eq("is_read", false)
    }

    if (createdAt) {
      query = query.gte("created_at", createdAt)
    }

    if (countOnly) {
      query = query.limit(1)
    } else {
      query = query.order("created_at", { ascending: false }).limit(limit)
    }

    const { data, count, error } = await query
    if (error) {
      throw error
    }

    if (countOnly) {
      return NextResponse.json({ count: count || 0 })
    }

    const notifications = (data || []) as Array<{ id: string; message: string; is_read: boolean; created_at: string }>
    const unreadCount = notifications.filter((notification) => !notification.is_read).length
    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("[notifications] GET:", error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRoles(request, ["student", "teacher", "deputy_teacher", "admin", "supervisor"])
    if ("response" in auth) {
      return auth.response
    }

    const body = await request.json().catch(() => ({}))
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : []

    if (ids.length === 0) {
      return NextResponse.json({ error: "لا توجد إشعارات محددة" }, { status: 400 })
    }

    const markRead = body?.markRead !== false
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: markRead })
      .eq("user_account_number", String(auth.session.accountNumber))
      .in("id", ids)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, count: ids.length })
  } catch (error) {
    console.error("[notifications] PATCH:", error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireRoles(request, ["student", "teacher", "deputy_teacher", "admin", "supervisor"])
    if ("response" in auth) {
      return auth.response
    }

    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get("id") || "").trim()
    if (!id) {
      return NextResponse.json({ error: "معرّف الإشعار مطلوب" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_account_number", String(auth.session.accountNumber))
      .eq("id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[notifications] DELETE:", error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoles(request, ["teacher", "deputy_teacher", "admin", "supervisor"])
    if ("response" in auth) {
      return auth.response
    }

    const body = await request.json()
    const notifications = Array.isArray(body?.notifications) ? body.notifications : []
    const normalizedNotifications = notifications
      .map((notification) => ({
        user_account_number: String(notification?.user_account_number || "").trim(),
        message: String(notification?.message || "").trim(),
      }))
      .filter((notification) => notification.user_account_number && notification.message)

    if (normalizedNotifications.length === 0) {
      return NextResponse.json({ error: "لا توجد إشعارات صالحة للإرسال" }, { status: 400 })
    }

    if (normalizedNotifications.some((notification) => !isValidAccountNumber(notification.user_account_number))) {
      return NextResponse.json({ error: "رقم الحساب غير صالح في أحد الإشعارات" }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (isTeacherRole(auth.session.role)) {
      const targetAccountNumbers = Array.from(
        new Set(normalizedNotifications.map((notification) => Number(notification.user_account_number)).filter(Number.isFinite)),
      )

      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("account_number, halaqah")
        .in("account_number", targetAccountNumbers)

      if (studentsError) {
        throw studentsError
      }

      if (!students || students.length !== targetAccountNumbers.length) {
        return NextResponse.json({ error: "يمكن للمعلم إرسال إشعارات لطلابه فقط" }, { status: 403 })
      }

      const sessionHalaqah = normalizeHalaqah(auth.session.halaqah)
      const hasOutsideScopeStudent = students.some(
        (student) => normalizeHalaqah(student.halaqah) !== sessionHalaqah,
      )

      if (hasOutsideScopeStudent) {
        return NextResponse.json({ error: "لا يمكنك إرسال إشعارات إلى طلاب حلقة أخرى" }, { status: 403 })
      }
    }

    await insertNotificationsAndSendPush(supabase, normalizedNotifications)

    return NextResponse.json({ success: true, count: normalizedNotifications.length })
  } catch (error) {
    console.error("[notifications] POST:", error)
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
