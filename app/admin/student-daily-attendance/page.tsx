
"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Calendar, Settings2 } from "lucide-react"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { useAlertDialog } from "@/hooks/use-confirm-dialog"
import { SiteLoader } from "@/components/ui/site-loader"
import { formatQuranRange } from "@/lib/quran-data"
import { isNonEvaluatedAttendance, translateAttendanceStatus } from "@/lib/student-attendance"
import {
  ATTENDANCE_SAVE_NOTIFICATION_SETTINGS_ID,
  DEFAULT_ATTENDANCE_SAVE_NOTIFICATION_TEMPLATES,
  normalizeAttendanceSaveNotificationTemplates,
  type AttendanceSaveNotificationTemplates,
} from "@/lib/attendance-save-notification-templates"
import {
  ATTENDANCE_AUTO_SEND_SETTINGS_ID,
  ATTENDANCE_WEEKLY_REPORT_LOG_SETTING_ID,
  DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS,
} from "@/lib/site-settings-constants"

type AttendanceAutoSendMode = "daily" | "weekly" | "none"
type AttendanceWeeklySendDay = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday"

type AttendanceAutoSendForm = {
  mode: AttendanceAutoSendMode
  weeklySendDay: AttendanceWeeklySendDay
  weeklySendTime: string
}

type AttendanceWeeklyReportLogEntry = {
  weekKey: string
  weekStart: string
  weekEnd: string
  studentIds: string[]
  sentAt: string
  queuedCount: number
}

const WEEKLY_SEND_DAY_OPTIONS: Array<{ value: AttendanceWeeklySendDay; label: string }> = [
  { value: "sunday", label: "الأحد" },
  { value: "monday", label: "الاثنين" },
  { value: "tuesday", label: "الثلاثاء" },
  { value: "wednesday", label: "الأربعاء" },
  { value: "thursday", label: "الخميس" },
  { value: "friday", label: "الجمعة" },
  { value: "saturday", label: "السبت" },
]

function normalizeAttendanceAutoSendSettings(value: unknown): AttendanceAutoSendForm {
  const candidate = value && typeof value === "object" ? (value as Partial<AttendanceAutoSendForm>) : {}
  const mode = candidate.mode === "weekly" || candidate.mode === "none" ? candidate.mode : DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS.mode
  const weeklySendDay = WEEKLY_SEND_DAY_OPTIONS.some((option) => option.value === candidate.weeklySendDay)
    ? (candidate.weeklySendDay as AttendanceWeeklySendDay)
    : DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS.weeklySendDay
  const weeklySendTime = typeof candidate.weeklySendTime === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(candidate.weeklySendTime.trim())
    ? candidate.weeklySendTime.trim()
    : DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS.weeklySendTime

  return { mode, weeklySendDay, weeklySendTime }
}

function normalizeAttendanceWeeklyReportLogEntry(value: unknown) {
  const candidate = value && typeof value === "object" ? (value as { entries?: unknown[] }) : {}
  const entries = Array.isArray(candidate.entries) ? candidate.entries : []
  const latestEntry = entries[entries.length - 1]

  if (!latestEntry || typeof latestEntry !== "object") {
    return null
  }

  const normalizedEntry = latestEntry as Partial<AttendanceWeeklyReportLogEntry>
  const weekKey = String(normalizedEntry.weekKey || "").trim()
  const weekStart = String(normalizedEntry.weekStart || "").trim()
  const weekEnd = String(normalizedEntry.weekEnd || "").trim()
  const sentAt = String(normalizedEntry.sentAt || "").trim()

  if (!weekKey || !weekStart || !weekEnd || !sentAt) {
    return null
  }

  return {
    weekKey,
    weekStart,
    weekEnd,
    sentAt,
    queuedCount: Math.max(0, Math.floor(Number(normalizedEntry.queuedCount) || 0)),
    studentIds: Array.isArray(normalizedEntry.studentIds) ? normalizedEntry.studentIds.map((studentId) => String(studentId || "").trim()).filter(Boolean) : [],
  }
}

function getWeeklySendDayLabel(day: AttendanceWeeklySendDay) {
  return WEEKLY_SEND_DAY_OPTIONS.find((option) => option.value === day)?.label || "الخميس"
}

function translateLevel(level: string | null | undefined) {
  if (!level) return null;
  switch (level) {
    case "excellent": return "ممتاز";
    case "very_good": return "جيد جدًا";
    case "good": return "جيد";
    case "not_completed": return "لم يكمل";
    default: return null;
  }
}

function LevelBadge({ level }: { level: string | null | undefined }) {
  const label = translateLevel(level);
  if (!label) return <span className="text-gray-300">—</span>;
  const colors: Record<string, string> = {
    "ممتاز": "text-emerald-600",
    "جيد جدًا": "text-blue-600",
    "جيد": "text-amber-600",
    "لم يكمل": "text-red-500",
  };
  return (
    <span className={`text-base font-semibold ${colors[label] ?? "text-gray-500"}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "present") return <span className="text-base font-semibold text-emerald-600">حاضر</span>;
  if (status === "late") return <span className="text-base font-semibold text-orange-600">متأخر</span>;
  if (status === "excused") return <span className="text-base font-semibold text-amber-600">مستأذن</span>;
  if (status === "absent") return <span className="text-base font-semibold text-red-500">غائب</span>;
  return <span className="text-gray-400 text-base">{translateAttendanceStatus(status) || "—"}</span>;
}

interface AttendanceRecord {
  id: string
  student_id: string
  student_name: string
  halaqah?: string | null
  status: string | null
  created_at: string
  hafiz_level?: string | null
  tikrar_level?: string | null
  samaa_level?: string | null
  rabet_level?: string | null
  hafiz_from_surah?: string | null
  hafiz_from_verse?: string | null
  hafiz_to_surah?: string | null
  hafiz_to_verse?: string | null
  samaa_from_surah?: string | null
  samaa_from_verse?: string | null
  samaa_to_surah?: string | null
  samaa_to_verse?: string | null
  rabet_from_surah?: string | null
  rabet_from_verse?: string | null
  rabet_to_surah?: string | null
  rabet_to_verse?: string | null
  attendance_date?: string
}

interface CircleOption {
  id?: string
  name?: string | null
}

function formatReadingRange(fromSurah?: string | null, fromVerse?: string | null, toSurah?: string | null, toVerse?: string | null) {
  return formatQuranRange(fromSurah, fromVerse, toSurah, toVerse)
}

function EvaluationCell({ level, detail }: { level: string | null | undefined, detail?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <LevelBadge level={level} />
      {detail && <span className="text-[11px] leading-4 text-neutral-500">{detail}</span>}
    </div>
  )
}

export default function StudentDailyAttendancePage() {
  return <StudentDailyAttendanceContent displayMode="page" />
}

export function StudentDailyAttendanceContent({
  displayMode = "page",
  onInlineActionsChange,
}: {
  displayMode?: "page" | "inline"
  onInlineActionsChange?: (actions: { openTemplates: () => void }) => void
}) {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("السجل اليومي للطلاب");
  const showAlert = useAlertDialog()

  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingRecords, setIsFetchingRecords] = useState(false)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([])
  const [circles, setCircles] = useState<CircleOption[]>([])
  const [selectedCircle, setSelectedCircle] = useState("all")
  const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false)
  const [isWeeklyScheduleDialogOpen, setIsWeeklyScheduleDialogOpen] = useState(false)
  const [isSavingTemplates, setIsSavingTemplates] = useState(false)
  const [attendanceTemplatesForm, setAttendanceTemplatesForm] = useState<AttendanceSaveNotificationTemplates>(
    DEFAULT_ATTENDANCE_SAVE_NOTIFICATION_TEMPLATES,
  )
  const [attendanceAutoSendForm, setAttendanceAutoSendForm] = useState<AttendanceAutoSendForm>(
    normalizeAttendanceAutoSendSettings(DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS),
  )
  const [latestWeeklyReportLog, setLatestWeeklyReportLog] = useState<AttendanceWeeklyReportLogEntry | null>(null)

  const getSaudiDate = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  const [selectedDate, setSelectedDate] = useState(getSaudiDate())
  useEffect(() => {
    if (!authLoading && authVerified) {
      fetchAttendanceRecords()
    }
  }, [authLoading, authVerified, selectedDate])

  useEffect(() => {
    if (!authLoading && authVerified) {
      void fetchCircles()
    }
  }, [authLoading, authVerified])

  useEffect(() => {
    filterRecords()
  }, [attendanceRecords, selectedDate, selectedCircle])

  useEffect(() => {
    if (!authLoading && authVerified) {
      void loadAttendanceTemplates()
      void loadAttendanceAutoSendSettings()
      void loadAttendanceWeeklyReportLog()
    }
  }, [authLoading, authVerified])

  useEffect(() => {
    if (!onInlineActionsChange) {
      return
    }

    onInlineActionsChange({
      openTemplates: () => setIsTemplatesDialogOpen(true),
    })
  }, [onInlineActionsChange])

  const fetchAttendanceRecords = async () => {
    setIsFetchingRecords(true)
    try {
      const response = await fetch(`/api/student-attendance/all?date=${selectedDate}`)
      if (!response.ok) throw new Error("فشل في جلب البيانات من السيرفر")
      const data = await response.json()
      setAttendanceRecords(Array.isArray(data.records) ? data.records : [])
    } catch (error) {
      setAttendanceRecords([])
      console.error("[v0] Error fetching attendance:", error)
    } finally {
      setIsFetchingRecords(false)
      setIsLoading(false)
    }
  }

  const fetchCircles = async () => {
    try {
      const response = await fetch("/api/circles", { cache: "no-store" })
      const data = await response.json()
      setCircles(Array.isArray(data.circles) ? data.circles : [])
    } catch (error) {
      console.error("[v0] Error fetching circles for daily attendance:", error)
      setCircles([])
    }
  }

  const loadAttendanceTemplates = async () => {
    try {
      const response = await fetch(`/api/site-settings?id=${ATTENDANCE_SAVE_NOTIFICATION_SETTINGS_ID}`, { cache: "no-store" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "تعذر جلب قوالب رسائل ولي الأمر في التقييم اليومي")
      }

      setAttendanceTemplatesForm(normalizeAttendanceSaveNotificationTemplates(data.value))
    } catch (error) {
      console.error("Error loading attendance templates:", error)
    }
  }

  const saveAttendanceTemplates = async () => {
    try {
      setIsSavingTemplates(true)
      const templatesResponse = await fetch("/api/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ATTENDANCE_SAVE_NOTIFICATION_SETTINGS_ID,
          value: attendanceTemplatesForm,
        }),
      })
      const templatesData = await templatesResponse.json()

      if (!templatesResponse.ok || !templatesData.success) {
        throw new Error(templatesData.error || "تعذر حفظ القوالب")
      }

      const settingsResponse = await fetch("/api/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ATTENDANCE_AUTO_SEND_SETTINGS_ID,
          value: attendanceAutoSendForm,
        }),
      })
      const settingsData = await settingsResponse.json()

      if (!settingsResponse.ok || !settingsData.success) {
        throw new Error(settingsData.error || "تعذر حفظ إعدادات الإرسال التلقائي")
      }

      setAttendanceTemplatesForm(normalizeAttendanceSaveNotificationTemplates(attendanceTemplatesForm))
      setAttendanceAutoSendForm(normalizeAttendanceAutoSendSettings(attendanceAutoSendForm))
      await loadAttendanceWeeklyReportLog()
      setIsTemplatesDialogOpen(false)
      await showAlert("تم حفظ قوالب الرسائل وإعدادات الإرسال التلقائي", "نجاح")
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "تعذر حفظ القوالب", "خطأ")
    } finally {
      setIsSavingTemplates(false)
    }
  }

  const loadAttendanceAutoSendSettings = async () => {
    try {
      const response = await fetch(`/api/site-settings?id=${ATTENDANCE_AUTO_SEND_SETTINGS_ID}`, { cache: "no-store" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "تعذر جلب إعدادات الإرسال التلقائي")
      }

      setAttendanceAutoSendForm(normalizeAttendanceAutoSendSettings(data.value))
    } catch (error) {
      console.error("Error loading attendance auto send settings:", error)
    }
  }

  const loadAttendanceWeeklyReportLog = async () => {
    try {
      const response = await fetch(`/api/site-settings?id=${ATTENDANCE_WEEKLY_REPORT_LOG_SETTING_ID}`, { cache: "no-store" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "تعذر جلب سجل الإرسال الأسبوعي")
      }

      setLatestWeeklyReportLog(normalizeAttendanceWeeklyReportLogEntry(data.value))
    } catch (error) {
      console.error("Error loading attendance weekly report log:", error)
      setLatestWeeklyReportLog(null)
    }
  }

  const handleAutoSendModeChange = (value: string) => {
    const nextMode = value === "weekly" || value === "none" ? value : "daily"

    setAttendanceAutoSendForm((current) => ({
      ...current,
      mode: nextMode,
    }))

    if (nextMode === "weekly") {
      setIsWeeklyScheduleDialogOpen(true)
    }
  }

  const filterRecords = () => {
    setFilteredRecords(
      attendanceRecords.filter((r) => {
        const matchesDate = selectedDate ? r.attendance_date === selectedDate : true
        const matchesCircle = selectedCircle === "all" ? true : (r.halaqah || "") === selectedCircle
        return matchesDate && matchesCircle
      })
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <SiteLoader size="lg" />
      </div>
    )
  }

  const isFuture = (() => {
    return selectedDate > getSaudiDate();
  })();

  const arabicCollator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" })
  const groupedRecords = Array.from(
    filteredRecords.reduce<Map<string, AttendanceRecord[]>>((groups, record) => {
      const circleName = (record.halaqah || "بدون حلقة").trim() || "بدون حلقة"
      const currentGroup = groups.get(circleName) || []
      currentGroup.push(record)
      groups.set(circleName, currentGroup)
      return groups
    }, new Map()),
  )
    .sort(([leftCircle], [rightCircle]) => arabicCollator.compare(leftCircle, rightCircle))
    .map(([circleName, records]) => ({
      circleName,
      records: records.slice().sort((left, right) => arabicCollator.compare(left.student_name || "", right.student_name || "")),
    }))

  const availableCircles = Array.from(
    new Set(
      [
        ...circles.map((circle) => (circle.name || "").trim()),
        ...attendanceRecords.map((record) => (record.halaqah || "").trim()),
      ].filter((circleName) => circleName.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "ar"))

  if (authLoading || !authVerified) return (<div className="min-h-screen flex items-center justify-center bg-white"><SiteLoader size="md" /></div>);

  const content = (
    <div className="space-y-5" dir="rtl">
      {displayMode === "page" ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-[#1a2332]">السجل اليومي للطلاب</h1>
            <p className="text-sm font-medium text-[#6c7d95]">عرض حضور الطلاب حسب التاريخ والحلقة داخل جدول موحّد.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsTemplatesDialogOpen(true)}
            className="h-11 rounded-full border-[#d8e5fb] bg-white px-5 text-sm font-bold text-[#3453a7] hover:bg-[#f6f9ff]"
          >
            <Settings2 className="me-2 h-4 w-4" />
            القوالب والإرسال التلقائي
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.7rem] border border-[#e2eaf7] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[#e8eef8] px-4 py-4 md:px-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Select value={selectedCircle} onValueChange={setSelectedCircle}>
                <SelectTrigger className="text-base border-[#d8e5fb] focus:ring-[#3453a7]/30">
                  <SelectValue placeholder="اختر الحلقة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الحلقات</SelectItem>
                  {availableCircles.map((circle) => (
                    <SelectItem key={circle} value={circle}>{circle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 flex-shrink-0 text-[#3453a7]" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-base border-[#d8e5fb] focus-visible:ring-[#3453a7]/30"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f8fbff] border-b border-[#e2eaf7] hover:bg-[#f8fbff]">
                <TableHead className="text-right text-[#20335f] font-extrabold text-base">الحلقة</TableHead>
                <TableHead className="text-right text-[#20335f] font-extrabold text-base">اسم الطالب</TableHead>
                <TableHead className="text-center text-[#20335f] font-extrabold w-24 px-1 text-base">الحفظ</TableHead>
                <TableHead className="text-center text-[#20335f] font-extrabold w-24 px-1 text-base">التكرار</TableHead>
                <TableHead className="text-center text-[#20335f] font-extrabold w-24 px-1 text-base">المراجعة</TableHead>
                <TableHead className="text-center text-[#20335f] font-extrabold w-24 px-1 text-base">الربط</TableHead>
                <TableHead className="text-center text-[#20335f] font-extrabold text-base">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFuture ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-[#7b8aa0]">
                    لا يمكن عرض بيانات الحضور لتاريخ مستقبلي
                  </TableCell>
                </TableRow>
              ) : isFetchingRecords ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12">
                    <div className="flex justify-center">
                      <SiteLoader size="md" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : groupedRecords.length > 0 ? groupedRecords.map((group, groupIndex) => (
                group.records.map((record, recordIndex) => (
                  <TableRow key={record.id} className="transition-colors duration-150 hover:bg-white border-b border-[#eef3fb]">
                    {recordIndex === 0 ? (
                      <TableCell rowSpan={group.records.length} className="min-w-[170px] border-s border-[#eef3fb] align-top font-medium text-neutral-700 text-base bg-[#fafcff]">
                        <div className="flex items-start gap-2">
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#3453a7]/10 px-2 text-sm font-bold text-[#3453a7]">
                            {groupIndex + 1}
                          </span>
                          <span className="pt-0.5 font-semibold">{group.circleName}</span>
                        </div>
                      </TableCell>
                    ) : null}
                    <TableCell className="font-semibold text-[#1a2332] text-base">{record.student_name}</TableCell>
                    <TableCell className="text-center">
                      {isNonEvaluatedAttendance(record.status)
                        ? <span className="text-gray-300">—</span>
                        : <EvaluationCell level={record.hafiz_level} detail={formatReadingRange(record.hafiz_from_surah, record.hafiz_from_verse, record.hafiz_to_surah, record.hafiz_to_verse)} />}
                    </TableCell>
                    <TableCell className="text-center px-1">
                      {isNonEvaluatedAttendance(record.status)
                        ? <span className="text-gray-300">—</span>
                        : <LevelBadge level={record.tikrar_level} />}
                    </TableCell>
                    <TableCell className="text-center px-1">
                      {isNonEvaluatedAttendance(record.status)
                        ? <span className="text-gray-300">—</span>
                        : <EvaluationCell level={record.samaa_level} detail={formatReadingRange(record.samaa_from_surah, record.samaa_from_verse, record.samaa_to_surah, record.samaa_to_verse)} />}
                    </TableCell>
                    <TableCell className="text-center px-1">
                      {isNonEvaluatedAttendance(record.status)
                        ? <span className="text-gray-300">—</span>
                        : <EvaluationCell level={record.rabet_level} detail={formatReadingRange(record.rabet_from_surah, record.rabet_from_verse, record.rabet_to_surah, record.rabet_to_verse)} />}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={record.status} />
                    </TableCell>
                  </TableRow>
                ))
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-[#7b8aa0]">
                    {selectedCircle === "all" ? "لا توجد سجلات للعرض في التاريخ المحدد" : "لا يوجد طلاب أو سجلات لهذه الحلقة في التاريخ المحدد"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )

  const templatesDialog = (
    <Dialog open={isTemplatesDialogOpen} onOpenChange={setIsTemplatesDialogOpen}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto" dir="rtl">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 text-right">
          <DialogTitle className="text-right text-xl font-black text-[#1a2332]">قوالب رسائل ولي الأمر والإرسال التلقائي</DialogTitle>
          <div className="group relative shrink-0 self-start">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8e4fb] bg-white text-[#526071] shadow-sm transition-colors hover:border-[#3453a7]/40 hover:text-[#3453a7]"
              aria-label="المتغيرات المتاحة في القالب"
            >
              <AlertCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
            <div className="pointer-events-none absolute left-0 top-11 z-20 hidden w-[320px] rounded-2xl border border-[#e6edf6] bg-white px-4 py-3 text-right text-sm leading-7 text-[#526071] shadow-lg group-hover:block">
              تُستخدم هذه الرسائل عند حفظ التحضير اليومي. المتغيرات المتاحة: {" "}
              <span className="font-bold">{'{name}'}</span> اسم الطالب، {" "}
              <span className="font-bold">{'{date}'}</span> التاريخ، {" "}
              <span className="font-bold">{'{status}'}</span> الحالة، {" "}
              <span className="font-bold">{'{hafiz_evaluation}'}</span> تقييم الحفظ، {" "}
              <span className="font-bold">{'{hafiz_amount}'}</span> مقدار الحفظ، {" "}
              <span className="font-bold">{'{tikrar_evaluation}'}</span> تقييم التكرار، {" "}
              <span className="font-bold">{'{samaa_evaluation}'}</span> تقييم المراجعة، {" "}
              <span className="font-bold">{'{rabet_evaluation}'}</span> تقييم الربط، {" "}
              <span className="font-bold">{'{week_start}'}</span> بداية الأسبوع، {" "}
              <span className="font-bold">{'{week_end}'}</span> نهاية الأسبوع، {" "}
              <span className="font-bold">{'{week_days}'}</span> الأيام التي تم تسجيلها.
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-2 text-right">
          <div className="rounded-[26px] border border-[#d8e4fb] bg-[#f8fbff] p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div>
                  <div className="text-base font-black text-[#1a2332]">الإرسال التلقائي</div>
                  <div className="mt-1 text-sm leading-6 text-[#526071]">اختيار إداري عام فقط. التقرير الأسبوعي يعتمد على السجلات التي تم تسجيلها فعليًا من الأحد إلى الخميس، مع منع تكرار نفس الأسبوع مرتين.</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
                  <div className="space-y-2">
                    <div className="text-sm font-bold text-[#1a2332]">نوع الإرسال</div>
                    <Select value={attendanceAutoSendForm.mode} onValueChange={handleAutoSendModeChange}>
                      <SelectTrigger className="border-[#d8e4fb] bg-white text-base focus:ring-[#3453a7]/30">
                        <SelectValue placeholder="اختر نوع الإرسال" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="daily">يومي</SelectItem>
                        <SelectItem value="weekly">أسبوعي</SelectItem>
                        <SelectItem value="none">إيقاف</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-2xl border border-[#e6edf6] bg-white px-4 py-3 text-sm leading-7 text-[#526071]">
                    <div>الوضع الحالي: <span className="font-black text-[#1a2332]">{attendanceAutoSendForm.mode === "daily" ? "يومي" : attendanceAutoSendForm.mode === "weekly" ? "أسبوعي" : "إيقاف"}</span></div>
                    <div>يوم الإرسال: <span className="font-black text-[#1a2332]">{getWeeklySendDayLabel(attendanceAutoSendForm.weeklySendDay)}</span></div>
                    <div>الوقت: <span className="font-black text-[#1a2332]">{attendanceAutoSendForm.weeklySendTime}</span></div>
                  </div>
                </div>
                {attendanceAutoSendForm.mode === "weekly" ? (
                  <div className="flex justify-start">
                    <Button type="button" variant="outline" onClick={() => setIsWeeklyScheduleDialogOpen(true)} className="h-10 rounded-full border-[#d8e4fb] bg-white px-5 text-[#3453a7] hover:bg-[#f6f9ff]">
                      إعداد يوم الإرسال والوقت
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-[#e6edf6] bg-white px-4 py-4 text-sm leading-7 text-[#526071]">
                <div className="text-sm font-black text-[#1a2332]">آخر إرسال أسبوعي مسجل</div>
                {latestWeeklyReportLog ? (
                  <div className="mt-2 space-y-1">
                    <div>الفترة: <span className="font-black text-[#1a2332]">من {latestWeeklyReportLog.weekStart} إلى {latestWeeklyReportLog.weekEnd}</span></div>
                    <div>الرسائل المضافة للطابور: <span className="font-black text-[#1a2332]">{latestWeeklyReportLog.queuedCount}</span></div>
                    <div>آخر تنفيذ: <span className="font-black text-[#1a2332]">{latestWeeklyReportLog.sentAt}</span></div>
                  </div>
                ) : (
                  <div className="mt-2">لا يوجد إرسال أسبوعي محفوظ بعد.</div>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-bold text-[#1a2332]">رسالة الحاضر</div>
              <Textarea value={attendanceTemplatesForm.present} onChange={(e) => setAttendanceTemplatesForm((current) => ({ ...current, present: e.target.value }))} className="min-h-[140px] border-[#d8e4fb] text-right" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold text-[#1a2332]">رسالة المتأخر</div>
              <Textarea value={attendanceTemplatesForm.late} onChange={(e) => setAttendanceTemplatesForm((current) => ({ ...current, late: e.target.value }))} className="min-h-[140px] border-[#d8e4fb] text-right" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold text-[#1a2332]">رسالة الغائب</div>
              <Textarea value={attendanceTemplatesForm.absent} onChange={(e) => setAttendanceTemplatesForm((current) => ({ ...current, absent: e.target.value }))} className="min-h-[140px] border-[#d8e4fb] text-right" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold text-[#1a2332]">رسالة المستأذن</div>
              <Textarea value={attendanceTemplatesForm.excused} onChange={(e) => setAttendanceTemplatesForm((current) => ({ ...current, excused: e.target.value }))} className="min-h-[140px] border-[#d8e4fb] text-right" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <div className="text-sm font-bold text-[#1a2332]">رسالة الملخص الأسبوعي</div>
              <Textarea value={attendanceTemplatesForm.weekly} onChange={(e) => setAttendanceTemplatesForm((current) => ({ ...current, weekly: e.target.value }))} className="min-h-[180px] border-[#d8e4fb] text-right" />
            </div>
          </div>
          <div className="flex justify-start gap-2">
            <Button variant="outline" onClick={() => setIsTemplatesDialogOpen(false)} className="h-11 rounded-full border-[#d8e4fb] px-6">
              إغلاق
            </Button>
            <Button onClick={saveAttendanceTemplates} disabled={isSavingTemplates} className="h-11 rounded-full border border-[#d8e4fb] bg-[#3453a7] px-6 text-white hover:bg-[#28448e] disabled:border-[#d8e4fb] disabled:bg-white disabled:text-white disabled:opacity-100">
              {isSavingTemplates ? "جاري الحفظ..." : "حفظ القوالب"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  const weeklyScheduleDialog = (
    <Dialog open={isWeeklyScheduleDialogOpen} onOpenChange={setIsWeeklyScheduleDialogOpen}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right text-xl font-black text-[#1a2332]">إعداد الإرسال الأسبوعي</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 text-right">
          <div className="rounded-2xl border border-[#d8e4fb] bg-[#f8fbff] px-4 py-3 text-sm leading-7 text-[#526071]">
            سيتم إرسال آخر أسبوع مسجل تلقائيًا، مع اعتماد الأيام المحفوظة فقط من الأحد إلى الخميس ومنع إرسال نفس الأسبوع مرتين.
          </div>
          <div className="space-y-2">
            <div className="text-sm font-bold text-[#1a2332]">يوم الإرسال</div>
            <Select value={attendanceAutoSendForm.weeklySendDay} onValueChange={(value) => setAttendanceAutoSendForm((current) => ({ ...current, weeklySendDay: value as AttendanceWeeklySendDay }))}>
              <SelectTrigger className="border-[#d8e4fb] bg-white text-base focus:ring-[#3453a7]/30">
                <SelectValue placeholder="اختر يوم الإرسال" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {WEEKLY_SEND_DAY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-bold text-[#1a2332]">الوقت</div>
            <Input type="time" value={attendanceAutoSendForm.weeklySendTime} onChange={(event) => setAttendanceAutoSendForm((current) => ({ ...current, weeklySendTime: event.target.value || "22:00" }))} className="border-[#d8e4fb] text-base focus-visible:ring-[#3453a7]/30" />
          </div>
          <div className="flex justify-start gap-2">
            <Button type="button" variant="outline" onClick={() => setIsWeeklyScheduleDialogOpen(false)} className="h-11 rounded-full border-[#d8e4fb] px-6">
              تم
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  if (displayMode === "inline") {
    return (
      <>
        <div className="px-1 py-1">{content}</div>
        {templatesDialog}
        {weeklyScheduleDialog}
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="container mx-auto max-w-7xl">{content}</div>
      </main>
      {templatesDialog}
      {weeklyScheduleDialog}
      <Footer />
    </div>
  )
}

