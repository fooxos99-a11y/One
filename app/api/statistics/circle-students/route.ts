import { NextRequest, NextResponse } from "next/server"

import { requireRoles } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOrCreateActiveSemester, isMissingSemestersTable, isNoActiveSemesterError } from "@/lib/semesters"
import { getStudyWeekEnd, getStudyWeekStart, isStudyDay } from "@/lib/study-calendar"
import { getPlanForDate, groupPlansByStudent } from "@/lib/plan-history"
import { calculatePreviousMemorizedPages, resolvePlanReviewPagesForDate, resolvePlanReviewPoolPages } from "@/lib/quran-data"
import { applyAttendancePointsAdjustment, calculateTotalEvaluationPoints, isPassingMemorizationLevel } from "@/lib/student-attendance"

export const dynamic = "force-dynamic"
export const revalidate = 0

type DateFilter = "today" | "currentWeek" | "currentMonth" | "all" | "custom"

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
  loadError: "تعذر تحميل مؤشرات الطلاب",
} as const

const MAX_EVALUATION_POINTS_PER_STUDY_DAY = 40

function normalizeCircleName(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

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
    const auth = await requireRoles(request, ["admin", "supervisor"])
    if ("response" in auth) {
      return auth.response
    }

    const circleName = String(request.nextUrl.searchParams.get("circle") || "").trim()
    const normalizedCircleName = normalizeCircleName(circleName)
    if (!normalizedCircleName) {
      return NextResponse.json({ circleName: "", students: [], error: "اسم الحلقة مطلوب" }, { status: 400 })
    }

    const filter = (request.nextUrl.searchParams.get("filter") || "currentMonth") as DateFilter
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
          circleName,
          students: [],
          error: "لا يوجد فصل نشط حاليًا. ابدأ فصلًا جديدًا لعرض الإحصائيات الحالية.",
        })
      }

      if (!isMissingSemestersTable(semesterError)) {
        throw semesterError
      }
    }

    let plansQuery = supabase
      .from("student_plans")
      .select("id, student_id, start_date, created_at, daily_pages, muraajaa_pages, rabt_pages, has_previous, prev_start_surah, prev_start_verse, prev_end_surah, prev_end_verse, previous_memorization_ranges")
    if (activeSemesterId) {
      plansQuery = plansQuery.eq("semester_id", activeSemesterId)
    }

    let dailyReportsQuery = supabase
      .from("student_daily_reports")
      .select("student_id, report_date, memorization_done, review_done, linking_done")

    const studentsResult = await supabase.from("students").select("id, name, halaqah")
    if (studentsResult.error) throw studentsResult.error

    const students = (studentsResult.data ?? []) as StudentRow[]
    const circleStudents = students.filter((student) => normalizeCircleName(student.halaqah) === normalizedCircleName)
    const circleStudentIds = new Set(circleStudents.map((student) => student.id))
    const resolvedCircleName = circleStudents[0]?.halaqah?.trim() || circleName || TEXT.unknownCircle

    const [plansResult, attendanceResult, dailyReportsResult] = await Promise.all([
      plansQuery,
      (async () => {
        let attendanceQuery = supabase.from("attendance_records").select(`
          id,
          student_id,
          halaqah,
          date,
          status,
          evaluations (hafiz_level, tikrar_level, samaa_level, rabet_level)
        `)

        if (activeSemesterId) {
          attendanceQuery = attendanceQuery.eq("semester_id", activeSemesterId)
        }

        if (filter !== "all") {
          attendanceQuery = attendanceQuery.gte("date", formatDateForQuery(start)).lte("date", formatDateForQuery(end))
        }

        return attendanceQuery
      })(),
      (async () => {
        if (filter !== "all") {
          dailyReportsQuery = dailyReportsQuery.gte("report_date", formatDateForQuery(start)).lte("report_date", formatDateForQuery(end))
        }

        return dailyReportsQuery
      })(),
    ])

    if (plansResult.error) throw plansResult.error
    if (attendanceResult.error) throw attendanceResult.error

    const dailyReportsTableMissing = dailyReportsResult.error?.code === "PGRST205" && String(dailyReportsResult.error.message || "").includes("student_daily_reports")
    if (dailyReportsResult.error && !dailyReportsTableMissing) {
      throw dailyReportsResult.error
    }

    const plans = (plansResult.data ?? []) as PlanRow[]
    const dailyReports = (dailyReportsResult.data ?? []) as DailyReportRow[]
    const plansByStudent = groupPlansByStudent(plans)
    const filteredPlansByStudent = new Map(
      Array.from(plansByStudent.entries()).filter(([studentId]) => circleStudentIds.has(studentId)),
    )
    const plannedStudentIds = new Set(Array.from(filteredPlansByStudent.keys()))
    const attendance = ((attendanceResult.data ?? []) as AttendanceRow[]).filter(
      (record) =>
        isStudyDay(record.date) &&
        circleStudentIds.has(record.student_id) &&
        normalizeCircleName(record.halaqah) === normalizedCircleName,
    )

    const studyDates = getStudyDatesInRange(filter === "all" ? activeSemesterStartDate ?? start : start, end)
    const studentStats = new Map<string, StudentIndicatorSummary>()
    const dailyReportsByStudentDate = new Map<string, DailyReportRow>()
    const memorizedPoolByStudent = new Map<string, number>()
    const activePlanIdByStudent = new Map<string, string>()
    const reviewCompletedByStudent = new Map<string, number>()

    for (const report of dailyReports) {
      if (circleStudentIds.has(report.student_id)) {
        dailyReportsByStudentDate.set(`${report.student_id}|${report.report_date}`, report)
      }
    }

    for (const student of circleStudents) {
      const summary = createStudentIndicatorSummary(student.id, student.name?.trim() || TEXT.unknownStudent, resolvedCircleName)
      const studentPlans = filteredPlansByStudent.get(student.id) || []
      summary.expectedRecords = studyDates.reduce((total, studyDate) => total + (getPlanForDate(studentPlans, studyDate) ? 1 : 0), 0)
      summary.maxPoints = summary.expectedRecords * MAX_EVALUATION_POINTS_PER_STUDY_DAY
      studentStats.set(student.id, summary)
    }

    const sortedAttendance = [...attendance].sort((left, right) => {
      if (left.student_id !== right.student_id) {
        return left.student_id.localeCompare(right.student_id)
      }
      return left.date.localeCompare(right.date)
    })

    for (const record of sortedAttendance) {
      const studentId = record.student_id
      if (!plannedStudentIds.has(studentId)) {
        continue
      }

      const studentPlans = filteredPlansByStudent.get(studentId) || []
      const plan = getPlanForDate(studentPlans, record.date)
      if (!plan) continue

      const summary = studentStats.get(studentId) ?? createStudentIndicatorSummary(studentId, TEXT.unknownStudent, resolvedCircleName)
      studentStats.set(studentId, summary)

      const dailyPages = Number(plan?.daily_pages ?? 1)
      const status = record.status ?? ""
      const isPresent = status === "present" || status === "late"
      const dailyReport = dailyReportsByStudentDate.get(`${studentId}|${record.date}`)
      const { reviewDone, linkingDone } = getDailyCompletionFlags(record, dailyReport)
      const activePlanId = activePlanIdByStudent.get(studentId)
      const nextPlanBasePages = calculatePreviousMemorizedPages(plan)
      const memorizedPoolPages = !memorizedPoolByStudent.has(studentId) || activePlanId !== plan.id
        ? Math.max(memorizedPoolByStudent.get(studentId) ?? 0, nextPlanBasePages)
        : (memorizedPoolByStudent.get(studentId) ?? 0)
      activePlanIdByStudent.set(studentId, plan.id)
      const reviewPoolPages = resolvePlanReviewPoolPages(plan, memorizedPoolPages)
      const reviewPages = resolvePlanReviewPagesForDate(plan, reviewPoolPages, reviewCompletedByStudent.get(studentId) ?? 0, record.date)
      const tiePages = Math.min(Number(plan?.rabt_pages ?? 10), Math.max(0, memorizedPoolPages))

      summary.totalRecords += 1

      if (!isPresent) {
        continue
      }

      summary.totalAttend += 1
      const evaluation = getEvaluationRecord(record.evaluations)

      if (isPassingMemorizationLevel(evaluation.hafiz_level ?? null)) {
        summary.passedMemorizationSegments += 1
        summary.memorized += dailyPages
      }

      if (isPassingMemorizationLevel(evaluation.tikrar_level ?? null)) {
        summary.passedTikrarSegments += 1
      }

      if (reviewDone) {
        summary.passedReviewSegments += 1
        summary.revised += reviewPages
        reviewCompletedByStudent.set(studentId, (reviewCompletedByStudent.get(studentId) ?? 0) + 1)
      }

      if (linkingDone) {
        summary.passedTiedSegments += 1
        summary.tied += tiePages
      }

      if (isPassingMemorizationLevel(evaluation.hafiz_level ?? null)) {
        memorizedPoolByStudent.set(studentId, memorizedPoolPages + dailyPages)
      }

      summary.earnedPoints += applyAttendancePointsAdjustment(calculateTotalEvaluationPoints(evaluation), status)
    }

    const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" })
    const studentsPayload = Array.from(studentStats.values())
      .map((item) => {
        const denominator = item.expectedRecords > 0 ? item.expectedRecords : countStudyDaysInRange(filter === "all" ? activeSemesterStartDate ?? start : start, end)
        const evalPercent = item.maxPoints > 0 ? (item.earnedPoints / item.maxPoints) * 100 : 0
        const attendPercent = denominator > 0 ? (item.totalAttend / denominator) * 100 : 0
        const memorizedPercent = denominator > 0 ? (item.passedMemorizationSegments / denominator) * 100 : 0
        const tikrarPercent = denominator > 0 ? (item.passedTikrarSegments / denominator) * 100 : 0
        const revisedPercent = denominator > 0 ? (item.passedReviewSegments / denominator) * 100 : 0
        const tiedPercent = denominator > 0 ? (item.passedTiedSegments / denominator) * 100 : 0
        const score = evalPercent * 0.6 + attendPercent * 0.4

        return {
          ...item,
          percent: evalPercent,
          attendPercent,
          memorizedPercent,
          tikrarPercent,
          revisedPercent,
          tiedPercent,
          score,
        }
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        if (right.attendPercent !== left.attendPercent) {
          return right.attendPercent - left.attendPercent
        }

        return collator.compare(left.name, right.name)
      })

    return NextResponse.json({
      circleName: resolvedCircleName,
      students: studentsPayload,
      error: "",
    })
  } catch (error) {
    const message = getReadableErrorMessage(error)
    return NextResponse.json({ circleName: "", students: [], error: `${TEXT.loadError}: ${message}` })
  }
}