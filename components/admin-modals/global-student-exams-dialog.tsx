"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SiteLoader } from "@/components/ui/site-loader"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { useAlertDialog } from "@/hooks/use-confirm-dialog"
import { calculateExamScore, normalizeExamSettings, type ExamSettings } from "@/lib/exam-settings"
import { normalizeExamPortionSettings, type ExamPortionType } from "@/lib/exam-portion-settings"
import { getPassedPortionNumbers } from "@/lib/exam-portions"
import type { PreviousMemorizationRange } from "@/lib/quran-data"
import { DEFAULT_EXAM_PORTION_SETTINGS, DEFAULT_EXAM_SETTINGS, EXAM_PORTION_SETTINGS_ID, EXAM_SETTINGS_ID } from "@/lib/site-settings-constants"
import { formatExamPortionLabel, getEligibleExamPortions, type StudentExamPlanProgressSource } from "@/lib/student-exams"
import { CircleAlert, ClipboardCheck } from "lucide-react"

type Circle = {
  id: string
  name: string
  studentCount: number
}

type Student = {
  id: string
  name: string
  halaqah: string
  account_number?: number | null
  completed_juzs?: number[] | null
  current_juzs?: number[] | null
  memorized_ranges?: PreviousMemorizationRange[] | null
  memorized_start_surah?: number | null
  memorized_start_verse?: number | null
  memorized_end_surah?: number | null
  memorized_end_verse?: number | null
}

type ExamRow = {
  id: string
  student_id: string
  halaqah: string
  exam_portion_label: string
  portion_type?: ExamPortionType | null
  portion_number?: number | null
  juz_number: number | null
  exam_date: string
  alerts_count: number
  mistakes_count: number
  final_score: number
  passed: boolean
}

type ExamScheduleRow = {
  id: string
  student_id: string
  exam_portion_label: string
  portion_type?: ExamPortionType | null
  portion_number?: number | null
  juz_number: number | null
  exam_date: string
  status: "scheduled" | "completed" | "cancelled"
}

type ExamFormState = {
  studentId: string
  selectedJuz: string
  testedByName: string
  alertsCount: string
  mistakesCount: string
}

type StudentPlanProgressState = {
  plan: StudentExamPlanProgressSource | null
  completedDays: number
}

type FailedExamAction = "retest" | "rememorize"

type FailedExamActionForm = {
  action: FailedExamAction
  retestDate: string
}

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date())
}

const DEFAULT_FORM: ExamFormState = {
  studentId: "",
  selectedJuz: "",
  testedByName: "",
  alertsCount: "0",
  mistakesCount: "0",
}

const DEFAULT_FAILED_EXAM_ACTION_FORM: FailedExamActionForm = {
  action: "retest",
  retestDate: getTodayDate(),
}

function parseCount(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return Math.floor(parsed)
}

function fromSettingsForm(settings: ExamSettings) {
  return normalizeExamSettings({
    maxScore: settings.maxScore,
    alertDeduction: settings.alertDeduction,
    mistakeDeduction: settings.mistakeDeduction,
    minPassingScore: settings.minPassingScore,
  })
}

function formatTodayScheduledExamText(schedules: ExamScheduleRow[]) {
  const scheduledByType = schedules.reduce<Record<"juz" | "hizb", number[]>>((accumulator, schedule) => {
    const portionType = schedule.portion_type === "hizb" ? "hizb" : "juz"
    const portionNumber = Number(schedule.portion_number ?? schedule.juz_number)
    if (!Number.isFinite(portionNumber) || portionNumber <= 0) {
      return accumulator
    }

    if (!accumulator[portionType].includes(portionNumber)) {
      accumulator[portionType].push(portionNumber)
    }

    return accumulator
  }, { juz: [], hizb: [] })

  const parts: string[] = []
  if (scheduledByType.juz.length > 0) {
    parts.push(`${scheduledByType.juz.sort((left, right) => left - right).join(",") } جزء`)
  }
  if (scheduledByType.hizb.length > 0) {
    parts.push(`${scheduledByType.hizb.sort((left, right) => left - right).join(",") } حزب`)
  }

  return parts.join(" ، ")
}

export function GlobalStudentExamsDialog() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const showAlert = useAlertDialog()
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("اختبار الطلاب")

  const [isOpen, setIsOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isExamDialogLoading, setIsExamDialogLoading] = useState(false)
  const [isFailedExamActionDialogOpen, setIsFailedExamActionDialogOpen] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [circles, setCircles] = useState<Circle[]>([])
  const [examDialogCircle, setExamDialogCircle] = useState("")
  const [form, setForm] = useState<ExamFormState>(DEFAULT_FORM)
  const [examDialogStudents, setExamDialogStudents] = useState<Student[]>([])
  const [examDialogExams, setExamDialogExams] = useState<ExamRow[]>([])
  const [examDialogSchedules, setExamDialogSchedules] = useState<ExamScheduleRow[]>([])
  const [examDialogPlanProgressMap, setExamDialogPlanProgressMap] = useState<Record<string, StudentPlanProgressState>>({})
  const [settingsPreview, setSettingsPreview] = useState<ExamSettings>(DEFAULT_EXAM_SETTINGS)
  const [portionMode, setPortionMode] = useState<ExamPortionType>(DEFAULT_EXAM_PORTION_SETTINGS.mode)
  const [failedExamActionForm, setFailedExamActionForm] = useState<FailedExamActionForm>(DEFAULT_FAILED_EXAM_ACTION_FORM)

  useEffect(() => {
    if (searchParams?.get("action") === "student-exams") {
      setIsOpen(true)
      return
    }

    setIsOpen(false)
  }, [searchParams])

  useEffect(() => {
    async function bootstrap() {
      if (authLoading || !authVerified || !isOpen) {
        return
      }

      try {
        const [authResponse, circlesResponse, settingsResponse, portionSettingsResponse] = await Promise.all([
          fetch("/api/auth", { cache: "no-store" }),
          fetch("/api/circles", { cache: "no-store" }),
          fetch(`/api/site-settings?id=${EXAM_SETTINGS_ID}`, { cache: "no-store" }),
          fetch(`/api/site-settings?id=${EXAM_PORTION_SETTINGS_ID}`, { cache: "no-store" }),
        ])

        if (!authResponse.ok || !circlesResponse.ok || !settingsResponse.ok || !portionSettingsResponse.ok) {
          throw new Error("تعذر تحميل بيانات صفحة اختبار الطلاب")
        }

        const authData = await authResponse.json()
        const circlesData = await circlesResponse.json()
        const settingsData = await settingsResponse.json()
        const portionSettingsData = await portionSettingsResponse.json()
        const loadedCircles = (circlesData.circles || []) as Circle[]
        const normalizedPortionSettings = normalizeExamPortionSettings(portionSettingsData.value)
        const accountName = String(authData?.user?.name || "").trim() || (localStorage.getItem("userName") || "")

        setCircles(loadedCircles)
        setSettingsPreview(fromSettingsForm(normalizeExamSettings(settingsData.value)))
        setPortionMode(normalizedPortionSettings.mode)
        setExamDialogCircle((current) => current || loadedCircles[0]?.name || "")
        if (accountName) {
          setForm((current) => ({ ...current, testedByName: accountName }))
        }
      } catch (error) {
        console.error("[admin-student-exams] bootstrap:", error)
      } finally {
        setIsLoading(false)
      }
    }

    void bootstrap()
  }, [authLoading, authVerified, isOpen])

  useEffect(() => {
    async function loadExamDialogData() {
      if (authLoading || !authVerified || !isOpen) {
        return
      }

      if (!examDialogCircle) {
        setExamDialogStudents([])
        setExamDialogExams([])
        setExamDialogSchedules([])
        setExamDialogPlanProgressMap({})
        setForm((current) => ({ ...current, studentId: "", selectedJuz: "", alertsCount: "0", mistakesCount: "0" }))
        setIsExamDialogLoading(false)
        return
      }

      try {
        setIsExamDialogLoading(true)
        const [studentsResponse, examsResponse, schedulesResponse] = await Promise.all([
          fetch(`/api/students?circle=${encodeURIComponent(examDialogCircle)}`, { cache: "no-store" }),
          fetch(`/api/exams?circle=${encodeURIComponent(examDialogCircle)}`, { cache: "no-store" }),
          fetch(`/api/exam-schedules?circle=${encodeURIComponent(examDialogCircle)}`, { cache: "no-store" }),
        ])

        if (!studentsResponse.ok || !examsResponse.ok || !schedulesResponse.ok) {
          throw new Error("تعذر تحميل بيانات نافذة الاختبار")
        }

        const studentsData = await studentsResponse.json()
        const examsData = await examsResponse.json()
        const schedulesData = await schedulesResponse.json()
        const loadedStudents = (studentsData.students || []) as Student[]
        const ids = loadedStudents.map((student) => student.id).join(",")
        const batchPlanResponse = loadedStudents.length > 0
          ? await fetch(`/api/student-plans?student_ids=${encodeURIComponent(ids)}`, { cache: "no-store" })
          : null
        const batchPlanData = batchPlanResponse && batchPlanResponse.ok
          ? await batchPlanResponse.json()
          : { plansByStudent: {} }
        const planEntries = loadedStudents.map((student) => ([
          student.id,
          {
            plan: (batchPlanData.plansByStudent?.[student.id]?.plan || null) as StudentExamPlanProgressSource | null,
            completedDays: Number(batchPlanData.plansByStudent?.[student.id]?.completedDays) || 0,
          },
        ] as const))

        setExamDialogStudents(loadedStudents)
        setExamDialogExams((examsData.exams || []) as ExamRow[])
  setExamDialogSchedules((schedulesData.schedules || []) as ExamScheduleRow[])
        setExamDialogPlanProgressMap(Object.fromEntries(planEntries))
        setTableMissing(Boolean(examsData.tableMissing))
        setForm((current) => ({
          ...current,
          studentId: loadedStudents.some((student) => student.id === current.studentId)
            ? current.studentId
            : (loadedStudents[0]?.id || ""),
        }))
      } catch (error) {
        console.error("[admin-student-exams] load exam dialog:", error)
        setExamDialogStudents([])
        setExamDialogExams([])
        setExamDialogSchedules([])
        setExamDialogPlanProgressMap({})
      } finally {
        setIsExamDialogLoading(false)
      }
    }

    void loadExamDialogData()
  }, [authLoading, authVerified, examDialogCircle, isOpen])

  const portionUnitLabel = portionMode === "hizb" ? "الحزب" : "الجزء"
  const selectedStudent = useMemo(() => examDialogStudents.find((student) => student.id === form.studentId) || null, [examDialogStudents, form.studentId])
  const selectedStudentPlanProgress = useMemo(() => {
    if (!form.studentId) {
      return null
    }

    return examDialogPlanProgressMap[form.studentId] || null
  }, [examDialogPlanProgressMap, form.studentId])
  const studentExams = useMemo(() => examDialogExams.filter((exam) => exam.student_id === form.studentId), [examDialogExams, form.studentId])
  const todayScheduledExams = useMemo(
    () => examDialogSchedules.filter((schedule) => schedule.student_id === form.studentId && schedule.status === "scheduled" && schedule.exam_date === getTodayDate()),
    [examDialogSchedules, form.studentId],
  )
  const todayScheduledExamText = useMemo(() => formatTodayScheduledExamText(todayScheduledExams), [todayScheduledExams])
  const eligiblePortions = useMemo(() => getEligibleExamPortions(selectedStudent, selectedStudentPlanProgress, portionMode), [selectedStudent, selectedStudentPlanProgress, portionMode])
  const eligiblePortionNumbers = useMemo(() => eligiblePortions.map((portion) => portion.portionNumber), [eligiblePortions])
  const passedPortionNumbers = useMemo(() => getPassedPortionNumbers(studentExams, portionMode), [studentExams, portionMode])
  const availablePortions = useMemo(() => eligiblePortions.filter((portion) => !passedPortionNumbers.has(portion.portionNumber)), [eligiblePortions, passedPortionNumbers])
  const availableJuzs = useMemo(() => availablePortions.map((portion) => portion.portionNumber), [availablePortions])
  const scorePreview = useMemo(
    () => calculateExamScore({ alerts: parseCount(form.alertsCount), mistakes: parseCount(form.mistakesCount) }, settingsPreview),
    [form.alertsCount, form.mistakesCount, settingsPreview],
  )

  useEffect(() => {
    if (!selectedStudent) {
      setForm((current) => ({ ...current, selectedJuz: "" }))
      return
    }

    setForm((current) => {
      const canKeepSelectedJuz = current.selectedJuz && availableJuzs.includes(Number(current.selectedJuz))
      if (canKeepSelectedJuz) {
        return current
      }

      const nextJuz = availableJuzs[0]
      return {
        ...current,
        selectedJuz: nextJuz ? String(nextJuz) : "",
      }
    })
  }, [availableJuzs, selectedStudent])

  const refreshExamDialogData = async () => {
    if (!examDialogCircle) {
      return
    }

    const [studentsResponse, examsResponse] = await Promise.all([
      fetch(`/api/students?circle=${encodeURIComponent(examDialogCircle)}`, { cache: "no-store" }),
      fetch(`/api/exams?circle=${encodeURIComponent(examDialogCircle)}`, { cache: "no-store" }),
    ])

    const schedulesResponse = await fetch(`/api/exam-schedules?circle=${encodeURIComponent(examDialogCircle)}`, { cache: "no-store" })

    const studentsData = await studentsResponse.json()
    const examsData = await examsResponse.json()
    const schedulesData = schedulesResponse.ok ? await schedulesResponse.json() : { schedules: [] }
    const loadedStudents = (studentsData.students || []) as Student[]
    const ids = loadedStudents.map((student) => student.id).join(",")
    const batchPlanResponse = loadedStudents.length > 0
      ? await fetch(`/api/student-plans?student_ids=${encodeURIComponent(ids)}`, { cache: "no-store" })
      : null
    const batchPlanData = batchPlanResponse && batchPlanResponse.ok
      ? await batchPlanResponse.json()
      : { plansByStudent: {} }
    const planEntries = loadedStudents.map((student) => ([
      student.id,
      {
        plan: (batchPlanData.plansByStudent?.[student.id]?.plan || null) as StudentExamPlanProgressSource | null,
        completedDays: Number(batchPlanData.plansByStudent?.[student.id]?.completedDays) || 0,
      },
    ] as const))

    setExamDialogStudents(loadedStudents)
    setExamDialogExams((examsData.exams || []) as ExamRow[])
    setExamDialogSchedules((schedulesData.schedules || []) as ExamScheduleRow[])
    setTableMissing(Boolean(examsData.tableMissing))
    setExamDialogPlanProgressMap(Object.fromEntries(planEntries))
  }

  const submitExam = async (failureAction?: FailedExamAction, retestDate?: string) => {
    const selectedJuz = Number(form.selectedJuz)
    const selectedPortion = eligiblePortions.find((portion) => portion.portionNumber === selectedJuz)

    const response = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: form.studentId,
        exam_date: getTodayDate(),
        portion_type: portionMode,
        portion_number: selectedJuz,
        exam_portion_label: selectedPortion?.label || formatExamPortionLabel(selectedJuz, "", portionMode),
        tested_by_name: form.testedByName.trim(),
        alerts_count: parseCount(form.alertsCount),
        mistakes_count: parseCount(form.mistakesCount),
        failure_action: failureAction,
        retest_date: retestDate,
      }),
    })

    const data = await response.json()
    if (!response.ok || !data.success) {
      throw new Error(data.error || "تعذر حفظ الاختبار")
    }

    const finalScore = data.score?.finalScore ?? scorePreview.finalScore
    const passed = Boolean(data.score?.passed)
    const resetWarning = typeof data.resetWarning === "string" ? data.resetWarning : ""
    const notificationWarning = typeof data.notificationWarning === "string" ? data.notificationWarning : ""
    const scheduledRetest = Boolean(data.scheduledRetest)
    const retestDateLabel = typeof data.retestDate === "string" ? data.retestDate : ""

    if (passed) {
      await showAlert(notificationWarning || `تم حفظ الاختبار بنتيجة ${finalScore} من ${settingsPreview.maxScore}`, notificationWarning ? "تنبيه" : "نجاح")
    } else if (scheduledRetest) {
      await showAlert(notificationWarning || resetWarning || `تم تسجيل الرسوب بنتيجة ${finalScore} من ${settingsPreview.maxScore}، وتم تحديد إعادة اختبار ${portionUnitLabel}${retestDateLabel ? ` بتاريخ ${retestDateLabel}` : ""}.`, "تنبيه")
    } else if (data.requiresRememorization) {
      await showAlert(notificationWarning || `تم تسجيل الرسوب بنتيجة ${finalScore} من ${settingsPreview.maxScore}، وتم تحويل هذا ${portionUnitLabel} إلى ${portionUnitLabel} يحتاج إعادة حفظ مع استمرار الخطة الحالية.`, "تنبيه")
    } else {
      await showAlert(notificationWarning || resetWarning || `تم تسجيل الرسوب بنتيجة ${finalScore} من ${settingsPreview.maxScore}.`, "تنبيه")
    }

    setForm((current) => ({
      ...current,
      alertsCount: "0",
      mistakesCount: "0",
    }))

    await refreshExamDialogData()
  }

  const handleSaveExam = async () => {
    if (!form.studentId) {
      await showAlert("اختر الطالب أولاً", "تنبيه")
      return
    }

    if (!form.selectedJuz) {
      await showAlert(`اختر ${portionUnitLabel} المختبر من القائمة`, "تنبيه")
      return
    }

    if (!form.testedByName.trim()) {
      await showAlert("أدخل اسم المختبر أولاً", "تنبيه")
      return
    }

    if (!scorePreview.passed) {
      setFailedExamActionForm({
        action: "retest",
        retestDate: getTodayDate(),
      })
      setIsFailedExamActionDialogOpen(true)
      return
    }

    try {
      setIsSaving(true)
      await submitExam()
    } catch (error) {
      console.error("[admin-student-exams] save:", error)
      await showAlert(error instanceof Error ? error.message : "حدث خطأ أثناء حفظ الاختبار", "خطأ")
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmFailedExamAction = async () => {
    if (failedExamActionForm.action === "retest" && !failedExamActionForm.retestDate) {
      await showAlert("اختر تاريخ إعادة الاختبار", "تنبيه")
      return
    }

    try {
      setIsSaving(true)
      setIsFailedExamActionDialogOpen(false)
      await submitExam(failedExamActionForm.action, failedExamActionForm.action === "retest" ? failedExamActionForm.retestDate : undefined)
      setFailedExamActionForm(DEFAULT_FAILED_EXAM_ACTION_FORM)
    } catch (error) {
      console.error("[admin-student-exams] save failed action:", error)
      await showAlert(error instanceof Error ? error.message : "حدث خطأ أثناء حفظ قرار الرسوب", "خطأ")
      setIsFailedExamActionDialogOpen(true)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDialogChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      const currentSearchParams = new URLSearchParams(searchParams?.toString() || "")
      currentSearchParams.delete("action")
      const query = currentSearchParams.toString()
      const targetUrl = query ? `${pathname}?${query}` : pathname
      router.replace(targetUrl || "/", { scroll: false })
    }
  }

  if (!isOpen) {
    return null
  }

  if (isLoading || authLoading || !authVerified) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="rounded-3xl bg-white px-8 py-7 shadow-2xl">
          <SiteLoader size="lg" />
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="top-3 max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-24px)] max-w-3xl translate-y-0 overflow-hidden rounded-[28px] border border-[#dbe5f1] bg-white p-0 shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:top-[50%] sm:max-h-[90vh] sm:w-full sm:translate-y-[-50%]" showCloseButton={false}>
          <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[28px] bg-white sm:max-h-[90vh]" dir="rtl">
            <DialogHeader className="border-b border-[#e5edf6] px-4 py-4 sm:px-6 sm:py-5">
              <DialogTitle className="flex items-center justify-start gap-2 text-left text-2xl font-black text-[#1a2332]">
                <ClipboardCheck className="h-5 w-5 text-[#3453a7]" />
                اختبار الطلاب
              </DialogTitle>
              {selectedStudent && todayScheduledExamText ? (
                <div className="pt-2 text-right text-sm font-bold text-[#3453a7]">
                  اختبار الطالب اليوم في: {todayScheduledExamText}
                </div>
              ) : null}
              <DialogDescription className="sr-only">نافذة اختيار الحلقة والطالب ثم تسجيل نتيجة الاختبار.</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 overscroll-contain sm:px-6 sm:py-6">
              <div className="space-y-5">
                {tableMissing ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-right text-sm font-bold leading-7 text-amber-800">
                    جدول الاختبارات غير موجود بعد. شغّل ملف 042_create_student_exams.sql في قاعدة البيانات أولاً، ثم ستعمل الصفحة بشكل كامل.
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 text-right">
                    <Label className="text-sm font-black text-[#334155]">الحلقة</Label>
                    <Select
                      value={examDialogCircle}
                      onValueChange={(value) => {
                        setExamDialogCircle(value)
                        setForm((current) => ({ ...current, studentId: "", selectedJuz: "", alertsCount: "0", mistakesCount: "0" }))
                      }}
                      dir="rtl"
                    >
                      <SelectTrigger className="h-11 rounded-2xl border-[#d7e3f2] bg-white">
                        <SelectValue placeholder="اختر الحلقة" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {circles.map((circle) => (
                          <SelectItem key={`exam-dialog-circle-${circle.id}`} value={circle.name}>{circle.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 text-right">
                    <Label className="text-sm font-black text-[#334155]">الطالب</Label>
                    <Select
                      key={examDialogCircle || "no-circle"}
                      value={form.studentId || undefined}
                      onValueChange={(value) => setForm((current) => ({ ...current, studentId: value, selectedJuz: "", alertsCount: "0", mistakesCount: "0" }))}
                      dir="rtl"
                      disabled={!examDialogCircle || isExamDialogLoading || examDialogStudents.length === 0}
                    >
                      <SelectTrigger className="h-11 rounded-2xl border-[#d7e3f2] bg-white disabled:cursor-not-allowed disabled:opacity-60">
                        <SelectValue placeholder={examDialogCircle ? (isExamDialogLoading ? "جاري تحميل الطلاب" : examDialogStudents.length > 0 ? "اختر الطالب" : "لا يوجد طلاب") : "اختر الحلقة أولاً"} />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {examDialogStudents.map((student) => (
                          <SelectItem key={`exam-dialog-student-${student.id}`} value={student.id}>{student.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-[30px] border border-[#dbe5f1] bg-[#fcfdff] p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)] sm:p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 text-right">
                      <Label className="text-sm font-black text-[#334155]">اسم المختبر</Label>
                      <Input value={form.testedByName} onChange={(event) => setForm((current) => ({ ...current, testedByName: event.target.value }))} placeholder="اكتب اسم المختبر" className="h-12 rounded-2xl border-[#d7e3f2] bg-white text-base font-bold" />
                    </div>

                    <div className="space-y-2 text-right">
                      <Label className="text-sm font-black text-[#334155]">{portionUnitLabel} المراد اختباره</Label>
                      <Select key={form.studentId || "no-student"} value={form.selectedJuz || undefined} onValueChange={(value) => setForm((current) => ({ ...current, selectedJuz: value }))} dir="rtl" disabled={!selectedStudent || isExamDialogLoading}>
                        <SelectTrigger className="h-12 rounded-2xl border-[#d7e3f2] bg-white">
                          <SelectValue placeholder={selectedStudent ? `اختر ${portionUnitLabel}` : "اختر الطالب أولاً"} />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {availablePortions.map((portion) => (
                            <SelectItem key={`${portion.portionType}-${portion.portionNumber}`} value={String(portion.portionNumber)}>{portion.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 text-right">
                      <Label className="text-sm font-black text-[#334155]">عدد الأخطاء</Label>
                      <Input type="number" min="0" value={form.mistakesCount} onChange={(event) => setForm((current) => ({ ...current, mistakesCount: event.target.value }))} className="h-12 rounded-2xl border-[#d7e3f2] bg-white text-base font-bold" />
                    </div>

                    <div className="space-y-2 text-right">
                      <Label className="text-sm font-black text-[#334155]">عدد التنبيهات</Label>
                      <Input type="number" min="0" value={form.alertsCount} onChange={(event) => setForm((current) => ({ ...current, alertsCount: event.target.value }))} className="h-12 rounded-2xl border-[#d7e3f2] bg-white text-base font-bold" />
                    </div>
                  </div>

                  {selectedStudent && eligiblePortionNumbers.length > 0 && availableJuzs.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-[#f8fbff] px-4 py-3 text-right text-sm font-bold text-[#20335f]">
                      كل المحفوظ المتاح لهذا الطالب تم اختباره فيه بالفعل.
                    </div>
                  ) : null}

                  {!selectedStudent && !isExamDialogLoading ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#d7e3f2] px-4 py-4 text-right text-sm font-bold text-[#64748b]">
                      اختر الحلقة والطالب أولاً ليظهر {portionUnitLabel} المتاح للاختبار.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#e5edf6] bg-white px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
              <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => handleDialogChange(false)} className="h-11 w-full rounded-2xl border-[#d7e3f2] bg-white px-5 text-sm font-black text-[#1a2332] hover:bg-[#f8fbff] sm:w-auto">
                  إغلاق
                </Button>
                <Button type="button" onClick={handleSaveExam} disabled={isSaving || isExamDialogLoading || tableMissing || !form.selectedJuz} className="h-11 w-full rounded-2xl bg-[#3453a7] px-6 text-sm font-black text-white hover:bg-[#274187] disabled:bg-[#3453a7] sm:w-auto">
                  {isSaving ? "جاري الحفظ..." : "حفظ الاختبار"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFailedExamActionDialogOpen} onOpenChange={setIsFailedExamActionDialogOpen}>
        <DialogContent className="top-3 max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-24px)] max-w-xl translate-y-0 overflow-hidden rounded-[28px] border border-[#dbe5f1] bg-white p-0 shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:top-[50%] sm:w-full sm:translate-y-[-50%]" showCloseButton={false}>
          <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[28px] bg-white" dir="rtl">
            <DialogHeader className="border-b border-[#e5edf6] px-6 py-5">
              <DialogTitle className="flex w-full items-center justify-start gap-2 text-left text-2xl font-black text-[#1a2332]">
                <CircleAlert className="h-5 w-5 text-[#3453a7]" />
                معالجة الرسوب
              </DialogTitle>
              <DialogDescription className="pt-2 text-right text-sm font-semibold leading-7 text-[#64748b]">
                الطالب راسب في هذا {portionUnitLabel}. هل تريد إعادة حفظه أم تجدوله على موعد آخر لإعادة اختباره؟
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 overflow-y-auto px-6 py-6">
              <div className="space-y-2 text-right">
                <Label className="text-sm font-black text-[#334155]">ماذا تريد بعد الرسوب؟</Label>
                <Select value={failedExamActionForm.action} onValueChange={(value) => setFailedExamActionForm((current) => ({ ...current, action: value === "rememorize" ? "rememorize" : "retest" }))} dir="rtl">
                  <SelectTrigger className="h-11 rounded-2xl border-[#d7e3f2] bg-white text-base font-bold">
                    <SelectValue placeholder="اختر الإجراء" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="retest">تحديد موعد آخر لإعادة الاختبار</SelectItem>
                    <SelectItem value="rememorize">إعادة الحفظ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {failedExamActionForm.action === "retest" ? (
                <div className="space-y-2 text-right">
                  <Label className="text-sm font-black text-[#334155]">موعد إعادة الاختبار</Label>
                  <Input type="date" value={failedExamActionForm.retestDate} onChange={(event) => setFailedExamActionForm((current) => ({ ...current, retestDate: event.target.value }))} className="h-11 rounded-2xl border-[#d7e3f2] bg-white text-base font-bold" />
                </div>
              ) : (
                <p className="text-right text-sm font-bold leading-7 text-[#dc2626]">
                  عند اختيار إعادة الحفظ سيتم حذف هذا {portionUnitLabel} من المحفوظ الحالي، ولن يبقى محسوبًا ضمن الخطة الجارية، وسيظهر لاحقًا كجزء يحتاج إلى إتقان عند إضافة خطة جديدة للطالب.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#e5edf6] px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setIsFailedExamActionDialogOpen(false)} className="h-11 rounded-2xl border-[#d7e3f2] bg-white px-5 text-sm font-black text-[#1a2332] hover:bg-[#f8fbff]">
                إغلاق
              </Button>
              <Button type="button" onClick={handleConfirmFailedExamAction} disabled={isSaving} className="h-11 rounded-2xl bg-[#3453a7] px-6 text-sm font-black text-white hover:bg-[#274187] disabled:bg-[#3453a7]">
                {isSaving ? "جاري الحفظ..." : "حفظ فقط"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}