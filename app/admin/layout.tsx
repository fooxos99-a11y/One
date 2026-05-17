"use client"

import { useEffect, useMemo, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

const DASHBOARD_ONLY_ADMIN_PATHS = new Set([
	"/admin/admins",
	"/admin/auction-questions",
	"/admin/circles",
	"/admin/enrollment-requests",
	"/admin/exams",
	"/admin/finance",
	"/admin/guess-images",
	"/admin/letter-hive-questions",
	"/admin/millionaire-questions",
	"/admin/notifications",
	"/admin/pathways",
	"/admin/permissions",
	"/admin/questions",
	"/admin/reports",
	"/admin/recitation-day",
	"/admin/semesters",
	"/admin/site-design",
	"/admin/statistics",
	"/admin/store-management",
	"/admin/store-orders",
	"/admin/student-daily-attendance",
	"/admin/student-exams",
	"/admin/student-plans",
	"/admin/student-records",
	"/admin/students-achievements",
	"/admin/teacher-attendance",
	"/admin/teachers",
	"/admin/whatsapp-send",
])

const DASHBOARD_TARGET_REDIRECTS: Record<string, string> = {
	"/admin/exams-settings": "/admin/exams",
	"/admin/pathways-results": "/admin/pathways",
	"/admin/recitation-day/archive": "/admin/recitation-day",
	"/admin/student-reports": "/admin/reports",
	"/admin/whatsapp-qr": "/admin/whatsapp-send",
	"/admin/whatsapp-replies": "/admin/whatsapp-send",
	"/admin/guardian-phones": "/admin/whatsapp-send",
	"/admin/achievements-management": "/admin/dashboard",
}

export default function AdminLayout({ children }: { children: ReactNode }) {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const isEmbedded = searchParams?.get("embedded") === "1"
	const useEmbeddedShell = isEmbedded && pathname !== "/admin/dashboard"
	const fullPath = useMemo(() => {
		const query = searchParams?.toString()
		return query ? `${pathname}?${query}` : pathname
	}, [pathname, searchParams])
	const redirectTarget = useMemo(() => {
		const mappedTarget = DASHBOARD_TARGET_REDIRECTS[pathname]
		if (mappedTarget) {
			return mappedTarget
		}

		if (DASHBOARD_ONLY_ADMIN_PATHS.has(pathname)) {
			return fullPath
		}

		return ""
	}, [fullPath, pathname])
	const shouldRedirectToDashboard = !isEmbedded && pathname !== "/admin/dashboard" && Boolean(redirectTarget)

	useEffect(() => {
		if (!shouldRedirectToDashboard) {
			return
		}

		if (redirectTarget === "/admin/dashboard") {
			router.replace(redirectTarget)
			return
		}

		router.replace(`/admin/dashboard?target=${encodeURIComponent(redirectTarget)}`)
	}, [redirectTarget, router, shouldRedirectToDashboard])

	if (shouldRedirectToDashboard) {
		return <div className="min-h-screen bg-[#fafaf9]" />
	}

	if (!useEmbeddedShell) {
		return children
	}

	return <div className="admin-embedded-shell">{children}</div>
}