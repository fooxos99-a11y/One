"use client"

import { useEffect, useMemo, useState } from "react"
import { MessageSquareMore } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type WhatsAppQueueIndicatorProps = {
  enabled: boolean
  buttonClassName?: string
  iconClassName?: string
}

type QueueTrackerState = {
  pendingCount: number
  totalCount: number
}

const STORAGE_KEY = "global-whatsapp-queue-tracker"
const POLL_INTERVAL_MS = 2000

function readStoredTrackerState() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as Partial<QueueTrackerState>
    return {
      pendingCount: Math.max(0, Number(parsed.pendingCount || 0)),
      totalCount: Math.max(0, Number(parsed.totalCount || 0)),
    } satisfies QueueTrackerState
  } catch {
    return null
  }
}

function writeStoredTrackerState(state: QueueTrackerState) {
  if (typeof window === "undefined") {
    return
  }

  try {
    if (state.pendingCount <= 0 && state.totalCount <= 0) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return
    }

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function formatCompactCount(value: number) {
  if (value > 999) {
    return "999+"
  }

  return String(value)
}

function getNextTrackerState(previous: QueueTrackerState, pendingCount: number) {
  const nextPendingCount = Math.max(0, pendingCount)

  if (nextPendingCount === 0) {
    return {
      pendingCount: 0,
      totalCount: 0,
    } satisfies QueueTrackerState
  }

  if (previous.pendingCount === 0) {
    return {
      pendingCount: nextPendingCount,
      totalCount: nextPendingCount,
    } satisfies QueueTrackerState
  }

  let totalCount = previous.totalCount || previous.pendingCount || nextPendingCount
  if (nextPendingCount > previous.pendingCount) {
    totalCount += nextPendingCount - previous.pendingCount
  } else if (nextPendingCount > totalCount) {
    totalCount = nextPendingCount
  }

  return {
    pendingCount: nextPendingCount,
    totalCount,
  } satisfies QueueTrackerState
}

async function readQueueSnapshot() {
  const response = await fetch("/api/whatsapp/progress", { cache: "no-store" })
  if (!response.ok) {
    throw new Error("تعذر جلب حالة طابور الرسائل")
  }

  const payload = (await response.json()) as { pendingCount?: number }
  return Math.max(0, Number(payload.pendingCount || 0))
}

export function WhatsAppQueueIndicator({ enabled, buttonClassName, iconClassName }: WhatsAppQueueIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tracker, setTracker] = useState<QueueTrackerState>({ pendingCount: 0, totalCount: 0 })

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false)
      setTracker({ pendingCount: 0, totalCount: 0 })
      return
    }

    const storedState = readStoredTrackerState()
    if (storedState) {
      setTracker(storedState)
    }

    let disposed = false

    const syncQueueState = async () => {
      try {
        const pendingCount = await readQueueSnapshot()
        if (disposed) {
          return
        }

        setTracker((previous) => {
          const nextState = getNextTrackerState(previous, pendingCount)
          writeStoredTrackerState(nextState)
          return nextState
        })
      } catch {
        return
      }
    }

    void syncQueueState()
    const intervalId = window.setInterval(() => {
      void syncQueueState()
    }, POLL_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [enabled])

  const sentCount = useMemo(() => {
    if (tracker.totalCount <= 0) {
      return 0
    }

    return Math.max(0, tracker.totalCount - tracker.pendingCount)
  }, [tracker.pendingCount, tracker.totalCount])

  const progressValue = useMemo(() => {
    if (tracker.totalCount <= 0) {
      return 0
    }

    return Math.min(100, Math.max(0, (sentCount / tracker.totalCount) * 100))
  }, [sentCount, tracker.totalCount])

  if (!enabled) {
    return null
  }

  return (
    <>
      <button
        type="button"
        className={`relative flex items-center justify-center rounded-full transition-all ${buttonClassName ?? "h-12 w-12 border border-[#d8e5fb] bg-white text-[#3453a7] shadow-[0_10px_30px_rgba(52,83,167,0.08)] hover:bg-[#f6f9ff]"}`}
        aria-label="عداد طابور الرسائل"
        onClick={() => setIsOpen(true)}
      >
        <MessageSquareMore size={20} className={iconClassName ?? "text-[#3453a7]"} />
        {tracker.pendingCount > 0 ? (
          <span className="absolute -top-2 -right-2 min-w-6 rounded-full bg-[#f97316] px-1.5 py-0.5 text-center text-[10px] font-black leading-5 text-white shadow-[0_0_0_4px_rgba(249,115,22,0.12)]">
            {formatCompactCount(tracker.pendingCount)}
          </span>
        ) : null}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md border border-[#d9e4fb] bg-white p-6 overflow-hidden">
          <DialogHeader className="mb-4 text-right">
            <DialogTitle className="text-2xl font-black text-[#1f3f8f]">عداد طابور الرسائل</DialogTitle>
          </DialogHeader>

          <div className="rounded-[28px] border border-[#cddcf8] bg-[#eef4ff] p-2">
            <div className="relative h-20 overflow-hidden rounded-[22px] bg-[#dfe8fb]">
              <div
                className="absolute inset-y-0 right-0 rounded-[22px] bg-[linear-gradient(135deg,#1f3f8f_0%,#3453a7_58%,#6f91eb_100%)] transition-all duration-500"
                style={{ width: `${progressValue}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                <span className={`text-base font-black ${progressValue > 45 ? "text-white" : "text-[#1a2332]"}`}>
                  {tracker.totalCount > 0 ? `تم الإرسال ${sentCount} من أصل ${tracker.totalCount}` : "لا يوجد رسائل في الطابور"}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}