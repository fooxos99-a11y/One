"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Save, Users, X } from "lucide-react"

import { ICON_MAP, ICON_OPTIONS, normalizeGoalItems, type GoalItem } from "@/components/goals-section-config"

export function GoalsSectionEditor({ initialItems }: { initialItems: GoalItem[] }) {
  const router = useRouter()
  const [canEdit, setCanEdit] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draftItems, setDraftItems] = useState<GoalItem[]>(initialItems)

  useEffect(() => {
    try {
      const accountNumber = Number(localStorage.getItem("accountNumber") || localStorage.getItem("account_number") || 0)
      setCanEdit(accountNumber === 2)
    } catch {
      setCanEdit(false)
    }
  }, [])

  const handleDraftChange = (index: number, field: keyof GoalItem, value: string) => {
    setDraftItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  const handleOpenDialog = () => {
    setDraftItems(initialItems)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch("/api/goals-section", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: draftItems }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(String(data?.error || "فشل في الحفظ"))
      }

      setDraftItems(normalizeGoalItems(data?.items))
      setIsDialogOpen(false)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "فشل في حفظ التعديلات")
    } finally {
      setIsSaving(false)
    }
  }

  if (!canEdit) {
    return null
  }

  return (
    <>
      <div className="mb-8 flex justify-center sm:justify-end">
        <button
          type="button"
          onClick={handleOpenDialog}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-[0_18px_40px_rgba(3,16,46,0.16)] backdrop-blur-md transition hover:bg-white/15"
        >
          <Pencil className="h-4 w-4" />
          تعديل البطاقات
        </button>
      </div>

      {isDialogOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/60 px-4 py-8" dir="rtl">
          <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#dbe6fb] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.32)]">
            <div className="flex items-center justify-between border-b border-[#e5ecf8] px-6 py-5">
              <div>
                <h3 className="text-xl font-black text-[#1a2332]">تعديل بطاقات إنجازتنا</h3>
                <p className="mt-1 text-sm text-[#66758a]">تستطيع تعديل الاسم والأيقونة والرقم لكل بطاقة.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d8e5fb] text-[#526071] transition hover:bg-[#f8fbff]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              {draftItems.map((item, index) => (
                <div key={`draft-${index}`} className="rounded-[1.5rem] border border-[#e4ecf8] bg-[#f8fbff] p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#3453a7] shadow-sm">
                      {(() => {
                        const Icon = ICON_MAP[item.icon] || Users
                        return <Icon className="h-5 w-5" />
                      })()}
                    </span>
                    <div className="text-sm font-black text-[#1a2332]">البطاقة {index + 1}</div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#506074]">الأيقونة</label>
                      <select
                        value={item.icon}
                        onChange={(event) => handleDraftChange(index, "icon", event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#cfdbf1] bg-white px-4 text-sm text-[#1a2332] outline-none transition focus:border-[#3453a7]"
                      >
                        {ICON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#506074]">العنوان</label>
                      <input
                        value={item.label}
                        onChange={(event) => handleDraftChange(index, "label", event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#cfdbf1] bg-white px-4 text-sm text-[#1a2332] outline-none transition focus:border-[#3453a7]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#506074]">الرقم</label>
                      <input
                        value={item.value}
                        onChange={(event) => handleDraftChange(index, "value", event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#cfdbf1] bg-white px-4 text-sm text-[#1a2332] outline-none transition focus:border-[#3453a7]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#506074]">المسمى المختصر</label>
                      <input
                        value={item.caption}
                        onChange={(event) => handleDraftChange(index, "caption", event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#cfdbf1] bg-white px-4 text-sm text-[#1a2332] outline-none transition focus:border-[#3453a7]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#e5ecf8] px-6 py-5">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#d8e5fb] px-6 text-sm font-bold text-[#526071] transition hover:bg-[#f8fbff]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#3453a7] px-6 text-sm font-bold text-white transition hover:bg-[#28448e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}