"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, LogOut, Play, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SiteLoader } from "@/components/ui/site-loader"
import { useAlertDialog, useConfirmDialog } from "@/hooks/use-confirm-dialog"

type WhatsAppStatusResponse = {
  instanceSlug?: string | null
  workerMode?: string | null
  deviceLabel?: string | null
  status: string
  qrAvailable: boolean
  ready: boolean
  authenticated: boolean
  lastUpdatedAt: string | null
  lastHeartbeatAt: string | null
  qrUpdatedAt: string | null
  connectedAt: string | null
  disconnectedAt: string | null
  authFailedAt: string | null
  lastError: string | null
  workerOnline: boolean
  qrImageUrl: string | null
}

type WhatsAppQrDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStatus?: Partial<WhatsAppStatusResponse> | null
}

function shouldLogStatusFetchError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return false
  }

  if (error instanceof TypeError) {
    const message = String(error.message || "").trim().toLowerCase()
    if (message.includes("failed to fetch") || message.includes("load failed")) {
      return false
    }
  }

  return true
}

const DEFAULT_STATUS: WhatsAppStatusResponse = {
  instanceSlug: null,
  workerMode: null,
  deviceLabel: null,
  status: "not_started",
  qrAvailable: false,
  ready: false,
  authenticated: false,
  lastUpdatedAt: null,
  lastHeartbeatAt: null,
  qrUpdatedAt: null,
  connectedAt: null,
  disconnectedAt: null,
  authFailedAt: null,
  lastError: null,
  workerOnline: false,
  qrImageUrl: null,
}

const QR_WARNING_MESSAGE = [
  "إذا كان الجوال غير متصل بالإنترنت أو خرجت جلسة واتساب من الأجهزة المرتبطة، سيتوقف الإرسال حتى تعود الحالة إلى تم الربط.",
  "",
  "لثبات الإرسال:",
  "- أبق الجوال متصلاً بالإنترنت.",
  "- لا تسجل خروجاً من واتساب ويب أو الأجهزة المرتبطة.",
  "- إذا انقطعت الجلسة، امسح الباركود من جديد.",
].join("\n")

function getAutoRefreshIntervalMs(status: WhatsAppStatusResponse, imageFailed: boolean, isStartingWorker: boolean) {
  if (isStartingWorker) {
    return 1200
  }

  if (status.workerOnline && status.ready && status.authenticated && status.status === "connected") {
    return 4000
  }

  if (imageFailed) {
    return 1200
  }

  if (status.qrAvailable && status.status === "waiting_for_qr") {
    return 5000
  }

  switch (status.status) {
    case "authenticating":
    case "disconnecting":
    case "fetching_qr":
    case "starting":
      return 1200
    case "waiting_for_qr":
      return 5000
    default:
      return 5000
  }
}

function getStatusUi(status: WhatsAppStatusResponse, isStartingWorker: boolean) {
  if (isStartingWorker) {
    return {
      label: "جاري تشغيل عامل واتساب المحلي",
      description: "يتم تشغيل العامل المحلي تلقائياً على هذا الجهاز، انتظر قليلاً ليظهر الباركود.",
    }
  }

  if (status.workerOnline && status.ready && status.authenticated && status.status === "connected") {
    return {
      label: "تم الربط",
      description: "الواتساب متصل الآن",
    }
  }

  if (!status.workerOnline) {
    return {
      label: status.workerMode === "local" ? "عامل واتساب المحلي غير متصل" : "عامل واتساب غير متصل",
      description:
        status.workerMode === "local"
          ? "العامل المحلي على هذا الجهاز غير شغال حالياً. سيحاول النظام تشغيله تلقائياً، وإذا لم يبدأ فراجع ملف .env.local-worker."
          : "الخادم المسؤول عن واتساب غير متصل حالياً.",
    }
  }

  switch (status.status) {
    case "waiting_for_qr":
      return {
        label: "الباركود جاهز",
        description: "امسح الباركود من تطبيق واتساب لإكمال الربط.",
      }
    case "authenticating":
      return {
        label: "جاري التحقق",
        description: "تمت قراءة الباركود. يرجى عدم الخروج من نافذة الأجهزة المرتبطة في واتساب حتى يكتمل الربط.",
      }
    case "disconnecting":
    case "fetching_qr":
      return {
        label: "جاري جلب الباركود",
        description: "يتم إنهاء الجلسة الحالية وتجهيز باركود جديد.",
      }
    case "starting":
      if (!status.authenticated && !status.qrAvailable) {
        return {
          label: "بانتظار الباركود",
          description: "يتم تجهيز الجلسة الآن، وسيظهر الباركود عند جاهزيته. إذا استمرت هذه الحالة فحدّث الباركود.",
        }
      }

      return {
        label: "جاري التشغيل",
        description: "عامل واتساب بدأ التشغيل ويجهز الجلسة.",
      }
    case "auth_failed":
      return {
        label: "فشل الربط",
        description: "فشل التحقق من الجلسة وقد تحتاج إلى تحديث الباركود أو إعادة الربط.",
      }
    case "disconnected":
      if (!status.authenticated) {
        return {
          label: "بانتظار الباركود",
          description: "يجري تجهيز باركود جديد أو تحديث الجلسة. انتظر قليلًا أو حدّث الباركود يدويًا.",
        }
      }

      return {
        label: "انقطع الاتصال",
        description: "انقطعت الجلسة. حدّث الباركود أو أعد الربط.",
      }
    default:
      return {
        label: "بانتظار الباركود",
        description: "لم يظهر باركود جاهز حتى الآن.",
      }
  }
}

export function WhatsAppQrDialog({ open, onOpenChange, initialStatus }: WhatsAppQrDialogProps) {
  const confirmDialog = useConfirmDialog()
  const alertDialog = useAlertDialog()
  const [status, setStatus] = useState<WhatsAppStatusResponse>(DEFAULT_STATUS)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isStartingWorker, setIsStartingWorker] = useState(false)
  const hasAttemptedAutoStartRef = useRef(false)

  const statusUi = useMemo(() => getStatusUi(status, isStartingWorker), [isStartingWorker, status])
  const isConnected = status.workerOnline && status.ready && status.authenticated && status.status === "connected"
  const canDisconnect = isConnected && !isDisconnecting
  const autoRefreshIntervalMs = getAutoRefreshIntervalMs(status, imageFailed, isStartingWorker)
  const qrImageSrc = status.qrImageUrl

  const ensureWorkerStarted = async () => {
    try {
      setIsStartingWorker(true)

      const response = await fetch("/api/whatsapp/ensure-worker", {
        method: "POST",
        cache: "no-store",
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          success: false,
          error: data?.error || "تعذر تشغيل عامل واتساب المحلي",
        }
      }

      return {
        success: true,
        message: data?.alreadyRunning ? "عامل واتساب المحلي شغال بالفعل." : "تم إرسال طلب تشغيل عامل واتساب المحلي.",
      }
    } catch {
      return {
        success: false,
        error: "تعذر الوصول إلى خدمة تشغيل عامل واتساب المحلي",
      }
    } finally {
      window.setTimeout(() => {
        setIsStartingWorker(false)
      }, 2500)
    }
  }

  const fetchStatus = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) {
        setIsLoadingStatus(true)
      }

      const response = await fetch(`/api/whatsapp/status?t=${Date.now()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("تعذر جلب حالة واتساب")
      }

      const data = (await response.json()) as WhatsAppStatusResponse
      setStatus({ ...DEFAULT_STATUS, ...data })
      setImageFailed(false)
    } catch (error) {
      if (shouldLogStatusFetchError(error)) {
        console.error("[whatsapp-qr-dialog] fetch status:", error)
      }
    } finally {
      if (!silent) {
        setIsLoadingStatus(false)
      }
    }
  }

  useEffect(() => {
    if (!open) {
      hasAttemptedAutoStartRef.current = false
      setIsStartingWorker(false)
      return
    }

    if (initialStatus) {
      setStatus((current) => ({
        ...DEFAULT_STATUS,
        ...current,
        ...initialStatus,
      }))
    }

    void fetchStatus()
  }, [open, initialStatus])

    useEffect(() => {
      if (!open || status.workerOnline || hasAttemptedAutoStartRef.current) {
        return
      }

      hasAttemptedAutoStartRef.current = true
      void ensureWorkerStarted().then((result) => {
        if (result.success) {
          void fetchStatus({ silent: true })
        }
      })
    }, [open, status.workerOnline])

  const handleStartWorker = async () => {
    const result = await ensureWorkerStarted()
    if (!result.success) {
      await alertDialog(result.error, "تعذر التشغيل")
      return
    }

    await alertDialog(result.message, "تم")
    await fetchStatus()
  }

  useEffect(() => {
    if (!open || autoRefreshIntervalMs <= 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      void fetchStatus({ silent: true })
    }, autoRefreshIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [open, autoRefreshIntervalMs])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleFocus = () => {
      void fetchStatus({ silent: true })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchStatus({ silent: true })
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [open])

  const handleDisconnect = async () => {
    const confirmed = await confirmDialog({
      title: "إلغاء ربط واتساب",
      description: "سيتم فصل الجوال الحالي وإنشاء باركود جديد لتتمكن من ربط جوال آخر. هل تريد المتابعة؟",
      confirmText: "إلغاء الربط",
      cancelText: "تراجع",
    })

    if (!confirmed) {
      return
    }

    try {
      setIsDisconnecting(true)
      const response = await fetch("/api/whatsapp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "تعذر إلغاء الربط")
      }

      setStatus((current) => ({
        ...current,
        status: "fetching_qr",
        ready: false,
        authenticated: false,
        qrAvailable: false,
        qrImageUrl: null,
      }))

      await alertDialog("تم إرسال طلب إلغاء الربط. حدّث الباركود بعد لحظات لعرض الكود الجديد.", "تم")
      await fetchStatus()
    } catch (error) {
      await alertDialog(error instanceof Error ? error.message : "تعذر إلغاء الربط حالياً", "خطأ")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleQrWarningClick = async () => {
    await alertDialog(QR_WARNING_MESSAGE, "تنبيه مهم")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden rounded-[28px] border-[#d8e0f0] bg-white p-0" showCloseButton={false}>
        <div className="space-y-0" dir="rtl">
          <DialogHeader className="border-b border-[#e6edf8] px-5 py-4">
            <div className="flex flex-col gap-3">
              <div className="relative flex min-h-9 items-start justify-center">
                <DialogTitle className="text-center text-xl font-black leading-tight text-[#1a2332]">
                  باركود الواتساب
                </DialogTitle>

                <div className="absolute left-0 top-0 flex items-center justify-start">
                  {status.qrAvailable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleQrWarningClick}
                      className="h-9 w-9 rounded-2xl border-[#cfe0ff] bg-[#eef5ff] text-[#3453a7] hover:bg-[#e2eeff] hover:text-[#3453a7]"
                      aria-label="عرض تنبيه مهم عن ربط واتساب"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <div className="h-9 w-9 shrink-0" aria-hidden="true" />
                  )}
                </div>
              </div>

              <p className="text-right text-sm font-bold leading-7 text-[#64748b]">
                يجب أن يكون الهاتف والجهاز المرتبط به الباركود متصلين بالإنترنت أثناء إرسال الرسائل.
              </p>

              {canDisconnect ? (
                <div className="flex justify-start">
                  <Button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    variant="outline"
                    className="h-10 rounded-2xl border-rose-200 bg-rose-50 px-3 text-sm font-black text-rose-700 hover:bg-rose-100 hover:text-rose-700"
                  >
                    <LogOut className="me-1.5 h-4 w-4" />
                    {isDisconnecting ? "جاري الإلغاء..." : "إلغاء الربط"}
                  </Button>
                </div>
              ) : null}

              {!status.workerOnline ? (
                <div className="flex justify-start">
                  <Button
                    type="button"
                    onClick={handleStartWorker}
                    disabled={isStartingWorker}
                    size="icon"
                    aria-label="تشغيل عامل واتساب"
                    className="h-10 w-10 rounded-2xl bg-[#3453a7] text-white hover:bg-[#2c478d]"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </DialogHeader>

          <div className="space-y-4 p-5">
            {status.qrAvailable && qrImageSrc && !imageFailed ? (
              <div className="relative flex justify-center rounded-[24px] border border-dashed border-[#cfdcf2] bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8fbff_55%,#eef3ff_100%)] p-4">
                <img
                  src={qrImageSrc}
                  alt="باركود واتساب"
                  className="h-auto w-full max-w-[280px] rounded-2xl bg-white p-3 shadow-[0_14px_40px_rgba(20,39,92,0.10)]"
                  onError={() => {
                    setImageFailed(true)
                    void fetchStatus({ silent: true })
                  }}
                />
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed border-[#d5dfef] bg-[linear-gradient(180deg,#fbfcff_0%,#f2f6ff_100%)] px-5 py-8 text-center">
                {isLoadingStatus ? (
                  <SiteLoader size="md" color="#3453a7" />
                ) : status.ready ? (
                  <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                ) : (
                  <Smartphone className="h-14 w-14 text-[#3453a7]" />
                )}
                <div className="space-y-2">
                  <p className="text-lg font-black text-[#1a2332]">{isConnected ? "تم الربط بنجاح" : statusUi.label}</p>
                  <p className="text-sm font-bold text-[#64748b]">{statusUi.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}