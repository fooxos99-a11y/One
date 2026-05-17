"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Loader2, MessageSquare, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type TrackerState = {
  active: boolean
  awaiting: boolean
  awaitUntil: number
  totalCount: number
  pendingCount: number
}

const MESSAGE_TRIGGER_PATTERNS = [
  /^\/api\/whatsapp\/send(?:\/|$)/,
  /^\/api\/attendance\/batch(?:\/|$)/,
  /^\/api\/exams(?:\/|$)/,
  /^\/api\/exam-schedules(?:\/|$)/,
  /^\/api\/enrollment-notifications(?:\/|$)/,
  /^\/api\/recitation-days(?:\/|$)/,
  /^\/api\/recitation-day-students(?:\/|$)/,
]

const CAPTURE_WINDOW_MS = 12000
const POLL_INTERVAL_MS = 2000
const COMPLETION_DELAY_MS = 1800

function getRequestPath(input: RequestInfo | URL): string | null {
  if (typeof input === "string") {
    return new URL(input, window.location.origin).pathname
  }

  if (input instanceof URL) {
    return input.pathname
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return new URL(input.url, window.location.origin).pathname
  }

  return null
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) {
    return init.method.toUpperCase()
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase()
  }

  return "GET"
}

function isMessageTriggerRequest(input: RequestInfo | URL, init?: RequestInit) {
  const method = getRequestMethod(input, init)
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return false
  }

  const path = getRequestPath(input)
  if (!path) {
    return false
  }

  return MESSAGE_TRIGGER_PATTERNS.some((pattern) => pattern.test(path))
}

function extractQueuedHint(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0
  }

  const record = payload as Record<string, unknown>

  if (typeof record.queuedCount === "number") {
    return Math.max(0, record.queuedCount)
  }

  if (typeof record.queued === "boolean") {
    return record.queued ? 1 : 0
  }

  const whatsappRecord = record.whatsapp
  if (whatsappRecord && typeof whatsappRecord === "object") {
    const whatsapp = whatsappRecord as Record<string, unknown>
    if (typeof whatsapp.queuedCount === "number") {
      return Math.max(0, whatsapp.queuedCount)
    }
  }

  return 0
}

async function readQueuedHint(response: Response) {
  if (!response.ok) {
    return 0
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    return 0
  }

  try {
    const payload = await response.clone().json()
    return extractQueuedHint(payload)
  } catch {
    return 0
  }
}

async function readProgressSnapshot() {
  const response = await fetch("/api/whatsapp/progress", { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Failed to fetch WhatsApp progress")
  }

  const payload = (await response.json()) as { pendingCount?: number }
  return Math.max(0, Number(payload.pendingCount || 0))
}

export function AdminMessageProgress() {
  const [isPrivilegedUser, setIsPrivilegedUser] = useState(false)
  const [isResolved, setIsResolved] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [tracker, setTracker] = useState<TrackerState>({
    active: false,
    awaiting: false,
    awaitUntil: 0,
    totalCount: 0,
    pendingCount: 0,
  })

  const completionTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolveViewer() {
      try {
        const response = await fetch("/api/auth", { cache: "no-store" })
        if (!response.ok) {
          if (!cancelled) {
            setIsResolved(true)
          }
          return
        }

        const payload = await response.json()
        const role = String(payload?.user?.role || "").trim()

        if (!cancelled) {
          setIsPrivilegedUser(role === "admin" || role === "supervisor")
          setIsResolved(true)
        }
      } catch {
        if (!cancelled) {
          setIsResolved(true)
        }
      }
    }

    resolveViewer()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isPrivilegedUser) {
      return
    }

    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init)

      if (!isMessageTriggerRequest(input, init)) {
        return response
      }

      const queuedHint = await readQueuedHint(response)
      const now = Date.now()

      setTracker((previous) => {
        if (queuedHint > 0 && !previous.active) {
          return {
            active: true,
            awaiting: false,
            awaitUntil: 0,
            totalCount: queuedHint,
            pendingCount: queuedHint,
          }
        }

        return {
          ...previous,
          awaiting: true,
          awaitUntil: now + CAPTURE_WINDOW_MS,
        }
      })

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [isPrivilegedUser])

  useEffect(() => {
    if (!isPrivilegedUser || (!tracker.active && !tracker.awaiting)) {
      return
    }

    let disposed = false

    const syncProgress = async () => {
      try {
        const pendingCount = await readProgressSnapshot()
        if (disposed) {
          return
        }

        setTracker((previous) => {
          if (previous.awaiting && pendingCount > 0) {
            return {
              active: true,
              awaiting: false,
              awaitUntil: 0,
              totalCount: Math.max(previous.totalCount, pendingCount, 1),
              pendingCount,
            }
          }

          if (previous.awaiting && Date.now() > previous.awaitUntil) {
            return {
              active: false,
              awaiting: false,
              awaitUntil: 0,
              totalCount: 0,
              pendingCount: 0,
            }
          }

          if (!previous.active) {
            return previous
          }

          let totalCount = previous.totalCount || pendingCount || 1
          if (pendingCount > previous.pendingCount) {
            totalCount += pendingCount - previous.pendingCount
          } else if (pendingCount > totalCount) {
            totalCount = pendingCount
          }

          return {
            ...previous,
            totalCount,
            pendingCount,
          }
        })
      } catch {
        return
      }
    }

    void syncProgress()
    const intervalId = window.setInterval(syncProgress, POLL_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [isPrivilegedUser, tracker.active, tracker.awaiting])

  useEffect(() => {
    if (!tracker.active || tracker.pendingCount > 0) {
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current)
        completionTimeoutRef.current = null
      }
      return
    }

    completionTimeoutRef.current = window.setTimeout(() => {
      setTracker({
        active: false,
        awaiting: false,
        awaitUntil: 0,
        totalCount: 0,
        pendingCount: 0,
      })
    }, COMPLETION_DELAY_MS)

    return () => {
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current)
        completionTimeoutRef.current = null
      }
    }
  }, [tracker.active, tracker.pendingCount])

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current)
      }
    }
  }, [])

  const progressValue = useMemo(() => {
    if (!tracker.totalCount) {
      return 0
    }

    const completedCount = Math.max(0, tracker.totalCount - tracker.pendingCount)
    return Math.min(100, Math.round((completedCount / tracker.totalCount) * 100))
  }, [tracker.pendingCount, tracker.totalCount])

  if (!isResolved || !isPrivilegedUser || (!tracker.active && !tracker.awaiting)) {
    return null
  }

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-5 left-5 z-[90] flex h-14 w-14 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-700 shadow-xl shadow-sky-200/60 transition hover:-translate-y-0.5 hover:bg-sky-50"
        aria-label="إظهار تقدم الرسائل"
      >
        <MessageSquare className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 min-w-7 rounded-full bg-sky-600 px-1.5 py-0.5 text-center text-[11px] font-bold leading-5 text-white">
          {progressValue}%
        </span>
      </button>
    )
  }

  const isCompleted = tracker.active && tracker.pendingCount === 0 && tracker.totalCount > 0
  const title = isCompleted ? "اكتمل إرسال الرسائل" : "جاري إرسال الرسائل"
  const description = isCompleted
    ? `تم إنهاء ${tracker.totalCount} رسالة بنجاح.`
    : tracker.awaiting && !tracker.active
      ? "جارٍ تجهيز دفعة الرسائل..."
      : `المتبقي ${tracker.pendingCount} من ${tracker.totalCount}`

  return (
    <div className="pointer-events-none fixed left-1/2 top-[38%] z-[90] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 px-4">
      <div className="pointer-events-auto rounded-2xl border border-sky-100 bg-white/96 p-4 shadow-2xl shadow-sky-200/50 backdrop-blur">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "mt-0.5 flex h-10 w-10 items-center justify-center rounded-full",
              isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-sky-100 text-sky-700",
            )}>
              {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{title}</p>
              <p className="mt-1 text-xs leading-6 text-slate-600">{description}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => setIsMinimized(true)}
            aria-label="تصغير شريط تقدم الرسائل"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>

        <Progress value={isCompleted ? 100 : progressValue} className="h-3 bg-sky-100 [&>div]:bg-sky-600" />

        <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-600">
          <span>{isCompleted ? "100%" : `${progressValue}%`}</span>
          <span>{tracker.totalCount > 0 ? `${Math.max(0, tracker.totalCount - tracker.pendingCount)} / ${tracker.totalCount}` : "0 / 0"}</span>
        </div>
      </div>
    </div>
  )
}