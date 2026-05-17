"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  Archive,
  Award,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronDown,
  Check,
  ClipboardCheck,
  Copy,
  FileText,
  Gamepad2,
  Plus,
  Loader2,
  Lock,
  Palette,
  Trash2,
  LayoutPanelTop,
  MessageSquare,
  ArrowRightLeft,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  QrCode,
  UserPlus,
  Unlock,
  Users,
  Wallet,
  Zap,
} from "lucide-react"

import { GlobalAddStudentDialog } from "@/components/global-add-student-dialog"
import { GlobalEditStudentDialog } from "@/components/admin-modals/global-edit-student-dialog"
import { AdminsManagementContent } from "@/app/admin/admins/page"
import { CircleManagementContent } from "@/app/admin/circles/page"
import { EnrollmentRequestsContent } from "@/app/admin/enrollment-requests/page"
import { ExamsContent } from "@/app/admin/exams/page"
import { FinanceContent } from "@/app/admin/finance/page"
import { GuessImagesManagementContent } from "@/app/admin/guess-images/page"
import { AuctionQuestionsAdminContent } from "@/app/admin/auction-questions/page"
import { LetterHiveQuestionsAdminContent } from "@/app/admin/letter-hive-questions/page"
import { MillionaireQuestionsAdminContent } from "@/app/admin/millionaire-questions/page"
import { AdminNotificationsContent } from "@/app/admin/notifications/page"
import { PathwaysContent } from "@/app/admin/pathways/page"
import { PermissionsContent } from "@/app/admin/permissions/page"
import { QuestionsDatabaseContent } from "@/app/admin/questions/page"
import { ReportsPageContent } from "@/app/admin/reports/page"
import { RecitationDayContent } from "@/app/admin/recitation-day/page"
import { SemestersContent } from "@/app/admin/semesters/page"
import { SiteDesignContent } from "@/app/admin/site-design/page"
import { StoreManagementContent } from "@/app/admin/store-management/page"
import { StoreOrdersContent } from "@/app/admin/store-orders/page"
import { StudentRecordsContent } from "@/app/admin/student-records/page"
import { StudentDailyAttendanceContent } from "@/app/admin/student-daily-attendance/page"
import { StudentPlansContent } from "@/app/admin/student-plans/page"
import { StatisticsContent } from "@/app/admin/statistics/page"
import StudentsAchievementsAdmin from "@/app/admin/students-achievements"
import { TeacherAttendanceContent } from "@/app/admin/teacher-attendance/page"
import { TeacherManagementContent } from "@/app/admin/teachers/page"
import { WhatsAppSendContent } from "@/app/admin/whatsapp-send/page"
import { WhatsAppQrDialog } from "@/components/whatsapp-qr-dialog"
import { WhatsAppQueueIndicator } from "@/components/whatsapp-queue-indicator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SiteLoader } from "@/components/ui/site-loader"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { hasPermissionAccess } from "@/lib/admin-permissions"

type DashboardContext = {
  hasPermission: (permission: string) => boolean
  hasActiveSemester: boolean | null
}

type DashboardAction = {
  key: string
  label: string
  description: string
  icon: LucideIcon
  permissionKey?: string
  isVisible?: (context: DashboardContext) => boolean
  getLabel?: (context: DashboardContext) => string
  getPath: (context: DashboardContext) => string
}

type DashboardSection = {
  key: string
  title: string
  description: string
  icon: LucideIcon
  accentClassName: string
  items: DashboardAction[]
}

type WhatsAppStatusSummary = {
  status?: string
  ready?: boolean
  authenticated?: boolean
  workerOnline?: boolean
}

function isConnectedWhatsAppStatus(status: WhatsAppStatusSummary | null) {
  return Boolean(status?.workerOnline && status?.ready && status?.authenticated && status?.status === "connected")
}

const dashboardOutlineButtonClass =
  "theme-pill-outline inline-flex h-12 items-center rounded-full px-5 text-sm font-bold transition-all"

const dashboardSolidButtonClass =
  "theme-pill-solid inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-bold transition-all"

const dashboardSquareOutlineButtonClass =
  "theme-pill-outline relative flex h-12 w-12 items-center justify-center rounded-full transition-all"

const dashboardDropdownContentClass =
  "min-w-[220px] rounded-[1.25rem] border border-[var(--border)] bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.12)]"

const dashboardDropdownItemClass =
  "cursor-pointer justify-end rounded-[1rem] px-4 py-3 text-right font-bold text-[#1f2a3d] focus:bg-[var(--button-outline-hover)] focus:text-[var(--challenge-primary)]"

function getDashboardFilterButtonClass(isActive: boolean) {
  return `${isActive ? "theme-pill-solid" : "theme-pill-outline"} inline-flex h-12 items-center rounded-full px-5 text-sm font-bold transition-all`
}

const adminSections: DashboardSection[] = [
  {
    key: "students",
    title: "إدارة الطلاب",
    description: "الوصول السريع إلى التسجيل، السجلات، الإنجازات، والخطط التعليمية.",
    icon: Users,
    accentClassName: "from-[#3453a7] to-[#4f73d1]",
    items: [
      {
        key: "students-add",
        label: "إضافة طلاب",
        description: "فتح شاشة إضافة طالب أو الإضافة الجماعية حسب الصلاحية المتاحة.",
        icon: UserPlus,
        isVisible: ({ hasPermission }) => hasPermission("إضافة طالب") || hasPermission("إضافة جماعية"),
        getPath: ({ hasPermission }) => (hasPermission("إضافة طالب") ? "/admin?action=add-student" : "/admin?action=bulk-add"),
      },
      {
        key: "students-edit",
        label: "تعديل بيانات الطالب",
        description: "تعديل بيانات الطلاب وربطها بالمسارات المناسبة.",
        icon: Settings,
        permissionKey: "تعديل بيانات الطالب",
        getPath: () => "/admin?action=edit-student",
      },
      {
        key: "students-records",
        label: "سجلات الطلاب",
        description: "عرض السجلات الفردية وتفاصيل التقدم والمتابعة.",
        icon: FileText,
        permissionKey: "سجلات الطلاب",
        getPath: () => "/admin/student-records",
      },
      {
        key: "students-achievements",
        label: "إنجازات الطلاب",
        description: "مراجعة الإنجازات والمحفوظات والاعتمادات.",
        icon: Award,
        permissionKey: "إنجازات الطلاب",
        getPath: () => "/admin/students-achievements",
      },
      {
        key: "students-plans",
        label: "خطط الطلاب",
        description: "إدارة الخطط الفردية ومتابعة التنفيذ الأسبوعي.",
        icon: BookMarked,
        permissionKey: "خطط الطلاب",
        getPath: () => "/admin/student-plans",
      },
    ],
  },
  {
    key: "users",
    title: "إدارة المستخدمين",
    description: "المعلمون، الحلقات، الهيكل الإداري، وطلبات التسجيل الجديدة.",
    icon: ShieldCheck,
    accentClassName: "from-[#1f4b99] to-[#3453a7]",
    items: [
      {
        key: "users-teachers",
        label: "إدارة المعلمين",
        description: "إضافة وتعديل وحذف المعلمين ومتابعة بياناتهم.",
        icon: Settings,
        permissionKey: "إدارة المعلمين",
        getPath: () => "/admin/teachers",
      },
      {
        key: "users-circles",
        label: "إدارة الحلقات",
        description: "تنظيم الحلقات وتوزيعها ومراجعة بياناتها الأساسية.",
        icon: BookOpen,
        permissionKey: "إدارة الحلقات",
        getPath: () => "/admin/circles",
      },
      {
        key: "users-admins",
        label: "الهيكل الإداري",
        description: "إدارة الحسابات الإدارية والأدوار داخل النظام.",
        icon: ShieldCheck,
        permissionKey: "الهيكل الإداري",
        getPath: () => "/admin/admins",
      },
      {
        key: "users-enrollments",
        label: "طلبات التسجيل",
        description: "مراجعة الطلبات الجديدة وقبولها أو معالجتها.",
        icon: UserPlus,
        permissionKey: "طلبات التسجيل",
        getPath: () => "/admin/enrollment-requests",
      },
    ],
  },
  {
    key: "reports",
    title: "التقارير",
    description: "تقارير الأداء، الرسائل، السجل اليومي، والإحصائيات العامة.",
    icon: BarChart3,
    accentClassName: "from-[#24428f] to-[#4568c7]",
    items: [
      {
        key: "reports-teachers",
        label: "تقارير المعلمين",
        description: "متابعة حضور المعلمين والتقارير المرتبطة بهم.",
        icon: FileText,
        permissionKey: "تقارير المعلمين",
        getPath: () => "/admin/teacher-attendance",
      },
      {
        key: "reports-messages",
        label: "تقارير الرسائل",
        description: "مراجعة الرسائل المرسلة وحالات الوصول والتفاعل.",
        icon: MessageSquare,
        permissionKey: "تقارير الرسائل",
        getPath: () => "/admin/reports",
      },
      {
        key: "reports-daily",
        label: "السجل اليومي للطلاب",
        description: "عرض السجل اليومي ومتابعة الأداء الميداني للطلاب.",
        icon: FileText,
        permissionKey: "السجل اليومي للطلاب",
        getPath: () => "/admin/student-daily-attendance",
      },
      {
        key: "reports-stats",
        label: "الإحصائيات",
        description: "لوحة أرقام شاملة لقياس الأداء والمؤشرات الرئيسية.",
        icon: BarChart3,
        permissionKey: "الإحصائيات",
        getPath: () => "/admin/statistics",
      },
    ],
  },
  {
    key: "general",
    title: "الإدارة العامة",
    description: "الاختبارات، المسار، المتجر، الإشعارات، التصميم، المالية، والفصول.",
    icon: LayoutPanelTop,
    accentClassName: "from-[#20335f] to-[#3453a7]",
    items: [
      {
        key: "general-exams",
        label: "إدارة الاختبارات",
        description: "إعداد الاختبارات ومتابعة التقييمات المركزية.",
        icon: ClipboardCheck,
        permissionKey: "إدارة الاختبارات",
        getPath: () => "/admin/exams",
      },
      {
        key: "general-student-exams",
        label: "اختبار الطلاب",
        description: "الانتقال السريع إلى واجهة اختبار الطلاب الإدارية.",
        icon: ClipboardCheck,
        permissionKey: "اختبار الطلاب",
        getPath: () => "/admin/student-exams",
      },
      {
        key: "general-pathways",
        label: "المسار",
        description: "إدارة المسارات والنتائج وخطط التقدم.",
        icon: BookOpen,
        permissionKey: "إدارة المسار",
        getPath: () => "/admin/pathways",
      },
      {
        key: "general-store",
        label: "المتجر",
        description: "إدارة المتجر ومحتواه وربط الطلبات بالمستخدمين.",
        icon: ShoppingBag,
        permissionKey: "إدارة المتجر",
        getPath: () => "/admin/store-management",
      },
      {
        key: "general-recitation-day",
        label: "يوم السرد",
        description: "الوصول السريع إلى تنظيم يوم السرد وإدارته.",
        icon: CalendarDays,
        permissionKey: "يوم السرد",
        getPath: () => "/admin/recitation-day",
      },
      {
        key: "general-notifications",
        label: "الإشعارات",
        description: "إرسال الإشعارات ومراجعة إعدادات التنبيهات.",
        icon: Bell,
        permissionKey: "الإشعارات",
        getPath: () => "/admin/notifications",
      },
      {
        key: "general-permissions",
        label: "الصلاحيات",
        description: "التحكم في الأدوار وصلاحيات الوصول داخل النظام.",
        icon: ShieldCheck,
        permissionKey: "الصلاحيات",
        getPath: () => "/admin/permissions",
      },
      {
        key: "general-finance",
        label: "المالية",
        description: "متابعة العمليات المالية والتقارير المرتبطة بها.",
        icon: Wallet,
        permissionKey: "المالية",
        getPath: () => "/admin/finance",
      },
      {
        key: "general-whatsapp",
        label: "إرسال عبر الواتس",
        description: "إدارة الرسائل الجماعية وربط الإرسال بحساب الواتساب.",
        icon: Send,
        permissionKey: "الإرسال إلى أولياء الأمور",
        getPath: () => "/admin/whatsapp-send",
      },
      {
        key: "general-semesters-archive",
        label: "الفصل",
        description: "عرض الفصل الحالي وأرشيف الفصول السابقة وإدارة انتقال الفصل.",
        icon: Calendar,
        permissionKey: "إنهاء الفصل",
        getPath: () => "/admin/semesters",
      },
      {
        key: "general-site-design",
        label: "تصميم الموقع",
        description: "تعديل اللون الأساسي والتدرجات العامة للموقع من شاشة واحدة.",
        icon: Palette,
        permissionKey: "تصميم الموقع",
        getPath: () => "/admin/site-design",
      },
    ],
  },
  {
    key: "games",
    title: "الألعاب",
    description: "أدوات إدارة الألعاب والمسابقات وربطها بالمحتوى والأسئلة.",
    icon: Gamepad2,
    accentClassName: "from-[#294892] to-[#5278d8]",
    items: [
      {
        key: "games-images",
        label: "إدارة صور خمن الصورة",
        description: "إضافة صور اللعبة وتحديث المحتوى المرئي للمراحل.",
        icon: Sparkles,
        permissionKey: "إدارة صور خمن الصورة",
        getPath: () => "/admin/guess-images",
      },
      {
        key: "games-auction",
        label: "إدارة أسئلة المزاد",
        description: "تنظيم بنك أسئلة المزاد والتحكم في ترتيبه.",
        icon: Zap,
        permissionKey: "إدارة أسئلة المزاد",
        getPath: () => "/admin/auction-questions",
      },
      {
        key: "games-millionaire",
        label: "إدارة من سيربح المليون",
        description: "تحديث أسئلة اللعبة ومراحلها ومسارات الفوز.",
        icon: Award,
        permissionKey: "إدارة من سيربح المليون",
        getPath: () => "/admin/millionaire-questions",
      },
      {
        key: "games-letter-hive",
        label: "إدارة خلية الحروف",
        description: "إدارة مفردات وأسئلة خلية الحروف وتوزيعها.",
        icon: BookOpen,
        permissionKey: "إدارة خلية الحروف",
        getPath: () => "/admin/letter-hive-questions",
      },
      {
        key: "games-categories",
        label: "إدارة أسئلة الفئات",
        description: "التحكم في أسئلة لعبة الفئات وتقسيماتها.",
        icon: FileText,
        permissionKey: "إدارة أسئلة الفئات",
        getPath: () => "/admin/questions",
      },
    ],
  },
]

export default function AdminDashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoading: authLoading, isVerified: authVerified, role, isFullAccess } = useAdminAuth()
  const [userName, setUserName] = useState("الحساب الإداري")
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [isContextLoading, setIsContextLoading] = useState(true)
  const [hasActiveSemester, setHasActiveSemester] = useState<boolean | null>(null)
  const [activeSectionKey, setActiveSectionKey] = useState<string>("")
  const [activeActionKey, setActiveActionKey] = useState<string>("")
  const [expandedSectionKeys, setExpandedSectionKeys] = useState<string[]>([])
  const [inlineDialogAction, setInlineDialogAction] = useState<"add-student" | "bulk-add" | "edit-student" | null>(null)
  const [editStudentInlineActions, setEditStudentInlineActions] = useState({
    canTransfer: false,
    canRemove: false,
    hasSelectedStudent: false,
    isSubmitting: false,
    openMoveDialog: () => {},
    removeStudent: () => {},
  })
  const [studentPlansInlineActions, setStudentPlansInlineActions] = useState({
    canResetStudent: false,
    openResetDialog: () => {},
  })
  const [teacherInlineActions, setTeacherInlineActions] = useState({
    openSingleForm: () => {},
    openBulkForm: () => {},
  })
  const [teacherAttendanceInlineActions, setTeacherAttendanceInlineActions] = useState({
    openDelayDialog: () => {},
    asrTimeLabel: "-",
    graceSummary: "",
  })
  const [adminInlineActions, setAdminInlineActions] = useState({
    openRoleForm: () => {},
    openAdminForm: () => {},
  })
  const [circleInlineActions, setCircleInlineActions] = useState({
    openAddDialog: () => {},
  })
  const [enrollmentInlineActions, setEnrollmentInlineActions] = useState({
    toggleEnrollmentStatus: () => {},
    openTemplates: () => {},
    copyEnrollmentLink: () => {},
    isEnrollmentOpen: true,
    isStatusLoading: false,
    copiedLink: false,
  })
  const [reportsInlineActions, setReportsInlineActions] = useState({
    filter: "all" as "all" | "unread" | "read" | "archived",
    showAll: () => {},
    showUnread: () => {},
    showRead: () => {},
    showArchived: () => {},
  })
  const [studentDailyInlineActions, setStudentDailyInlineActions] = useState({
    openTemplates: () => {},
  })
  const [examInlineActions, setExamInlineActions] = useState({
    openSchedulesOverview: () => {},
    openExamResults: () => {},
    openSettings: () => {},
  })
  const [pathwaysInlineActions, setPathwaysInlineActions] = useState({
    openTemplates: () => {},
    openResults: () => {},
    openAddLevel: () => {},
  })
  const [recitationDayInlineActions, setRecitationDayInlineActions] = useState({
    openTemplates: () => {},
    openArchive: () => {},
  })
  const [whatsAppSendInlineActions, setWhatsAppSendInlineActions] = useState({
    toggleRepliesView: () => {},
    isRepliesView: false,
  })
  const [semestersInlineActions, setSemestersInlineActions] = useState({
    openEndSemesterDialog: () => {},
    hasActiveSemester: false,
  })
  const [storeInlineActions, setStoreInlineActions] = useState({
    openOrders: () => {},
    openAddProduct: () => {},
    openAddCategory: () => {},
  })
  const [storeDashboardView, setStoreDashboardView] = useState<"catalog" | "orders">("catalog")
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppStatusSummary | null>(null)
  const [isWhatsAppQrDialogOpen, setIsWhatsAppQrDialogOpen] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const storedUserName = localStorage.getItem("userName")
    if (storedUserName) {
      setUserName(storedUserName)
    }
  }, [])

  useEffect(() => {
    if (!authVerified) {
      return
    }

    let cancelled = false

    const loadPageContext = async () => {
      try {
        const [rolesResponse, semestersResponse] = await Promise.all([
          fetch("/api/roles", { cache: "no-store" }).catch(() => null),
          fetch("/api/semesters?t=" + Date.now(), { cache: "no-store" }).catch(() => null),
        ])

        if (!cancelled && rolesResponse?.ok) {
          const rolesPayload = await rolesResponse.json()
          const permissionsMap = (rolesPayload?.permissions || {}) as Record<string, string[]>
          const resolvedPermissions = permissionsMap[role] || permissionsMap[String(role || "").trim()] || []
          setUserPermissions(resolvedPermissions)
        }

        if (!cancelled && semestersResponse?.ok) {
          const semestersPayload = await semestersResponse.json()
          setHasActiveSemester(Boolean(semestersPayload?.activeSemesterId))
        }
      } finally {
        if (!cancelled) {
          setIsContextLoading(false)
        }
      }
    }

    void loadPageContext()

    return () => {
      cancelled = true
    }
  }, [authVerified, role])

  const hasPermission = useMemo(
    () => (permissionKey: string) => hasPermissionAccess(userPermissions, permissionKey, isFullAccess),
    [isFullAccess, userPermissions],
  )

  const visibleSections = useMemo(() => {
    const context: DashboardContext = { hasPermission, hasActiveSemester }

    return adminSections
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => {
            if (item.isVisible) {
              return item.isVisible(context)
            }

            if (item.permissionKey) {
              return hasPermission(item.permissionKey)
            }

            return true
          })
          .map((item) => ({
            ...item,
            resolvedLabel: item.getLabel?.(context) ?? item.label,
            resolvedPath: item.getPath(context),
          })),
      }))
      .filter((section) => section.items.length > 0)
  }, [hasActiveSemester, hasPermission])

  const canOpenWhatsAppQr = hasPermission("باركود الواتساب")
  const canViewWhatsAppQueue = hasPermission("الإرسال إلى أولياء الأمور")
  const canAddSingle = hasPermission("إضافة طالب")
  const canAddBulk = hasPermission("إضافة جماعية")
  const whatsAppNeedsAttention = canOpenWhatsAppQr && Boolean(whatsAppStatus && !isConnectedWhatsAppStatus(whatsAppStatus))
  const requestedTarget = useMemo(() => searchParams?.get("target")?.trim() || "", [searchParams])

  useEffect(() => {
    if (visibleSections.length === 0) {
      setActiveSectionKey("")
      return
    }

    if (!visibleSections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey("")
    }
  }, [activeSectionKey, visibleSections])

  useEffect(() => {
    if (visibleSections.length === 0) {
      setExpandedSectionKeys([])
      return
    }

    setExpandedSectionKeys((current) => current.filter((key) => visibleSections.some((section) => section.key === key)))
  }, [visibleSections])

  useEffect(() => {
    if (visibleSections.length === 0 || !requestedTarget) {
      return
    }

    const [requestedBasePath] = requestedTarget.split("?")
    let matchedSectionKey = ""
    let matchedActionKey = ""
    let nextStoreView: "catalog" | "orders" = "catalog"

    for (const section of visibleSections) {
      for (const item of section.items) {
        const [itemBasePath] = item.resolvedPath.split("?")
        const isExactMatch = item.resolvedPath === requestedTarget
        const isBaseMatch = itemBasePath === requestedBasePath
        const isStoreOrdersMatch = requestedBasePath === "/admin/store-orders" && itemBasePath === "/admin/store-management"

        if (!isExactMatch && !isBaseMatch && !isStoreOrdersMatch) {
          continue
        }

        matchedSectionKey = section.key
        matchedActionKey = item.key
        nextStoreView = isStoreOrdersMatch ? "orders" : "catalog"
        break
      }

      if (matchedActionKey) {
        break
      }
    }

    if (!matchedSectionKey || !matchedActionKey) {
      return
    }

    setActiveSectionKey(matchedSectionKey)
    setActiveActionKey(matchedActionKey)
    setExpandedSectionKeys((current) => Array.from(new Set([...current.filter((key) => key !== "reports"), matchedSectionKey])))
    setStoreDashboardView(nextStoreView)
  }, [requestedTarget, visibleSections])

  useEffect(() => {
    if (visibleSections.length === 0) {
      return
    }

    if (activeSectionKey || activeActionKey) {
      return
    }

    const reportsSection = visibleSections.find((section) => section.key === "reports")
    const statisticsAction = reportsSection?.items.find((item) => item.key === "reports-stats")
    const fallbackSection = visibleSections[0] ?? null
    const fallbackAction = fallbackSection?.items[0] ?? null
    const nextSection = statisticsAction ? reportsSection : fallbackSection
    const nextAction = statisticsAction ?? fallbackAction

    if (!nextSection || !nextAction) {
      return
    }

    setActiveSectionKey(nextSection.key)
    setActiveActionKey(nextAction.key)
    setExpandedSectionKeys((current) => current.filter((key) => key !== "reports"))
  }, [activeActionKey, activeSectionKey, visibleSections])

  const activeSection = useMemo(
    () => visibleSections.find((section) => section.key === activeSectionKey) ?? null,
    [activeSectionKey, visibleSections],
  )

  useEffect(() => {
    if (!activeSection) {
      setActiveActionKey("")
      return
    }

    if (activeActionKey && !activeSection.items.some((item) => item.key === activeActionKey)) {
      setActiveActionKey("")
    }
  }, [activeActionKey, activeSection])

  const activeAction = useMemo(
    () => activeSection?.items.find((item) => item.key === activeActionKey) ?? null,
    [activeActionKey, activeSection],
  )

  const activeEmbeddedPath = useMemo(() => {
    if (!activeAction?.resolvedPath) {
      return ""
    }

    const [basePath, queryString = ""] = activeAction.resolvedPath.split("?")
    const params = new URLSearchParams(queryString)
    params.set("embedded", "1")
    const nextQuery = params.toString()

    return nextQuery ? `${basePath}?${nextQuery}` : `${basePath}?embedded=1`
  }, [activeAction])

  const activeDialogAction = useMemo(() => {
    if (!activeAction?.resolvedPath) {
      return null
    }

    if (activeAction.resolvedPath.includes("action=add-student")) {
      return "add-student" as const
    }

    if (activeAction.resolvedPath.includes("action=bulk-add")) {
      return "bulk-add" as const
    }

    if (activeAction.resolvedPath.includes("action=edit-student") || activeAction.resolvedPath.includes("action=edit-points")) {
      return "edit-student" as const
    }

    return null
  }, [activeAction])

  const activeInlinePage = useMemo(() => {
    if (!activeAction?.resolvedPath) {
      return null
    }

    if (activeAction.resolvedPath.startsWith("/admin/student-records")) {
      return "student-records" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/admins")) {
      return "admins" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/teachers")) {
      return "teachers" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/circles")) {
      return "circles" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/enrollment-requests")) {
      return "enrollment-requests" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/students-achievements")) {
      return "students-achievements" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/student-plans")) {
      return "student-plans" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/teacher-attendance")) {
      return "teacher-attendance" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/reports")) {
      return "reports" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/student-daily-attendance")) {
      return "student-daily-attendance" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/statistics")) {
      return "statistics" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/notifications")) {
      return "notifications" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/permissions")) {
      return "permissions" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/site-design")) {
      return "site-design" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/finance")) {
      return "finance" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/store-management")) {
      return "store-management" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/whatsapp-send")) {
      return "whatsapp-send" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/semesters")) {
      return "semesters" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/exams")) {
      return "exams" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/pathways")) {
      return "pathways" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/guess-images")) {
      return "guess-images" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/auction-questions")) {
      return "auction-questions" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/millionaire-questions")) {
      return "millionaire-questions" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/letter-hive-questions")) {
      return "letter-hive-questions" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/questions")) {
      return "questions" as const
    }

    if (activeAction.resolvedPath.startsWith("/admin/recitation-day")) {
      return "recitation-day" as const
    }

    return null
  }, [activeAction])

  useEffect(() => {
    setInlineDialogAction(activeDialogAction)
  }, [activeDialogAction])

  useEffect(() => {
    if (inlineDialogAction !== "edit-student") {
      setEditStudentInlineActions({
        canTransfer: false,
        canRemove: false,
        hasSelectedStudent: false,
        isSubmitting: false,
      })
    }
  }, [inlineDialogAction])

  useEffect(() => {
    if (activeInlinePage !== "student-plans") {
      setStudentPlansInlineActions({
        canResetStudent: false,
        openResetDialog: () => {},
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "teachers") {
      setTeacherInlineActions({
        openSingleForm: () => {},
        openBulkForm: () => {},
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "teacher-attendance") {
      setTeacherAttendanceInlineActions({
        openDelayDialog: () => {},
        asrTimeLabel: "-",
        graceSummary: "",
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "admins") {
      setAdminInlineActions({
        openRoleForm: () => {},
        openAdminForm: () => {},
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "circles") {
      setCircleInlineActions({
        openAddDialog: () => {},
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "enrollment-requests") {
      setEnrollmentInlineActions({
        toggleEnrollmentStatus: () => {},
        openTemplates: () => {},
        copyEnrollmentLink: () => {},
        isEnrollmentOpen: true,
        isStatusLoading: false,
        copiedLink: false,
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "exams") {
      setExamInlineActions({
        openSchedulesOverview: () => {},
        openExamResults: () => {},
        openSettings: () => {},
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "pathways") {
      setPathwaysInlineActions({
        openTemplates: () => {},
        openResults: () => {},
        openAddLevel: () => {},
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "recitation-day") {
      setRecitationDayInlineActions({
        openTemplates: () => {},
        openArchive: () => {},
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "whatsapp-send") {
      setWhatsAppSendInlineActions({
        toggleRepliesView: () => {},
        isRepliesView: false,
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "semesters") {
      setSemestersInlineActions({
        openEndSemesterDialog: () => {},
        hasActiveSemester: false,
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "store-management") {
      setStoreInlineActions({
        openOrders: () => {},
        openAddProduct: () => {},
        openAddCategory: () => {},
      })
      setStoreDashboardView("catalog")
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (activeInlinePage !== "reports") {
      setReportsInlineActions({
        filter: "all",
        showAll: () => {},
        showUnread: () => {},
        showRead: () => {},
        showArchived: () => {},
      })
    }
  }, [activeInlinePage])

  useEffect(() => {
    if (!canOpenWhatsAppQr) {
      setWhatsAppStatus(null)
      return
    }

    void fetchWhatsAppStatus()
  }, [canOpenWhatsAppQr])

  useEffect(() => {
    if (activeInlinePage !== "student-daily-attendance") {
      setStudentDailyInlineActions({
        openTemplates: () => {},
      })
    }
  }, [activeInlinePage])

  const toggleSection = (sectionKey: string) => {
    setExpandedSectionKeys((current) =>
      current.includes(sectionKey) ? current.filter((key) => key !== sectionKey) : [...current, sectionKey],
    )
  }

  const fetchWhatsAppStatus = async () => {
    try {
      const response = await fetch(`/api/whatsapp/status?t=${Date.now()}`, { cache: "no-store" })
      if (!response.ok) {
        return null
      }

      const data = (await response.json()) as WhatsAppStatusSummary
      setWhatsAppStatus(data)
      return data
    } catch {
      return null
    }
  }

  const openWhatsAppEntryPoint = async () => {
    await fetchWhatsAppStatus()
    setIsWhatsAppQrDialogOpen(true)
  }

  if (authLoading || !authVerified || isContextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7faff]" dir="rtl">
        <SiteLoader size="lg" />
      </div>
    )
  }

  return (
    <div dir="rtl" className="h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fbfb,#eef5f5)] text-right text-[#17324e]">
      <div className="flex h-full w-full items-start lg:flex-row">
        <aside className="hidden h-screen w-[320px] shrink-0 border-l border-white/60 bg-white/95 shadow-[10px_0_35px_rgba(15,23,42,0.04)] lg:block">
          <div className="flex h-full flex-col bg-white">
            <div className="border-b border-[#e7eef2] px-4 py-5 text-right">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex w-full cursor-pointer items-center justify-start gap-3 rounded-2xl outline-none transition-opacity hover:opacity-90"
              >
                <img src="/%D8%B4%D8%B9%D8%A7%D8%B1-%D8%A7%D9%84%D8%AC%D9%85%D8%B9%D9%8A%D8%A9.png" alt="شعار الجمعية" className="h-12 w-auto object-contain" />
                <div className="text-right">
                  <p className="whitespace-nowrap text-base font-extrabold leading-tight text-[#13253a]">لوحة التحكم</p>
                </div>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 text-right">
              <div className="space-y-3">
                {visibleSections.map((section, index) => {
                  const SectionIcon = section.icon
                  const isExpanded = expandedSectionKeys.includes(section.key)

                  return (
                    <div key={section.key} className={index >= 4 ? "border-t border-[var(--border)] pt-3" : undefined}>
                      <button
                        type="button"
                        onClick={() => toggleSection(section.key)}
                        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-[15px] font-medium text-[var(--challenge-primary)] transition-all duration-200 hover:text-[var(--primary)]"
                      >
                        <div className="flex items-center gap-2.5">
                          <span>{section.title}</span>
                          <SectionIcon className="size-4 text-[var(--button-outline-text)]" />
                        </div>
                        <ChevronDown className={`size-4 transition-transform duration-300 ease-out ${isExpanded ? "rotate-180 text-[var(--primary)]" : "rotate-0 text-[var(--button-outline-text)]"}`} />
                      </button>

                      <div className={`grid transition-all duration-300 ease-out ${isExpanded ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="overflow-hidden">
                          <div className="theme-admin-muted-surface space-y-1.5 rounded-2xl p-2">
                          {section.items.map((item) => {
                            const ItemIcon = item.icon
                            const isSelected = activeAction?.key === item.key

                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => {
                                  setActiveSectionKey(section.key)
                                  setActiveActionKey(item.key)
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                                  isSelected
                                    ? "theme-chip-selected ring-1 ring-[color:color-mix(in_srgb,var(--primary)_14%,transparent_86%)]"
                                    : "theme-chip-hover text-[#36506f]"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span>{item.resolvedLabel}</span>
                                  <ItemIcon className="size-4 text-[var(--button-outline-text)]" />
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          </div>
        </aside>

        <main className="h-screen min-w-0 flex-1 overflow-y-auto px-4 py-4 text-right md:px-6 lg:px-8 lg:py-8">
          <div className="w-full">
            <div className="mb-6 rounded-[2rem] border border-white/70 bg-white/90 px-4 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:px-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-right lg:shrink-0">
                  <p className="text-xs font-medium text-[#6d7f90]">مرحبًا</p>
                  <p className="text-sm font-bold text-[#10263c]">{userName}</p>
                </div>

                {activeInlinePage === "teacher-attendance" ? (
                  <div className="hidden flex-1 items-center justify-center lg:flex">
                    <div className="text-center">
                      <p className="text-sm font-bold text-[#20335f]">أذان العصر اليوم: {teacherAttendanceInlineActions.asrTimeLabel}</p>
                      <p className="mt-1 text-xs font-medium text-[#6c7d95]">{teacherAttendanceInlineActions.graceSummary}</p>
                    </div>
                  </div>
                ) : null}

                {activeInlinePage === "reports" ? (
                  <div className="hidden flex-1 items-center justify-center lg:flex">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => reportsInlineActions.showAll()}
                        className={getDashboardFilterButtonClass(reportsInlineActions.filter === "all")}
                      >
                        الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => reportsInlineActions.showUnread()}
                        className={getDashboardFilterButtonClass(reportsInlineActions.filter === "unread")}
                      >
                        غير مقروءة
                      </button>
                      <button
                        type="button"
                        onClick={() => reportsInlineActions.showRead()}
                        className={getDashboardFilterButtonClass(reportsInlineActions.filter === "read")}
                      >
                        مقروءة
                      </button>
                      <button
                        type="button"
                        onClick={() => reportsInlineActions.showArchived()}
                        className={getDashboardFilterButtonClass(reportsInlineActions.filter === "archived")}
                      >
                        مؤرشفة
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-3">
                  {activeInlinePage === "teachers" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={dashboardOutlineButtonClass}
                        >
                          <Plus className="h-4 w-4" />
                          إضافة
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={dashboardDropdownContentClass}>
                        <DropdownMenuItem onClick={() => teacherInlineActions.openSingleForm()} className={dashboardDropdownItemClass}>
                          إضافة معلم
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => teacherInlineActions.openBulkForm()} className={dashboardDropdownItemClass}>
                          إضافة جماعية
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  {activeInlinePage === "admins" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={dashboardOutlineButtonClass}
                        >
                          <Plus className="h-4 w-4" />
                          إضافة
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={dashboardDropdownContentClass}>
                        <DropdownMenuItem onClick={() => adminInlineActions.openRoleForm()} className={dashboardDropdownItemClass}>
                          إضافة مسمى
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => adminInlineActions.openAdminForm()} className={dashboardDropdownItemClass}>
                          إضافة إداري
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  {activeInlinePage === "circles" ? (
                    <button
                      type="button"
                      onClick={() => circleInlineActions.openAddDialog()}
                      className={dashboardOutlineButtonClass}
                    >
                      <Plus className="h-4 w-4" />
                      إضافة
                    </button>
                  ) : null}
                  {activeInlinePage === "enrollment-requests" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => enrollmentInlineActions.toggleEnrollmentStatus()}
                        disabled={enrollmentInlineActions.isStatusLoading}
                        className={`inline-flex h-12 min-w-[148px] items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition-all ${
                          enrollmentInlineActions.isEnrollmentOpen
                            ? "border-red-200 bg-white text-red-600 shadow-[0_10px_30px_rgba(220,38,38,0.08)] hover:bg-red-50"
                            : "border-emerald-200 bg-white text-emerald-700 shadow-[0_10px_30px_rgba(5,150,105,0.08)] hover:bg-emerald-50"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {enrollmentInlineActions.isStatusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : enrollmentInlineActions.isEnrollmentOpen ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        {enrollmentInlineActions.isEnrollmentOpen ? "إقفال التسجيل" : "فتح التسجيل"}
                      </button>
                      <button
                        type="button"
                        onClick={() => enrollmentInlineActions.copyEnrollmentLink()}
                        className={`${dashboardSolidButtonClass} min-w-[148px] justify-center px-4`}
                      >
                        {enrollmentInlineActions.copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        نسخ الرابط
                      </button>
                      <button
                        type="button"
                        onClick={() => enrollmentInlineActions.openTemplates()}
                        className={`${dashboardOutlineButtonClass} min-w-[148px] justify-center px-4`}
                      >
                        القوالب
                      </button>
                    </>
                  ) : null}
                  {activeInlinePage === "teacher-attendance" ? (
                    <button
                      type="button"
                      onClick={() => teacherAttendanceInlineActions.openDelayDialog()}
                      className={dashboardOutlineButtonClass}
                    >
                      مدة التأخير
                    </button>
                  ) : null}
                  {activeInlinePage === "reports" ? (
                    <div className="flex items-center gap-3 lg:hidden">
                      <button
                        type="button"
                        onClick={() => reportsInlineActions.showAll()}
                        className={getDashboardFilterButtonClass(reportsInlineActions.filter === "all")}
                      >
                        الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => reportsInlineActions.showUnread()}
                        className={getDashboardFilterButtonClass(reportsInlineActions.filter === "unread")}
                      >
                        غير مقروءة
                      </button>
                      <button
                        type="button"
                        onClick={() => reportsInlineActions.showRead()}
                        className={getDashboardFilterButtonClass(reportsInlineActions.filter === "read")}
                      >
                        مقروءة
                      </button>
                      <button
                        type="button"
                        onClick={() => reportsInlineActions.showArchived()}
                        className={getDashboardFilterButtonClass(reportsInlineActions.filter === "archived")}
                      >
                        مؤرشفة
                      </button>
                    </div>
                  ) : null}
                  {activeInlinePage === "student-daily-attendance" ? (
                    <button
                      type="button"
                      onClick={() => studentDailyInlineActions.openTemplates()}
                      className={dashboardOutlineButtonClass}
                    >
                      القوالب
                    </button>
                  ) : null}
                  {activeInlinePage === "exams" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => examInlineActions.openSchedulesOverview()}
                        className={dashboardSolidButtonClass}
                      >
                        <CalendarDays className="h-4 w-4" />
                        المواعيد
                      </button>
                      <button
                        type="button"
                        onClick={() => examInlineActions.openExamResults()}
                        className={dashboardSolidButtonClass}
                      >
                        <Bell className="h-4 w-4" />
                        نتائج الاختبارات
                      </button>
                      <button
                        type="button"
                        onClick={() => examInlineActions.openSettings()}
                        className={dashboardSolidButtonClass}
                      >
                        <Settings className="h-4 w-4" />
                        إعدادات الاختبارات
                      </button>
                    </>
                  ) : null}
                  {activeInlinePage === "pathways" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => pathwaysInlineActions.openAddLevel()}
                        className={dashboardSolidButtonClass}
                      >
                        <Plus className="h-4 w-4" />
                        إضافة
                      </button>
                      <button
                        type="button"
                        onClick={() => pathwaysInlineActions.openTemplates()}
                        className={dashboardOutlineButtonClass}
                      >
                        القالب
                      </button>
                      <button
                        type="button"
                        onClick={() => pathwaysInlineActions.openResults()}
                        className={dashboardSolidButtonClass}
                      >
                        <FileText className="h-4 w-4" />
                        نتائج المسار
                      </button>
                    </>
                  ) : null}
                  {activeInlinePage === "recitation-day" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => recitationDayInlineActions.openTemplates()}
                        className={dashboardOutlineButtonClass}
                      >
                        القوالب
                      </button>
                      <button
                        type="button"
                        onClick={() => recitationDayInlineActions.openArchive()}
                        className={dashboardSolidButtonClass}
                      >
                        <Archive className="h-4 w-4" />
                        الأرشيف
                      </button>
                    </>
                  ) : null}
                  {activeInlinePage === "store-management" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setStoreDashboardView((current) => (current === "orders" ? "catalog" : "orders"))}
                        className={dashboardSolidButtonClass}
                      >
                        <ShoppingBag className="h-4 w-4" />
                        {storeDashboardView === "orders" ? "العودة للمتجر" : "طلبات الطلاب"}
                      </button>
                      {storeDashboardView === "orders" ? null : <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={dashboardOutlineButtonClass}
                          >
                            <Plus className="h-4 w-4" />
                            إضافة
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={dashboardDropdownContentClass}>
                          <DropdownMenuItem onClick={() => storeInlineActions.openAddProduct()} className={dashboardDropdownItemClass}>
                            إضافة منتج
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => storeInlineActions.openAddCategory()} className={dashboardDropdownItemClass}>
                            إضافة فئة
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>}
                    </>
                  ) : null}
                  {((inlineDialogAction === "add-student" && canAddBulk) || (inlineDialogAction === "bulk-add" && canAddSingle)) ? (
                    <button
                      type="button"
                      onClick={() => setInlineDialogAction(inlineDialogAction === "add-student" ? "bulk-add" : "add-student")}
                      className={dashboardOutlineButtonClass}
                    >
                      {inlineDialogAction === "add-student" ? "إضافة جماعية" : "إضافة طالب"}
                    </button>
                  ) : null}
                  {inlineDialogAction === "edit-student" && editStudentInlineActions.canTransfer ? (
                    <button
                      type="button"
                      onClick={() => editStudentInlineActions.openMoveDialog()}
                      disabled={!editStudentInlineActions.hasSelectedStudent || editStudentInlineActions.isSubmitting}
                      className={`${dashboardOutlineButtonClass} gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      نقل الطالب
                    </button>
                  ) : null}
                  {inlineDialogAction === "edit-student" && editStudentInlineActions.canRemove ? (
                    <button
                      type="button"
                      onClick={() => editStudentInlineActions.removeStudent()}
                      disabled={!editStudentInlineActions.hasSelectedStudent || editStudentInlineActions.isSubmitting}
                      className="inline-flex h-12 items-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-bold text-red-600 shadow-[0_10px_30px_rgba(220,38,38,0.08)] transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      إزالة الطالب
                    </button>
                  ) : null}
                  {activeInlinePage === "student-plans" && studentPlansInlineActions.canResetStudent ? (
                    <button
                      type="button"
                      onClick={() => studentPlansInlineActions.openResetDialog()}
                      className="inline-flex h-12 items-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-bold text-red-600 shadow-[0_10px_30px_rgba(220,38,38,0.08)] transition-all hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      إعادة حفظ طالب
                    </button>
                  ) : null}
                  {activeInlinePage === "whatsapp-send" ? (
                    <button
                      type="button"
                      onClick={() => whatsAppSendInlineActions.toggleRepliesView()}
                      className={dashboardOutlineButtonClass}
                    >
                      {whatsAppSendInlineActions.isRepliesView ? "عرض الإرسال" : "عرض الردود"}
                    </button>
                  ) : null}
                  {activeInlinePage === "semesters" && semestersInlineActions.hasActiveSemester ? (
                    <button
                      type="button"
                      onClick={() => semestersInlineActions.openEndSemesterDialog()}
                      className={dashboardSolidButtonClass}
                    >
                      إنهاء الفصل
                    </button>
                  ) : null}
                  {canViewWhatsAppQueue ? (
                    <WhatsAppQueueIndicator
                      enabled={canViewWhatsAppQueue}
                      buttonClassName={dashboardSquareOutlineButtonClass}
                      iconClassName="text-[var(--button-outline-text)]"
                    />
                  ) : null}
                  {canOpenWhatsAppQr ? (
                    <button
                      type="button"
                      onClick={() => void openWhatsAppEntryPoint()}
                      className={dashboardSquareOutlineButtonClass}
                      aria-label="باركود الواتساب"
                    >
                      <QrCode className="h-5 w-5" />
                      {whatsAppNeedsAttention ? (
                        <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#fff7ed] text-[11px] font-black text-[#f97316] shadow-[0_0_0_4px_rgba(249,115,22,0.12)]">
                          !
                        </span>
                      ) : null}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[1280px] overflow-x-hidden px-1 md:px-2">
              <div className="space-y-6">
                <div className="mx-auto w-full max-w-[1120px]">
                  {activeAction ? (
                    activeDialogAction ? (
                      inlineDialogAction === "edit-student" || activeDialogAction === "edit-student" ? (
                        <GlobalEditStudentDialog
                          displayMode="inline"
                          onInlineActionsChange={setEditStudentInlineActions}
                          onCloseComplete={() => {
                            setInlineDialogAction(null)
                            setActiveActionKey("")
                          }}
                        />
                      ) : (
                        <GlobalAddStudentDialog
                          forcedAction={(inlineDialogAction ?? activeDialogAction) as "add-student" | "bulk-add"}
                          displayMode="inline"
                          hideSwitchActions
                          onCloseComplete={() => {
                            setInlineDialogAction(null)
                            setActiveActionKey("")
                          }}
                        />
                      )
                    ) : activeInlinePage === "student-records" ? (
                      <StudentRecordsContent displayMode="inline" />
                    ) : activeInlinePage === "teacher-attendance" ? (
                      <TeacherAttendanceContent displayMode="inline" onInlineActionsChange={setTeacherAttendanceInlineActions} />
                    ) : activeInlinePage === "reports" ? (
                      <ReportsPageContent displayMode="inline" onInlineActionsChange={setReportsInlineActions} />
                    ) : activeInlinePage === "student-daily-attendance" ? (
                      <StudentDailyAttendanceContent displayMode="inline" onInlineActionsChange={setStudentDailyInlineActions} />
                    ) : activeInlinePage === "statistics" ? (
                      <StatisticsContent displayMode="inline" />
                    ) : activeInlinePage === "notifications" ? (
                      <AdminNotificationsContent displayMode="inline" />
                    ) : activeInlinePage === "permissions" ? (
                      <PermissionsContent displayMode="inline" />
                    ) : activeInlinePage === "site-design" ? (
                      <SiteDesignContent displayMode="inline" />
                    ) : activeInlinePage === "finance" ? (
                      <FinanceContent displayMode="inline" />
                    ) : activeInlinePage === "store-management" ? (
                      storeDashboardView === "orders" ? (
                        <StoreOrdersContent displayMode="inline" onBack={() => setStoreDashboardView("catalog")} />
                      ) : (
                        <StoreManagementContent displayMode="inline" onInlineActionsChange={setStoreInlineActions} />
                      )
                    ) : activeInlinePage === "whatsapp-send" ? (
                      <WhatsAppSendContent displayMode="inline" onInlineActionsChange={setWhatsAppSendInlineActions} />
                    ) : activeInlinePage === "semesters" ? (
                      <SemestersContent displayMode="inline" onInlineActionsChange={setSemestersInlineActions} />
                    ) : activeInlinePage === "exams" ? (
                      <ExamsContent displayMode="inline" onInlineActionsChange={setExamInlineActions} />
                    ) : activeInlinePage === "pathways" ? (
                      <PathwaysContent displayMode="inline" onInlineActionsChange={setPathwaysInlineActions} />
                    ) : activeInlinePage === "guess-images" ? (
                      <GuessImagesManagementContent displayMode="inline" />
                    ) : activeInlinePage === "auction-questions" ? (
                      <AuctionQuestionsAdminContent displayMode="inline" />
                    ) : activeInlinePage === "millionaire-questions" ? (
                      <MillionaireQuestionsAdminContent displayMode="inline" />
                    ) : activeInlinePage === "letter-hive-questions" ? (
                      <LetterHiveQuestionsAdminContent displayMode="inline" />
                    ) : activeInlinePage === "questions" ? (
                      <QuestionsDatabaseContent displayMode="inline" />
                    ) : activeInlinePage === "recitation-day" ? (
                      <RecitationDayContent displayMode="inline" onInlineActionsChange={setRecitationDayInlineActions} />
                    ) : activeInlinePage === "admins" ? (
                      <AdminsManagementContent displayMode="inline" onInlineActionsChange={setAdminInlineActions} />
                    ) : activeInlinePage === "teachers" ? (
                      <TeacherManagementContent displayMode="inline" onInlineActionsChange={setTeacherInlineActions} />
                    ) : activeInlinePage === "circles" ? (
                      <CircleManagementContent displayMode="inline" onInlineActionsChange={setCircleInlineActions} />
                    ) : activeInlinePage === "enrollment-requests" ? (
                      <EnrollmentRequestsContent displayMode="inline" onInlineActionsChange={setEnrollmentInlineActions} />
                    ) : activeInlinePage === "student-plans" ? (
                      <StudentPlansContent displayMode="inline" onInlineActionsChange={setStudentPlansInlineActions} />
                    ) : activeInlinePage === "students-achievements" ? (
                      <StudentsAchievementsAdmin displayMode="inline" />
                    ) : (
                      <div className="overflow-hidden rounded-[1.9rem] bg-transparent shadow-none">
                        <div className="h-[calc(100vh-210px)] min-h-[720px] bg-transparent">
                          <iframe
                            key={activeAction.key}
                            src={activeEmbeddedPath}
                            title={activeAction.resolvedLabel}
                            className="h-full w-full border-0 bg-white"
                          />
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <WhatsAppQrDialog open={isWhatsAppQrDialogOpen} onOpenChange={setIsWhatsAppQrDialogOpen} initialStatus={whatsAppStatus} />
    </div>
  )
}