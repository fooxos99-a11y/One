"use client";

import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ChevronDown,
  ChevronLeft,
  User,
  LogOut,
  Users,
  Menu,
  ClipboardCheck,
  Trophy,
  Store,
  Map,
  Target,
  MessageSquare,
  Home,
  Gamepad2,
  Star,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  Settings,
  Eye,
  FileText,
  Award,
  Edit2,
  BookOpen,
  ShieldCheck,
  Zap,
  Bell,
  Send,
  Calendar,
  ShoppingBag,
  Phone,
  Banknote,
  BarChart3,
  Trash2,
  BookMarked,
  CalendarDays,
  QrCode,
} from "lucide-react";

import { GlobalAddStudentDialog } from "@/components/global-add-student-dialog";
import { WhatsAppQueueIndicator } from "@/components/whatsapp-queue-indicator"
import { WhatsAppQrDialog } from "@/components/whatsapp-qr-dialog"
import { createClient } from "@/lib/supabase/client";
import { hasPermissionAccess } from "@/lib/admin-permissions";

import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

import { TeacherAttendanceModal } from "@/components/teacher-attendance-modal";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoginForm } from "@/components/login-form";
import { SiteLoader } from "@/components/ui/site-loader";
import {
  clearNotificationLocalState,
  syncWebPushSubscription,
  unregisterWebPushSubscription,
} from "@/lib/push-subscription-client";
import { clearClientAuthState, performClientLogout } from "@/lib/auth/logout-client";

const NOTIFICATION_PERMISSION_UPDATED_EVENT = "app-notification-permission-updated";

interface Circle {
  name: string;

  studentCount: number;
}

const CIRCLES_CACHE_DURATION = 5 * 60 * 1000;
const HEADER_RANK_CACHE_DURATION = 2 * 60 * 1000;
const HEADER_STATS_CACHE_DURATION = 2 * 60 * 1000;
const TEACHER_INFO_CACHE_DURATION = 5 * 60 * 1000;
const NOTIFICATION_START_AT_CACHE_DURATION = 10 * 60 * 1000;
const HEADER_LINKS = [
  { label: "الرئيسية", target: "#home" },
  { label: "الإنجازات", target: "#achievements" },
  { label: "أفضل الحلقات", target: "/halaqat/all" },
];

function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

function isStandaloneApp() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function readCachedJson<T>(key: string, maxAgeMs: number): T | null {
  try {
    const rawValue = localStorage.getItem(key);
    const rawTimestamp = localStorage.getItem(`${key}:ts`);
    if (!rawValue || !rawTimestamp) return null;
    if (Date.now() - Number(rawTimestamp) > maxAgeMs) return null;
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function writeCachedJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(`${key}:ts`, Date.now().toString());
  } catch {}
}

function readCachedText(key: string, maxAgeMs: number) {
  try {
    const value = localStorage.getItem(key);
    const rawTimestamp = localStorage.getItem(`${key}:ts`);
    if (!value || !rawTimestamp) return null;
    if (Date.now() - Number(rawTimestamp) > maxAgeMs) return null;
    return value;
  } catch {
    return null;
  }
}

function writeCachedText(key: string, value: string | null) {
  try {
    if (value == null) {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}:ts`);
      return;
    }
    localStorage.setItem(key, value);
    localStorage.setItem(`${key}:ts`, Date.now().toString());
  } catch {}
}

function getHeaderRoleLabel(role: string | null, isAdmin: boolean, accountNumber: number | null) {
  if (isAdmin) {
    if (accountNumber === 2 || role === "admin") {
      return "مدير"
    }

    if (role === "supervisor") {
      return "مشرف"
    }

    return role || "مشرف"
  }

  if (role === "teacher") return "معلم"
  if (role === "deputy_teacher") return "نائب معلم"
  if (role === "student") return "طالب"
  return ""
}

function NavItem({
  icon: Icon,

  label,

  onClick,

  gold,

  indent,

  disabled,
  labelClassName,
  showAlertBadge,
}: {
  icon: React.ElementType;

  label: string;

  onClick: () => void;

  gold?: boolean;

  indent?: boolean;

  disabled?: boolean;

  labelClassName?: string;

  showAlertBadge?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group relative cursor-pointer

        ${indent ? "pr-8" : ""}

        ${disabled ? "cursor-not-allowed opacity-55 hover:bg-transparent" : "cursor-pointer"}

        ${gold ? "text-[#3453a7] hover:bg-[#3453a7]/10" : "text-[#111111] hover:bg-black/5"}`}
    >
      <Icon
        size={17}
        className={`flex-shrink-0 transition-all duration-200 group-hover:scale-110
          ${gold ? "text-[#3453a7]" : "text-black/55 group-hover:text-black/80"}
          ${disabled ? "group-hover:scale-100 group-hover:text-black/55" : ""}`}
      />

      <span className={`flex-1 text-right leading-tight ${labelClassName ?? ""}`.trim()}>{label}</span>

      {showAlertBadge ? (
        <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#fff7ed] text-[11px] font-black text-[#f97316] shadow-[0_0_0_4px_rgba(249,115,22,0.12)]" aria-hidden="true">
          !
        </span>
      ) : null}
    </button>
  );
}

type WhatsAppStatusSummary = {
  status?: string;
  ready?: boolean;
  authenticated?: boolean;
  workerOnline?: boolean;
}

function isConnectedWhatsAppStatus(status: WhatsAppStatusSummary | null) {
  return Boolean(status?.ready && status?.authenticated && status?.status === "connected");
}

function HeaderRankTrophy() {
  return (
    <div className="relative flex h-6 w-6 translate-y-[1px] items-center justify-center sm:h-6.5 sm:w-6.5">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-[19px] w-[19px] text-[#ffd766] drop-shadow-[0_0_7px_rgba(255,215,102,0.30)] sm:h-[17px] sm:w-[17px]"
        fill="currentColor"
      >
        <path d="M8 2.75a1.25 1.25 0 0 0-1.25 1.25v1H4.75A1.75 1.75 0 0 0 3 6.96c.2 2.58 1.72 4.72 4.12 5.54A5.51 5.51 0 0 0 10.75 16v1.25H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-2.25V16a5.51 5.51 0 0 0 3.63-3.5c2.4-.82 3.92-2.96 4.12-5.54A1.75 1.75 0 0 0 19.25 5h-2V4A1.25 1.25 0 0 0 16 2.75H8Zm-.95 4.25c.11 1.21.46 2.34 1 3.32-1.33-.63-2.17-1.79-2.42-3.32h1.42Zm10.9 0c-.25 1.53-1.09 2.69-2.42 3.32.54-.98.89-2.11 1-3.32h1.42Z" />
      </svg>
    </div>
  );
}

function HeaderPointsStar() {
  return (
    <div className="relative flex h-5 w-5 items-center justify-center sm:h-5.5 sm:w-5.5">
      <Star
        className="h-4 w-4 fill-[#ffd766] text-[#ffd766] drop-shadow-[0_0_7px_rgba(255,215,102,0.30)] sm:h-[14px] sm:w-[14px]"
        strokeWidth={1.9}
      />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 pt-5 pb-2">
      <p className="text-right text-[12px] font-extrabold tracking-[0.08em] text-[#5f6f6b] whitespace-nowrap">
          {title}
      </p>
    </div>
  );
}

function CollapseSection({
  icon: Icon,

  label,

  isOpen,

  onToggle,

  children,
}: {
  icon: React.ElementType;

  label: string;

  isOpen: boolean;

  onToggle: () => void;

  children: React.ReactNode;
}) {
  return (
    <div className="mb-0.5">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group cursor-pointer

          ${isOpen ? "bg-black/6 text-[#111111]" : "text-[#111111] hover:bg-black/5"}`}
      >
        <Icon
          size={17}
          className={`flex-shrink-0 transition-all duration-200 group-hover:scale-110
          ${isOpen ? "text-[#111111]" : "text-black/55 group-hover:text-black/80"}`}
        />

        <span className="flex-1 text-right leading-tight">{label}</span>

        <ChevronLeft
          size={14}
          className={`flex-shrink-0 transition-transform duration-300 ${isOpen ? "-rotate-90 opacity-70" : "opacity-35"}`}
        />
      </button>

      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pt-0.5 pb-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

type StaffProfileData = {
  name: string;
  accountNumber: string;
  role: string;
  phoneNumber: string | null;
  idNumber: string | null;
  halaqah?: string | null;
};

type TeacherHeaderInfo = {
  id: string;
  name: string;
  accountNumber: number;
  halaqah?: string | null;
};

export function Header() {
  const [globalRank, setGlobalRank] = useState<string | number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [isGlobalRankLoading, setIsGlobalRankLoading] = useState(true);

  const [userRole, setUserRole] = useState<string | null>(null);

  const [userName, setUserName] = useState<string | null>(null);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [circles, setCircles] = useState<Circle[]>([]);

  const [circlesLoading, setCirclesLoading] = useState(false);

  const [teacherInfo, setTeacherInfo] = useState<TeacherHeaderInfo | null>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isStudentsOpen, setIsStudentsOpen] = useState(false);

  const [isAdminStudentsOpen, setIsAdminStudentsOpen] = useState(false);

  const [isAdminReportsOpen, setIsAdminReportsOpen] = useState(false);

  const [isAdminCommOpen, setIsAdminCommOpen] = useState(false);

  const [isAdminGeneralOpen, setIsAdminGeneralOpen] = useState(false);

  const [isAdminGamesOpen, setIsAdminGamesOpen] = useState(false);

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const [validAdminRoles, setValidAdminRoles] = useState<string[]>([
    "admin",
    "مدير",
    "سكرتير",
    "مشرف تعليمي",
    "مشرف تربوي",
    "مشرف برامج",
  ]);

  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userAccountNumber, setUserAccountNumber] = useState<number | null>(null);
  const [notificationStartAt, setNotificationStartAt] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<{id:string;message:string;is_read:boolean;created_at:string}[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isNotificationIndicatorEligible, setIsNotificationIndicatorEligible] = useState(false);
  const [isNotificationPromptOpen, setIsNotificationPromptOpen] = useState(false);
  const [isSubmittingNotificationPermission, setIsSubmittingNotificationPermission] = useState(false);
  const [dailyChallengePlayedToday, setDailyChallengePlayedToday] = useState(false);
  const [sidebarPlanProgress, setSidebarPlanProgress] = useState<number | null>(null);
  const [sidebarQuranProgress, setSidebarQuranProgress] = useState<number | null>(null);
  const [sidebarQuranLevel, setSidebarQuranLevel] = useState<number>(0);
  const [sidebarStudentPoints, setSidebarStudentPoints] = useState<number>(0);
  const [sidebarPlanName, setSidebarPlanName] = useState<string | null>(null);
  const [isSidebarStudentStatsLoading, setIsSidebarStudentStatsLoading] = useState(true);
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppStatusSummary | null>(null);
  const [isWhatsAppQrDialogOpen, setIsWhatsAppQrDialogOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isNotificationsDialogOpen, setIsNotificationsDialogOpen] = useState(false);
  const [isStaffProfileDialogOpen, setIsStaffProfileDialogOpen] = useState(false);
  const [isStaffProfileLoading, setIsStaffProfileLoading] = useState(false);
  const [staffProfileData, setStaffProfileData] = useState<StaffProfileData | null>(null);
  const [hasActiveSemester, setHasActiveSemester] = useState<boolean | null>(null);

  const canUseDirectNotificationQueries = userRole === "student";

  const isAdmin = userAccountNumber === 2 || validAdminRoles.includes(userRole || "");

  const isFullAccess = userAccountNumber === 2 || userRole === "admin" || userRole === "مدير" || userPermissions.includes("all");

  const hasPermission = (key: string) => hasPermissionAccess(userPermissions, key, isFullAccess);
  const canManageSemesters = hasPermission("إنهاء الفصل");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isHeaderSolid, setIsHeaderSolid] = useState(pathname !== "/");

  const confirmDialog = useConfirmDialog();

  const syncStoredAuthState = () => {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true";
    const role = localStorage.getItem("userRole");
    const name = localStorage.getItem("userName");
    const accNumStr = localStorage.getItem("accountNumber");

    setIsLoggedIn(loggedIn);
    setUserRole(role);
    setUserName(name);
    setAuthResolved(true);
    setUserAccountNumber(accNumStr ? Number(accNumStr) : null);
  };

  useEffect(() => {
    const syncHeaderAppearance = () => {
      const shouldUseSolidHeader = pathname !== "/" || isMobileMenuOpen || window.scrollY > 16;
      setIsHeaderSolid(shouldUseSolidHeader);
    };

    syncHeaderAppearance();
    window.addEventListener("scroll", syncHeaderAppearance, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncHeaderAppearance);
    };
  }, [isMobileMenuOpen, pathname]);

  useEffect(() => {
    if (searchParams?.get("login") === "1") {
      setIsLoginDialogOpen(true);
    }
  }, [searchParams]);

  const fetchNotificationStartAt = async (accountNumber: string) => {
    if (!canUseDirectNotificationQueries) {
      setNotificationStartAt(null);
      return null;
    }

    const cacheKey = `notificationStartAt_${accountNumber}`;
    const cachedCreatedAt = readCachedText(cacheKey, NOTIFICATION_START_AT_CACHE_DURATION);
    if (cachedCreatedAt !== null) {
      setNotificationStartAt(cachedCreatedAt);
      return cachedCreatedAt;
    }

    try {
      const response = await fetch(`/api/account-created-at?account_number=${accountNumber}`, { cache: "no-store" });
      const data = await response.json();
      const createdAt = typeof data.created_at === "string" ? data.created_at : null;
      setNotificationStartAt(createdAt);
      writeCachedText(cacheKey, createdAt);
      return createdAt;
    } catch {
      setNotificationStartAt(null);
      return null;
    }
  };

  const fetchWhatsAppStatus = async () => {
    try {
      const response = await fetch(`/api/whatsapp/status?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setWhatsAppStatus(data);
      return data as WhatsAppStatusSummary;
    } catch {}

    return null;
  };

  const openWhatsAppEntryPoint = async () => {
    await fetchWhatsAppStatus();
    setIsWhatsAppQrDialogOpen(true);
  };

  const fetchActiveSemesterStatus = async () => {
    try {
      const response = await fetch(`/api/semesters?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        setHasActiveSemester(null);
        return;
      }

      const data = await response.json();
      setHasActiveSemester(Boolean(data.activeSemesterId));
    } catch {
      setHasActiveSemester(null);
    }
  };

  const whatsAppNeedsAttention = Boolean(
    isAdmin &&
    hasPermission("باركود الواتساب") &&
    whatsAppStatus &&
    !isConnectedWhatsAppStatus(whatsAppStatus)
  );

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "instant" });

  const syncDailyChallengePlayedStatus = () => {
    const accNumStr = localStorage.getItem("accountNumber");
    if (!accNumStr) {
      setDailyChallengePlayedToday(false);
      return;
    }

    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const lastPlay = localStorage.getItem(`lastPlayDate_${accNumStr}`);
    setDailyChallengePlayedToday(lastPlay === todayStr);
  };

  useEffect(() => {
        // جلب الترتيب العام للطالب عند تحميل القائمة الجانبية
        const fetchGlobalRank = async () => {
          const accNum = localStorage.getItem("accountNumber");
          const role = localStorage.getItem("userRole");
          if (!(accNum && role === "student")) {
            setIsGlobalRankLoading(false);
            return;
          }
          const cachedGlobalRank = readCachedText(`studentGlobalRank_${accNum}`, HEADER_RANK_CACHE_DURATION) || readCachedText("studentGlobalRank", HEADER_RANK_CACHE_DURATION);
          if (cachedGlobalRank) {
            setGlobalRank(cachedGlobalRank);
            setIsGlobalRankLoading(false);
            return;
          }
          if (accNum && role === "student") {
            try {
              // جلب بيانات الطالب للحصول على studentId
              const resStudents = await fetch(`/api/students?account_number=${accNum}`);
              const dataStudents = await resStudents.json();
              const student = (dataStudents.students || []).find((s:any) => String(s.account_number) === String(accNum));
              if (student && student.id) {
                const resRank = await fetch(`/api/student-ranking?student_id=${student.id}`);
                const dataRank = await resRank.json();
                if (dataRank.success && dataRank.ranking && dataRank.ranking.globalRank) {
                  setGlobalRank(dataRank.ranking.globalRank);
                  writeCachedText('studentGlobalRank', String(dataRank.ranking.globalRank));
                  writeCachedText(`studentGlobalRank_${accNum}`, String(dataRank.ranking.globalRank));
                } else {
                  setGlobalRank("-");
                  writeCachedText('studentGlobalRank', "-");
                  writeCachedText(`studentGlobalRank_${accNum}`, "-");
                }
              } else {
                setGlobalRank("-");
                writeCachedText('studentGlobalRank', "-");
                writeCachedText(`studentGlobalRank_${accNum}`, "-");
              }
            } catch {
              setGlobalRank("-");
              writeCachedText('studentGlobalRank', "-");
              writeCachedText(`studentGlobalRank_${accNum}`, "-");
            } finally {
              setIsGlobalRankLoading(false);
            }
          }
        };
        fetchGlobalRank();
      syncStoredAuthState();

      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      const role = localStorage.getItem("userRole");
      const accNumStr = localStorage.getItem("accountNumber");

    // Check if student played today's daily challenge
    syncDailyChallengePlayedStatus();
    const fetchUnread = async () => {
      if (!accNumStr) return;
      if (role !== "student") {
        setUnreadCount(0);
        return;
      }
      try {
        const createdAt = await fetchNotificationStartAt(accNumStr);
        const response = await fetch(`/api/notifications?countOnly=true&unreadOnly=true${createdAt ? `&createdAt=${encodeURIComponent(createdAt)}` : ""}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch notifications count");
        }
        const data = await response.json();
        setUnreadCount(Number(data.count) || 0);
      } catch {}
    };
    if (role === "student") {
      fetchUnread();
    }
    const unreadIntervalId = window.setInterval(() => {
      if (role === "student") {
        void fetchUnread();
      }
    }, 30000);
    const handleUnreadRefresh = () => {
      if (role === "student") {
        void fetchUnread();
      }
    };
    window.addEventListener("focus", handleUnreadRefresh);

    if (loggedIn && (role === "teacher" || role === "deputy_teacher")) {
      const accNum = localStorage.getItem("accountNumber");
      if (accNum) fetchTeacherInfo(accNum);
    }

    if (loggedIn && role === "student") {
      const accNum = localStorage.getItem("accountNumber");
      if (accNum) {
        const cachedStats = readCachedJson<{
          sidebarPlanProgress: number;
          sidebarQuranProgress: number;
          sidebarQuranLevel: number;
          sidebarStudentPoints: number;
          sidebarPlanName: string | null;
        }>(`studentHeaderStats_${accNum}`, HEADER_STATS_CACHE_DURATION);
        if (cachedStats) {
          setSidebarPlanProgress(cachedStats.sidebarPlanProgress ?? 0);
          setSidebarQuranProgress(cachedStats.sidebarQuranProgress ?? 0);
          setSidebarQuranLevel(cachedStats.sidebarQuranLevel ?? 0);
          setSidebarStudentPoints(cachedStats.sidebarStudentPoints ?? 0);
          setSidebarPlanName(cachedStats.sidebarPlanName ?? null);
          setIsSidebarStudentStatsLoading(false);
          fetchSidebarPlan(accNum);
        } else {
          fetchSidebarPlan(accNum);
        }
      }
      else setIsSidebarStudentStatsLoading(false);
    } else {
      setIsSidebarStudentStatsLoading(false);
    }

    // Verify fresh role from DB (background) to keep sidebar in sync
    if (loggedIn) {
      const accountNumber = localStorage.getItem("accountNumber");
      if (accountNumber) {
        verifyFreshRole(accountNumber);
      }
    }

    if (loggedIn) {
      void fetchWhatsAppStatus();
    }

    const handleAppLogin = () => {
      syncStoredAuthState();
      setIsLoginDialogOpen(false);
    };

    window.addEventListener("app-login", handleAppLogin);

    return () => {
      window.clearInterval(unreadIntervalId);
      window.removeEventListener("focus", handleUnreadRefresh);
      window.removeEventListener("app-login", handleAppLogin);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const standaloneMedia = window.matchMedia("(display-mode: standalone)");
    const mobileMedia = window.matchMedia("(max-width: 768px)");

    const updateNotificationEligibility = () => {
      const supported = isNotificationSupported();
      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      const eligible = loggedIn && isStandaloneApp() && mobileMedia.matches && supported;

      setNotificationPermission(supported ? Notification.permission : "unsupported");
      setIsNotificationIndicatorEligible(eligible);
    };

    updateNotificationEligibility();
    standaloneMedia.addEventListener("change", updateNotificationEligibility);
    mobileMedia.addEventListener("change", updateNotificationEligibility);
    window.addEventListener("focus", updateNotificationEligibility);
    window.addEventListener(NOTIFICATION_PERMISSION_UPDATED_EVENT, updateNotificationEligibility);

    return () => {
      standaloneMedia.removeEventListener("change", updateNotificationEligibility);
      mobileMedia.removeEventListener("change", updateNotificationEligibility);
      window.removeEventListener("focus", updateNotificationEligibility);
      window.removeEventListener(NOTIFICATION_PERMISSION_UPDATED_EVENT, updateNotificationEligibility);
    };
  }, []);

  useEffect(() => {
    const handleDailyChallengeStatusChange = () => {
      syncDailyChallengePlayedStatus();
    };

    window.addEventListener("focus", handleDailyChallengeStatusChange);
    window.addEventListener("daily-challenge-status-changed", handleDailyChallengeStatusChange);

    return () => {
      window.removeEventListener("focus", handleDailyChallengeStatusChange);
      window.removeEventListener("daily-challenge-status-changed", handleDailyChallengeStatusChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen || circles.length > 0 || circlesLoading) {
      return;
    }

    loadCircles();
  }, [circles.length, circlesLoading, isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen || !isAdmin || !hasPermission("باركود الواتساب")) {
      return;
    }

    void fetchWhatsAppStatus();
  }, [isMobileMenuOpen, isAdmin, userPermissions.length, userRole]);

  useEffect(() => {
    if (!isLoggedIn || (userRole !== "teacher" && userRole !== "deputy_teacher")) {
      setTeacherInfo(null);
      return;
    }

    const accNum = localStorage.getItem("accountNumber") || localStorage.getItem("account_number");
    if (accNum) {
      void fetchTeacherInfo(accNum);
    }
  }, [isLoggedIn, userRole, userAccountNumber]);

  useEffect(() => {
    if (!isLoggedIn || !isAdmin || !canManageSemesters) {
      setHasActiveSemester(null);
      return;
    }

    void fetchActiveSemesterStatus();
  }, [isLoggedIn, isAdmin, canManageSemesters]);

  const verifyFreshRole = async (accountNumber: string) => {
    try {
      const authResponse = await fetch("/api/auth", { cache: "no-store" });
      if (!authResponse.ok) {
        return;
      }

      const authData = await authResponse.json();
      if (!authData?.success || !authData?.authenticated || !authData?.user) {
        clearClientAuthState();
        setIsLoggedIn(false);
        setUserRole(null);
        setUserName(null);
        setUserAccountNumber(null);
        setUserPermissions([]);
        setTeacherInfo(null);
        setAuthResolved(true);
        return;
      }

      const freshRole = String(authData?.user?.role || "");
      if (!freshRole) return;

      // Fetch valid admin roles dynamically from API
      let freshAdminRoles = [
        "ادمين",
        "مدير",
        "سكرتير",
        "مشرف تعليمي",
        "مشرف تربوي",
        "مشرف برامج",
      ];
      try {
        const res = await fetch("/api/roles");
        const rolesData = await res.json();
        if (rolesData.roles) {
          freshAdminRoles = ["admin", ...rolesData.roles];
        }
        // Set permissions for this role
        const freshPerms: string[] = rolesData.permissions?.[freshRole] || [];
        setUserPermissions(freshPerms);
      } catch {}

      // Update localStorage and state with fresh role
      localStorage.setItem("userRole", freshRole);
      setUserRole(freshRole);
      setValidAdminRoles(freshAdminRoles);

      // If role is no longer valid admin, update isLoggedIn display
      if (
        freshRole === "student" ||
        freshRole === "teacher" ||
        freshRole === "deputy_teacher" ||
        !freshRole ||
        (!validAdminRoles.includes(freshRole) &&
          freshRole !== "student" &&
          freshRole !== "teacher" &&
          freshRole !== "deputy_teacher")
      ) {
        // No redirect here — just update sidebar. Redirect happens on admin pages via useAdminAuth.
      }
    } catch {}
  };

  const loadCircles = () => {
    const cachedData = localStorage.getItem("circlesCache");

    const cacheTime = localStorage.getItem("circlesCacheTime");

    if (
      cachedData &&
      cacheTime &&
      Date.now() - Number(cacheTime) < CIRCLES_CACHE_DURATION
    ) {
      setCircles(JSON.parse(cachedData));

      setCirclesLoading(false);
    } else {
      fetchCircles();
    }
  };

  const fetchCircles = async () => {
    try {
      setCirclesLoading(true);

      const res = await fetch("/api/circles");

      const data = await res.json();

      if (data.circles) {
        setCircles(data.circles);

        localStorage.setItem("circlesCache", JSON.stringify(data.circles));

        localStorage.setItem("circlesCacheTime", Date.now().toString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCirclesLoading(false);
    }
  };

  const fetchSidebarPlan = async (accNum: string) => {
    try {
      const res = await fetch(`/api/students?account_number=${accNum}`);
      const data = await res.json();
      const student = (data.students || [])[0];
      if (!student) {
        setSidebarPlanProgress(0);
        setSidebarQuranProgress(0);
        setSidebarQuranLevel(0);
        setSidebarStudentPoints(0);
        setSidebarPlanName(null);
        writeCachedJson(`studentHeaderStats_${accNum}`, {
          sidebarPlanProgress: 0,
          sidebarQuranProgress: 0,
          sidebarQuranLevel: 0,
          sidebarStudentPoints: 0,
          sidebarPlanName: null,
        });
        return;
      }
      setSidebarStudentPoints(Number(student.points) || 0);
      const planRes = await fetch(`/api/student-plans?student_id=${student.id}`);
      const planData = await planRes.json();
      if (planData.plan) {
        setSidebarPlanProgress(planData.progressPercent ?? 0);
        setSidebarQuranProgress(planData.quranProgressPercent ?? 0);
        setSidebarQuranLevel(planData.quranLevel ?? 0);
        setSidebarPlanName(`${planData.plan.start_surah_name} ← ${planData.plan.end_surah_name}`);
        writeCachedJson(`studentHeaderStats_${accNum}`, {
          sidebarPlanProgress: planData.progressPercent ?? 0,
          sidebarQuranProgress: planData.quranProgressPercent ?? 0,
          sidebarQuranLevel: planData.quranLevel ?? 0,
          sidebarStudentPoints: Number(student.points) || 0,
          sidebarPlanName: `${planData.plan.start_surah_name} ← ${planData.plan.end_surah_name}`,
        });
      } else {
        const quranProgress = planData.quranProgressPercent ?? 0;
        const quranLevel = planData.quranLevel ?? Math.round(quranProgress);

        setSidebarPlanProgress(0);
        setSidebarQuranProgress(quranProgress);
        setSidebarQuranLevel(quranLevel);
        setSidebarPlanName(null);
        writeCachedJson(`studentHeaderStats_${accNum}`, {
          sidebarPlanProgress: 0,
          sidebarQuranProgress: quranProgress,
          sidebarQuranLevel: quranLevel,
          sidebarStudentPoints: Number(student.points) || 0,
          sidebarPlanName: null,
        });
      }
    } catch {
      setSidebarPlanProgress(0);
      setSidebarQuranProgress(0);
      setSidebarQuranLevel(0);
      setSidebarStudentPoints(0);
      setSidebarPlanName(null);
      writeCachedJson(`studentHeaderStats_${accNum}`, {
        sidebarPlanProgress: 0,
        sidebarQuranProgress: 0,
        sidebarQuranLevel: 0,
        sidebarStudentPoints: 0,
        sidebarPlanName: null,
      });
    } finally {
      setIsSidebarStudentStatsLoading(false);
    }
  };

  const fetchTeacherInfo = async (accNum: string) => {
    const cachedTeacherInfo = readCachedJson<{
      id: string;
      name: string;
      accountNumber: number;
      halaqah?: string | null;
    }>(`teacherInfo_${accNum}`, TEACHER_INFO_CACHE_DURATION);

    if (cachedTeacherInfo) {
      setTeacherInfo(cachedTeacherInfo);
      return cachedTeacherInfo;
    }

    try {
      const res = await fetch(`/api/teachers?account_number=${accNum}`);

      const data = await res.json();

      if (data.teachers?.[0]) {
        const nextTeacherInfo = {
          id: data.teachers[0].id,

          name: data.teachers[0].name,

          accountNumber: data.teachers[0].account_number,
          halaqah: data.teachers[0].halaqah || null,
        };
        setTeacherInfo(nextTeacherInfo);
        writeCachedJson(`teacherInfo_${accNum}`, nextTeacherInfo);
        return nextTeacherInfo;
      }
    } catch (e) {
      console.error(e);
    }

    return null;
  };

  const getTeacherEvaluationPath = () => {
    const teacherHalaqah = (teacherInfo?.halaqah || localStorage.getItem("userHalaqah") || "").trim();
    if (!teacherHalaqah) {
      return "/teacher/halaqah/1";
    }

    return `/teacher/halaqah/${encodeURIComponent(teacherHalaqah)}`;
  };

  const getStoredTeacherInfo = (): TeacherHeaderInfo | null => {
    try {
      const storedUser = localStorage.getItem("currentUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const fallbackId = String(parsedUser?.id || "").trim();
      const fallbackName = String(parsedUser?.name || localStorage.getItem("userName") || "").trim();
      const fallbackAccountNumber = Number(
        parsedUser?.account_number || localStorage.getItem("accountNumber") || localStorage.getItem("account_number") || 0,
      );
      const fallbackHalaqah = String(parsedUser?.halaqah || localStorage.getItem("userHalaqah") || "").trim();

      if (!fallbackId || !fallbackName || !fallbackAccountNumber) {
        return null;
      }

      return {
        id: fallbackId,
        name: fallbackName,
        accountNumber: fallbackAccountNumber,
        halaqah: fallbackHalaqah || null,
      };
    } catch {
      return null;
    }
  };

  const openTeacherAttendanceDialog = async () => {
    const openDialog = () => {
      window.setTimeout(() => {
        setIsAttendanceModalOpen(true);
      }, 0);
    };

    if (teacherInfo) {
      openDialog();
      return;
    }

    const storedTeacherInfo = getStoredTeacherInfo();
    if (storedTeacherInfo) {
      setTeacherInfo(storedTeacherInfo);
      openDialog();
      return;
    }

    const accNum = localStorage.getItem("accountNumber") || localStorage.getItem("account_number");
    if (!accNum) {
      return;
    }

    const nextTeacherInfo = await fetchTeacherInfo(accNum);
    if (nextTeacherInfo) {
      openDialog();
    }
  };

  const goToTeacherEvaluation = () => {
    handleNav(getTeacherEvaluationPath());
  };

  const goToTeacherStudentPlans = () => {
    handleNav("/teacher/student-plans");
  };

  const goToTeacherWeeklyReports = () => {
    handleNav("/teacher/weekly-reports");
  };

  const openStaffProfileDialog = async () => {
    if (!(isAdmin || userRole === "teacher" || userRole === "deputy_teacher")) {
      return;
    }

    const fallbackData: StaffProfileData = {
      name: userName || "المستخدم",
      accountNumber: userAccountNumber ? String(userAccountNumber) : "-",
      role: roleLabel || "حساب مسجل",
      phoneNumber: null,
      idNumber: null,
      halaqah: null,
    };

    setStaffProfileData(fallbackData);
    setIsStaffProfileDialogOpen(true);
    setIsStaffProfileLoading(true);

    try {
      if (isAdmin) {
        const response = await fetch("/api/admin-users?current=1", { cache: "no-store" });
        const payload = await response.json();

        if (response.ok && payload?.user) {
          setStaffProfileData({
            name: payload.user.name || fallbackData.name,
            accountNumber: payload.user.account_number ? String(payload.user.account_number) : fallbackData.accountNumber,
            role: getHeaderRoleLabel(payload.user.role || userRole, true, Number(payload.user.account_number || userAccountNumber || 0)) || fallbackData.role,
            phoneNumber: payload.user.phone_number || null,
            idNumber: payload.user.id_number || null,
            halaqah: null,
          });
        }
      } else {
        const accNum = localStorage.getItem("accountNumber") || localStorage.getItem("account_number");
        if (!accNum) {
          return;
        }

        const response = await fetch(`/api/teachers?account_number=${accNum}`, { cache: "no-store" });
        const payload = await response.json();
        const teacher = payload?.teachers?.[0];

        if (response.ok && teacher) {
          setStaffProfileData({
            name: teacher.name || fallbackData.name,
            accountNumber: teacher.accountNumber || fallbackData.accountNumber,
            role: teacher.role === "deputy_teacher" ? "نائب معلم" : "معلم",
            phoneNumber: teacher.phoneNumber || null,
            idNumber: teacher.idNumber || null,
            halaqah: teacher.halaqah || null,
          });
        }
      }
    } catch {}

    setIsStaffProfileLoading(false);
  };

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: "تأكيد تسجيل الخروج",

      description: "هل أنت متأكد من أنك تريد تسجيل الخروج؟",

      confirmText: "نعم، تسجيل الخروج",

      cancelText: "إلغاء",
    });

    if (confirmed) {
      setIsLoggingOut(true);

      const currentAccountNumber = localStorage.getItem("accountNumber") || localStorage.getItem("account_number");

      try {
        await Promise.race([
          unregisterWebPushSubscription({
            accountNumber: currentAccountNumber,
            clearLocalState: true,
            unsubscribeLocal: true,
          }),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error("logout notification cleanup timeout")), 1200);
          }),
        ]);
      } catch (error) {
        console.error("[notifications] logout subscription cleanup failed:", error);
        clearNotificationLocalState(currentAccountNumber);
      }

      clearClientAuthState();
      setIsLoggedIn(false);
      setUserRole(null);
      setUserName(null);
      setUserAccountNumber(null);
      setUserPermissions([]);
      setTeacherInfo(null);
      setIsMobileMenuOpen(false);
      setIsLoggingOut(false);

      await performClientLogout("/");
    }
  };

  const handleLogoutMenuSelect = () => {
    window.setTimeout(() => {
      void handleLogout();
    }, 0);
  };

  const handleTeacherAttendanceMenuSelect = () => {
    window.setTimeout(() => {
      void openTeacherAttendanceDialog();
    }, 0);
  };

  const handleTeacherEvaluationMenuSelect = () => {
    window.setTimeout(() => {
      goToTeacherEvaluation();
    }, 0);
  };

  const handleTeacherStudentPlansMenuSelect = () => {
    window.setTimeout(() => {
      goToTeacherStudentPlans();
    }, 0);
  };

  const handleTeacherWeeklyReportsMenuSelect = () => {
    window.setTimeout(() => {
      goToTeacherWeeklyReports();
    }, 0);
  };

  const handleNav = (href: string) => {
    setIsMobileMenuOpen(false);
    scrollToTop();

    if (href.startsWith('?')) {
        router.push(window.location.pathname + href);
    } else {
        router.push(href);
    }
  };

  const goToProfile = () => {
    if (isAdmin) router.push("/admin/profile");
    else if (userRole === "teacher" || userRole === "deputy_teacher") router.push("/teacher/dashboard");
    else router.push("/profile");

    scrollToTop();
  };

  const goToHome = () => {
    handleNav("/");
  };

  const goToDashboard = () => {
    if (isAdmin) {
      router.push("/admin/dashboard");
    }

    scrollToTop();
  };

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleHeaderLinkClick = (target: string) => {
    setIsMobileMenuOpen(false);

    if (!target.startsWith("#")) {
      handleNav(target);
      return;
    }

    if (pathname !== "/") {
      router.push(`/${target}`);
      return;
    }

    scrollToSection(target.slice(1));
  };

  const handleLoginDialogChange = (open: boolean) => {
    setIsLoginDialogOpen(open);

    if (!open && searchParams?.get("login") === "1") {
      router.replace(pathname || "/");
    }
  };

  const handleBestStudentsMenuChange = (open: boolean) => {
    if (!open || circles.length > 0 || circlesLoading) {
      return;
    }

    loadCircles();
  };

  const loadNotifications = async () => {
    const accNumStr = localStorage.getItem("accountNumber");
    if (!accNumStr) return;
    if (!canUseDirectNotificationQueries) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setNotifLoading(true);
    try {
      const createdAt = notificationStartAt || await fetchNotificationStartAt(accNumStr);
      const response = await fetch(`/api/notifications?limit=20${createdAt ? `&createdAt=${encodeURIComponent(createdAt)}` : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }
      const data = await response.json();
      const nextNotifications = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications(nextNotifications);
      const unreadIds = nextNotifications.filter((notification) => !notification.is_read).map((notification) => notification.id);
      if (unreadIds.length > 0) {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: unreadIds, markRead: true }),
        });
        setUnreadCount(0);
      }
    } catch {}
    setNotifLoading(false);
  };

  const openNotificationsDialog = async () => {
    setIsNotificationsDialogOpen(true);
    await loadNotifications();
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete notification");
      }
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const enableNotificationsFromHeader = async () => {
    if (!isNotificationSupported()) {
      setNotificationPermission("unsupported");
      return;
    }

    setIsSubmittingNotificationPermission(true);

    try {
      const nextPermission = await Notification.requestPermission();
      setNotificationPermission(nextPermission);
      window.dispatchEvent(new Event(NOTIFICATION_PERMISSION_UPDATED_EVENT));

      if (nextPermission === "granted") {
        await navigator.serviceWorker.ready;
        await syncWebPushSubscription();
        setIsNotificationPromptOpen(false);
      }
    } finally {
      setIsSubmittingNotificationPermission(false);
    }
  };

  const shouldShowNotificationIndicator = isNotificationIndicatorEligible && notificationPermission !== "granted" && notificationPermission !== "unsupported";

  const roleLabel = getHeaderRoleLabel(userRole, isAdmin, userAccountNumber);
  const isLandingPage = pathname === "/";
  const shouldShowDashboardUtilities = !isLandingPage;
  const isStaffAccount = isAdmin || userRole === "teacher" || userRole === "deputy_teacher";

  const isStudentHeaderStatsReady =
    authResolved &&
    isLoggedIn &&
    userRole === "student" &&
    !isSidebarStudentStatsLoading &&
    !isGlobalRankLoading;
  const teacherAttendanceInfo = teacherInfo || ((isLoggedIn && (userRole === "teacher" || userRole === "deputy_teacher")) ? getStoredTeacherInfo() : null);

  return (
    <>
      {isLoggedIn && (userRole === "teacher" || userRole === "deputy_teacher") && teacherAttendanceInfo && (
        <TeacherAttendanceModal
          isOpen={isAttendanceModalOpen}
          onClose={() => setIsAttendanceModalOpen(false)}
          teacherId={teacherAttendanceInfo.id}
          teacherName={teacherAttendanceInfo.name}
          accountNumber={teacherAttendanceInfo.accountNumber}
        />
      )}

      {isLoggingOut && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white rounded-3xl px-10 py-8 flex flex-col items-center shadow-2xl min-w-[260px]">
            <SiteLoader size="md" color="#003f55" />
          </div>
        </div>
      )}

      <header
        data-scrolled={isHeaderSolid ? "true" : "false"}
        className={isLandingPage ? "site-header fixed inset-x-0 top-0 z-50" : "site-header sticky top-0 z-50"}
      >
        {shouldShowDashboardUtilities ? (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2">
        </div>
        ) : null}
        <div className="container mx-auto flex h-20 items-center justify-between gap-4 px-4">
          <button
            type="button"
            onClick={goToHome}
            className="site-header-brand relative z-20 hidden min-w-0 md:inline-flex"
            aria-label="العودة إلى الرئيسية"
          >
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
          </button>

          <div className="hidden flex-1 items-center justify-center md:flex">
            <div className="flex items-center gap-7 lg:gap-10">
              {HEADER_LINKS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleHeaderLinkClick(item.target)}
                  className="site-header-nav-button"
                >
                  {item.label}
                </button>
              ))}
              {isLoggedIn && (userRole === "teacher" || userRole === "deputy_teacher" || isAdmin) ? (
                <button
                  type="button"
                  onClick={() => handleNav("/competitions")}
                  className="site-header-nav-button"
                >
                  المسابقات
                </button>
              ) : null}
              <DropdownMenu onOpenChange={handleBestStudentsMenuChange}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="site-header-nav-button inline-flex items-center gap-1.5"
                    aria-label="أفضل الطلاب"
                  >
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
                    {circlesLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <SiteLoader size="sm" color="#3453a7" />
                      </div>
                    ) : (
                      circles.map((circle) => (
                        <DropdownMenuItem
                          key={circle.name}
                          onClick={() => handleNav(`/halaqat/${circle.name}`)}
                          className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]"
                        >
                          <span className="w-full text-right">{circle.name}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={() => handleHeaderLinkClick("#contact")}
                className="site-header-nav-button"
              >
                تواصل معنا
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {authResolved && isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="site-header-user-button" aria-label="حساب المستخدم">
                    <User size={20} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={10} className="w-56 rounded-2xl border border-[#d9e4fb] bg-white p-2 shadow-[0_20px_50px_rgba(19,39,89,0.14)]">
                  {isStaffAccount ? (
                    <button
                      type="button"
                      onClick={openStaffProfileDialog}
                      className="w-full rounded-xl px-3 py-2.5 text-right transition-colors hover:bg-[#f4f7ff]"
                      dir="rtl"
                    >
                      <div className="text-sm font-black text-[#1a2332]">{userName || "المستخدم"}</div>
                      <div className="mt-1 text-xs font-semibold text-[#6b778c]">{roleLabel || "حساب مسجل"}</div>
                    </button>
                  ) : (
                    <div className="px-3 py-2.5 text-right" dir="rtl">
                      <div className="text-sm font-black text-[#1a2332]">{userName || "المستخدم"}</div>
                      <div className="mt-1 text-xs font-semibold text-[#6b778c]">{roleLabel || "حساب مسجل"}</div>
                    </div>
                  )}
                  <DropdownMenuSeparator />
                  {!isStaffAccount ? (
                    <DropdownMenuItem onClick={goToProfile} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                      <span className="w-full text-right">الملف الشخصي</span>
                    </DropdownMenuItem>
                  ) : null}
                  {userRole === "student" ? (
                    <>
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
                  {isAdmin ? (
                    <DropdownMenuItem onClick={goToDashboard} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                      <span className="w-full text-right">لوحة التحكم</span>
                    </DropdownMenuItem>
                  ) : null}
                  {(userRole === "teacher" || userRole === "deputy_teacher") ? (
                    <DropdownMenuItem
                      onSelect={handleTeacherAttendanceMenuSelect}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]"
                      dir="rtl"
                    >
                      <span className="w-full text-right">التحضير</span>
                    </DropdownMenuItem>
                  ) : null}
                  {(userRole === "teacher" || userRole === "deputy_teacher") ? (
                    <DropdownMenuItem onSelect={handleTeacherEvaluationMenuSelect} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                      <span className="w-full text-right">التقييم اليومي</span>
                    </DropdownMenuItem>
                  ) : null}
                  {userRole === "teacher" ? (
                    <DropdownMenuItem onSelect={handleTeacherStudentPlansMenuSelect} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                      <span className="w-full text-right">خطط الطلاب</span>
                    </DropdownMenuItem>
                  ) : null}
                  {(userRole === "teacher" || userRole === "deputy_teacher") ? (
                    <DropdownMenuItem onSelect={handleTeacherWeeklyReportsMenuSelect} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                      <span className="w-full text-right">تقارير الأسابيع</span>
                    </DropdownMenuItem>
                  ) : null}
                  {isStaffAccount ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem onClick={openNotificationsDialog} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-[#1a2332] focus:bg-[#f4f7ff] focus:text-[#3453a7]" dir="rtl">
                    <span className="flex w-full items-center justify-between gap-3 text-right">
                      <span>الإشعارات</span>
                      {unreadCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleLogoutMenuSelect} className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-red-600 focus:bg-red-50 focus:text-red-600" dir="rtl">
                    <span className="w-full text-right">تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : authResolved ? (
              <button
                type="button"
                onClick={() => handleLoginDialogChange(true)}
                className="site-header-user-button"
                aria-label="تسجيل الدخول"
              >
                <User size={20} />
              </button>
            ) : null}
          </div>
        </div>
        <GlobalAddStudentDialog />
    </header>

      {/* خلفية مظللة */}

      <div
        className={`fixed inset-0 bg-black/50 z-[80] backdrop-blur-sm transition-opacity duration-300 ${isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* الدرج الجانبي */}

      <div
        dir="rtl"
        className={`fixed top-0 right-0 h-full w-[min(300px,calc(100vw-56px))] max-w-[calc(100vw-56px)] bg-[#f9fafb] z-[90] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* رأس الدرج */}

        <div
          className="px-4 pt-2.5 pb-3 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #0f2f6d 0%, #1f4d9a 55%, #3667b2 100%)" }}
        >
          {/* الصف العلوي: إغلاق */}
          <div className="mb-2 flex items-start justify-start">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center self-start translate-y-1.5 transition-all duration-200 active:scale-90 hover:opacity-70"
            >
              <Menu size={26} className="text-white" />
            </button>
          </div>

          {/* معلومات المستخدم */}
          {isLoggedIn && (
            <>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    if (isStaffAccount) {
                      setIsMobileMenuOpen(false);
                      void openStaffProfileDialog();
                      return;
                    }
                    goToProfile();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.08] transition-colors rounded-xl px-3 py-2.5"
                >
                  <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 border border-white/20">
                    <User size={18} className="text-white" />
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <p className="text-white font-bold text-sm truncate">{userName || "المستخدم"}</p>
                    <p className="text-white/60 text-xs mt-0.5">{roleLabel}</p>
                  </div>
                  <ChevronLeft size={16} className="text-white/40 flex-shrink-0" />
                </button>
              </div>
              {userRole === "student" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/15 bg-white/[0.08] px-3 py-2.5 text-right backdrop-blur-sm">
                    <div className="text-[11px] font-semibold text-white/65">الترتيب العام</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-lg font-black leading-none text-white">{globalRank ?? "-"}</span>
                      <HeaderRankTrophy />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/[0.08] px-3 py-2.5 text-right backdrop-blur-sm">
                    <div className="text-[11px] font-semibold text-white/65">النقاط</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-lg font-black leading-none text-white">{sidebarStudentPoints}</span>
                      <HeaderPointsStar />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* محتوى الدرج */}

        <div className="flex-1 overflow-y-auto bg-[#f9fafb] [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">

          {isLoggedIn && (userRole === "teacher" || userRole === "deputy_teacher") && (
            <>
              <SectionHeader title="الإدارة" />
              <div className="px-2 mb-0">
                <NavItem
                  icon={ClipboardCheck}
                  label="التحضير"
                  onClick={() => {
                    void openTeacherAttendanceDialog();
                    setIsMobileMenuOpen(false);
                  }}
                />
                <NavItem
                  icon={Users}
                  label="التقييم اليومي"
                  onClick={goToTeacherEvaluation}
                />
                {userRole === "teacher" && (
                  <NavItem
                    icon={BookMarked}
                    label="خطط الطلاب"
                    onClick={goToTeacherStudentPlans}
                  />
                )}
                <NavItem
                  icon={BarChart3}
                  label="تقارير الأسابيع"
                  onClick={goToTeacherWeeklyReports}
                />
              </div>
            </>
          )}

          <SectionHeader title="المعلومات العامة" />

          <div className="px-2 mb-2">
            <NavItem
              icon={Home}
              label="الرئيسية"
              onClick={goToHome}
            />

            <NavItem
              icon={Trophy}
              label="الإنجازات"
              onClick={() => handleNav("/achievements")}
            />

            <NavItem
              icon={MessageSquare}
              label="تواصل معنا"
              onClick={() => handleNav("/contact")}
            />

            <CollapseSection
              icon={Star}
              label="أفضل الطلاب"
              isOpen={isStudentsOpen}
              onToggle={() => setIsStudentsOpen(!isStudentsOpen)}
            >
              <NavItem
                icon={Users}
                label="جميع الطلاب"
                labelClassName="font-black"
                onClick={() => handleNav("/students/all")}
                indent
              />

              {circlesLoading ? (
                <div className="pr-10 pl-4 py-3 flex justify-start">
                  <SiteLoader size="sm" color="#3453a7" />
                </div>
              ) : (
                circles.map((c) => (
                  <NavItem
                    key={c.name}
                    icon={BookOpen}
                    label={c.name}
                    onClick={() => handleNav(`/halaqat/${c.name}`)}
                    indent
                  />
                ))
              )}
            </CollapseSection>

            <NavItem
              icon={BookOpen}
              label="أفضل الحلقات"
              onClick={() => handleNav("/halaqat/all")}
            />

            {isLoggedIn && (userRole === "teacher" || userRole === "deputy_teacher" || isAdmin) && (
              <NavItem
                icon={Gamepad2}
                label="المسابقات"
                onClick={() => handleNav("/competitions")}
              />
            )}
          </div>

          {isLoggedIn && userRole === "student" && (
            <>
              <SectionHeader title="البيانات" />
              <div className="px-2 mb-0">
                <NavItem
                  icon={User}
                  label="الملف الشخصي"
                  onClick={() => { handleNav("/profile?tab=profile"); setIsMobileMenuOpen(false); }}
                />
                <NavItem
                  icon={Award}
                  label="الإنجازات"
                  onClick={() => { handleNav("/profile?tab=achievements"); setIsMobileMenuOpen(false); }}
                />
                <NavItem
                  icon={BarChart3}
                  label="السجلات"
                  onClick={() => { handleNav("/profile?tab=records"); setIsMobileMenuOpen(false); }}
                />
                <NavItem
                  icon={Trophy}
                  label="المؤشر"
                  onClick={() => { handleNav("/profile?tab=indicators"); setIsMobileMenuOpen(false); }}
                />
                <NavItem
                  icon={BookMarked}
                  label="الخطة"
                  onClick={() => { handleNav("/profile?tab=plan"); setIsMobileMenuOpen(false); }}
                />
                <NavItem
                  icon={ClipboardCheck}
                  label="الاختبارات"
                  onClick={() => { handleNav("/exams"); setIsMobileMenuOpen(false); }}
                />
              </div>

              <SectionHeader title="الأنشطة" />
              <div className="px-2 mb-0">
                <NavItem
                  icon={Map}
                  label="المسار"
                  onClick={() => handleNav("/pathways")}
                />
                <NavItem
                  icon={Target}
                  label="التحدي اليومي"
                  onClick={() => handleNav("/daily-challenge")}
                  gold={!dailyChallengePlayedToday}
                />
                <NavItem
                  icon={Store}
                  label="المتجر"
                  onClick={() => handleNav("/store")}
                />
              </div>
            </>
          )}

          {isLoggedIn && isAdmin && (
            <>
              <SectionHeader title="لوحة التحكم" />

              {/* فئة إدارة الطلاب */}

              {["إضافة طالب", "إضافة جماعية", "تعديل بيانات الطالب", "سجلات الطلاب", "إنجازات الطلاب", "خطط الطلاب"].some((permission) => hasPermission(permission)) && <div className="px-2 mb-0.5">
                <CollapseSection
                  icon={Users}
                  label="إدارة الطلاب"
                  isOpen={isAdminStudentsOpen}
                  onToggle={() => setIsAdminStudentsOpen(!isAdminStudentsOpen)}
                >
                  {[
                    {
                      icon: UserPlus,

                      label: "إضافة طلاب",

                      permKey: "إضافة طالب",

                      isVisible: hasPermission("إضافة طالب") || hasPermission("إضافة جماعية"),

                      path: hasPermission("إضافة طالب") ? "?action=add-student" : "?action=bulk-add",
                    },

                    {
                      icon: Settings,

                      label: "تعديل بيانات الطالب",

                      permKey: "تعديل بيانات الطالب",

                      path: "?action=edit-student",
                    },

                    {
                      icon: FileText,

                      label: "سجلات الطلاب",

                      permKey: "سجلات الطلاب",

                      path: "?action=student-records",
                    },

                    {
                      icon: Award,

                      label: "إنجازات الطلاب",

                      permKey: "إنجازات الطلاب",

                      path: "/admin/students-achievements",
                    },
                    {
                      icon: BookMarked,

                      label: "خطط الطلاب",

                      permKey: "خطط الطلاب",

                      path: "/admin/student-plans",
          },
          ].filter((item) => ("isVisible" in item ? item.isVisible : hasPermission(item.permKey))).map(({ icon: Ic, label, path }) => (
                    <NavItem
                      key={label}
                      icon={Ic}
                      label={label}
                      onClick={() => handleNav(path)}
                      indent
                    />
                  ))}
                </CollapseSection>
              </div>}

              {/* فئة إدارة المستخدمين */}

              {["إدارة المعلمين", "إدارة الحلقات", "الهيكل الإداري", "طلبات التسجيل"].some(p => hasPermission(p)) && <div className="px-2 mb-0.5">
                <CollapseSection
                  icon={ShieldCheck}
                  label="إدارة المستخدمين"
                  isOpen={isAdminCommOpen}
                  onToggle={() => setIsAdminCommOpen(!isAdminCommOpen)}
                >
                  {[
                    {
                      icon: Settings,

                      label: "إدارة المعلمين",

                      path: "?action=teachers",
                    },

                    {
                      icon: BookOpen,

                      label: "إدارة الحلقات",

                      path: "?action=circles",
                    },

                    {
                      icon: ShieldCheck,

                      label: "الهيكل الإداري",

                      path: "?action=admins",
                    },

                    {
                      icon: UserPlus,

                      label: "طلبات التسجيل",

                      path: "/admin/enrollment-requests",
                    },
                  ].filter(({ label }) => hasPermission(label)).map(({ icon: Ic, label, path }) => (
                    <NavItem
                      key={label}
                      icon={Ic}
                      label={label}
                      onClick={() => handleNav(path)}
                      indent
                    />
                  ))}
                </CollapseSection>
              </div>}

              {/* فئة التقارير */}

              {["تقارير المعلمين", "تقارير الرسائل", "السجل اليومي للطلاب", "الإحصائيات"].some((permission) => hasPermission(permission)) && <div className="px-2 mb-0.5">
                <CollapseSection
                  icon={FileText}
                  label="التقارير"
                  isOpen={isAdminReportsOpen}
                  onToggle={() => setIsAdminReportsOpen(!isAdminReportsOpen)}
                >
                  {[
                    {
                      icon: FileText,

                      label: "تقارير المعلمين",

                      permKey: "تقارير المعلمين",

                      path: "/admin/teacher-attendance",
                    },

                    {
                      icon: MessageSquare,

                      label: "تقارير الرسائل",

                      permKey: "تقارير الرسائل",

                      path: "/admin/reports",
                    },

                    {
                      icon: FileText,

                      label: "السجل اليومي للطلاب",

                      permKey: "السجل اليومي للطلاب",

                      path: "/admin/student-daily-attendance",
                    },

                    {
                      icon: BarChart3,

                      label: "الإحصائيات",

                      permKey: "الإحصائيات",

                      path: "/admin/statistics",
                    },
                  ].filter(({ permKey }) => hasPermission(permKey)).map(({ icon: Ic, label, path }) => (
                    <NavItem
                      key={label}
                      icon={Ic}
                      label={label}
                      onClick={() => handleNav(path)}
                      indent
                    />
                  ))}
                </CollapseSection>
              </div>}

              {/* فئة الإدارة العامة */}

              {["إدارة الاختبارات", "اختبار الطلاب", "إدارة المسار", "إدارة المتجر", "الإشعارات", "الصلاحيات", "المالية", "الإرسال إلى أولياء الأمور", "إنهاء الفصل", "يوم السرد"].some(p => hasPermission(p)) && <div className="px-2 mb-0.5">
                <CollapseSection
                  icon={Settings}
                  label="الإدارة العامة"
                  isOpen={isAdminGeneralOpen}
                  onToggle={() => setIsAdminGeneralOpen(!isAdminGeneralOpen)}
                >
                  {[
                    {
                      icon: ClipboardCheck,

                      label: "إدارة الاختبارات",

                      permKey: "إدارة الاختبارات",

                      path: "/admin/exams",
                    },

                    {
                      icon: ClipboardCheck,

                      label: "اختبار الطلاب",

                      permKey: "اختبار الطلاب",

                      path: "?action=student-exams",
                    },

                    {
                      icon: Map,

                      label: "المسار",

                      permKey: "إدارة المسار",

                      path: "/admin/pathways",
                    },

                    {
                      icon: ShoppingBag,

                      label: "المتجر",

                      permKey: "إدارة المتجر",

                      path: "/admin/store-management",
                    },

                    {
                      icon: CalendarDays,

                      label: "يوم السرد",

                      permKey: "يوم السرد",

                      path: "/admin/recitation-day",
                    },

                    {
                      icon: Bell,

                      label: "الإشعارات",

                      permKey: "الإشعارات",

                      path: "/admin/notifications",
                    },

                    {
                      icon: ShieldCheck,

                      label: "الصلاحيات",

                      permKey: "الصلاحيات",

                      path: "/admin/permissions",
                    },

                    {
                      icon: Banknote,

                      label: "المالية",

                      permKey: "المالية",

                      path: "/admin/finance",
                    },

                    {
                      icon: Send,

                      label: "إرسال عبر الواتس",

                      permKey: "الإرسال إلى أولياء الأمور",

                      path: "/admin/whatsapp-send",
                    },

                    {
                      icon: Calendar,

                      label: "الفصول المؤرشفة",

                      permKey: "إنهاء الفصل",

                      path: "/admin/semesters",
                    },

                    {
                      icon: Calendar,

                      label: hasActiveSemester === false ? "بدء الفصل" : "إنهاء الفصل",

                      permKey: "إنهاء الفصل",

                      path: hasActiveSemester === false ? "/admin/semesters" : "?action=end-semester",
                    },
                  ].filter(({ permKey }) => hasPermission(permKey)).map(({ icon: Ic, label, path }) => (
                    <NavItem
                      key={label}
                      icon={Ic}
                      label={label}
                      onClick={() => handleNav(path)}
                      indent
                    />
                  ))}
                </CollapseSection>
              </div>}

              {/* فئة الألعاب */}

              {["إدارة صور خمن الصورة", "إدارة أسئلة المزاد", "إدارة من سيربح المليون", "إدارة خلية الحروف", "إدارة أسئلة الفئات"].some((permission) => hasPermission(permission)) && <div className="px-2 mb-0.5">
                <CollapseSection
                  icon={Gamepad2}
                  label="الألعاب"
                  isOpen={isAdminGamesOpen}
                  onToggle={() => setIsAdminGamesOpen(!isAdminGamesOpen)}
                >
                  {[
                    {
                      icon: Star,

                      label: "إدارة صور خمن الصورة",

                      permKey: "إدارة صور خمن الصورة",

                      path: "/admin/guess-images",
                    },

                    {
                      icon: Zap,

                      label: "إدارة أسئلة المزاد",

                      permKey: "إدارة أسئلة المزاد",

                      path: "/admin/auction-questions",
                    },

                    {
                      icon: Award,

                      label: "إدارة من سيربح المليون",

                      permKey: "إدارة من سيربح المليون",

                      path: "/admin/millionaire-questions",
                    },

                    {
                      icon: BookOpen,

                      label: "إدارة خلية الحروف",

                      permKey: "إدارة خلية الحروف",

                      path: "/admin/letter-hive-questions",
                    },

                    {
                      icon: FileText,

                      label: "إدارة أسئلة الفئات",

                      permKey: "إدارة أسئلة الفئات",

                      path: "/admin/questions",
                    },
                  ].filter(({ permKey }) => hasPermission(permKey)).map(({ icon: Ic, label, path }) => (
                    <NavItem
                      key={label}
                      icon={Ic}
                      label={label}
                      onClick={() => handleNav(path)}
                      indent
                    />
                  ))}
                </CollapseSection>
              </div>}
            </>
          )}

          {/* تسجيل الخروج */}
          {isLoggedIn && (
            <div className="px-2 mt-1 mb-4">
              <button
                onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-right text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <LogOut size={16} className="text-red-600" />
                </div>
                <span className="text-red-600">تسجيل الخروج</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <WhatsAppQrDialog open={isWhatsAppQrDialogOpen} onOpenChange={setIsWhatsAppQrDialogOpen} initialStatus={whatsAppStatus} />

      <Dialog open={isLoginDialogOpen} onOpenChange={handleLoginDialogChange}>
        <DialogContent className="max-w-[92vw] rounded-[22px] border border-[#dbe5f1] bg-white p-6 shadow-[0_18px_50px_rgba(18,37,84,0.14)] sm:max-w-md" dir="rtl">
          <DialogHeader className="mb-2 text-right">
            <DialogTitle className="text-2xl font-black text-[#1a2332]">تسجيل الدخول</DialogTitle>
          </DialogHeader>
          <div>
            <LoginForm onSuccess={() => setIsLoginDialogOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNotificationsDialogOpen} onOpenChange={setIsNotificationsDialogOpen}>
        <DialogContent className="max-w-[92vw] overflow-hidden rounded-[22px] border border-[#dbe5f1] bg-white p-0 shadow-[0_18px_50px_rgba(18,37,84,0.14)] sm:max-w-md" dir="rtl">
          <DialogHeader className="border-b border-gray-100 px-5 py-4 text-right">
            <DialogTitle className="text-xl font-black text-[#1a2332]">الإشعارات</DialogTitle>
            <DialogDescription className="sr-only">قائمة الإشعارات الخاصة بالحساب الحالي.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#3453a740_transparent] bg-white" dir="rtl">
            {notifLoading ? (
              <div className="flex items-center justify-center py-14">
                <SiteLoader size="sm" color="#3453a7" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-3 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#3453a7]/10 flex items-center justify-center">
                  <Bell size={24} className="text-[#3453a7]/60" />
                </div>
                <p className="text-sm text-gray-400 font-medium">لا توجد إشعارات</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    className={`group flex items-start gap-3 px-4 py-3.5 hover:bg-[#f4f7ff] transition-colors cursor-default ${index !== notifications.length - 1 ? "border-b border-gray-100" : ""}`}
                  >
                    <div className="flex-shrink-0 mt-2">
                      {!notification.is_read
                        ? <div className="w-2 h-2 rounded-full bg-[#3453a7] shadow-sm" />
                        : <div className="w-2 h-2 rounded-full border border-gray-300" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-relaxed break-words ${!notification.is_read ? "text-gray-800 font-medium" : "text-gray-500"}`}>
                        {notification.message}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {new Date(notification.created_at).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="flex-shrink-0 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      aria-label="حذف الإشعار"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isStaffProfileDialogOpen} onOpenChange={setIsStaffProfileDialogOpen}>
        <DialogContent className="max-w-[92vw] rounded-[22px] border border-[#dbe5f1] bg-white p-0 shadow-[0_18px_50px_rgba(18,37,84,0.14)] sm:max-w-md" dir="rtl">
          <DialogHeader className="border-b border-gray-100 px-5 py-4 text-right">
            <DialogTitle className="text-xl font-black text-[#1a2332]">البيانات الشخصية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-5 py-5">
            {isStaffProfileLoading ? (
              <div className="flex items-center justify-center py-10">
                <SiteLoader size="sm" color="#3453a7" />
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-[#e3ebfb] bg-[#f8fbff] px-4 py-3 text-right">
                  <div className="text-[12px] font-bold text-[#7b879a]">الاسم</div>
                  <div className="mt-1 text-base font-black text-[#1a2332]">{staffProfileData?.name || userName || "-"}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#e3ebfb] bg-white px-4 py-3 text-right">
                    <div className="text-[12px] font-bold text-[#7b879a]">رقم الحساب</div>
                    <div className="mt-1 text-sm font-black text-[#1a2332]" dir="ltr">{staffProfileData?.accountNumber || "-"}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e3ebfb] bg-white px-4 py-3 text-right">
                    <div className="text-[12px] font-bold text-[#7b879a]">المسمى</div>
                    <div className="mt-1 text-sm font-black text-[#1a2332]">{staffProfileData?.role || roleLabel || "-"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#e3ebfb] bg-white px-4 py-3 text-right">
                    <div className="text-[12px] font-bold text-[#7b879a]">رقم الهوية</div>
                    <div className="mt-1 text-sm font-black text-[#1a2332]" dir="ltr">{staffProfileData?.idNumber || "غير متوفر"}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e3ebfb] bg-white px-4 py-3 text-right">
                    <div className="text-[12px] font-bold text-[#7b879a]">رقم الجوال</div>
                    <div className="mt-1 text-sm font-black text-[#1a2332]" dir="ltr">{staffProfileData?.phoneNumber || "غير متوفر"}</div>
                  </div>
                </div>
                {staffProfileData?.halaqah ? (
                  <div className="rounded-2xl border border-[#e3ebfb] bg-white px-4 py-3 text-right">
                    <div className="text-[12px] font-bold text-[#7b879a]">الحلقة</div>
                    <div className="mt-1 text-sm font-black text-[#1a2332]">{staffProfileData.halaqah}</div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {shouldShowNotificationIndicator && isNotificationPromptOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(15,23,42,0.46)] px-4" dir="rtl">
          <div className="w-full max-w-sm rounded-[28px] border border-[#d8e4fb] bg-white px-6 py-7 text-center shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#20335f_0%,#3453a7_62%,#7d9ff5_100%)] text-white">
              <Bell size={28} />
            </div>
            <div className="mb-3 text-lg font-black leading-8 text-[#1a2332]">أنت ما فعلت التنبيهات</div>
            <p className="mb-6 text-sm leading-7 text-[#526071]">هل تريد تفعيلها الآن؟</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={enableNotificationsFromHeader}
                disabled={isSubmittingNotificationPermission}
                className="rounded-full bg-[#3453a7] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#28448e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingNotificationPermission ? "جاري التفعيل..." : "نعم، فعلها"}
              </button>
              <button
                type="button"
                onClick={() => setIsNotificationPromptOpen(false)}
                className="rounded-full border border-[#d8e4fb] px-4 py-3 text-sm font-bold text-[#526071] transition hover:bg-[#f8fbff]"
              >
                لاحقًا
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default Header;
