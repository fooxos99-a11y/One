"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ChevronDown, Menu, User } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { performClientLogout } from "@/lib/auth/logout-client"

const LoginForm = dynamic(() => import("@/components/login-form").then((module) => module.LoginForm))

const ADMIN_LIKE_ROLES = new Set([
  "admin",
  "supervisor",
  "مدير",
  "سكرتير",
  "مشرف تعليمي",
  "مشرف تربوي",
  "مشرف برامج",
])

const LANDING_LINKS = [
  { label: "الرئيسية", href: "#home" },
  { label: "الإنجازات", href: "#achievements" },
  { label: "تواصل معنا", href: "#contact" },
] as const

type CircleOption = {
  id?: string
  name?: string | null
}

function getLandingRoleLabel(role: string) {
  if (ADMIN_LIKE_ROLES.has(role)) return role === "admin" || role === "supervisor" ? "الإدارة" : role
  if (role === "admin") return "مدير"
  if (role === "supervisor") return "مشرف"
  if (role === "teacher") return "معلم"
  if (role === "deputy_teacher") return "نائب معلم"
  if (role === "student") return "طالب"
  return role || "حساب مسجل"
}

export function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false)
  const [isMobileHeaderLinksOpen, setIsMobileHeaderLinksOpen] = useState(false)
  const [isPortraitMobile, setIsPortraitMobile] = useState(false)
  const [authResolved, setAuthResolved] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState("")
  const [userName, setUserName] = useState("")
  const [circles, setCircles] = useState<CircleOption[]>([])
  const [isCirclesLoading, setIsCirclesLoading] = useState(false)
  const [mobileExpandedGroup, setMobileExpandedGroup] = useState<"students" | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const syncAuthState = () => {
      try {
        setIsLoggedIn(localStorage.getItem("isLoggedIn") === "true")
        setUserRole(String(localStorage.getItem("userRole") || "").trim())
        setUserName(String(localStorage.getItem("userName") || localStorage.getItem("studentName") || "").trim())
      } catch {
        setIsLoggedIn(false)
        setUserRole("")
        setUserName("")
      } finally {
        setAuthResolved(true)
      }
    }

    syncAuthState()
    window.addEventListener("app-login", syncAuthState)
    window.addEventListener("storage", syncAuthState)

    return () => {
      window.removeEventListener("app-login", syncAuthState)
      window.removeEventListener("storage", syncAuthState)
    }
  }, [])

  useEffect(() => {
    let animationFrameId = 0

    const syncScrollState = () => {
      setIsScrolled(window.scrollY > 16)
    }

    const handleScroll = () => {
      if (animationFrameId) {
        return
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0
        syncScrollState()
      })
    }

    syncScrollState()
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  useEffect(() => {
    if (searchParams?.get("login") === "1" && !isLoggedIn) {
      setIsLoginDialogOpen(true)
      return
    }

    if (searchParams?.get("login") === "1" && isLoggedIn) {
      router.replace(pathname || "/")
    }
  }, [isLoggedIn, pathname, router, searchParams])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia("(max-width: 767px) and (orientation: portrait)")

    const syncPortraitMobileState = () => {
      const nextIsPortraitMobile = mediaQuery.matches
      setIsPortraitMobile(nextIsPortraitMobile)
      if (!nextIsPortraitMobile) {
        setIsMobileHeaderLinksOpen(false)
      }
    }

    syncPortraitMobileState()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPortraitMobileState)
      return () => mediaQuery.removeEventListener("change", syncPortraitMobileState)
    }

    mediaQuery.addListener(syncPortraitMobileState)
    return () => mediaQuery.removeListener(syncPortraitMobileState)
  }, [])

  const loadCircles = async () => {
    let cancelled = false

    try {
      setIsCirclesLoading(true)
      const response = await fetch("/api/circles", { cache: "no-store" })
      const data = await response.json()
      if (!cancelled) {
        setCircles(Array.isArray(data?.circles) ? data.circles : [])
      }
    } catch {
      if (!cancelled) {
        setCircles([])
      }
    } finally {
      if (!cancelled) {
        setIsCirclesLoading(false)
      }
    }

    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    if (!isPortraitMobile || !isMobileHeaderLinksOpen || circles.length > 0 || isCirclesLoading) {
      return
    }

    const cleanup = loadCircles()

    return () => {
      void cleanup.then((dispose) => dispose())
    }
  }, [circles.length, isCirclesLoading, isMobileHeaderLinksOpen, isPortraitMobile])

  const handleLoginDialogChange = (open: boolean) => {
    setIsLoginDialogOpen(open)

    if (!open && searchParams?.get("login") === "1") {
      router.replace(pathname || "/")
    }
  }

  const handleNav = (href: string) => {
    setIsMobileHeaderLinksOpen(false)
    setMobileExpandedGroup(null)
    router.push(href)
  }

  const handleLandingAnchorClick = (href: string) => {
    setIsMobileHeaderLinksOpen(false)
    setMobileExpandedGroup(null)
    if (pathname && pathname !== "/") {
      router.push(`/${href}`)
      return
    }

    const targetId = href.replace(/^#/, "")
    const target = document.getElementById(targetId)
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }

    window.location.hash = href
  }

  const handleLogout = () => {
    void performClientLogout(pathname || "/")
  }

  const handleBestStudentsMenuChange = (open: boolean) => {
    if (!open || circles.length > 0 || isCirclesLoading) {
      return
    }

    void loadCircles()
  }

  const toggleMobileGroup = (group: "students") => {
    setMobileExpandedGroup((current) => (current === group ? null : group))
  }

  const isStudentAccount = userRole === "student"
  const isTeacherAccount = userRole === "teacher" || userRole === "deputy_teacher"
  const isAdminAccount = ADMIN_LIKE_ROLES.has(userRole)
  const teacherEvaluationPath = (() => {
    const teacherHalaqah = String(localStorage.getItem("userHalaqah") || "").trim()
    if (!teacherHalaqah) {
      return "/teacher/halaqah/1"
    }

    return `/teacher/halaqah/${encodeURIComponent(teacherHalaqah)}`
  })()

  return (
    <>
      <header data-scrolled={isScrolled ? "true" : "false"} className="site-header fixed inset-x-0 top-0 z-50">
        <div className="container mx-auto flex h-20 items-center justify-between gap-4 px-4">
          <Link href="/" className="site-header-brand relative z-20 inline-flex min-w-0 items-center gap-3" aria-label="العودة إلى الرئيسية">
            <Image
              src="/%D8%B4%D8%B9%D8%A7%D8%B1-%D8%A7%D9%84%D8%AC%D9%85%D8%B9%D9%8A%D8%A9.png"
              alt="شعار الجمعية"
              width={42}
              height={42}
              className="site-header-brand-logo h-9 w-9 object-contain"
              priority
            />
            <div className="min-w-0 whitespace-nowrap text-right text-[0.92rem] font-black leading-tight">
              مجمع الملك خالد
            </div>
          </Link>

          <nav className="hidden flex-1 items-center justify-center md:flex">
            <div className="flex items-center gap-7 lg:gap-10">
              {LANDING_LINKS.map((item) => (
                <button key={item.label} type="button" onClick={() => handleLandingAnchorClick(item.href)} className="site-header-nav-button">
                  {item.label}
                </button>
              ))}
              <Link href="/halaqat/all" className="site-header-nav-button">
                أفضل الحلقات
              </Link>
              <DropdownMenu onOpenChange={handleBestStudentsMenuChange}>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="site-header-nav-button inline-flex items-center gap-1.5" aria-label="أفضل الطلاب">
                    <span>أفضل الطلاب</span>
                    <ChevronDown size={16} strokeWidth={2.4} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={12} className="w-56 rounded-2xl border border-[#d9e4fb] bg-white p-2 shadow-[0_20px_50px_rgba(19,39,89,0.14)]">
                  <div dir="rtl">
                    <DropdownMenuItem onClick={() => handleNav("/students/all")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]">
                      <span className="w-full text-right">جميع الطلاب</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isCirclesLoading ? (
                      <div className="px-4 py-3 text-center text-sm font-medium text-[#6b778c]">جاري التحميل...</div>
                    ) : (
                      circles
                        .map((circle) => ({ id: circle.id, name: (circle.name || "").trim() }))
                        .filter((circle) => circle.name.length > 0)
                        .map((circle) => (
                          <DropdownMenuItem
                            key={circle.id || circle.name}
                            onClick={() => handleNav(`/halaqat/${encodeURIComponent(circle.name)}`)}
                            className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]"
                          >
                            <span className="w-full text-right">{circle.name}</span>
                          </DropdownMenuItem>
                        ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {(isTeacherAccount || isAdminAccount) ? (
                <Link href="/competitions" className="site-header-nav-button">
                  المسابقات
                </Link>
              ) : null}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            {isPortraitMobile ? (
              <button
                type="button"
                onClick={() => setIsMobileHeaderLinksOpen((current) => !current)}
                className="site-header-mobile-button inline-flex h-11 w-11 items-center justify-center rounded-full md:hidden"
                aria-label="روابط الهيدر"
              >
                <Menu size={22} />
              </button>
            ) : (
              <Link
                href="/halaqat/all"
                className="site-header-mobile-button inline-flex items-center justify-center rounded-full px-4 text-sm font-black md:hidden"
              >
                الحلقات
              </Link>
            )}
            {authResolved && isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="site-header-user-button"
                    aria-label="حساب المستخدم"
                  >
                    <User size={20} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={10} className="w-56 rounded-2xl border border-[#d9e4fb] bg-white p-2 shadow-[0_20px_50px_rgba(19,39,89,0.14)]">
                  <div className="px-3 py-2.5 text-right" dir="rtl">
                    <div className="text-sm font-black text-[#1a2332]">{userName || "المستخدم"}</div>
                    <div className="mt-1 text-xs font-semibold text-[#6b778c]">{getLandingRoleLabel(userRole)}</div>
                  </div>
                  <DropdownMenuSeparator />
                  {isStudentAccount ? (
                    <>
                      <DropdownMenuItem onClick={() => handleNav("/profile?tab=profile")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                        <span className="w-full text-right">الملف الشخصي</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNav("/daily-challenge")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                        <span className="w-full text-right">التحدي اليومي</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNav("/store")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                        <span className="w-full text-right">المتجر</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNav("/pathways")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                        <span className="w-full text-right">المسار</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNav("/exams")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                        <span className="w-full text-right">الاختبارات</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  {isAdminAccount ? (
                    <>
                      <DropdownMenuItem onClick={() => handleNav("/admin/dashboard")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                        <span className="w-full text-right">لوحة التحكم</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  {isTeacherAccount ? (
                    <>
                      <DropdownMenuItem onClick={() => handleNav("/teacher/dashboard")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                        <span className="w-full text-right">التحضير</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNav(teacherEvaluationPath)} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                        <span className="w-full text-right">التقييم اليومي</span>
                      </DropdownMenuItem>
                      {userRole === "teacher" ? (
                        <DropdownMenuItem onClick={() => handleNav("/teacher/student-plans")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                          <span className="w-full text-right">خطط الطلاب</span>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => handleNav("/teacher/weekly-reports")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                        <span className="w-full text-right">تقارير الأسابيع</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem onClick={() => handleNav("/notifications")} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                    <span className="w-full text-right">الإشعارات</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-red-600 focus:bg-red-50 focus:text-red-600" dir="rtl">
                    <span className="w-full text-right">تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                onClick={() => handleLoginDialogChange(true)}
                className="site-header-user-button"
                aria-label="تسجيل الدخول"
              >
                <User size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      {isPortraitMobile ? (
        <>
          <div
            className={`fixed inset-0 z-[55] bg-black/25 transition-opacity duration-200 md:hidden ${isMobileHeaderLinksOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
            onClick={() => {
              setIsMobileHeaderLinksOpen(false)
              setMobileExpandedGroup(null)
            }}
          />
          <div
            dir="rtl"
            className={`fixed left-4 right-4 top-[5.5rem] z-[60] rounded-[28px] border border-[#d9e4fb] bg-white/95 p-3 shadow-[0_24px_55px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-200 md:hidden ${isMobileHeaderLinksOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}
          >
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => toggleMobileGroup("students")}
                className="flex items-center justify-between rounded-2xl border border-[#e3ebfb] bg-white px-4 py-3 text-right text-sm font-bold text-[#1a2332] transition-colors hover:bg-[#f8fbff]"
              >
                <span>أفضل الطلاب</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${mobileExpandedGroup === "students" ? "rotate-180" : "rotate-0"}`} />
              </button>
              {mobileExpandedGroup === "students" ? (
                <div className="space-y-2 rounded-2xl border border-[#e8eef8] bg-[#f8fbff] p-2">
                  <button
                    type="button"
                    onClick={() => handleNav("/students/all")}
                    className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-2.5 text-right text-sm font-bold text-[#1a2332] transition-colors hover:bg-[#eef4ff]"
                  >
                    <span>جميع الطلاب</span>
                  </button>
                  {isCirclesLoading ? (
                    <div className="px-4 py-2 text-sm font-medium text-[#6b778c]">جاري التحميل...</div>
                  ) : (
                    circles
                      .map((circle) => (circle.name || "").trim())
                      .filter((circleName) => circleName.length > 0)
                      .map((circleName) => (
                        <button
                          key={`students-${circleName}`}
                          type="button"
                          onClick={() => handleNav(`/halaqat/${encodeURIComponent(circleName)}`)}
                          className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-2.5 text-right text-sm font-bold text-[#1a2332] transition-colors hover:bg-[#eef4ff]"
                        >
                          <span>{circleName}</span>
                        </button>
                      ))
                  )}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => handleNav("/halaqat/all")}
                className="flex items-center justify-between rounded-2xl border border-[#e3ebfb] bg-white px-4 py-3 text-right text-sm font-bold text-[#1a2332] transition-colors hover:bg-[#f8fbff]"
              >
                <span>أفضل الحلقات</span>
              </button>
              {(isTeacherAccount || isAdminAccount) ? (
                <button
                  type="button"
                  onClick={() => handleNav("/competitions")}
                  className="flex items-center justify-between rounded-2xl border border-[#e3ebfb] bg-white px-4 py-3 text-right text-sm font-bold text-[#1a2332] transition-colors hover:bg-[#f8fbff]"
                >
                  <span>المسابقات</span>
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <Dialog open={isLoginDialogOpen} onOpenChange={handleLoginDialogChange}>
        <DialogContent className="max-w-[92vw] rounded-[22px] border border-[#dbe5f1] bg-white p-6 shadow-[0_18px_50px_rgba(18,37,84,0.14)] sm:max-w-md" dir="rtl">
          <DialogHeader className="mb-2 text-right">
            <DialogTitle className="text-2xl font-black text-[#1a2332]">تسجيل الدخول</DialogTitle>
          </DialogHeader>
          {isLoginDialogOpen ? (
            <div>
              <LoginForm onSuccess={() => setIsLoginDialogOpen(false)} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}