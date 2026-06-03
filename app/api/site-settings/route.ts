import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermissionsForSession, requireRoles } from "@/lib/auth/guards"
import { getSiteSetting, upsertSiteSetting } from "@/lib/site-settings"
import {
	ATTENDANCE_AUTO_SEND_SETTINGS_ID,
	EXAM_PORTION_SETTINGS_ID,
	EXAM_SETTINGS_ID,
	RECITATION_DAY_GRADING_SETTINGS_ID,
	SITE_DESIGN_SETTINGS_ID,
	ATTENDANCE_WEEKLY_REPORT_LOG_SETTING_ID,
	TEACHER_ATTENDANCE_DELAY_SETTING_ID,
} from "@/lib/site-settings-constants"
import { EXAM_WHATSAPP_SETTINGS_ID } from "@/lib/whatsapp-notification-templates"
import { PATHWAY_LEVEL_NOTIFICATION_SETTINGS_ID } from "@/lib/pathway-notification-templates"
import { ATTENDANCE_SAVE_NOTIFICATION_SETTINGS_ID } from "@/lib/attendance-save-notification-templates"
import { RECITATION_DAY_NOTIFICATION_SETTINGS_ID } from "@/lib/recitation-day-notification-templates"
import { RECITATION_DAY_LIFECYCLE_NOTIFICATION_SETTINGS_ID } from "@/lib/recitation-day-lifecycle-notification-templates"

const SITE_SETTING_PERMISSIONS: Record<string, string | string[]> = {
	[EXAM_SETTINGS_ID]: ["إدارة الاختبارات", "اختبار الطلاب"],
	[EXAM_PORTION_SETTINGS_ID]: ["إدارة الاختبارات", "اختبار الطلاب"],
	[EXAM_WHATSAPP_SETTINGS_ID]: "إدارة الاختبارات",
	[PATHWAY_LEVEL_NOTIFICATION_SETTINGS_ID]: "إدارة المسار",
	[TEACHER_ATTENDANCE_DELAY_SETTING_ID]: "تقارير المعلمين",
	[ATTENDANCE_SAVE_NOTIFICATION_SETTINGS_ID]: "السجل اليومي للطلاب",
	[ATTENDANCE_AUTO_SEND_SETTINGS_ID]: "السجل اليومي للطلاب",
	[ATTENDANCE_WEEKLY_REPORT_LOG_SETTING_ID]: "السجل اليومي للطلاب",
	[RECITATION_DAY_NOTIFICATION_SETTINGS_ID]: "يوم السرد",
	[RECITATION_DAY_LIFECYCLE_NOTIFICATION_SETTINGS_ID]: "يوم السرد",
	[RECITATION_DAY_GRADING_SETTINGS_ID]: "يوم السرد",
	[SITE_DESIGN_SETTINGS_ID]: "تصميم الموقع",
}

async function requireSiteSettingAccess(request: NextRequest, settingId: string, deniedMessage: string) {
	const auth = await requireRoles(request, ["admin", "supervisor"])
	if ("response" in auth) {
		return auth
	}

	const requiredPermissions = SITE_SETTING_PERMISSIONS[settingId]
	if (!requiredPermissions) {
		return auth
	}

	const permissionAuth = await requireAdminPermissionsForSession(auth.session, requiredPermissions)
	if ("response" in permissionAuth) {
		return {
			response: NextResponse.json({ error: deniedMessage }, { status: 403 }),
		}
	}

	return auth
}

export async function GET(request: NextRequest) {
	try {
		const id = request.nextUrl.searchParams.get("id")

		if (!id) {
			return NextResponse.json({ error: "معرف الإعداد مطلوب" }, { status: 400 })
		}

		const auth = await requireSiteSettingAccess(request, id, "غير مصرح لك بعرض هذا الإعداد")
		if ("response" in auth) {
			return auth.response
		}

		const value = await getSiteSetting(id, null)
		return NextResponse.json({ id, value })
	} catch (error) {
		console.error("[site-settings][GET]", error)
		return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 })
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const body = await request.json()
		const { id, value } = body

		if (!id) {
			return NextResponse.json({ error: "معرف الإعداد مطلوب" }, { status: 400 })
		}

		const auth = await requireSiteSettingAccess(request, id, "غير مصرح لك بتعديل هذا الإعداد")
		if ("response" in auth) {
			return auth.response
		}

		const { data, error } = await upsertSiteSetting(id, value)

		if (error) {
			console.error("[site-settings][PATCH]", error)
			return NextResponse.json({ error: "فشل في حفظ الإعداد" }, { status: 500 })
		}

		return NextResponse.json({ success: true, setting: data })
	} catch (error) {
		console.error("[site-settings][PATCH]", error)
		return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 })
	}
}