"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SiteLoader } from "@/components/ui/site-loader"
import { useToast } from "@/hooks/use-toast"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { buildSiteDesignCssVariables, normalizeSiteDesignSettings, type SiteDesignSettings } from "@/lib/site-design"
import { DEFAULT_SITE_DESIGN_SETTINGS, SITE_DESIGN_SETTINGS_ID } from "@/lib/site-settings-constants"
import { Palette, RotateCcw, Save } from "lucide-react"

type SiteDesignField = {
  key: keyof SiteDesignSettings
  label: string
}

type SiteDesignSection = {
  title: string
  fields: SiteDesignField[]
}

const DESIGN_SECTIONS: SiteDesignSection[] = [
  {
    title: "الأزرار والعناوين",
    fields: [
      { key: "primary", label: "الزر الأساسي" },
      { key: "primaryDark", label: "تدرج الزر" },
      { key: "heading", label: "العناوين" },
    ],
  },
  {
    title: "الهيدر والحدود",
    fields: [
      { key: "headerBackground", label: "خلفية الهيدر" },
      { key: "headerText", label: "نص وأيقونات الهيدر" },
      { key: "headerBorder", label: "حدود الهيدر" },
      { key: "border", label: "الحدود العامة" },
    ],
  },
  {
    title: "الخلفية والتدرج",
    fields: [
      { key: "heroStart", label: "الهيرو 1" },
      { key: "heroMid", label: "الهيرو 2" },
      { key: "heroEnd", label: "الهيرو 3" },
      { key: "pageGlow", label: "الوهج" },
      { key: "pageTop", label: "الخلفية 1" },
      { key: "pageMiddle", label: "الخلفية 2" },
      { key: "pageBottom", label: "الخلفية 3" },
    ],
  },
]

function ColorField({
  field,
  value,
  normalizedValue,
  onChange,
}: {
  field: SiteDesignField
  value: string
  normalizedValue: string
  onChange: (nextValue: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-[var(--border)] bg-white px-3 py-3 text-right shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <input
          type="color"
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-12 cursor-pointer rounded-xl border border-[var(--border)] bg-white p-1"
          aria-label={field.label}
        />
        <div className="min-w-0 flex-1">
          <Label className="block truncate text-sm font-black text-[#1a2332]">{field.label}</Label>
        </div>
      </div>
      <div className="w-[126px] shrink-0">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-xl border-[var(--border)] text-left font-mono"
          dir="ltr"
        />
      </div>
    </div>
  )
}

export function SiteDesignContent({ displayMode = "page" }: { displayMode?: "page" | "inline" }) {
  const router = useRouter()
  const { toast } = useToast()
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("تصميم الموقع")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formValues, setFormValues] = useState<SiteDesignSettings>(DEFAULT_SITE_DESIGN_SETTINGS)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(`/api/site-settings?id=${encodeURIComponent(SITE_DESIGN_SETTINGS_ID)}`, {
          cache: "no-store",
        })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.error || "تعذر تحميل إعدادات تصميم الموقع")
        }

        setFormValues(normalizeSiteDesignSettings(data.value))
      } catch (error) {
        toast({
          title: "خطأ",
          description: error instanceof Error ? error.message : "تعذر تحميل إعدادات التصميم",
          variant: "destructive",
        })
        setFormValues(DEFAULT_SITE_DESIGN_SETTINGS)
      } finally {
        setIsLoading(false)
      }
    }

    void loadSettings()
  }, [toast])

  const normalizedPreview = useMemo(() => normalizeSiteDesignSettings(formValues), [formValues])
  const previewVars = useMemo(() => buildSiteDesignCssVariables(normalizedPreview), [normalizedPreview])

  const updateField = (key: keyof SiteDesignSettings, value: string) => {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async () => {
    const normalizedValue = normalizeSiteDesignSettings(formValues)

    try {
      setIsSaving(true)

      const response = await fetch("/api/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: SITE_DESIGN_SETTINGS_ID,
          value: normalizedValue,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || "تعذر حفظ تصميم الموقع")
      }

      setFormValues(normalizedValue)
      router.refresh()
      toast({ title: "تم الحفظ", description: "تم تحديث ألوان الموقع العامة بنجاح" })
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "تعذر حفظ تصميم الموقع",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setFormValues(DEFAULT_SITE_DESIGN_SETTINGS)
  }

  if (authLoading || isLoading || !authVerified) {
    return (
      <div className={`${displayMode === "inline" ? "min-h-[60vh]" : "min-h-screen"} flex items-center justify-center bg-white`}>
        <SiteLoader size="lg" />
      </div>
    )
  }

  const content = (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-right">
          <h1 className="flex items-center justify-start gap-3 text-3xl font-black text-[#1a2332] md:text-4xl">
            <Palette className="h-8 w-8 text-[var(--primary)]" />
            تصميم الموقع
          </h1>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="h-11 rounded-2xl border-[var(--border)] bg-white px-5 text-sm font-black text-[#1a2332] hover:bg-[var(--button-outline-hover)]"
          >
            <RotateCcw className="me-2 h-4 w-4" />
            استعادة الافتراضي
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-11 rounded-2xl bg-[var(--button-gradient)] px-6 text-sm font-black text-white hover:brightness-105 disabled:opacity-70"
          >
            <Save className="me-2 h-4 w-4" />
            {isSaving ? "جاري الحفظ..." : "حفظ التصميم"}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-[30px] border-[var(--border)] bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
        <CardContent>
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_340px]">
            <div
              className="px-6 py-8 text-white"
              style={{ backgroundImage: previewVars["--landing-hero"] }}
            >
              <div className="max-w-2xl text-right">
                <div className="text-sm font-bold text-white/80">معاينة</div>
                <div className="mt-4 flex flex-wrap justify-end gap-3">
                  <button type="button" className="rounded-full px-5 py-2 text-sm font-black text-white" style={{ backgroundColor: normalizedPreview.primary }}>
                    الزر الأساسي
                  </button>
                  <button type="button" className="rounded-full border px-5 py-2 text-sm font-black text-white" style={{ borderColor: "rgba(255,255,255,0.35)" }}>
                    الزر الثانوي
                  </button>
                </div>
                <div className="mt-6 rounded-[24px] border bg-white/12 p-4 backdrop-blur-sm" style={{ borderColor: "rgba(255,255,255,0.18)" }}>
                  <div className="text-lg font-black" style={{ color: normalizedPreview.headerText }}>الهيدر</div>
                  <div className="mt-3 flex items-center justify-between rounded-[18px] border px-4 py-3" style={{ borderColor: normalizedPreview.headerBorder, backgroundColor: normalizedPreview.headerBackground }}>
                    <div className="h-9 w-9 rounded-full border" style={{ borderColor: normalizedPreview.border }} />
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-14 rounded-full bg-white/70" />
                      <div className="h-3 w-24 rounded-full bg-white/45" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] p-5">
              {[
                { label: "الزر الأساسي", value: normalizedPreview.primary },
                { label: "الزر الثانوي", value: normalizedPreview.primaryDark },
                { label: "العناوين", value: normalizedPreview.heading },
                { label: "نص وأيقونات الهيدر", value: normalizedPreview.headerText },
                { label: "الحدود", value: normalizedPreview.border },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-[20px] border border-white/80 bg-white/88 px-4 py-3 text-right shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-[#64748b]">{item.label}</div>
                    <div className="mt-1 font-mono text-sm text-[#1a2332]">{item.value}</div>
                  </div>
                  <span className="h-10 w-10 rounded-2xl border border-white" style={{ backgroundColor: item.value }} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {DESIGN_SECTIONS.map((section) => (
          <Card key={section.title} className="rounded-[28px] border-[var(--border)] bg-white shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
            <CardHeader className="pb-3 text-right">
              <CardTitle className="text-lg font-black text-[#1a2332]">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.fields.map((field) => (
                <ColorField
                  key={field.key}
                  field={field}
                  value={formValues[field.key]}
                  normalizedValue={normalizedPreview[field.key]}
                  onChange={(nextValue) => updateField(field.key, nextValue)}
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  if (displayMode === "inline") {
    return <div className="min-h-full bg-white px-4 py-6 md:px-6 md:py-8">{content}</div>
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="px-4 py-8 md:px-6 md:py-10">{content}</main>
      <Footer />
    </div>
  )
}

export default function SiteDesignPage() {
  return <SiteDesignContent displayMode="page" />
}