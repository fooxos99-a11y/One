import { NextRequest, NextResponse } from "next/server"

import {
  type AttendanceWeeklyReportLog,
  loadAttendanceAutoSendSettings,
  normalizeAttendanceWeeklyReportLog,
} from "@/lib/attendance-auto-send-settings"
import {
  buildAttendanceWeeklyGuardianMessage,
  buildHafizAmountLabel,
  loadAttendanceSaveGuardianTemplates,
} from "@/lib/attendance-save-notifications"
import { getSiteSetting, upsertSiteSetting } from "@/lib/site-settings"
import { ATTENDANCE_WEEKLY_REPORT_LOG_SETTING_ID, DEFAULT_ATTENDANCE_WEEKLY_REPORT_LOG } from "@/lib/site-settings-constants"
import { createAdminClient } from "@/lib/supabase/admin"
import { enqueueWhatsAppMessage } from "@/lib/whatsapp-queue"

type AttendanceRow = {
  id: string
  student_id: string
  date: string
  status: string
}

type EvaluationRow = {
  attendance_record_id: string
  hafiz_level?: "excellent" | "very_good" | "good" | "not_completed" | null
  tikrar_level?: "excellent" | "very_good" | "good" | "not_completed" | null
  samaa_level?: "excellent" | "very_good" | "good" | "not_completed" | null
  rabet_level?: "excellent" | "very_good" | "good" | "not_completed" | null
  hafiz_from_surah?: string | null
  hafiz_from_verse?: string | null
  hafiz_to_surah?: string | null
  hafiz_to_verse?: string | null
}

type StudentRow = {
  id: string
  name?: string | null
  halaqah?: string | null
  guardian_phone?: string | null
}

const WEEKDAY_TO_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const

function isAuthorized(request: NextRequest) {
  const cronHeader = request.headers.get("x-vercel-cron")
  if (cronHeader === "1") {
    return true
  }

  const secret = String(process.env.CRON_SECRET || "").trim()
  if (!secret) {
    return false
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader === `Bearer ${secret}`) {
    return true
  }

  return request.nextUrl.searchParams.get("secret") === secret
}

function getKsaNow(date = new Date()) {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
  }).format(date).toLowerCase() as keyof typeof WEEKDAY_TO_INDEX

  const year = dateParts.find((part) => part.type === "year")?.value || "0000"
  const month = dateParts.find((part) => part.type === "month")?.value || "00"
  const day = dateParts.find((part) => part.type === "day")?.value || "00"
  const hour = timeParts.find((part) => part.type === "hour")?.value || "00"
  const minute = timeParts.find((part) => part.type === "minute")?.value || "00"

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    weekdayIndex: WEEKDAY_TO_INDEX[weekday] ?? 0,
    timestamp: `${year}-${month}-${day} ${hour}:${minute}`,
  }
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function hasReachedSchedule(currentDate: string, currentTime: string, scheduleDate: string, scheduleTime: string) {
  if (currentDate > scheduleDate) {
    return true
  }

  if (currentDate < scheduleDate) {
    return false
  }

  return currentTime >= scheduleTime
}

function getScheduleDateForWeek(weekStart: string, sendDay: keyof typeof WEEKDAY_TO_INDEX) {
  const sendDayIndex = WEEKDAY_TO_INDEX[sendDay]
  return addDays(weekStart, sendDayIndex >= 4 ? sendDayIndex : 7 + sendDayIndex)
}

function resolveWeeklyWindow(currentDate: string, currentTime: string, sendDay: keyof typeof WEEKDAY_TO_INDEX, sendTime: string) {
  const currentWeekdayIndex = getKsaNow(new Date(`${currentDate}T12:00:00Z`)).weekdayIndex
  const currentWeekStart = addDays(currentDate, -currentWeekdayIndex)
  let candidateWeekStart = WEEKDAY_TO_INDEX[sendDay] >= 4 ? currentWeekStart : addDays(currentWeekStart, -7)
  const candidateScheduleDate = getScheduleDateForWeek(candidateWeekStart, sendDay)

  if (!hasReachedSchedule(currentDate, currentTime, candidateScheduleDate, sendTime)) {
    candidateWeekStart = addDays(candidateWeekStart, -7)
  }

  return {
    weekStart: candidateWeekStart,
    weekEnd: addDays(candidateWeekStart, 4),
  }
}

function upsertWeeklyLogEntry(log: AttendanceWeeklyReportLog, payload: {
  weekKey: string
  weekStart: string
  weekEnd: string
  studentIds: string[]
  queuedCount: number
  sentAt: string
}) {
  const nextEntries = log.entries.filter((entry) => entry.weekKey !== payload.weekKey)
  nextEntries.push({
    weekKey: payload.weekKey,
    weekStart: payload.weekStart,
    weekEnd: payload.weekEnd,
    studentIds: Array.from(new Set(payload.studentIds)),
    queuedCount: payload.queuedCount,
    sentAt: payload.sentAt,
  })

  return normalizeAttendanceWeeklyReportLog({ entries: nextEntries })
}

async function loadWeeklyLog() {
  return normalizeAttendanceWeeklyReportLog(
    await getSiteSetting(ATTENDANCE_WEEKLY_REPORT_LOG_SETTING_ID, DEFAULT_ATTENDANCE_WEEKLY_REPORT_LOG),
  )
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const autoSendSettings = await loadAttendanceAutoSendSettings()
    if (autoSendSettings.mode !== "weekly") {
      return NextResponse.json({ skipped: true, reason: "mode-not-weekly" })
    }

    const now = getKsaNow()
    const { weekStart, weekEnd } = resolveWeeklyWindow(
      now.date,
      now.time,
      autoSendSettings.weeklySendDay,
      autoSendSettings.weeklySendTime,
    )
    const scheduleDate = getScheduleDateForWeek(weekStart, autoSendSettings.weeklySendDay)

    if (!hasReachedSchedule(now.date, now.time, scheduleDate, autoSendSettings.weeklySendTime)) {
      return NextResponse.json({ skipped: true, reason: "before-schedule-time", weekStart, weekEnd })
    }

    const supabase = createAdminClient()
    const templates = await loadAttendanceSaveGuardianTemplates()
    const weeklyLog = await loadWeeklyLog()
    const weekKey = `${weekStart}_${weekEnd}`
    const existingLogEntry = weeklyLog.entries.find((entry) => entry.weekKey === weekKey) || null
    const alreadySentStudentIds = new Set(existingLogEntry?.studentIds || [])

    const { data: attendanceRows, error: attendanceError } = await supabase
      .from("attendance_records")
      .select("id, student_id, date, status")
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .eq("is_compensation", false)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true })

    if (attendanceError) {
      throw attendanceError
    }

    const normalizedAttendanceRows = (attendanceRows || []) as AttendanceRow[]
    if (normalizedAttendanceRows.length === 0) {
      return NextResponse.json({ success: true, sent: 0, weekStart, weekEnd, reason: "no-records" })
    }

    const attendanceIds = normalizedAttendanceRows.map((row) => row.id)
    const studentIds = Array.from(new Set(normalizedAttendanceRows.map((row) => row.student_id).filter(Boolean)))

    const [{ data: evaluationRows, error: evaluationsError }, { data: studentRows, error: studentsError }] = await Promise.all([
      supabase
        .from("evaluations")
        .select("attendance_record_id, hafiz_level, tikrar_level, samaa_level, rabet_level, hafiz_from_surah, hafiz_from_verse, hafiz_to_surah, hafiz_to_verse")
        .in("attendance_record_id", attendanceIds),
      supabase
        .from("students")
        .select("id, name, halaqah, guardian_phone")
        .in("id", studentIds),
    ])

    if (evaluationsError) {
      throw evaluationsError
    }

    if (studentsError) {
      throw studentsError
    }

    const evaluationsByAttendanceId = new Map((evaluationRows || []).map((row) => [String((row as EvaluationRow).attendance_record_id), row as EvaluationRow]))
    const studentsById = new Map((studentRows || []).map((student) => [String((student as StudentRow).id), student as StudentRow]))
    const attendanceByStudent = new Map<string, AttendanceRow[]>()

    for (const row of normalizedAttendanceRows) {
      const currentRows = attendanceByStudent.get(row.student_id) || []
      currentRows.push(row)
      attendanceByStudent.set(row.student_id, currentRows)
    }

    let queuedCount = 0
    let skippedCount = 0
    let missingGuardianPhoneCount = 0
    let invalidPhoneCount = 0
    let duplicateCount = 0
    let notReadyCount = 0
    const sentStudentIds = new Set(existingLogEntry?.studentIds || [])

    for (const [studentId, rows] of attendanceByStudent.entries()) {
      if (alreadySentStudentIds.has(studentId)) {
        duplicateCount += 1
        continue
      }

      const student = studentsById.get(studentId)
      if (!student) {
        skippedCount += 1
        continue
      }

      const entries = rows
        .slice()
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((row) => {
          const evaluation = evaluationsByAttendanceId.get(row.id)
          return {
            date: row.date,
            status: row.status,
            hafiz: evaluation?.hafiz_level || null,
            tikrar: evaluation?.tikrar_level || null,
            samaa: evaluation?.samaa_level || null,
            rabet: evaluation?.rabet_level || null,
            hafizAmount: buildHafizAmountLabel({
              fromSurah: evaluation?.hafiz_from_surah,
              fromVerse: evaluation?.hafiz_from_verse,
              toSurah: evaluation?.hafiz_to_surah,
              toVerse: evaluation?.hafiz_to_verse,
            }),
          }
        })

      if (entries.length === 0) {
        skippedCount += 1
        continue
      }

      const message = await buildAttendanceWeeklyGuardianMessage({
        studentName: student.name || "الطالب",
        halaqah: student.halaqah,
        weekStart,
        weekEnd,
        entries,
        templates,
      })

      const queueResult = await enqueueWhatsAppMessage(supabase, {
        phoneNumber: student.guardian_phone,
        message,
        dedupeDate: null,
      })

      if (queueResult.queued) {
        queuedCount += 1
        sentStudentIds.add(studentId)
        continue
      }

      skippedCount += 1
      if (queueResult.reason === "missing-guardian-phone") missingGuardianPhoneCount += 1
      else if (queueResult.reason === "invalid-phone") invalidPhoneCount += 1
      else if (queueResult.reason === "duplicate") duplicateCount += 1
      else if (queueResult.reason === "whatsapp-not-ready") notReadyCount += 1
    }

    if (queuedCount > 0 || sentStudentIds.size > 0) {
      const nextLog = upsertWeeklyLogEntry(weeklyLog, {
        weekKey,
        weekStart,
        weekEnd,
        studentIds: Array.from(sentStudentIds),
        queuedCount: sentStudentIds.size,
        sentAt: now.timestamp,
      })

      const { error: upsertError } = await upsertSiteSetting(ATTENDANCE_WEEKLY_REPORT_LOG_SETTING_ID, nextLog)
      if (upsertError) {
        throw upsertError
      }
    }

    return NextResponse.json({
      success: true,
      weekStart,
      weekEnd,
      queuedCount,
      skippedCount,
      duplicateCount,
      missingGuardianPhoneCount,
      invalidPhoneCount,
      notReadyCount,
    })
  } catch (error) {
    console.error("[cron][attendance-weekly-guardian-notifications]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "حدث خطأ غير معروف" },
      { status: 500 },
    )
  }
}