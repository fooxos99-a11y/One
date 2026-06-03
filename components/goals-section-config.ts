import type { LucideIcon } from "lucide-react"
import { Award, BookOpen, BookOpenCheck, GraduationCap, Medal, Star, Trophy, Users } from "lucide-react"

import { DEFAULT_GOALS_SECTION_SETTINGS } from "@/lib/site-settings-constants"

export type GoalItem = {
  icon: string
  value: string
  label: string
  caption: string
}

export const ICON_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "users", label: "طلاب", icon: Users },
  { value: "graduation-cap", label: "تخرج", icon: GraduationCap },
  { value: "book-open-check", label: "حفظ", icon: BookOpenCheck },
  { value: "award", label: "جوائز", icon: Award },
  { value: "trophy", label: "كأس", icon: Trophy },
  { value: "medal", label: "ميدالية", icon: Medal },
  { value: "star", label: "نجمة", icon: Star },
  { value: "book-open", label: "كتاب", icon: BookOpen },
]

export const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map((option) => [option.value, option.icon])) as Record<string, LucideIcon>

export function normalizeGoalItems(value: unknown): GoalItem[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_GOALS_SECTION_SETTINGS]
  }

  const items = value
    .map((item) => {
      const candidate = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
      return {
        icon: String(candidate.icon || "users").trim() || "users",
        value: String(candidate.value || "").trim(),
        label: String(candidate.label || "").trim(),
        caption: String(candidate.caption || "").trim(),
      }
    })
    .filter((item) => item.value && item.label && item.caption)

  return items.length === DEFAULT_GOALS_SECTION_SETTINGS.length ? items : [...DEFAULT_GOALS_SECTION_SETTINGS]
}