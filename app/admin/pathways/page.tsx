"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SiteLoader } from "@/components/ui/site-loader"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import {
  DEFAULT_PATHWAY_LEVEL_NOTIFICATION_TEMPLATES,
  normalizePathwayLevelNotificationTemplates,
  PATHWAY_LEVEL_NOTIFICATION_SETTINGS_ID,
  type PathwayLevelNotificationTemplates,
} from "@/lib/pathway-notification-templates"

import {
  Bell,
  Lock,
  Unlock,
  Plus,
  Trash2,
  FileText,
  Pencil,
  Video,
  LinkIcon,
  Upload,
} from "lucide-react"

const ALL_HALAQAH_VALUE = "all"

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

interface Level {
  id: number
  level_number: number
  title: string
  description: string | null
  points: number
  is_locked: boolean
  half_points_applied: boolean
}

interface LevelContent {
  id: string
  content_title: string
  content_description?: string
  content_url: string
  content_type: "pdf" | "video" | "link"
}

interface Quiz {
  id: number
  question: string
  options: string[]
  correctAnswer: number
}

function dedupeLevels(levels: Level[]) {
  const levelMap = new Map<number, Level>()

  for (const level of levels) {
    if (!levelMap.has(level.level_number)) {
      levelMap.set(level.level_number, level)
    }
  }

  return Array.from(levelMap.values()).sort((left, right) => left.level_number - right.level_number)
}

function dedupeContents(items: LevelContent[]) {
  const contentMap = new Map<string, LevelContent>()

  for (const item of items) {
    const key = [item.content_title, item.content_description || "", item.content_url, item.content_type].join("::")
    if (!contentMap.has(key)) {
      contentMap.set(key, item)
    }
  }

  return Array.from(contentMap.values())
}

function dedupeQuizzes(items: Quiz[]) {
  const quizMap = new Map<string, Quiz>()

  for (const item of items) {
    const key = [item.question, JSON.stringify(item.options), item.correctAnswer].join("::")
    if (!quizMap.has(key)) {
      quizMap.set(key, item)
    }
  }

  return Array.from(quizMap.values())
}

/* -------------------------------------------------------------------------- */

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function PathwaysContent({
  displayMode = "page",
  onInlineActionsChange,
}: {
  displayMode?: "page" | "inline"
  onInlineActionsChange?: (actions: { openTemplates: () => void; openResults: () => void; openAddLevel: () => void }) => void
}) {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("إدارة المسار");

  useEffect(() => {
    if (displayMode !== "inline" || !onInlineActionsChange) {
      return
    }

    onInlineActionsChange({
      openTemplates: () => setShowNotificationTemplateModal(true),
      openResults: () => {
        void loadLevelResults()
        setShowResultsModal(true)
      },
      openAddLevel: () => openAddLevelModal(),
    })

    return () => {
      onInlineActionsChange({
        openTemplates: () => {},
        openResults: () => {},
        openAddLevel: () => {},
      })
    }
  }, [displayMode, onInlineActionsChange])
  const searchParams = useSearchParams()
  const isEmbedded = displayMode === "inline" || searchParams.get("embedded") === "1"

    // قيمة النقاط داخل نافذة تعديل المستوى
    const [pointsEditValue, setPointsEditValue] = useState<number>(0);
  const router = useRouter()

  const [levels, setLevels] = useState<Level[]>([])
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const [selectedHalaqah, setSelectedHalaqah] = useState<string>("")
  const [circles, setCircles] = useState<{ id: string; name: string }[]>([]);

  const [contents, setContents] = useState<Record<number, LevelContent[]>>({})
  const [quizzes, setQuizzes] = useState<Record<number, Quiz[]>>({})

  const [showContentForm, setShowContentForm] = useState(false)
  const [showQuizForm, setShowQuizForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddLevelModal, setShowAddLevelModal] = useState(false)
  const [showNotificationTemplateModal, setShowNotificationTemplateModal] = useState(false)
  const [isSavingNotificationTemplate, setIsSavingNotificationTemplate] = useState(false)
  const [notificationTemplates, setNotificationTemplates] = useState<PathwayLevelNotificationTemplates>(DEFAULT_PATHWAY_LEVEL_NOTIFICATION_TEMPLATES)
  const [newLevelTitle, setNewLevelTitle] = useState("")
  const [newLevelPoints, setNewLevelPoints] = useState<number>(100)
  const [newLevelHalaqah, setNewLevelHalaqah] = useState("")
  const [isAddingLevel, setIsAddingLevel] = useState(false)

  const [notification, setNotification] = useState<string>("")
  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(""), 3000)
  }
  const isAllHalaqahSelected = selectedHalaqah === ALL_HALAQAH_VALUE

  /* ------------------------------ Content Form ----------------------------- */
  const [contentTitle, setContentTitle] = useState("")
  const [contentDescription, setContentDescription] = useState("")
  const [contentUrl, setContentUrl] = useState("")
  const [contentType, setContentType] =
    useState<LevelContent["content_type"]>("link")
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  /* ------------------------------- Quiz Form -------------------------------- */
  const [quizQuestion, setQuizQuestion] = useState("")
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""])
  const [correctAnswer, setCorrectAnswer] = useState(0)

  /* ------------------------------ Edit Level Modal ----------------------------- */
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [levelResults, setLevelResults] = useState<any[]>([])
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")

  /* -------------------------------------------------------------------------- */
  /*                                   EFFECTS                                  */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true"
    const role = localStorage.getItem("userRole")

    if (!loggedIn || !role || role === "student" || role === "teacher" || role === "deputy_teacher") {
      router.push("/login")
      return
    }

    loadLevels()
    fetchCircles()
    loadNotificationTemplates()
  }, [])

  useEffect(() => {
    if (selectedHalaqah) {
      void loadLevels(selectedHalaqah)
      setSelectedLevel(null)
      setNewLevelHalaqah(selectedHalaqah)
    }
  }, [selectedHalaqah])

  useEffect(() => {
    if (selectedLevel && selectedHalaqah) {
      loadContents()
      loadQuizzes()
    }
  }, [selectedLevel, selectedHalaqah])

  useEffect(() => {
    if (!levels.some((item) => item.level_number === selectedLevel)) {
      setShowContentForm(false)
      setShowQuizForm(false)
    }
  }, [levels, selectedLevel])

  /* -------------------------------------------------------------------------- */
  /*                                   LOADERS                                  */
  /* -------------------------------------------------------------------------- */

  async function fetchCircles() {
    try {
      const res = await fetch('/api/circles');
      const data = await res.json();
      if (data.circles) {
        setCircles(data.circles);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadLevels(halaqah = selectedHalaqah) {
    if (!halaqah) return [] as Level[]
    const supabase = getSupabase()
    let query = supabase.from("pathway_levels").select("*").order("level_number")

    if (halaqah !== ALL_HALAQAH_VALUE) {
      query = query.eq("halaqah", halaqah)
    }

    const { data, error } = await query

    if (!error && data) {
      const nextLevels = halaqah === ALL_HALAQAH_VALUE ? dedupeLevels(data as Level[]) : (data as Level[])
      setLevels(nextLevels)
      return nextLevels
    }

    return [] as Level[]
  }

  async function loadNotificationTemplates() {
    try {
      const response = await fetch(`/api/site-settings?id=${PATHWAY_LEVEL_NOTIFICATION_SETTINGS_ID}`, { cache: "no-store" })
      if (!response.ok) {
        return
      }

      const data = await response.json()
      setNotificationTemplates(normalizePathwayLevelNotificationTemplates(data.value))
    } catch (error) {
      console.error("[admin-pathways] load notification templates:", error)
    }
  }

  async function loadContents() {
    const params = new URLSearchParams({ level_id: String(selectedLevel) })
    if (!isAllHalaqahSelected) {
      params.set("halaqah", selectedHalaqah)
    }

    const res = await fetch(`/api/pathway-contents?${params.toString()}`)
    const json = await res.json()
    const nextContents = Array.isArray(json.contents) ? json.contents : []
    setContents((p) => ({ ...p, [selectedLevel]: isAllHalaqahSelected ? dedupeContents(nextContents) : nextContents }))
  }

  async function loadLevelResults() {
    if (!selectedLevel || !selectedHalaqah) return;
    setIsLoadingResults(true);
    const supabase = getSupabase()
    let query = supabase
      .from("pathway_level_completions")
      .select("id, student_id, points, level_number, students!inner(name, halaqah)")
      .eq("level_number", selectedLevel)

    if (!isAllHalaqahSelected) {
      query = query.eq("students.halaqah", selectedHalaqah)
    }

    const { data, error } = await query;
    
    if (!error && data) {
      setLevelResults(data.map((r: any) => ({
        id: r.id,
        student_id: r.student_id,
        points: r.points,
        student_name: r.students?.name || "-",
      })));
    } else {
      setLevelResults([]);
    }
    setIsLoadingResults(false);
  }

  async function loadQuizzes() {
    const supabase = getSupabase()
    let query = supabase
      .from("pathway_level_questions").select("*").eq("level_number", selectedLevel)

    if (!isAllHalaqahSelected) {
      query = query.eq("halaqah", selectedHalaqah)
    }

    const { data } = await query.order("id")

    if (data) {
      const nextQuizzes = data.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correct_answer,
      }))

      setQuizzes((p) => ({
        ...p,
        [selectedLevel]: isAllHalaqahSelected ? dedupeQuizzes(nextQuizzes) : nextQuizzes,
      }))
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                  HANDLERS                                  */
  /* -------------------------------------------------------------------------- */

  async function handleAddContent() {
    if (!level) {
      showNotification("اختر مستوى أولاً")
      return
    }

    if (!contentTitle) return

    let finalUrl = contentUrl

    if (uploadMode === "file" && selectedFile) {
      const supabase = getSupabase()
      setIsUploading(true)
      const ext = selectedFile.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error } = await supabase.storage
        .from("Contact")
        .upload(fileName, selectedFile, { upsert: false })

      if (error) {
        showNotification("فشل رفع الملف: " + error.message)
        setIsUploading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from("Contact")
        .getPublicUrl(fileName)
      finalUrl = urlData.publicUrl
      setIsUploading(false)
    }

    if (!finalUrl) return

    const response = await fetch("/api/pathway-contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level_id: selectedLevel,
        halaqah: selectedHalaqah,
        content_title: contentTitle,
        content_description: contentDescription,
        content_url: finalUrl,
        content_type: contentType,
      }),
    })

    if (!response.ok) {
      showNotification("حدث خطأ أثناء إضافة المحتوى")
      return
    }

    setShowContentForm(false)
    setContentTitle("")
    setContentDescription("")
    setContentUrl("")
    setSelectedFile(null)
    setUploadMode("url")
    await loadContents()
    await notifyLevelUpdated("تمت إضافة المحتوى")
  }

  async function handleDeleteContent(id: string) {
    if (isAllHalaqahSelected) {
      showNotification("اختر حلقة محددة إذا أردت حذف المحتوى")
      return
    }

    await fetch(`/api/pathway-contents?id=${id}`, { method: "DELETE" })
    loadContents()
  }

  async function handleAddQuiz() {
    if (!level) {
      showNotification("اختر مستوى أولاً")
      return
    }

    if (!quizQuestion || quizOptions.some((o) => !o)) return

    const supabase = getSupabase()
    const targetHalaqat = isAllHalaqahSelected ? circles.map((circle) => circle.name) : [selectedHalaqah]
    const { error } = await supabase.from("pathway_level_questions").insert(
      targetHalaqat.map((halaqah) => ({
        level_number: selectedLevel,
        halaqah,
        question: quizQuestion,
        options: quizOptions,
        correct_answer: correctAnswer,
      })),
    )

    if (error) {
      showNotification("حدث خطأ أثناء إضافة السؤال")
      return
    }

    setQuizQuestion("")
    setQuizOptions(["", "", "", ""])
    setCorrectAnswer(0)
    setShowQuizForm(false)
    await loadQuizzes()
    await notifyLevelUpdated("تمت إضافة السؤال")
  }

  async function handleDeleteQuiz(id: number) {
    if (isAllHalaqahSelected) {
      showNotification("اختر حلقة محددة إذا أردت حذف السؤال")
      return
    }

    const supabase = getSupabase()
    await supabase.from("pathway_level_questions").delete().eq("id", id)
    loadQuizzes()
  }

  async function handleAddLevel() {
    const targetHalaqah = String(newLevelHalaqah || selectedHalaqah || "").trim()
    const normalizedTitle = String(newLevelTitle || "").trim()
    const normalizedPoints = Number(newLevelPoints)

    if (!targetHalaqah) {
      showNotification("اختر الحلقة أولاً")
      return
    }

    if (!normalizedTitle) {
      showNotification("اكتب اسم المستوى")
      return
    }

    const targetHalaqat = targetHalaqah === ALL_HALAQAH_VALUE ? circles.map((circle) => circle.name) : [targetHalaqah]
    if (targetHalaqat.length === 0) {
      showNotification("لا توجد حلقات متاحة لإضافة المستوى")
      return
    }

    setIsAddingLevel(true)

    try {
      const createdLevels: Level[] = []

      for (const halaqah of targetHalaqat) {
        const response = await fetch("/api/pathway-levels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            halaqah,
            title: normalizedTitle,
            description: "",
            points: Number.isFinite(normalizedPoints) && normalizedPoints > 0 ? normalizedPoints : 100,
          }),
        })
        const data = await response.json().catch(() => null)

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "حدث خطأ أثناء إضافة المستوى")
        }

        if (data.level) {
          createdLevels.push(data.level as Level)
        }
      }

      const nextLevels = await loadLevels(selectedHalaqah)
      const nextSelectedLevel = createdLevels.find((item) => item.halaqah === selectedHalaqah) || createdLevels[0]
      if (nextSelectedLevel && nextLevels.some((item) => item.level_number === nextSelectedLevel.level_number)) {
        setSelectedLevel(nextSelectedLevel.level_number)
      }

      setShowAddLevelModal(false)
      setNewLevelTitle("")
      setNewLevelPoints(100)
      setNewLevelHalaqah(selectedHalaqah || "")
      showNotification(targetHalaqah === ALL_HALAQAH_VALUE ? "تمت إضافة المستوى لجميع الحلقات" : "تمت إضافة المستوى للحلقة المحددة")
    } catch (error) {
      showNotification(error instanceof Error ? error.message : "حدث خطأ أثناء إضافة المستوى")
    } finally {
      setIsAddingLevel(false)
    }
  }

  function openAddLevelModal() {
    setNewLevelTitle("")
    setNewLevelPoints(100)
    setNewLevelHalaqah(selectedHalaqah || circles[0]?.name || "")
    setShowAddLevelModal(true)
  }

  async function notifyLevelUpdated(prefixMessage: string) {
    if (!selectedHalaqah || !selectedLevel) {
      showNotification(prefixMessage)
      return
    }

    try {
      const targetHalaqat = isAllHalaqahSelected ? circles.map((circle) => circle.name) : [selectedHalaqah]
      let sentCount = 0

      for (const halaqah of targetHalaqat) {
        const response = await fetch("/api/pathway-level-notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            halaqah,
            level_number: selectedLevel,
          }),
        })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          const errorMessage = String(data?.error || "")
          if (response.status === 400 && errorMessage.includes("لن يتم إرسال التنبيه")) {
            continue
          }

          throw new Error(errorMessage || "تعذر إرسال تنبيه المسار")
        }

        sentCount += Number(data?.sent || 0)
      }

      showNotification(sentCount > 0 ? `${prefixMessage} وتم إشعار الطلاب تلقائيًا` : prefixMessage)
    } catch (error) {
      showNotification(error instanceof Error ? `${prefixMessage}، لكن ${error.message}` : prefixMessage)
    }
  }

  async function handleSaveNotificationTemplate() {
    try {
      setIsSavingNotificationTemplate(true)
      const normalizedTemplates = normalizePathwayLevelNotificationTemplates(notificationTemplates)
      const response = await fetch("/api/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: PATHWAY_LEVEL_NOTIFICATION_SETTINGS_ID,
          value: normalizedTemplates,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "تعذر حفظ قالب التنبيه")
      }

      setNotificationTemplates(normalizedTemplates)
      setShowNotificationTemplateModal(false)
      showNotification("تم حفظ قالب تنبيه المسار بنجاح")
    } catch (error) {
      showNotification(error instanceof Error ? error.message : "تعذر حفظ قالب التنبيه")
    } finally {
      setIsSavingNotificationTemplate(false)
    }
  }

  async function handleDeleteLevel(targetLevel: Level) {
    if (selectedHalaqah === ALL_HALAQAH_VALUE) {
      showNotification("اختر حلقة محددة لحذف مستوى")
      return
    }

    try {
      const response = await fetch("/api/pathway-levels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ halaqah: selectedHalaqah, levelNumber: targetLevel.level_number }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "تعذر حذف المستوى")
      }

      const nextLevels = levels.filter((item) => item.level_number !== targetLevel.level_number)
      setLevels(nextLevels)
      if (nextLevels.length > 0) {
        const nextSelectedLevel = nextLevels.some((item) => item.level_number === selectedLevel)
          ? selectedLevel
          : Math.max(...nextLevels.map((item) => item.level_number))
        setSelectedLevel(nextSelectedLevel)
      } else {
        setSelectedLevel(null)
      }

      showNotification("تم حذف المستوى")
    } catch (error) {
      showNotification("حدث خطأ أثناء حذف المستوى: " + (error instanceof Error ? error.message : "خطأ غير معروف"))
    }
  }

  async function handleToggleLockLevel(targetLevel: Level) {
    if (selectedHalaqah === ALL_HALAQAH_VALUE) {
      showNotification("اختر حلقة محددة لتعديل حالة المستوى")
      return
    }

    const supabase = getSupabase()
    const { error } = await supabase.from("pathway_levels").update({ is_locked: !targetLevel.is_locked }).eq("id", targetLevel.id)
    if (!error) {
      showNotification(targetLevel.is_locked ? "تم فتح المستوى بنجاح" : "تم قفل المستوى بنجاح")
      loadLevels()
    } else {
      showNotification("حدث خطأ أثناء تحديث حالة القفل")
    }
  }

  function openEditLevelModal(targetLevel: Level) {
    setSelectedLevel(targetLevel.level_number)
    setEditTitle(targetLevel.title || "")
    setEditDescription(targetLevel.description || "")
    setPointsEditValue(targetLevel.points || 0)
    setShowEditModal(true)
  }

  /* -------------------------------------------------------------------------- */

  const level = levels.find((l) => l.level_number === selectedLevel)
  const hasSelectedLevel = Boolean(level)
  const levelContents = hasSelectedLevel && selectedLevel !== null ? contents[selectedLevel] || [] : []
  const levelQuizzes = hasSelectedLevel && selectedLevel !== null ? quizzes[selectedLevel] || [] : []
  const canShowLevelDetails = Boolean(selectedHalaqah && hasSelectedLevel)

  const getContentTypeLabel = (type: LevelContent["content_type"]) => {
    if (type === "pdf") {
      return "PDF"
    }

    if (type === "video") {
      return "فيديو"
    }

    return "رابط"
  }

    if (authLoading || !authVerified) {
      return isEmbedded ? <div className="flex min-h-[60vh] items-center justify-center bg-[#fafaf9]"><SiteLoader size="md" /></div> : <SiteLoader fullScreen />
    }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#fafaf9]">
      {!isEmbedded ? <Header /> : null}

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 inset-x-0 mx-auto max-w-sm z-50 px-4">
          <div className="bg-white border border-[#3453a7]/40 rounded-xl px-5 py-3 shadow-lg text-sm font-medium text-[#1a2332] text-center">
            {notification}
          </div>
        </div>
      )}

      <main className="flex-1 py-10 px-4">
        <div className="container mx-auto max-w-4xl space-y-8">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h1 className="text-3xl font-black text-[#1a2332]">إدارة المسار</h1>
              {displayMode !== "inline" ? (
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Button type="button" onClick={() => { loadLevelResults(); setShowResultsModal(true); }} className="h-11 w-full rounded-2xl border border-[#3453a7] bg-[#3453a7] px-6 text-sm font-black text-white shadow-none hover:bg-[#2c478f] sm:w-auto">
                  نتائج المسار
                </Button>
                <Button type="button" onClick={openAddLevelModal} className="h-11 w-full rounded-2xl border border-[#3453a7] bg-[#3453a7] px-6 text-sm font-black text-white shadow-none hover:bg-[#2c478f] sm:w-auto">
                  إضافة
                </Button>
                <Button type="button" onClick={() => setShowNotificationTemplateModal(true)} className="inline-flex h-12 w-full items-center justify-center rounded-full border border-[#d8e5fb] bg-white px-5 text-sm font-bold text-[#3453a7] shadow-[0_10px_30px_rgba(52,83,167,0.08)] transition-all hover:bg-[#f6f9ff] sm:w-auto">
                  القالب
                </Button>
              </div>
              ) : null}
            </div>

            <div className="space-y-2 text-right">
              <Label className="text-sm font-black text-[#1a2332]">اختر الحلقة:</Label>
              <Select value={selectedHalaqah} onValueChange={(val) => { setSelectedHalaqah(val); setSelectedLevel(null); }} dir="rtl">
                <SelectTrigger className="w-full rounded-2xl border-[#d7e3f2] bg-white text-right md:w-[250px] [&>span]:w-full [&>span]:justify-end [&>span]:text-right flex-row-reverse">
                  <SelectValue placeholder="اختر الحلقة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value={ALL_HALAQAH_VALUE}>جميع الحلقات</SelectItem>
                  {circles.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[#e8eef8] px-4 py-4 md:px-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-xl font-black text-[#1a2332]">المستويات</h2>
                {hasSelectedLevel ? <div className="text-sm font-bold text-[#4f73d1]">المستوى المحدد: {level?.title}</div> : null}
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f8fbff] hover:bg-[#f8fbff]">
                    <TableHead className="text-right font-extrabold text-[#20335f]">المستوى</TableHead>
                    <TableHead className="text-right font-extrabold text-[#20335f]">الوصف</TableHead>
                    <TableHead className="text-right font-extrabold text-[#20335f]">النقاط</TableHead>
                    <TableHead className="text-right font-extrabold text-[#20335f]">الحالة</TableHead>
                    <TableHead className="text-center font-extrabold text-[#20335f]">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.length > 0 ? levels.map((l) => (
                    <TableRow key={l.id} onClick={() => setSelectedLevel(l.level_number)} className={l.level_number === selectedLevel ? "cursor-pointer bg-[#eef4ff] ring-1 ring-inset ring-[#c8d9ff]" : "cursor-pointer hover:bg-[#f8fbff]"}>
                      <TableCell className="text-right font-bold text-[#1a2332]">{l.title}</TableCell>
                      <TableCell className="text-right text-[#64748b]">{l.description || "-"}</TableCell>
                      <TableCell className="text-right text-[#1a2332]">{l.points}</TableCell>
                      <TableCell className="text-right text-[#1a2332]">{l.is_locked ? "مقفل" : "مفتوح"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" onClick={(event) => { event.stopPropagation(); void handleDeleteLevel(l) }} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50" aria-label="حذف المستوى">
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); openEditLevelModal(l) }} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8e5fb] bg-white text-[#3453a7] transition-colors hover:bg-[#f6f9ff]" aria-label="تعديل المستوى">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); void handleToggleLockLevel(l) }} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8e5fb] bg-white text-[#3453a7] transition-colors hover:bg-[#f6f9ff]" aria-label={l.is_locked ? "فتح المستوى" : "قفل المستوى"}>
                            {l.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-[#7b8aa0]">لا توجد مستويات بعد</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {canShowLevelDetails ? (
          <>
          <div className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[#e8eef8] px-4 py-4 md:px-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#1a2332]">محتوى المستوى</h2>
                  <p className="text-sm text-[#6c7d95]">ملفات وروابط تعليمية</p>
                </div>
              <button
                onClick={() => {
                  if (!hasSelectedLevel) {
                    showNotification("اختر مستوى أولاً")
                    return
                  }

                  setShowContentForm(!showContentForm)
                }}
                disabled={!hasSelectedLevel}
                className="h-10 rounded-2xl border border-[#3453a7] bg-[#3453a7] px-5 text-sm font-black text-white transition-colors hover:bg-[#2c478f] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#3453a7]"
              >
                إضافة محتوى
              </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-3">
              {!hasSelectedLevel && (
                <p className="text-sm text-neutral-400 text-center py-2">اختر مستوى أولاً لتتمكن من إضافة المحتوى.</p>
              )}

              {isAllHalaqahSelected && (
                <p className="text-sm text-[#4f73d1]">سيتم تطبيق المحتوى والأسئلة الجديدة على جميع الحلقات، بينما الحذف وتعديل بنية المستويات يتطلبان اختيار حلقة محددة.</p>
              )}

              {showContentForm && (
                <div className="space-y-3 p-4 bg-[#fafaf9] rounded-xl border border-[#3453a7]/20 mb-4">
                  <Input placeholder="عنوان المحتوى" value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} />
                  <Textarea placeholder="الوصف (اختياري)" value={contentDescription} onChange={(e) => setContentDescription(e.target.value)} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUploadMode("url")}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${uploadMode === "url" ? "border-[#3453a7] bg-white text-[#4f73d1]" : "border-neutral-200 bg-white text-neutral-500 hover:border-[#3453a7]/50"}`}
                    >
                      رابط
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("file")}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${uploadMode === "file" ? "border-[#3453a7] bg-white text-[#4f73d1]" : "border-neutral-200 bg-white text-neutral-500 hover:border-[#3453a7]/50"}`}
                    >
                      رفع ملف
                    </button>
                  </div>
                  {uploadMode === "url" ? (
                    <Input placeholder="الرابط" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} />
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#3453a7]/40 rounded-lg cursor-pointer bg-white hover:bg-[#f8fafc] transition-colors">
                      <input type="file" className="hidden" accept=".pdf,.mp4,.mov,.avi,.doc,.docx,.ppt,.pptx" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                      {selectedFile ? (
                        <span className="text-sm text-[#4f73d1] font-medium">{selectedFile.name}</span>
                      ) : (
                        <span className="text-sm text-neutral-400">اضغط لاختيار ملف</span>
                      )}
                    </label>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowContentForm(false)} className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-500 text-sm hover:bg-neutral-50 transition-colors">إلغاء</button>
                    <button
                      onClick={handleAddContent}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-lg border border-[#3453a7]/50 bg-white hover:bg-[#f8fafc] text-[#4f73d1] hover:text-[#3453a7] text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {isUploading ? "جاري الرفع..." : "حفظ"}
                    </button>
                  </div>
                </div>
              )}

              {levelContents.length === 0 && !showContentForm && (
                <p className="text-sm text-neutral-400 text-center py-6">لا يوجد محتوى لهذا المستوى</p>
              )}

              {levelContents.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#f8fbff] hover:bg-[#f8fbff]">
                        <TableHead className="text-right font-extrabold text-[#20335f]">العنوان</TableHead>
                        <TableHead className="text-right font-extrabold text-[#20335f]">النوع</TableHead>
                        <TableHead className="text-right font-extrabold text-[#20335f]">الرابط</TableHead>
                        <TableHead className="text-center font-extrabold text-[#20335f]">الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levelContents.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-right font-bold text-[#1a2332]">{c.content_title}</TableCell>
                          <TableCell className="text-right text-[#64748b]">{getContentTypeLabel(c.content_type)}</TableCell>
                          <TableCell className="text-right">
                            <a href={c.content_url} target="_blank" rel="noreferrer" className="text-[#3453a7] underline underline-offset-4">فتح</a>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button type="button" variant="outline" onClick={() => handleDeleteContent(c.id)} className="h-9 rounded-full border-[#d8e5fb] bg-white px-4 text-[#b91c1c] hover:bg-[#fff5f5]">حذف</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[#e8eef8] px-4 py-4 md:px-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-xl font-black text-[#1a2332]">الاختبار</h2>
              <button
                onClick={() => {
                  if (!hasSelectedLevel) {
                    showNotification("اختر مستوى أولاً")
                    return
                  }

                  setShowQuizForm(!showQuizForm)
                }}
                disabled={!hasSelectedLevel}
                className="h-10 rounded-2xl border border-[#3453a7] bg-[#3453a7] px-5 text-sm font-black text-white transition-colors hover:bg-[#2c478f] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#3453a7]"
              >
                إضافة سؤال
              </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-3">
              {!hasSelectedLevel && (
                <p className="text-sm text-neutral-400 text-center py-2">اختر مستوى أولاً لتتمكن من إضافة الأسئلة.</p>
              )}

              {showQuizForm && (
                <div className="space-y-3 p-4 bg-[#fafaf9] rounded-xl border border-[#3453a7]/20 mb-4">
                  <Input placeholder="السؤال" value={quizQuestion} onChange={(e) => setQuizQuestion(e.target.value)} />
                  {quizOptions.map((o, i) => (
                    <Input key={i} placeholder={`خيار ${i + 1}`} value={o} onChange={(e) => { const n = [...quizOptions]; n[i] = e.target.value; setQuizOptions(n) }} />
                  ))}
                  <Select value={String(correctAnswer)} onValueChange={(v) => setCorrectAnswer(Number(v))}>
                    <SelectTrigger className="border-[#3453a7]/30">
                      <SelectValue placeholder="الإجابة الصحيحة" />
                    </SelectTrigger>
                    <SelectContent>
                      {quizOptions.map((_, i) => (
                        <SelectItem key={i} value={String(i)}>الخيار {i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowQuizForm(false)} className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-500 text-sm hover:bg-neutral-50 transition-colors">إلغاء</button>
                    <button onClick={handleAddQuiz} className="px-4 py-2 rounded-lg border border-[#3453a7]/50 bg-white hover:bg-[#f8fafc] text-[#4f73d1] hover:text-[#3453a7] text-sm font-semibold transition-colors">حفظ السؤال</button>
                  </div>
                </div>
              )}

              {levelQuizzes.length === 0 && !showQuizForm && (
                <p className="text-sm text-neutral-400 text-center py-6">لا يوجد أسئلة لهذا المستوى</p>
              )}

              {levelQuizzes.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#f8fbff] hover:bg-[#f8fbff]">
                        <TableHead className="text-right font-extrabold text-[#20335f]">#</TableHead>
                        <TableHead className="text-right font-extrabold text-[#20335f]">السؤال</TableHead>
                        <TableHead className="text-right font-extrabold text-[#20335f]">الإجابة الصحيحة</TableHead>
                        <TableHead className="text-center font-extrabold text-[#20335f]">الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levelQuizzes.map((q, i) => (
                        <TableRow key={q.id}>
                          <TableCell className="text-right font-bold text-[#1a2332]">{i + 1}</TableCell>
                          <TableCell className="text-right font-bold text-[#1a2332]">{q.question}</TableCell>
                          <TableCell className="text-right text-[#64748b]">{q.options[q.correctAnswer] || `الخيار ${q.correctAnswer + 1}`}</TableCell>
                          <TableCell className="text-center">
                            <Button type="button" variant="outline" onClick={() => handleDeleteQuiz(q.id)} className="h-9 rounded-full border-[#d8e5fb] bg-white px-4 text-[#b91c1c] hover:bg-[#fff5f5]">حذف</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          </div>
          </>
          ) : (
          <div className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
            <div className="px-6 py-12 text-center text-sm font-bold text-[#7b8aa0]">
              {selectedHalaqah ? "اختر مستوى محددًا لعرض المحتوى والاختبار." : "اختر الحلقة أولاً ثم اختر مستوى محددًا لعرض المحتوى والاختبار."}
            </div>
          </div>
          )}

        </div>
      </main>

      {!isEmbedded ? <Footer /> : null}

      {showAddLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" dir="rtl">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#3453a7]/40 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2 text-[#1a2332]">
              <Plus className="h-5 w-5 text-[#3453a7]" />
              <h2 className="text-xl font-bold">إضافة مستوى</h2>
            </div>
            <div className="space-y-2 text-right">
              <Label className="text-sm font-black text-[#1a2332]">اسم المستوى</Label>
              <Input value={newLevelTitle} onChange={(event) => setNewLevelTitle(event.target.value)} placeholder="مثال: المستوى الأول" />
            </div>
            <div className="space-y-2 text-right">
              <Label className="text-sm font-black text-[#1a2332]">النقاط</Label>
              <Input type="number" min={1} value={newLevelPoints} onChange={(event) => setNewLevelPoints(Number(event.target.value))} placeholder="100" />
            </div>
            <div className="space-y-2 text-right">
              <Label className="text-sm font-black text-[#1a2332]">لأي حلقة</Label>
              <Select value={newLevelHalaqah} onValueChange={setNewLevelHalaqah} dir="rtl">
                <SelectTrigger className="w-full rounded-2xl border-[#d7e3f2] bg-white text-right [&>span]:w-full [&>span]:justify-end [&>span]:text-right flex-row-reverse">
                  <SelectValue placeholder="اختر الحلقة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value={ALL_HALAQAH_VALUE}>جميع الحلقات</SelectItem>
                  {circles.map((circle) => (
                    <SelectItem key={`pathway-add-level-${circle.id}`} value={circle.name}>{circle.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAddLevelModal(false)} className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-500 text-sm hover:bg-neutral-50 transition-colors">إلغاء</button>
              <button onClick={() => void handleAddLevel()} disabled={isAddingLevel} className="px-4 py-2 rounded-lg bg-[#3453a7] text-sm font-semibold text-white transition-colors hover:bg-[#274187] disabled:opacity-50">
                {isAddingLevel ? "جاري الإضافة..." : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Template Modal */}
      {showNotificationTemplateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30" dir="rtl">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl border border-[#3453a7]/40 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-[#1a2332]">
              <Bell className="w-5 h-5 text-[#3453a7]" />
              <h2 className="text-xl font-bold">قالب تنبيه المسار</h2>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#1a2332]">قالب إشعار تحديث المسار عند إضافة محتوى أو أسئلة جديدة</p>
              <Textarea
                value={notificationTemplates.publish}
                onChange={(e) => setNotificationTemplates((current) => ({ ...current, publish: e.target.value }))}
                placeholder="اكتب نص التنبيه هنا"
                className="min-h-32"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowNotificationTemplateModal(false)} className="h-11 rounded-2xl border border-[#d7e3f2] bg-white px-5 text-sm font-black text-[#1a2332] transition-colors hover:bg-[#f8fbff]">إلغاء</button>
              <button onClick={handleSaveNotificationTemplate} disabled={isSavingNotificationTemplate} className="h-11 rounded-2xl bg-[#3453a7] px-6 text-sm font-black text-white transition-colors hover:bg-[#274187] disabled:bg-[#3453a7] disabled:opacity-50">{isSavingNotificationTemplate ? "جاري الحفظ..." : "حفظ القالب"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Level Modal */}
      {showEditModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30" dir="rtl">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-[#3453a7]/40 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-[#1a2332]">تعديل المستوى</h2>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="اسم المستوى" />
            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="وصف المستوى" />
            <Input type="number" min={0} value={pointsEditValue} onChange={(e) => setPointsEditValue(Number(e.target.value))} placeholder="نقاط المستوى" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-500 text-sm hover:bg-neutral-50 transition-colors">إلغاء</button>
              <button onClick={async () => {
                if (level) {
                  if (isAllHalaqahSelected) {
                    showNotification("اختر حلقة محددة لتعديل المستوى")
                    return
                  }

                  const supabase = getSupabase()
                  await supabase.from("pathway_levels").update({ title: editTitle, description: editDescription, points: pointsEditValue }).eq("id", level.id)
                  setShowEditModal(false)
                  loadLevels()
                }
              }} className="px-4 py-2 rounded-lg border border-[#3453a7]/50 bg-white hover:bg-[#f8fafc] text-[#4f73d1] hover:text-[#3453a7] text-sm font-semibold transition-colors">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResultsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30" dir="rtl">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg border border-[#3453a7]/40 shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1a2332]">
                {selectedHalaqah === "all" ? "جميع الحلقات" : `حلقة ${selectedHalaqah}`}
              </h2>
            </div>

            <div className="overflow-y-auto pr-2 space-y-3">
              {isLoadingResults ? (
                <div className="flex justify-center items-center py-10">
                  <SiteLoader />
                </div>
              ) : levelResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-lg font-bold text-[#1a2332]">لا يوجد طلاب حاليا</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {levelResults.map((r, i) => (
                    <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-[#3453a7]/20 hover:bg-[#3453a7]/3 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#3453a7]/10 flex items-center justify-center font-bold text-[#3453a7] border border-[#3453a7]/20">
                          {i + 1}
                        </div>
                        <span className="font-medium text-[#1a2332]">{r.student_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3453a7]/10 border border-[#3453a7]/20">
                        <span className="text-[#3453a7] font-bold">{r.points}</span>
                        <span className="text-xs text-[#4f73d1] font-semibold">نقطة</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-neutral-100">
              <button 
                onClick={() => setShowResultsModal(false)}
                className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-500 text-sm hover:bg-neutral-50 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPathwaysPage() {
  return <PathwaysContent displayMode="page" />
}