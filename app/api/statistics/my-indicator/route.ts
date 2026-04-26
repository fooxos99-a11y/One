import { NextRequest, NextResponse } from "next/server"

import { requireRoles } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrCreateActiveSemester, isMissingSemestersTable, isNoActiveSemesterError } from "@/lib/semesters"
import { getStudyWeekEnd, getStudyWeekStart, isStudyDay } from "@/lib/study-calendar"
import { getPlanForDate } from "@/lib/plan-history"
import { calculatePreviousMemorizedPages, resolvePlanReviewPagesForDate, resolvePlanReviewPoolPages } from "@/lib/quran-data"
import { applyAttendancePointsAdjustment, calculateTotalEvaluationPoints, isPassingMemorizationLevel } from "@/lib/student-attendance"

export const dynamic = "force-dynamic"
export const revalidate = 0

type DateFilter = "today" | "currentWeek" | "currentMonth" | "currentSemester" | "all" | "custom"

type CustomDateRange = {
  start: string
  end: string
}

type StudentRow = {
  id: string
  name: string | null
  halaqah?: string | null
}

type PlanRow = {
  id: string
  student_id: string
  start_date: string | null
  created_at: string | null
  daily_pages: number | null
  muraajaa_pages: number | null
  rabt_pages: number | null
  review_distribution_mode?: "fixed" | "weekly" | null
  muraajaa_mode?: "daily_fixed" | "weekly_distributed" | null
  weekly_muraajaa_min_daily_pages?: number | null
  weekly_muraajaa_start_day?: number | null
  weekly_muraajaa_end_day?: number | null
  has_previous?: boolean | null
  prev_start_surah?: number | null
  prev_start_verse?: number | null
  prev_end_surah?: number | null
  prev_end_verse?: number | null
  previous_memorization_ranges?: unknown[] | null
  completed_juzs?: number[] | null
}

type DailyReportRow = {
  student_id: string
  report_date: string
  memorization_done: boolean
  review_done: boolean
  linking_done: boolean
}

type EvaluationRecord = {
  hafiz_level?: string | null
  tikrar_level?: string | null
  samaa_level?: string | null
  rabet_level?: string | null
}

type AttendanceRow = {
  id: string
  student_id: string
  halaqah: string | null
  date: string
  status: string | null
  evaluations: EvaluationRecord[] | EvaluationRecord | null
}

type StudentIndicatorSummary = {
  id: string
  name: string
  circleName: string
  memorized: number
  revised: number
  tied: number
  expectedRecords: number
  totalRecords: number
  totalAttend: number
  passedMemorizationSegments: number
  passedTikrarSegments: number
  passedReviewSegments: number
  passedTiedSegments: number
  maxPoints: number
  earnedPoints: number
  percent: number
  attendPercent: number
  memorizedPercent: number
  tikrarPercent: number
  revisedPercent: number
  tiedPercent: number
  score: number
}

const TEXT = {
  unknownStudent: "طالب غير معرف",
  unknownCircle: "حلقة غير معرفة",
  loadError: "تعذر تحميل مؤشر الطالب",
} as const

const MAX_EVALUATION_POINTS_PER_STUDY_DAY = 40

function getReadableErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === "string" && error.trim()) {
    return error
  }

  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; error?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [candidate.message, candidate.error, candidate.details, candidate.hint, candidate.code]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)

    if (parts.length > 0) {
      return parts.join(" - ")
    }
  }

  return "حدث خطأ غير معروف أثناء تحميل البيانات"
}

function formatDateForQuery(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(value)
}

function countStudyDaysInRange(start: Date, end: Date) {
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)

  const normalizedEnd = new Date(end)
  normalizedEnd.setHours(0, 0, 0, 0)

  let count = 0
  while (cursor <= normalizedEnd) {
    if (isStudyDay(cursor)) {
      count += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return count
}

function getStudyDatesInRange(start: Date, end: Date) {
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)

  const normalizedEnd = new Date(end)
  normalizedEnd.setHours(0, 0, 0, 0)

  const studyDates: string[] = []
  while (cursor <= normalizedEnd) {
    if (isStudyDay(cursor)) {
      studyDates.push(formatDateForQuery(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return studyDates
}

function getDateRange(filter: DateFilter, customRange: CustomDateRange) {
  const end = new Date()
  const start = new Date()

  if (filter === "today") {
    return { start: new Date(start.setHours(0, 0, 0, 0)), end }
  }

  if (filter === "currentWeek") {
    return { start: getStudyWeekStart(), end: getStudyWeekEnd() }
  }

  if (filter === "currentMonth") {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return { start, end }
  }

  if (filter === "custom") {
    return {
      start: new Date(`${customRange.start}T00:00:00`),
      end: new Date(`${customRange.end}T23:59:59`),
    }
  }

  start.setFullYear(2020, 0, 1)
  return { start, end }
}

function getEvaluationRecord(value: AttendanceRow["evaluations"]): EvaluationRecord {
  if (Array.isArray(value)) {
    return value[0] ?? {}
  }

  return value ?? {}
}

function getDailyCompletionFlags(record?: AttendanceRow, dailyReport?: DailyReportRow) {
  const evaluation = record ? getEvaluationRecord(record.evaluations) : {}

  return {
    reviewDone: Boolean(dailyReport?.review_done) || isPassingMemorizationLevel(evaluation.samaa_level ?? null),
    linkingDone: Boolean(dailyReport?.linking_done) || isPassingMemorizationLevel(evaluation.rabet_level ?? null),
  }
}

function createStudentIndicatorSummary(id: string, name: string, circleName: string): StudentIndicatorSummary {
  return {
    id,
    name,
    circleName,
    memorized: 0,
    revised: 0,
    tied: 0,
    expectedRecords: 0,
    totalRecords: 0,
    totalAttend: 0,
    passedMemorizationSegments: 0,
    passedTikrarSegments: 0,
    passedReviewSegments: 0,
    passedTiedSegments: 0,
    maxPoints: 0,
    earnedPoints: 0,
    percent: 0,
    attendPercent: 0,
    memorizedPercent: 0,
    tikrarPercent: 0,
    revisedPercent: 0,
    tiedPercent: 0,
    score: 0,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRoles(request, ["student"])
    if ("response" in auth) {
      return auth.response
    }

    const filter = (request.nextUrl.searchParams.get("filter") || "currentSemester") as DateFilter
    const customRange: CustomDateRange = {
      start: request.nextUrl.searchParams.get("start") || formatDateForQuery(new Date()),
      end: request.nextUrl.searchParams.get("end") || formatDateForQuery(new Date()),
    }

    const supabase = createAdminClient()
    const { start, end } = getDateRange(filter, customRange)
    let activeSemesterId: string | null = null
    let activeSemesterStartDate: Date | null = null

    try {
      const activeSemester = await getOrCreateActiveSemester(supabase)
      activeSemesterId = activeSemester.id
      activeSemesterStartDate = activeSemester.start_date ? new Date(`${activeSemester.start_date}T00:00:00`) : null
    } catch (semesterError) {
      if (isNoActiveSemesterError(semesterError)) {
        return NextResponse.json({
          indicator: null,
          error: "لا يوجد فصل نشط حاليًا. ابدأ فصلًا جديدًا لعرض الإحصائيات الحالية.",
        })
      }

      if (!isMissingSemestersTable(semesterError)) {
        throw semesterError
      }
    }

    const studentResult = await supabase
      .from("students")
      .select("id, name, halaqah")
      .eq("id", auth.session.id)
      .maybeSingle()

    if (studentResult.error) {
      throw studentResult.error
    }

    const student = studentResult.data as StudentRow | null
    if (!student) {
      return NextResponse.json({ indicator: null, error: "تعذر العثور على بيانات الطالب" }, { status: 404 })
    }

    const effectiveStart = filter === "currentSemester"
      ? activeSemesterStartDate ?? start
      : start
    const effectiveEnd = end

    let plansQuery = supabase
      .from("student_plans")
      .select("id, student_id, start_date, created_at, daily_pages, muraajaa_pages, rabt_pages, has_previous, prev_start_surah, prev_start_verse, prev_end_surah, prev_end_verse, previous_memorization_ranges")
      .eq("student_id", student.id)
    if (activeSemesterId) {
      plansQuery = plansQuery.eq("semester_id", activeSemesterId)
    }

    let attendanceQuery = supabase
      .from("attendance_records")
      .select(`
        id,
        student_id,
        halaqah,
        date,
        status,
        evaluations (hafiz_level, tikrar_level, samaa_level, rabet_level)
      `)
      .eq("student_id", student.id)

    let dailyReportsQuery = supabase
      .from("student_daily_reports")
      .select("student_id, report_date, memorization_done, review_done, linking_done")
      .eq("student_id", student.id)

    if (activeSemesterId) {
      attendanceQuery = attendanceQuery.eq("semester_id", activeSemesterId)
    }

    if (filter !== "all") {
      attendanceQuery = attendanceQuery.gte("date", formatDateForQuery(effectiveStart)).lte("date", formatDateForQuery(effectiveEnd))
      dailyReportsQuery = dailyReportsQuery.gte("report_date", formatDateForQuery(effectiveStart)).lte("report_date", formatDateForQuery(effectiveEnd))
    }

    const [plansResult, attendanceResult, dailyReportsResult] = await Promise.all([
      plansQuery,
      attendanceQuery,
      dailyReportsQuery,
    ])

    if (plansResult.error) throw plansResult.error
    if (attendanceResult.error) throw attendanceResult.error

    const dailyReportsTableMissing = dailyReportsResult.error?.code === "PGRST205" && String(dailyReportsResult.error.message || "").includes("student_daily_reports")
    if (dailyReportsResult.error && !dailyReportsTableMissing) {
      throw dailyReportsResult.error
    }

    const plans = (plansResult.data ?? []) as PlanRow[]
    const dailyReports = (dailyReportsResult.data ?? []) as DailyReportRow[]
    const attendance = ((attendanceResult.data ?? []) as AttendanceRow[]).filter((record) => isStudyDay(record.date))
    const studyDates = getStudyDatesInRange(
      filter === "all"
        ? activeSemesterStartDate ?? start
        : filter === "currentSemester"
          ? effectiveStart
          : start,
      effectiveEnd,
    )
    const indicator = createStudentIndicatorSummary(
      student.id,
      student.name?.trim() || TEXT.unknownStudent,
      student.halaqah?.trim() || TEXT.unknownCircle,
    )

    indicator.expectedRecords = studyDates.reduce((total, studyDate) => total + (getPlanForDate(plans, studyDate) ? 1 : 0), 0)
    indicator.maxPoints = indicator.expectedRecords * MAX_EVALUATION_POINTS_PER_STUDY_DAY

    const dailyReportsByStudentDate = new Map<string, DailyReportRow>()
    const memorizedPoolByStudent = new Map<string, number>()
    const activePlanIdByStudent = new Map<string, string>()
    const reviewCompletedByStudent = new Map<string, number>()

    for (const report of dailyReports) {
      dailyReportsByStudentDate.set(`${report.student_id}|${report.report_date}`, report)
    }

    const sortedAttendance = [...attendance].sort((left, right) => left.date.localeCompare(right.date))

    for (const record of sortedAttendance) {
      const plan = getPlanForDate(plans, record.date)
      if (!plan) continue

      const dailyPages = Number(plan?.daily_pages ?? 1)
      const status = record.status ?? ""
      const isPresent = status === "present" || status === "late"
      const dailyReport = dailyReportsByStudentDate.get(`${student.id}|${record.date}`)
      const { reviewDone, linkingDone } = getDailyCompletionFlags(record, dailyReport)
      const activePlanId = activePlanIdByStudent.get(student.id)
      const nextPlanBasePages = calculatePreviousMemorizedPages(plan)
      const memorizedPoolPages = !memorizedPoolByStudent.has(student.id) || activePlanId !== plan.id
        ? Math.max(memorizedPoolByStudent.get(student.id) ?? 0, nextPlanBasePages)
        : (memorizedPoolByStudent.get(student.id) ?? 0)
      activePlanIdByStudent.set(student.id, plan.id)
      const reviewPoolPages = resolvePlanReviewPoolPages(plan, memorizedPoolPages)
      const reviewPages = resolvePlanReviewPagesForDate(plan, reviewPoolPages, reviewCompletedByStudent.get(student.id) ?? 0, record.date)
      const tiePages = Math.min(Number(plan?.rabt_pages ?? 10), Math.max(0, memorizedPoolPages))

      indicator.totalRecords += 1

      if (!isPresent) {
        continue
      }

      indicator.totalAttend += 1
      const evaluation = getEvaluationRecord(record.evaluations)

      if (isPassingMemorizationLevel(evaluation.hafiz_level ?? null)) {
        indicator.passedMemorizationSegments += 1
        indicator.memorized += dailyPages
      }

      if (isPassingMemorizationLevel(evaluation.tikrar_level ?? null)) {
        indicator.passedTikrarSegments += 1
      }

      if (reviewDone) {
        indicator.passedReviewSegments += 1
        indicator.revised += reviewPages
        reviewCompletedByStudent.set(student.id, (reviewCompletedByStudent.get(student.id) ?? 0) + 1)
      }

      if (linkingDone) {
        indicator.passedTiedSegments += 1
        indicator.tied += tiePages
      }

      if (isPassingMemorizationLevel(evaluation.hafiz_level ?? null)) {
        memorizedPoolByStudent.set(student.id, memorizedPoolPages + dailyPages)
      }

      indicator.earnedPoints += applyAttendancePointsAdjustment(calculateTotalEvaluationPoints(evaluation), status)
    }

    const denominator = indicator.expectedRecords > 0
      ? indicator.expectedRecords
      : countStudyDaysInRange(
          filter === "all"
            ? activeSemesterStartDate ?? start
            : filter === "currentSemester"
              ? effectiveStart
              : start,
          effectiveEnd,
        )
    const evalPercent = indicator.maxPoints > 0 ? (indicator.earnedPoints / indicator.maxPoints) * 100 : 0

    indicator.percent = evalPercent
    indicator.attendPercent = denominator > 0 ? (indicator.totalAttend / denominator) * 100 : 0
    indicator.memorizedPercent = denominator > 0 ? (indicator.passedMemorizationSegments / denominator) * 100 : 0
    indicator.tikrarPercent = denominator > 0 ? (indicator.passedTikrarSegments / denominator) * 100 : 0
    indicator.revisedPercent = denominator > 0 ? (indicator.passedReviewSegments / denominator) * 100 : 0
    indicator.tiedPercent = denominator > 0 ? (indicator.passedTiedSegments / denominator) * 100 : 0
    indicator.score = evalPercent * 0.6 + indicator.attendPercent * 0.4

    return NextResponse.json({ indicator, error: "" })
  } catch (error) {
    const message = getReadableErrorMessage(error)
    return NextResponse.json({ indicator: null, error: `${TEXT.loadError}: ${message}` })
  }
}