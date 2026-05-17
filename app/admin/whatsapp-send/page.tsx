"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { useWhatsAppStatus } from "@/hooks/use-whatsapp-status"
import { MessageCircle, Send, Users, CheckCircle2, XCircle, Phone, CircleAlert, Search, CheckCheck, Trash2, Mic, Paperclip } from "lucide-react"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { SiteLoader } from "@/components/ui/site-loader"
import { formatGuardianPhoneForDisplay } from "@/lib/phone-number"
import { getOfflineErrorMessage } from "@/lib/network-error"

type RecipientGroup = "guardians" | "teachers" | "admins"

type Recipient = {
  id: string
  name: string
  phoneNumber: string
  accountNumber: string
  halaqah: string
  role: string
  group: RecipientGroup
}

type OutgoingImagePayload = {
  base64: string
  mimeType: string
  fileName: string
  previewUrl: string
}

type SendResults = {
  sent: number
  pending: number
  failed: number
}

type QueuedMessageStatus = {
  id: string
  status: string | null
  error_message?: string | null
}

type QueuedMessageSummary = {
  tracked: number
  sent: number
  pending: number
  failed: number
}

type Reply = {
  id: string
  student_name: string
  sent_message_text: string
  sent_message_type?: string | null
  sent_media_mime_type?: string | null
  sent_media_base64?: string | null
  reply_message_text: string
  reply_type?: string | null
  media_mime_type?: string | null
  media_base64?: string | null
  is_read: boolean
}

const OUTBOUND_ATTACHMENT_MAX_SIZE_BYTES = 50 * 1024 * 1024
const OUTBOUND_ATTACHMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const
const OUTBOUND_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
const SEND_RESULTS_POLL_INTERVAL_MS = 2000
const OUTBOUND_ATTACHMENT_MIME_BY_EXTENSION: Record<string, (typeof OUTBOUND_ATTACHMENT_MIME_TYPES)[number]> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

const RECIPIENT_GROUP_LABELS: Record<RecipientGroup, string> = {
  guardians: "أولياء الأمور",
  teachers: "المعلمين",
  admins: "الإداريين",
}

const TEMPLATE_VARIABLES = [
  { token: "{name}", label: "الاسم", sample: "أحمد محمد" },
  { token: "{account_number}", label: "رقم الحساب", sample: "10234" },
  { token: "{phone_number}", label: "رقم الجوال", sample: "0551234567" },
  { token: "{halaqah}", label: "الحلقة", sample: "حلقة أبي بن كعب" },
  { token: "{role}", label: "المسمى الوظيفي", sample: "مشرف تعليمي" },
  { token: "{recipient_type}", label: "نوع المستلم", sample: "المعلمين" },
  { token: "{date}", label: "تاريخ اليوم", sample: "09/04/2026" },
] as const

const whatsappOutlinePillClass =
  "theme-pill-outline inline-flex h-12 items-center rounded-full px-5 text-sm font-bold transition-all"

const whatsappCardClass = "theme-admin-card border-2"

const whatsappSoftPanelClass = "theme-admin-muted-surface rounded-xl p-4"

const whatsappInputAccentClass = "theme-admin-input"

function resolveMessageTemplate(template: string, recipient: Recipient) {
  const replacements: Record<string, string> = {
    "{name}": recipient.name || "",
    "{account_number}": recipient.accountNumber || "",
    "{phone_number}": formatGuardianPhoneForDisplay(recipient.phoneNumber),
    "{halaqah}": recipient.halaqah || "",
    "{role}": recipient.role || "",
    "{recipient_type}": RECIPIENT_GROUP_LABELS[recipient.group],
    "{date}": new Intl.DateTimeFormat("ar-SA").format(new Date()),
  }

  return Object.entries(replacements).reduce(
    (result, [token, value]) => result.replaceAll(token, value),
    template,
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }

      reject(new Error("تعذر قراءة الصورة"))
    }
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"))
    reader.readAsDataURL(file)
  })
}

function buildMediaSrc(base64: string | null | undefined, mimeType: string | null | undefined) {
  if (!base64 || !mimeType) {
    return null
  }

  return `data:${mimeType};base64,${base64}`
}

function extractBase64FromDataUrl(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",")
  return separatorIndex >= 0 ? dataUrl.slice(separatorIndex + 1) : dataUrl
}

function resolveAttachmentMimeType(file: File) {
  const normalizedType = String(file.type || "").trim().toLowerCase()
  if (OUTBOUND_ATTACHMENT_MIME_TYPES.includes(normalizedType as (typeof OUTBOUND_ATTACHMENT_MIME_TYPES)[number])) {
    return normalizedType as (typeof OUTBOUND_ATTACHMENT_MIME_TYPES)[number]
  }

  const extension = String(file.name || "").trim().toLowerCase().split(".").pop() || ""
  return OUTBOUND_ATTACHMENT_MIME_BY_EXTENSION[extension] || null
}

function getRecipientFilterLabel(group: RecipientGroup) {
  return group === "admins" ? "كل المسميات" : "كل الحلقات"
}

function getRecipientSecondaryLabel(recipient: Recipient) {
  if (recipient.group === "admins") {
    return recipient.role || "بدون مسمى"
  }

  const details = [recipient.halaqah]
  if (recipient.group === "teachers" && recipient.role) {
    details.push(recipient.role === "deputy_teacher" ? "نائب معلم" : "معلم")
  }

  return details.filter(Boolean).join(" • ") || "بدون حلقة"
}

export function WhatsAppSendContent({
  displayMode = "page",
  onInlineActionsChange,
}: {
  displayMode?: "page" | "inline"
  onInlineActionsChange?: (actions: { toggleRepliesView: () => void; isRepliesView: boolean }) => void
}) {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("الإرسال إلى أولياء الأمور")
  const { isReady: isWhatsAppReady, isLoading: isWhatsAppStatusLoading } = useWhatsAppStatus()
  const searchParams = useSearchParams()
  const isEmbedded = displayMode === "inline" || searchParams.get("embedded") === "1"
  const router = useRouter()
  const { toast } = useToast()
  const confirmDialog = useConfirmDialog()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const completionToastShownRef = useRef(false)

  const [readyMessages, setReadyMessages] = useState<{ id: number; text: string }[]>([])
  const [isLoadingReady, setIsLoadingReady] = useState(false)
  const [quickText, setQuickText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [recipientsByGroup, setRecipientsByGroup] = useState<Record<RecipientGroup, Recipient[]>>({
    guardians: [],
    teachers: [],
    admins: [],
  })
  const [selectedRecipientGroup, setSelectedRecipientGroup] = useState<RecipientGroup>("guardians")
  const [filteredRecipients, setFilteredRecipients] = useState<Recipient[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [isSending, setIsSending] = useState(false)
  const [sendResults, setSendResults] = useState<SendResults | null>(null)
  const [localFailedCount, setLocalFailedCount] = useState(0)
  const [trackedQueuedIds, setTrackedQueuedIds] = useState<string[]>([])
  const [imagePayload, setImagePayload] = useState<OutgoingImagePayload | null>(null)
  const [activeView, setActiveView] = useState<"send" | "replies">("send")
  const [replies, setReplies] = useState<Reply[]>([])
  const [filteredReplies, setFilteredReplies] = useState<Reply[]>([])
  const [repliesSearchTerm, setRepliesSearchTerm] = useState("")
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [isRepliesLoading, setIsRepliesLoading] = useState(false)
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null)

  const pollQueuedMessagesStatus = async (queuedIds: string[]) => {
    if (queuedIds.length === 0) {
      return {
        statuses: [] as QueuedMessageStatus[],
        summary: { tracked: 0, sent: 0, pending: 0, failed: 0 } satisfies QueuedMessageSummary,
      }
    }

    const response = await fetch(`/api/whatsapp/send?ids=${encodeURIComponent(queuedIds.join(","))}`, {
      cache: "no-store",
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.error || "تعذر جلب حالة الرسائل")
    }

    const statuses = Array.isArray(data.statuses) ? (data.statuses as QueuedMessageStatus[]) : []
    const rawSummary = data.summary as Partial<QueuedMessageSummary> | undefined
    const summary: QueuedMessageSummary = {
      tracked: Number(rawSummary?.tracked) || statuses.length,
      sent: Number(rawSummary?.sent) || 0,
      pending: Number(rawSummary?.pending) || 0,
      failed: Number(rawSummary?.failed) || 0,
    }

    return { statuses, summary }
  }

  const currentRecipients = recipientsByGroup[selectedRecipientGroup]
  const isRepliesView = activeView === "replies"
  const filterOptions = Array.from(
    new Set(
      currentRecipients
        .map((recipient) => (selectedRecipientGroup === "admins" ? recipient.role : recipient.halaqah).trim())
        .filter(Boolean),
    ),
  ).sort((first, second) => first.localeCompare(second, "ar"))

  const fetchReadyMessages = async () => {
    setIsLoadingReady(true)
    try {
      const res = await fetch("/api/whatsapp-ready-messages")
      const data = await res.json()
      if (data.messages) {
        setReadyMessages(data.messages)
      }
    } catch {
      setReadyMessages([])
    } finally {
      setIsLoadingReady(false)
    }
  }

  const fetchReplies = async () => {
    try {
      setIsRepliesLoading(true)
      const repliesResponse = await fetch("/api/whatsapp/replies", { cache: "no-store" })
      const repliesData = await repliesResponse.json().catch(() => ({}))

      if (repliesData.success && Array.isArray(repliesData.replies)) {
        setReplies(repliesData.replies)
        setFilteredReplies(repliesData.replies)
        return
      }

      throw new Error(repliesData.error || "فشل في جلب الردود")
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في جلب الردود",
        variant: "destructive",
      })
    } finally {
      setIsRepliesLoading(false)
    }
  }

  const toggleRepliesView = () => {
    setActiveView((currentView) => (currentView === "send" ? "replies" : "send"))
  }

  const handleAddReadyMessage = async () => {
    if (!quickText.trim()) {
      return
    }

    try {
      const res = await fetch("/api/whatsapp-ready-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: quickText }),
      })
      const data = await res.json()
      if (data.message) {
        setQuickText("")
        await fetchReadyMessages()
      }
    } catch {
      return
    }
  }

  const handleDeleteReadyMessage = async (id: number) => {
    try {
      await fetch("/api/whatsapp-ready-messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      await fetchReadyMessages()
    } catch {
      return
    }
  }

  const handleImageSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const resolvedMimeType = resolveAttachmentMimeType(file)

    if (!resolvedMimeType) {
      toast({
        title: "نوع غير مدعوم",
        description: "يمكن رفع JPG أو PNG أو WEBP أو PDF فقط.",
        variant: "destructive",
      })
      event.target.value = ""
      return
    }

    if (file.size > OUTBOUND_ATTACHMENT_MAX_SIZE_BYTES) {
      toast({
        title: "الملف كبير جدًا",
        description: "الرجاء اختيار ملف أصغر ثم إعادة المحاولة.",
        variant: "destructive",
      })
      event.target.value = ""
      return
    }

    try {
      const previewUrl = await readFileAsDataUrl(file)
      setImagePayload({
        base64: extractBase64FromDataUrl(previewUrl),
        mimeType: resolvedMimeType,
        fileName: file.name,
        previewUrl,
      })
    } catch (error) {
      console.error("Error reading outbound attachment:", error)
      toast({
        title: "تعذر قراءة الملف",
        description: "حاول اختيار ملف آخر أو أعد المحاولة.",
        variant: "destructive",
      })
      event.target.value = ""
    }
  }

  useEffect(() => {
    void fetchReadyMessages()
  }, [])

  useEffect(() => {
    if (displayMode !== "inline" || !onInlineActionsChange) {
      return
    }

    onInlineActionsChange({
      toggleRepliesView,
      isRepliesView,
    })

    return () => {
      onInlineActionsChange({
        toggleRepliesView: () => {},
        isRepliesView: false,
      })
    }
  }, [displayMode, isRepliesView, onInlineActionsChange])

  useEffect(() => {
    if (isRepliesView && replies.length === 0 && !isRepliesLoading) {
      void fetchReplies()
    }
  }, [isRepliesLoading, isRepliesView, replies.length])

  useEffect(() => {
    const normalizedSearchTerm = repliesSearchTerm.trim().toLowerCase()

    const nextReplies = replies.filter((reply) => {
      if (showUnreadOnly && reply.is_read) {
        return false
      }

      if (!normalizedSearchTerm) {
        return true
      }

      return (
        (reply.reply_message_text || "").toLowerCase().includes(normalizedSearchTerm) ||
        (reply.sent_message_text || "").toLowerCase().includes(normalizedSearchTerm) ||
        reply.student_name.toLowerCase().includes(normalizedSearchTerm)
      )
    })

    setFilteredReplies(nextReplies)
  }, [replies, repliesSearchTerm, showUnreadOnly])

  useEffect(() => {
    if (trackedQueuedIds.length === 0) {
      return
    }

    let cancelled = false

    const syncStatuses = async () => {
      try {
        const { summary } = await pollQueuedMessagesStatus(trackedQueuedIds)
        if (cancelled) {
          return
        }

        setSendResults({
          sent: summary.sent,
          pending: summary.pending,
          failed: summary.failed + localFailedCount,
        })

        if (summary.pending === 0) {
          setTrackedQueuedIds([])

          if (!completionToastShownRef.current) {
            completionToastShownRef.current = true
            if (summary.sent > 0 && summary.failed + localFailedCount === 0) {
              toast({
                title: "تم إرسال الرسائل",
                description: `تم إرسال ${summary.sent} رسالة واتساب بنجاح`,
              })
            } else {
              toast({
                title: summary.sent > 0 ? "اكتمل الإرسال جزئيًا" : "تعذر الإرسال",
                description: summary.sent > 0
                  ? `تم إرسال ${summary.sent} رسالة وتعذر إرسال ${summary.failed + localFailedCount}`
                  : `تعذر إرسال ${summary.failed + localFailedCount} رسالة`,
                variant: summary.sent > 0 ? "default" : "destructive",
              })
            }
          }
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        const offlineMessage = getOfflineErrorMessage(error)
        toast({
          title: offlineMessage || "تعذر تحديث حالة الرسائل",
          description: offlineMessage || (error instanceof Error ? error.message : "تعذر تحديث حالة الرسائل المرسلة"),
          variant: "destructive",
        })
      }
    }

    void syncStatuses()
    const intervalId = window.setInterval(() => {
      void syncStatuses()
    }, SEND_RESULTS_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [localFailedCount, toast, trackedQueuedIds])

  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true"
    const userRole = localStorage.getItem("userRole")

    if (!loggedIn || !userRole || userRole === "student" || userRole === "teacher" || userRole === "deputy_teacher") {
      router.push("/login")
      return
    }

    const fetchRecipients = async () => {
      try {
        const [studentsResponse, teachersResponse, adminsResponse] = await Promise.all([
          fetch("/api/students"),
          fetch("/api/teachers"),
          fetch("/api/admin-users?includeProtected=1"),
        ])

        const [studentsData, teachersData, adminsData] = await Promise.all([
          studentsResponse.json().catch(() => ({})),
          teachersResponse.json().catch(() => ({})),
          adminsResponse.json().catch(() => ({})),
        ])

        const guardians = Array.isArray(studentsData.students)
          ? studentsData.students
              .filter((student: any) => String(student.guardian_phone || "").trim())
              .map((student: any) => ({
                id: String(student.id),
                name: String(student.name || ""),
                phoneNumber: String(student.guardian_phone || "").trim(),
                accountNumber: String(student.account_number || ""),
                halaqah: String(student.halaqah || student.circle_name || "").trim(),
                role: "",
                group: "guardians" as const,
              }))
          : []

        const teachers = Array.isArray(teachersData.teachers)
          ? teachersData.teachers
              .filter((teacher: any) => String(teacher.phoneNumber || teacher.phone_number || "").trim())
              .map((teacher: any) => ({
                id: String(teacher.id),
                name: String(teacher.name || ""),
                phoneNumber: String(teacher.phoneNumber || teacher.phone_number || "").trim(),
                accountNumber: String(teacher.accountNumber || teacher.account_number || ""),
                halaqah: String(teacher.halaqah || "").trim(),
                role: String(teacher.role || "teacher"),
                group: "teachers" as const,
              }))
          : []

        const admins = Array.isArray(adminsData.users)
          ? adminsData.users
              .filter((user: any) => String(user.phone_number || "").trim())
              .map((user: any) => ({
                id: String(user.id),
                name: String(user.name || ""),
                phoneNumber: String(user.phone_number || "").trim(),
                accountNumber: String(user.account_number || ""),
                halaqah: "",
                role: String(user.role || ""),
                group: "admins" as const,
              }))
          : []

        setRecipientsByGroup({ guardians, teachers, admins })
      } catch (error) {
        console.error("Error fetching recipients:", error)
        toast({
          title: "خطأ",
          description: "فشل في جلب بيانات المستلمين",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    void fetchRecipients()
  }, [router, toast])

  useEffect(() => {
    let nextRecipients = [...currentRecipients]

    if (selectedFilter !== "all") {
      nextRecipients = nextRecipients.filter((recipient) => {
        const candidate = selectedRecipientGroup === "admins" ? recipient.role : recipient.halaqah
        return candidate.trim() === selectedFilter
      })
    }

    if (searchTerm.trim()) {
      const normalizedSearch = searchTerm.toLowerCase()
      nextRecipients = nextRecipients.filter((recipient) =>
        recipient.name.toLowerCase().includes(normalizedSearch) ||
        recipient.phoneNumber.includes(searchTerm) ||
        recipient.accountNumber.includes(searchTerm) ||
        recipient.halaqah.toLowerCase().includes(normalizedSearch) ||
        recipient.role.toLowerCase().includes(normalizedSearch),
      )
    }

    setFilteredRecipients(nextRecipients)
  }, [currentRecipients, searchTerm, selectedFilter, selectedRecipientGroup])

  const handleChangeRecipientGroup = (value: string) => {
    const nextGroup = value as RecipientGroup
    setSelectedRecipientGroup(nextGroup)
    setSelectedRecipients([])
    setSelectedFilter("all")
    setSearchTerm("")
    setSendResults(null)
  }

  const handleSelectAll = () => {
    const filteredIds = filteredRecipients.map((recipient) => recipient.id)
    const areAllFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedRecipients.includes(id))

    if (areAllFilteredSelected) {
      setSelectedRecipients((prev) => prev.filter((id) => !filteredIds.includes(id)))
      return
    }

    setSelectedRecipients((prev) => Array.from(new Set([...prev, ...filteredIds])))
  }

  const handleSelectRecipient = (recipientId: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(recipientId) ? prev.filter((id) => id !== recipientId) : [...prev, recipientId],
    )
  }

  const handleSendMessages = async () => {
    if (isWhatsAppStatusLoading) {
      return
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast({
        title: "لا يوجد اتصال بالإنترنت",
        description: "تحقق من اتصالك بالإنترنت ثم أعد المحاولة.",
        variant: "destructive",
      })
      return
    }

    if (selectedRecipients.length === 0) {
      toast({
        title: "تنبيه",
        description: `الرجاء اختيار ${RECIPIENT_GROUP_LABELS[selectedRecipientGroup]} أولاً`,
        variant: "destructive",
      })
      return
    }

    if (!message.trim() && !imagePayload) {
      toast({
        title: "تنبيه",
        description: "الرجاء كتابة نص الرسالة أو إرفاق صورة",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setSendResults(null)

    if (!sendResults || sendResults.pending === 0) {
      setLocalFailedCount(0)
    }

    const selectedRecipientsData = currentRecipients.filter((recipient) => selectedRecipients.includes(recipient.id))

    if (!isWhatsAppReady) {
      toast({
        title: "عامل واتساب غير جاهز",
        description: "شغّل عامل واتساب المحلي أو اربط الخادم ثم أعد المحاولة.",
        variant: "destructive",
      })
      setIsSending(false)
      return
    }

    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          media: imagePayload
            ? {
                mimeType: imagePayload.mimeType,
                base64: imagePayload.base64,
                fileName: imagePayload.fileName,
              }
            : null,
          recipients: selectedRecipientsData.map((recipient) => ({
            phoneNumber: recipient.phoneNumber,
            userId: recipient.id,
            message: resolveMessageTemplate(message, recipient),
          })),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        if (response.status === 409) {
          toast({
            title: "عامل واتساب غير جاهز",
            description: data.error || "شغّل عامل واتساب المحلي أو اربط الخادم ثم أعد المحاولة.",
            variant: "destructive",
          })
          return
        }
        throw new Error(data.error || "فشل في تجهيز رسائل واتساب")
      }

      const queuedCount = Number(data.queuedCount) || 0
      const failedCount = Number(data.failedCount) || 0
      const queuedIds = Array.isArray(data.queuedIds) ? data.queuedIds.filter((value: unknown) => typeof value === "string") : []

      if (queuedCount > 0) {
        completionToastShownRef.current = false
        setTrackedQueuedIds((previous) => {
          const nextIds = sendResults && sendResults.pending > 0 ? [...previous, ...queuedIds] : queuedIds
          return Array.from(new Set(nextIds))
        })
        setLocalFailedCount((previous) => (sendResults && sendResults.pending > 0 ? previous : 0) + failedCount)

        setSendResults((previous) => ({
          sent: previous && previous.pending > 0 ? previous.sent : 0,
          pending: (previous && previous.pending > 0 ? previous.pending : 0) + queuedCount,
          failed: (previous && previous.pending > 0 ? previous.failed : 0) + failedCount,
        }))
      }

      if (queuedCount > 0) {
        toast({
          title: "بدأ إرسال الرسائل",
          description: failedCount > 0
            ? `جارٍ تحديث الحالة الفعلية الآن، وتعذر تجهيز ${failedCount} رسالة.`
            : "جارٍ تحديث عدد تم الإرسال وقيد الانتظار بشكل مباشر.",
        })

        setMessage("")
        setImagePayload(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        setSelectedRecipients([])
      } else {
        toast({
          title: "فشل",
          description: data.error || "لم يتم تجهيز أي رسالة للإرسال",
          variant: "destructive",
        })
      }
    } catch (error) {
      const offlineMessage = getOfflineErrorMessage(error)
      toast({
        title: offlineMessage || "فشل",
        description: offlineMessage || (error instanceof Error ? error.message : "حدث خطأ أثناء تجهيز رسائل واتساب"),
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const markReplyAsRead = async (replyId: string) => {
    try {
      const response = await fetch("/api/whatsapp/replies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId, isRead: true }),
      })

      if (!response.ok) {
        throw new Error("update failed")
      }

      setReplies((prev) => prev.map((reply) => (reply.id === replyId ? { ...reply, is_read: true } : reply)))
    } catch {
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة الرد",
        variant: "destructive",
      })
    }
  }

  const deleteReply = async (replyId: string) => {
    const confirmed = await confirmDialog({
      title: "حذف الرد",
      description: "سيتم حذف هذا الرد من صفحة العرض. هل تريد المتابعة؟",
      confirmText: "حذف",
      cancelText: "تراجع",
    })

    if (!confirmed) {
      return
    }

    try {
      setDeletingReplyId(replyId)
      const response = await fetch("/api/whatsapp/replies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId }),
      })

      if (!response.ok) {
        throw new Error("delete failed")
      }

      setReplies((prev) => prev.filter((reply) => reply.id !== replyId))
      toast({
        title: "تم",
        description: "تم حذف الرد",
      })
    } catch {
      toast({
        title: "خطأ",
        description: "فشل في حذف الرد",
        variant: "destructive",
      })
    } finally {
      setDeletingReplyId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SiteLoader size="lg" />
      </div>
    )
  }

  if (authLoading || !authVerified) {
    return <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]"><SiteLoader size="md" /></div>
  }

  const allFilteredSelected = filteredRecipients.length > 0 && filteredRecipients.every((recipient) => selectedRecipients.includes(recipient.id))

  const content = (
    <div className="container mx-auto max-w-[2200px] px-2 md:px-8 lg:px-16">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-[var(--challenge-primary)] md:text-4xl">
                  <MessageCircle className="h-8 w-8 text-[var(--primary)]" />
                  إرسال عبر الواتس
                </h1>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {!isRepliesView ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={whatsappOutlinePillClass}
                      >
                        القوالب
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" side="bottom" className="w-[min(92vw,30rem)] space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 text-right shadow-[0_16px_40px_rgba(19,39,89,0.12)]">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-[var(--challenge-primary)]">القوالب</div>
                        <div className="text-xs text-neutral-500">أضف رسالة جاهزة ثم أدرجها داخل النص الحالي.</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          placeholder="اكتب نص لإضافته كرسالة جاهزة"
                          value={quickText}
                          onChange={(event) => setQuickText(event.target.value)}
                          className="text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="theme-admin-input text-sm h-9 rounded-lg text-neutral-600"
                          onClick={handleAddReadyMessage}
                        >
                          إضافة
                        </Button>
                      </div>
                      <div className="max-h-72 space-y-2 overflow-y-auto">
                        {isLoadingReady ? (
                          <div className="py-3"><SiteLoader /></div>
                        ) : readyMessages.length === 0 ? (
                          <div className="text-xs text-gray-400">لا توجد قوالب جاهزة</div>
                        ) : (
                          readyMessages.map((msg) => (
                            <div key={msg.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="mb-2 text-xs leading-6 text-gray-700">{msg.text}</div>
                              <div className="flex items-center gap-2">
                                <Button type="button" size="sm" variant="outline" className="theme-admin-input text-sm h-8 rounded-lg text-neutral-600" onClick={() => setMessage((prev) => prev ? `${prev}\n${msg.text}` : msg.text)}>
                                  إدراج
                                </Button>
                                <Button type="button" size="sm" variant="outline" className="text-sm h-8 rounded-lg border-red-300 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteReadyMessage(msg.id)}>
                                  حذف
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : null}
                {displayMode !== "inline" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={toggleRepliesView}
                    className={whatsappOutlinePillClass}
                  >
                    {isRepliesView ? "عرض الإرسال" : "عرض الردود"}
                  </Button>
                ) : null}
              </div>
            </div>

            {isRepliesView ? (
              <div className="space-y-6">
                <Card className={whatsappCardClass}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="flex flex-1 items-center gap-2">
                        <Search className="h-5 w-5 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="بحث بالاسم أو نص الرسالة..."
                          value={repliesSearchTerm}
                          onChange={(event) => setRepliesSearchTerm(event.target.value)}
                          className="flex-1"
                        />
                      </div>
                      <Button
                        type="button"
                        variant={showUnreadOnly ? "default" : "outline"}
                        onClick={() => setShowUnreadOnly((prev) => !prev)}
                        className={showUnreadOnly ? "theme-pill-solid" : "theme-pill-outline"}
                      >
                        غير المقروء فقط
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className={whatsappCardClass}>
                  <CardHeader>
                    <CardTitle className="text-[var(--challenge-primary)]">الردود المستلمة ({filteredReplies.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isRepliesLoading ? (
                      <div className="flex min-h-[220px] items-center justify-center">
                        <SiteLoader size="md" />
                      </div>
                    ) : filteredReplies.length === 0 ? (
                      <div className="py-12 text-center text-gray-500">
                        <MessageCircle className="mx-auto mb-4 h-16 w-16 opacity-50" />
                        <p>لا توجد ردود</p>
                      </div>
                    ) : (
                      filteredReplies.map((reply) => {
                        const replyAudioSrc = buildMediaSrc(reply.media_base64, reply.media_mime_type)
                        const sentImageSrc = buildMediaSrc(reply.sent_media_base64, reply.sent_media_mime_type)

                        return (
                          <div key={reply.id} className={`rounded-2xl border p-4 md:p-5 ${reply.is_read ? "border-slate-200 bg-white" : "theme-admin-muted-surface"}`}>
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[var(--challenge-primary)]">
                                  {reply.is_read ? <CheckCheck className="h-5 w-5 text-green-600" /> : <MessageCircle className="h-5 w-5 text-[var(--primary)]" />}
                                  <h3 className="text-lg font-bold">{reply.student_name}</h3>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {!reply.is_read ? (
                                  <Button type="button" onClick={() => void markReplyAsRead(reply.id)} size="sm" className="theme-pill-solid">
                                    تحديد كمقروء
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  onClick={() => void deleteReply(reply.id)}
                                  size="sm"
                                  variant="outline"
                                  disabled={deletingReplyId === reply.id}
                                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="me-1.5 h-4 w-4" />
                                  {deletingReplyId === reply.id ? "جاري الحذف..." : "حذف"}
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className={whatsappSoftPanelClass}>
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                                  <Send className="h-4 w-4" />
                                  الرسالة المرسلة
                                </div>
                                {sentImageSrc ? (
                                  <div className="space-y-3">
                                    <img src={sentImageSrc} alt="الصورة المرسلة" className="h-48 w-full rounded-xl border border-[var(--border)] object-cover" />
                                    {reply.sent_message_text ? <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--challenge-primary)]">{reply.sent_message_text}</p> : <p className="text-sm leading-7 text-[var(--challenge-primary)]">تم إرسال صورة بدون نص مرفق.</p>}
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--challenge-primary)]">{reply.sent_message_text}</p>
                                )}
                              </div>

                              <div className={whatsappSoftPanelClass}>
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                                  {reply.reply_type === "audio" || reply.reply_type === "ptt" ? <Mic className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                                  أول رد من ولي الأمر
                                </div>
                                {replyAudioSrc ? (
                                  <div className="space-y-3">
                                    <audio controls preload="none" className="w-full">
                                      <source src={replyAudioSrc} type={reply.media_mime_type || "audio/ogg"} />
                                      المتصفح الحالي لا يدعم تشغيل الصوت.
                                    </audio>
                                    <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--challenge-primary)]">{reply.reply_message_text}</p>
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--challenge-primary)]">{reply.reply_message_text}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
            <div className="flex flex-col gap-6">
              <div className="order-1">
                <Card className={whatsappCardClass}>
                  <CardHeader>
                    <CardTitle className="text-[var(--challenge-primary)]">اختيار المستلمين</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <input
                      ref={fileInputRef}
                      id="whatsapp-image"
                      type="file"
                      accept={OUTBOUND_ATTACHMENT_MIME_TYPES.join(",")}
                      onChange={handleImageSelection}
                      className="hidden"
                    />

                    <div className="theme-admin-muted-surface flex items-end gap-3 rounded-2xl px-3 py-3">
                      <Textarea
                        id="message"
                        placeholder="اكتب رسالتك هنا..."
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        rows={3}
                        className="min-h-[72px] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        title={imagePayload?.fileName || "رفع ملف"}
                        className={`theme-admin-input h-11 w-11 rounded-2xl bg-white text-[var(--primary)] ${imagePayload ? "border-[var(--primary)] bg-[var(--button-outline-hover)]" : ""}`}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {sendResults ? (
                        <>
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تم الإرسال {sendResults.sent}</span>
                          </div>
                          <div className="flex items-center gap-2 text-amber-600">
                            <CircleAlert className="w-4 h-4" />
                            <span>قيد الانتظار {sendResults.pending}</span>
                          </div>
                        </>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[220px_220px_minmax(0,1fr)_auto] gap-3">
                      <Select value={selectedRecipientGroup} onValueChange={handleChangeRecipientGroup}>
                        <SelectTrigger className={`w-full ${whatsappInputAccentClass}`}>
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="guardians">أولياء الأمور</SelectItem>
                          <SelectItem value="teachers">المعلمين</SelectItem>
                          <SelectItem value="admins">الإداريين</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                        <SelectTrigger className={`w-full ${whatsappInputAccentClass}`}>
                          <SelectValue placeholder={getRecipientFilterLabel(selectedRecipientGroup)} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{getRecipientFilterLabel(selectedRecipientGroup)}</SelectItem>
                          {filterOptions.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="text"
                        placeholder="بحث بالاسم أو رقم الهاتف أو رقم الحساب..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className={whatsappInputAccentClass}
                      />

                      <Button
                        onClick={handleSelectAll}
                        variant="outline"
                        className="theme-admin-input text-sm h-9 rounded-lg whitespace-nowrap text-neutral-600"
                      >
                        {allFilteredSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
                      </Button>
                    </div>

                    <div className="max-h-[600px] overflow-y-auto space-y-2">
                      {filteredRecipients.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p>لا توجد نتائج في {RECIPIENT_GROUP_LABELS[selectedRecipientGroup]}</p>
                        </div>
                      ) : (
                        filteredRecipients.map((recipient) => (
                          <label
                            key={recipient.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-all ${selectedRecipients.includes(recipient.id) ? "theme-chip-selected border-[var(--primary)]" : "border-gray-200 hover:border-[var(--primary)]"}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRecipients.includes(recipient.id)}
                              onChange={() => handleSelectRecipient(recipient.id)}
                              className="h-5 w-5 rounded text-[var(--primary)]"
                            />
                            <div className="flex-1">
                              <p className="font-semibold text-[var(--challenge-primary)]">{recipient.name}</p>
                              <p className="text-sm text-gray-600 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {formatGuardianPhoneForDisplay(recipient.phoneNumber)}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-[var(--primary)]">{getRecipientSecondaryLabel(recipient)}</p>
                            </div>
                            <div className="text-sm text-gray-500">#{recipient.accountNumber || "-"}</div>
                          </label>
                        ))
                      )}
                    </div>

                    <Button
                      onClick={handleSendMessages}
                      disabled={isSending || isWhatsAppStatusLoading || selectedRecipients.length === 0 || (!message.trim() && !imagePayload)}
                      variant="outline"
                      className="w-full text-sm h-9 rounded-lg border-[var(--button-outline-border)] bg-[var(--button-gradient)] !text-white hover:brightness-105 hover:!text-white focus-visible:!text-white active:!text-white disabled:!text-white disabled:opacity-60"
                    >
                      {isSending ? "جاري الإرسال" : <><Send className="w-4 h-4 ml-2" />إرسال</>}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
            )}
          </div>
    </div>
  )

  if (isEmbedded) {
    return <div className="min-h-full bg-white px-3 py-4 md:px-4 md:py-8 lg:py-12">{content}</div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 py-4 md:py-8 lg:py-12 px-3 md:px-4">{content}</main>
      <Footer />
    </div>
  )
}

export default function WhatsAppSendPage() {
  return <WhatsAppSendContent displayMode="page" />
}
