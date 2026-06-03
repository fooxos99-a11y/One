"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Clock } from "lucide-react"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { useAlertDialog } from "@/hooks/use-confirm-dialog"
import { SiteLoader } from "@/components/ui/site-loader"
import { formatSaudiTimeWithPeriod, getSaudiDateString } from "@/lib/saudi-time"
import { DEFAULT_TEACHER_ATTENDANCE_DELAY_MINUTES, TEACHER_ATTENDANCE_DELAY_SETTING_ID } from "@/lib/site-settings-constants"

interface AttendanceRecord {
  id: string
  teacher_id: string
  teacher_name: string
  account_number: number
  attendance_date: string
  check_in_time: string
  status: string
  created_at: string
  asrTime: string | null
  graceDeadline: string | null
  checkInTimeLocal: string | null
  isLate: boolean | null
  isEarly: boolean | null
  isOnTime: boolean | null
  timingCategory: "late" | "early" | "on-time" | null
  lateMinutes: number | null
  city: string
  graceMinutes: number
  source: string
}

export default function TeacherAttendancePage() {
  return <TeacherAttendanceContent displayMode="page" />
}

export function TeacherAttendanceContent({
  displayMode = "page",
  onInlineActionsChange,
}: {
  displayMode?: "page" | "inline"
  onInlineActionsChange?: (actions: { openDelayDialog: () => void; asrTimeLabel: string; graceSummary: string }) => void
}) {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("تقارير المعلمين");

  const [isLoading, setIsLoading] = useState(true)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([])
  const [graceMinutes, setGraceMinutes] = useState(50)
  const [todayAsrTime, setTodayAsrTime] = useState<string | null>(null)
  const [currentSaudiDate, setCurrentSaudiDate] = useState(getSaudiDateString())
  const [selectedDate, setSelectedDate] = useState(getSaudiDateString())
  const [isDelayDialogOpen, setIsDelayDialogOpen] = useState(false)
  const [delayMinutes, setDelayMinutes] = useState(String(DEFAULT_TEACHER_ATTENDANCE_DELAY_MINUTES))
  const [isSavingDelay, setIsSavingDelay] = useState(false)
  const currentSaudiDateRef = useRef(currentSaudiDate)
  const router = useRouter()
  const showAlert = useAlertDialog()

  useEffect(() => {
    currentSaudiDateRef.current = currentSaudiDate
  }, [currentSaudiDate])

  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true"
    const userRole = localStorage.getItem("userRole")

    if (!loggedIn || !userRole || userRole === "student" || userRole === "teacher" || userRole === "deputy_teacher") {
      router.push("/login")
    } else {
      fetchAttendanceRecords()
    }
  }, [router])

  useEffect(() => {
    const syncSaudiDate = () => {
      const nextSaudiDate = getSaudiDateString()
      const previousSaudiDate = currentSaudiDateRef.current

      if (nextSaudiDate === previousSaudiDate) {
        return
      }

      currentSaudiDateRef.current = nextSaudiDate
      setCurrentSaudiDate(nextSaudiDate)
      setSelectedDate((previousSelectedDate) => (previousSelectedDate === previousSaudiDate ? nextSaudiDate : previousSelectedDate))
    }

    const refreshData = () => {
      syncSaudiDate()
      void fetchAttendanceRecords()
    }

    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshData()
      }
    }

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshData()
      }
    }, 60000)

    window.addEventListener("focus", refreshData)
    document.addEventListener("visibilitychange", refreshOnVisibility)

    return () => {
      window.removeEventListener("focus", refreshData)
      document.removeEventListener("visibilitychange", refreshOnVisibility)
      window.clearInterval(refreshInterval)
    }
  }, [])

  useEffect(() => {
    filterRecords()
  }, [attendanceRecords, selectedDate])

  useEffect(() => {
    if (!onInlineActionsChange) {
      return
    }

    onInlineActionsChange({
      openDelayDialog: () => setIsDelayDialogOpen(true),
      asrTimeLabel: todayAsrTime ? formatSaudiTimeWithPeriod(todayAsrTime) : "-",
      graceSummary: `يحتسب التأخر بعد ${graceMinutes} دقيقة من أذان العصر.`,
    })
  }, [graceMinutes, onInlineActionsChange, todayAsrTime])

  const fetchAttendanceRecords = async () => {
    try {
      const response = await fetch("/api/teacher-attendance/all", { cache: "no-store" })
      const data = await response.json()

      if (data.records) {
        setAttendanceRecords(data.records)
      }

      if (typeof data.meta?.graceMinutes === "number") {
        setGraceMinutes(data.meta.graceMinutes)
        setDelayMinutes(String(data.meta.graceMinutes))
      }

      if (typeof data.meta?.todayDate === "string") {
        currentSaudiDateRef.current = data.meta.todayDate
        setCurrentSaudiDate(data.meta.todayDate)
      }

      setTodayAsrTime(typeof data.meta?.todayAsrTime === "string" ? data.meta.todayAsrTime : null)
    } catch (error) {
      console.error("[v0] Error fetching attendance:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterRecords = () => {
    let filtered = attendanceRecords
    // Filter by date only
    if (selectedDate) {
      filtered = filtered.filter((record) => record.attendance_date === selectedDate)
    }
    setFilteredRecords(filtered)
  }

  const handleSaveDelaySetting = async () => {
    const parsedMinutes = Number.parseInt(delayMinutes, 10)
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 0) {
      await showAlert("أدخل مدة تأخير صحيحة بالدقائق", "تنبيه")
      return
    }

    try {
      setIsSavingDelay(true)
      const response = await fetch("/api/site-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: TEACHER_ATTENDANCE_DELAY_SETTING_ID,
          value: { minutes: parsedMinutes },
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "فشل في حفظ مدة التأخير")
      }

      setGraceMinutes(parsedMinutes)
      setDelayMinutes(String(parsedMinutes))
      setIsDelayDialogOpen(false)
      await fetchAttendanceRecords()
      await showAlert(`تم ضبط مدة التأخير إلى ${parsedMinutes} دقيقة بعد أذان العصر في القصيم`, "نجاح")
    } catch (error) {
      console.error("[teacher-attendance] Error saving teacher delay setting:", error)
      await showAlert(error instanceof Error ? error.message : "حدث خطأ أثناء حفظ مدة التأخير", "خطأ")
    } finally {
      setIsSavingDelay(false)
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      return formatSaudiTimeWithPeriod(timestamp)
    } catch {
      return "-"
    }
  }

  const formatLateDuration = (totalMinutes: number | null) => {
    const safeMinutes = Math.max(0, Number(totalMinutes) || 0)
    const hours = Math.floor(safeMinutes / 60)
    const minutes = safeMinutes % 60

    if (hours === 0) {
      return `${minutes} دقيقة`
    }

    if (minutes === 0) {
      return hours === 1 ? "ساعة واحدة" : `${hours} ساعات`
    }

    const hoursLabel = hours === 1 ? "ساعة" : `${hours} ساعات`
    return `${hoursLabel} ${minutes} دقيقة`
  }

  const renderAttendanceStatus = (record: AttendanceRecord) => {
    if (record.status !== "present") {
      return <span className="text-red-600 font-bold">✗ لم يحضر</span>
    }

    if (record.timingCategory === "late") {
      return <span className="font-bold text-amber-600">متأخر {formatLateDuration(record.lateMinutes)}</span>
    }

    if (record.timingCategory === "early") {
      return <span className="text-emerald-600 font-bold">مبكر</span>
    }

    if (record.timingCategory === "on-time") {
      return <span className="text-sky-700 font-bold">حاضر</span>
    }

    return <span className="text-neutral-500 font-bold">حاضر</span>
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString + "T00:00:00")
      return date.toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch {
      return dateString
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SiteLoader size="lg" />
      </div>
    )
  }

    if (authLoading || !authVerified) return (<div className="min-h-screen flex items-center justify-center bg-[#fafaf9]"><SiteLoader size="md" /></div>);

  const content = (
    <div className="space-y-5" dir="rtl">
      {displayMode === "page" ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-[#1a2332]">تحضير المعلمين</h1>
            <p className="text-sm font-medium text-[#6c7d95]">يحتسب التأخر بعد {graceMinutes} دقيقة من أذان العصر</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsDelayDialogOpen(true)}
            className="self-start border-[#d8e5fb] bg-white text-[#3453a7] hover:bg-[#f6f9ff]"
          >
            مدة التأخير
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.7rem] border border-[#e2eaf7] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="border-b border-[#e8eef8] px-4 py-4 md:px-5">
          <div className="flex max-w-md items-center gap-3">
            <Calendar className="h-4 w-4 shrink-0 text-[#3453a7]" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-[#d8e5fb] text-base focus-visible:ring-[#3453a7]/25"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f8fbff] hover:bg-[#f8fbff]">
                <TableHead className="text-right text-[#20335f] font-extrabold">الاسم</TableHead>
                <TableHead className="text-right text-[#20335f] font-extrabold">رقم الحساب</TableHead>
                <TableHead className="text-right text-[#20335f] font-extrabold">التاريخ</TableHead>
                <TableHead className="text-right text-[#20335f] font-extrabold">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    وقت التحضير
                  </div>
                </TableHead>
                <TableHead className="text-right text-[#20335f] font-extrabold">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedDate > currentSaudiDate ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-[#7b8aa0]">
                    لا يمكن عرض بيانات الحضور لتاريخ مستقبلي
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-semibold text-[#1a2332]">{record.teacher_name}</TableCell>
                    <TableCell className="text-[#1a2332]">{record.account_number}</TableCell>
                    <TableCell className="text-[#1a2332]">{formatDate(record.attendance_date)}</TableCell>
                    <TableCell className="text-[#1a2332] font-mono font-semibold">
                      {record.checkInTimeLocal ? formatSaudiTimeWithPeriod(record.checkInTimeLocal) : formatTime(record.check_in_time)}
                    </TableCell>
                    <TableCell className="text-[#1a2332]">{renderAttendanceStatus(record)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-[#7b8aa0]">
                    لا توجد سجلات للعرض في التاريخ المحدد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )

  const delayDialog = (
    <Dialog open={isDelayDialogOpen} onOpenChange={setIsDelayDialogOpen}>
      <DialogContent className="sm:max-w-[420px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#1a2332] text-right">مدة التأخير</DialogTitle>
          <DialogDescription className="text-sm text-neutral-500 text-right">يتم احتساب التأخير بعد أذان العصر في القصيم بهذه المدة</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 text-right">
          <div className="space-y-2">
            <Label htmlFor="teacherDelayMinutes" className="text-sm font-semibold text-[#1a2332]">عدد الدقائق بعد أذان العصر</Label>
            <Input
              id="teacherDelayMinutes"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(e.target.value)}
              placeholder="50"
              dir="ltr"
              type="number"
              min="0"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3" dir="rtl">
          <Button variant="outline" onClick={() => setIsDelayDialogOpen(false)} className="border-[#3453a7]/50 text-neutral-600">إلغاء</Button>
          <Button onClick={handleSaveDelaySetting} disabled={isSavingDelay} className="bg-[#3453a7] hover:bg-[#24428f] text-white border-none disabled:bg-[#3453a7] disabled:text-white">
            {isSavingDelay ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  if (displayMode === "inline") {
    return (
      <>
        <div className="px-1 py-1">{content}</div>
        {delayDialog}
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="container mx-auto max-w-7xl">{content}</div>
      </main>
      {delayDialog}
      <Footer />
    </div>
  )
}
