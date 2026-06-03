import { getSiteSetting } from "@/lib/site-settings"
import {
  ATTENDANCE_AUTO_SEND_SETTINGS_ID,
  ATTENDANCE_WEEKLY_REPORT_LOG_SETTING_ID,
  DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS,
  DEFAULT_ATTENDANCE_WEEKLY_REPORT_LOG,
} from "@/lib/site-settings-constants"

export type AttendanceAutoSendMode = "daily" | "weekly" | "none"

export type AttendanceWeeklySendDay = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday"

export type AttendanceAutoSendSettings = {
  mode: AttendanceAutoSendMode
  weeklySendDay: AttendanceWeeklySendDay
  weeklySendTime: string
}

export type AttendanceWeeklyReportLogEntry = {
  weekKey: string
  weekStart: string
  weekEnd: string
  studentIds: string[]
  sentAt: string
  queuedCount: number
}

export type AttendanceWeeklyReportLog = {
  entries: AttendanceWeeklyReportLogEntry[]
}

const VALID_WEEKLY_DAYS = new Set<AttendanceWeeklySendDay>([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
])

function normalizeMode(value: unknown): AttendanceAutoSendMode {
  if (value === "weekly" || value === "none") {
    return value
  }

  return "daily"
}

function normalizeDay(value: unknown): AttendanceWeeklySendDay {
  if (typeof value === "string" && VALID_WEEKLY_DAYS.has(value as AttendanceWeeklySendDay)) {
    return value as AttendanceWeeklySendDay
  }

  return DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS.weeklySendDay
}

function normalizeTime(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS.weeklySendTime
  }

  const trimmedValue = value.trim()
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmedValue)) {
    return DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS.weeklySendTime
  }

  return trimmedValue
}

export function normalizeAttendanceAutoSendSettings(value: unknown): AttendanceAutoSendSettings {
  const candidate = value && typeof value === "object" ? (value as Partial<AttendanceAutoSendSettings>) : {}

  return {
    mode: normalizeMode(candidate.mode),
    weeklySendDay: normalizeDay(candidate.weeklySendDay),
    weeklySendTime: normalizeTime(candidate.weeklySendTime),
  }
}

export function normalizeAttendanceWeeklyReportLog(value: unknown): AttendanceWeeklyReportLog {
  const candidate = value && typeof value === "object" ? (value as { entries?: unknown[] }) : {}
  const entries = Array.isArray(candidate.entries) ? candidate.entries : []

  return {
    entries: entries
      .map((entry) => {
        const normalizedEntry = entry && typeof entry === "object" ? (entry as Partial<AttendanceWeeklyReportLogEntry>) : {}
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
          studentIds: Array.from(
            new Set(
              (Array.isArray(normalizedEntry.studentIds) ? normalizedEntry.studentIds : [])
                .map((studentId) => String(studentId || "").trim())
                .filter(Boolean),
            ),
          ),
        }
      })
      .filter((entry): entry is AttendanceWeeklyReportLogEntry => Boolean(entry))
      .slice(-12),
  }
}

export async function loadAttendanceAutoSendSettings() {
  return normalizeAttendanceAutoSendSettings(
    await getSiteSetting(ATTENDANCE_AUTO_SEND_SETTINGS_ID, DEFAULT_ATTENDANCE_AUTO_SEND_SETTINGS),
  )
}

export async function loadAttendanceWeeklyReportLog() {
  return normalizeAttendanceWeeklyReportLog(
    await getSiteSetting(ATTENDANCE_WEEKLY_REPORT_LOG_SETTING_ID, DEFAULT_ATTENDANCE_WEEKLY_REPORT_LOG),
  )
}