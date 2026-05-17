"use client"

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Award, BookOpen, BookOpenCheck, GraduationCap, Medal, Pencil, Save, Star, Trophy, Users, X } from 'lucide-react'

import { DEFAULT_GOALS_SECTION_SETTINGS } from '@/lib/site-settings-constants'

type GoalItem = {
  icon: string
  value: string
  label: string
  caption: string
}

const ICON_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'users', label: 'طلاب', icon: Users },
  { value: 'graduation-cap', label: 'تخرج', icon: GraduationCap },
  { value: 'book-open-check', label: 'حفظ', icon: BookOpenCheck },
  { value: 'award', label: 'جوائز', icon: Award },
  { value: 'trophy', label: 'كأس', icon: Trophy },
  { value: 'medal', label: 'ميدالية', icon: Medal },
  { value: 'star', label: 'نجمة', icon: Star },
  { value: 'book-open', label: 'كتاب', icon: BookOpen },
]

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map((option) => [option.value, option.icon])) as Record<string, LucideIcon>

function normalizeItems(value: unknown): GoalItem[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_GOALS_SECTION_SETTINGS]
  }

  const items = value
    .map((item) => {
      const candidate = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return {
        icon: String(candidate.icon || 'users').trim() || 'users',
        value: String(candidate.value || '').trim(),
        label: String(candidate.label || '').trim(),
        caption: String(candidate.caption || '').trim(),
      }
    })
    .filter((item) => item.value && item.label && item.caption)

  return items.length === DEFAULT_GOALS_SECTION_SETTINGS.length ? items : [...DEFAULT_GOALS_SECTION_SETTINGS]
}

export function GoalsSection() {
  const [items, setItems] = useState<GoalItem[]>([...DEFAULT_GOALS_SECTION_SETTINGS])
  const [draftItems, setDraftItems] = useState<GoalItem[]>([...DEFAULT_GOALS_SECTION_SETTINGS])
  const [canEdit, setCanEdit] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSection() {
      try {
        const isLoggedIn = typeof window !== 'undefined' && localStorage.getItem('isLoggedIn') === 'true'
        const [sectionResponse, authResponse] = await Promise.all([
          fetch('/api/goals-section', { cache: 'no-store' }),
          isLoggedIn ? fetch('/api/auth', { cache: 'no-store' }).catch(() => null) : Promise.resolve(null),
        ])

        if (!cancelled && sectionResponse.ok) {
          const sectionData = await sectionResponse.json()
          const nextItems = normalizeItems(sectionData?.items)
          setItems(nextItems)
          setDraftItems(nextItems)
        }

        if (!cancelled && authResponse?.ok) {
          const authData = await authResponse.json()
          setCanEdit(Number(authData?.user?.accountNumber) === 2)
        }
      } catch {
        if (!cancelled) {
          setItems([...DEFAULT_GOALS_SECTION_SETTINGS])
          setDraftItems([...DEFAULT_GOALS_SECTION_SETTINGS])
        }
      }
    }

    void loadSection()

    return () => {
      cancelled = true
    }
  }, [])

  const handleDraftChange = (index: number, field: keyof GoalItem, value: string) => {
    setDraftItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  const handleOpenDialog = () => {
    setDraftItems(items)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/goals-section', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: draftItems }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(String(data?.error || 'فشل في الحفظ'))
      }

      const nextItems = normalizeItems(data?.items)
      setItems(nextItems)
      setDraftItems(nextItems)
      setIsDialogOpen(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'فشل في حفظ التعديلات')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section id="achievements" className="relative overflow-hidden py-20 sm:py-24">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0f2f6d_0%,#1f4d9a_58%,#2e7fb6_100%)]" aria-hidden />
      <div className="absolute inset-0 opacity-[0.08]" aria-hidden style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
      <div className="absolute -right-24 top-10 h-72 w-72 rounded-full border border-white/10" aria-hidden />
      <div className="absolute -left-20 bottom-10 h-56 w-56 rounded-full border border-white/10" aria-hidden />

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center text-white sm:mb-16">
          <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl md:text-5xl">
            إنجازتنا
          </h2>
        </div>

        {canEdit ? (
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
        ) : null}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {items.map((item, index) => {
            const Icon = ICON_MAP[item.icon] || Users

            return (
            <div
              key={`${item.label}-${index}`}
              className="rounded-[2rem] border border-white/12 bg-white/10 px-6 py-8 text-center shadow-[0_24px_60px_rgba(3,16,46,0.14)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-1.5 hover:bg-white/[0.14] sm:px-7"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]">
                <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>

              <p className="mb-4 text-sm font-bold text-white/80 sm:text-base">{item.label}</p>
              <p className="text-4xl font-black tracking-[0.04em] text-white sm:text-5xl">{item.value}</p>
              <p className="mt-3 text-sm font-medium text-white/60">{item.caption}</p>
            </div>
            )
          })}
        </div>
      </div>

      {canEdit && isDialogOpen ? (
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
                        onChange={(event) => handleDraftChange(index, 'icon', event.target.value)}
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
                        onChange={(event) => handleDraftChange(index, 'label', event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#cfdbf1] bg-white px-4 text-sm text-[#1a2332] outline-none transition focus:border-[#3453a7]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#506074]">الرقم</label>
                      <input
                        value={item.value}
                        onChange={(event) => handleDraftChange(index, 'value', event.target.value)}
                        className="h-12 w-full rounded-2xl border border-[#cfdbf1] bg-white px-4 text-sm text-[#1a2332] outline-none transition focus:border-[#3453a7]"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-[#506074]">المسمى المختصر</label>
                      <input
                        value={item.caption}
                        onChange={(event) => handleDraftChange(index, 'caption', event.target.value)}
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
                {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
