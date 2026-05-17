"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SiteLoader } from "@/components/ui/site-loader"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Archive, ArchiveX, CheckCircle, Clock, Mail, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useAdminAuth } from "@/hooks/use-admin-auth"

interface ContactMessage {
  id: string
  name: string
  subject: string
  message: string
  status: "unread" | "read" | "archived"
  created_at: string
}

const subjectLabels: Record<string, string> = {
  inquiry: "استفسار عام",
  registration: "التسجيل في الحلقات",
  programs: "الاستفسار عن البرامج",
  complaint: "شكوى أو اقتراح",
  other: "أخرى",
}

export default function ReportsPage() {
  return <ReportsPageContent displayMode="page" />
}

export function ReportsPageContent({
  displayMode = "page",
  onInlineActionsChange,
}: {
  displayMode?: "page" | "inline"
  onInlineActionsChange?: (actions: {
    filter: "all" | "unread" | "read" | "archived"
    showAll: () => void
    showUnread: () => void
    showRead: () => void
    showArchived: () => void
  }) => void
}) {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("تقارير الرسائل");
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread" | "read" | "archived">("all")

  useEffect(() => {
    if (!authVerified) return
    fetchMessages()
  }, [authVerified])

  useEffect(() => {
    if (!onInlineActionsChange) {
      return
    }

    onInlineActionsChange({
      filter,
      showAll: () => setFilter("all"),
      showUnread: () => setFilter("unread"),
      showRead: () => setFilter("read"),
      showArchived: () => setFilter("archived"),
    })
  }, [filter, onInlineActionsChange])

  const fetchMessages = async () => {
    try {
      const response = await fetch("/api/contact")
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error("[v0] Error fetching messages:", error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch("/api/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "read" }),
      })

      if (response.ok) {
        setMessages(messages.map((msg) => (msg.id === id ? { ...msg, status: "read" as const } : msg)))
      }
    } catch (error) {
      console.error("[v0] Error updating message:", error)
    }
  }

  const archiveMessage = async (id: string) => {
    try {
      const response = await fetch("/api/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "archived" }),
      })

      if (response.ok) {
        setMessages(messages.map((msg) => (msg.id === id ? { ...msg, status: "archived" as const } : msg)))
      }
    } catch (error) {
      console.error("[v0] Error archiving message:", error)
    }
  }

  const unarchiveMessage = async (id: string) => {
    try {
      const response = await fetch("/api/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "read" }),
      })

      if (response.ok) {
        setMessages(messages.map((msg) => (msg.id === id ? { ...msg, status: "read" as const } : msg)))
      }
    } catch (error) {
      console.error("[v0] Error unarchiving message:", error)
    }
  }

  const deleteMessage = async (id: string) => {
    try {
      const response = await fetch(`/api/contact?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setMessages(messages.filter((msg) => msg.id !== id))
      }
    } catch (error) {
      console.error("[v0] Error deleting message:", error)
    }
  }

  const filteredMessages = messages.filter((msg) => {
    if (filter === "all") return true
    return msg.status === filter
  })

  const unreadCount = messages.filter((msg) => msg.status === "unread").length

  const formatDate = (dateString: string) => {
    // تأكد من أن التاريخ يتم تفسيره كـ UTC إذا لم يحتوي على معلومات المنطقة الزمنية
    const date = new Date(dateString.includes("Z") || dateString.includes("+") ? dateString : dateString + "Z")
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "الآن"
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `منذ ${diffInHours} ساعة`

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays === 1) return "منذ يوم واحد"
    if (diffInDays < 7) return `منذ ${diffInDays} أيام`

    return date.toLocaleDateString("ar-SA")
  }

  if (authLoading || !authVerified) return (<div className="min-h-screen flex items-center justify-center bg-[#fafaf9]"><SiteLoader size="md" /></div>);

  const content = (
    <div className="space-y-5" dir="rtl">
      {displayMode === "page" ? (
        <div className="space-y-2 px-1">
          <h1 className="text-3xl font-black text-[#1a2332] md:text-4xl">تقارير الرسائل</h1>
          <p className="text-sm font-medium text-[#6c7d95]">جميع الرسائل الواردة من صفحة تواصل معنا داخل جدول موحّد.</p>
        </div>
      ) : null}

      {displayMode === "page" ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Button onClick={() => setFilter("all")} variant={filter === "all" ? "default" : "outline"} className={filter === "all" ? "bg-[#3453a7] hover:bg-[#24428f]" : "border-[#d8e5fb] text-[#3453a7]"}>الكل</Button>
          <Button onClick={() => setFilter("unread")} variant={filter === "unread" ? "default" : "outline"} className={filter === "unread" ? "bg-[#3453a7] hover:bg-[#24428f]" : "border-[#d8e5fb] text-[#3453a7]"}>غير مقروءة</Button>
          <Button onClick={() => setFilter("read")} variant={filter === "read" ? "default" : "outline"} className={filter === "read" ? "bg-[#3453a7] hover:bg-[#24428f]" : "border-[#d8e5fb] text-[#3453a7]"}>مقروءة</Button>
          <Button onClick={() => setFilter("archived")} variant={filter === "archived" ? "default" : "outline"} className={filter === "archived" ? "bg-[#3453a7] hover:bg-[#24428f]" : "border-[#d8e5fb] text-[#3453a7]"}>مؤرشفة</Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.7rem] border border-[#e2eaf7] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center py-12">
            <SiteLoader />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center text-[#7b8aa0]">
            <Mail className="h-12 w-12" />
            <p className="text-lg font-semibold">لا توجد رسائل</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f8fbff] hover:bg-[#f8fbff]">
                  <TableHead className="text-right font-extrabold text-[#20335f]">الاسم</TableHead>
                  <TableHead className="text-right font-extrabold text-[#20335f]">التصنيف</TableHead>
                  <TableHead className="text-right font-extrabold text-[#20335f]">الحالة</TableHead>
                  <TableHead className="text-right font-extrabold text-[#20335f]">الوقت</TableHead>
                  <TableHead className="min-w-[360px] text-right font-extrabold text-[#20335f]">الرسالة</TableHead>
                  <TableHead className="text-right font-extrabold text-[#20335f]">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((message) => (
                  <TableRow key={message.id} className={message.status === "unread" ? "bg-[#fffdf7]" : message.status === "archived" ? "bg-[#fafafa]" : "bg-white"}>
                    <TableCell className="align-top font-bold text-[#1a2332]">{message.name}</TableCell>
                    <TableCell className="align-top text-[#4d5d75]">{subjectLabels[message.subject]}</TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant={message.status === "unread" ? "default" : "secondary"}
                        className={message.status === "unread" ? "bg-[#3453a7]" : message.status === "archived" ? "bg-[#6b7280] text-white" : "bg-[#e8eefb] text-[#3453a7]"}
                      >
                        {message.status === "unread" ? "جديدة" : message.status === "archived" ? "مؤرشفة" : "مقروءة"}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top text-sm font-semibold text-[#6c7d95]">
                      <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{formatDate(message.created_at)}</span>
                    </TableCell>
                    <TableCell className="max-w-[520px] whitespace-pre-wrap align-top text-sm leading-7 text-[#334155]">{message.message}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex min-w-[210px] flex-wrap items-center justify-end gap-2">
                        {message.status === "unread" ? (
                          <Button onClick={() => markAsRead(message.id)} size="sm" className="bg-[#3453a7] hover:bg-[#24428f]">
                            <CheckCircle className="me-1 h-4 w-4" />
                            تعليم كمقروءة
                          </Button>
                        ) : null}
                        {message.status === "archived" ? (
                          <Button onClick={() => unarchiveMessage(message.id)} size="sm" className="bg-[#3453a7] hover:bg-[#24428f]">
                            <ArchiveX className="me-1 h-4 w-4" />
                            إلغاء الأرشفة
                          </Button>
                        ) : (
                          <Button onClick={() => archiveMessage(message.id)} size="sm" variant="outline" className="border-[#d8e5fb] text-[#3453a7] hover:bg-[#f6f9ff]">
                            <Archive className="me-1 h-4 w-4" />
                            أرشفة
                          </Button>
                        )}
                        <Button onClick={() => deleteMessage(message.id)} size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                          <Trash2 className="me-1 h-4 w-4" />
                          حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )

  if (displayMode === "inline") {
    return <div className="px-1 py-1">{content}</div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-white" dir="rtl">
      <Header />
      <main className="flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="container mx-auto max-w-7xl">{content}</div>
      </main>
      <Footer />
    </div>
  )
}
