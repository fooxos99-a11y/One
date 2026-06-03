"use client"

import { useEffect } from "react"
import { buildSiteDesignCssVariables, DEFAULT_SITE_DESIGN_PRESET_ID, SITE_DESIGN_PRESETS, SITE_DESIGN_UPDATED_EVENT, type SiteDesignSettings } from "@/lib/site-design"

type SiteDesignResponse = {
  settings?: SiteDesignSettings
}

const SITE_DESIGN_CACHE_KEY = "site-design-settings"
const SITE_DESIGN_CACHE_MAX_AGE_MS = 15 * 60 * 1000

function applySiteDesign(settings: SiteDesignSettings) {
  const root = document.documentElement
  const cssVariables = buildSiteDesignCssVariables(settings)

  for (const [name, value] of Object.entries(cssVariables)) {
    root.style.setProperty(name, value)
  }
}

function readCachedSiteDesign() {
  try {
    const rawSettings = localStorage.getItem(SITE_DESIGN_CACHE_KEY)
    const rawTimestamp = localStorage.getItem(`${SITE_DESIGN_CACHE_KEY}:ts`)
    if (!rawSettings || !rawTimestamp) return null
    if (Date.now() - Number(rawTimestamp) > SITE_DESIGN_CACHE_MAX_AGE_MS) return null
    const parsed = JSON.parse(rawSettings) as SiteDesignSettings
    return parsed
  } catch {
    return null
  }
}

function writeCachedSiteDesign(settings: SiteDesignSettings) {
  try {
    localStorage.setItem(SITE_DESIGN_CACHE_KEY, JSON.stringify(settings))
    localStorage.setItem(`${SITE_DESIGN_CACHE_KEY}:ts`, Date.now().toString())
  } catch {}
}

export function SiteDesignApplier() {
  useEffect(() => {
    let disposed = false

    const applyLatestSiteDesign = async () => {
      try {
        const response = await fetch("/api/site-design", { cache: "force-cache" })
        const data = (await response.json().catch(() => null)) as SiteDesignResponse | null

        if (!response.ok || !data?.settings || disposed) {
          throw new Error("Failed to load site design")
        }

        writeCachedSiteDesign(data.settings)
        applySiteDesign(data.settings)
      } catch {
        if (!disposed) {
          applySiteDesign(SITE_DESIGN_PRESETS[DEFAULT_SITE_DESIGN_PRESET_ID].settings)
        }
      }
    }

    const handleSiteDesignUpdate = () => {
      void applyLatestSiteDesign()
    }

    const cachedSettings = readCachedSiteDesign()
    if (cachedSettings) {
      applySiteDesign(cachedSettings)
    }

    void applyLatestSiteDesign()
    window.addEventListener(SITE_DESIGN_UPDATED_EVENT, handleSiteDesignUpdate)

    return () => {
      disposed = true
      window.removeEventListener(SITE_DESIGN_UPDATED_EVENT, handleSiteDesignUpdate)
    }
  }, [])

  return null
}