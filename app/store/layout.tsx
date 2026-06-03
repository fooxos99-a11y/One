"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SiteLoader } from "@/components/ui/site-loader"
import { useVerifiedRoleAccess } from "@/hooks/use-verified-role-access"

export default function StoreLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isLoading, isAuthorized } = useVerifiedRoleAccess(["student"])
  const [isStoreOpen, setIsStoreOpen] = useState(true)
  const [isStoreStatusResolved, setIsStoreStatusResolved] = useState(false)

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!isAuthorized) {
      setIsStoreStatusResolved(true)
      return
    }

    let cancelled = false

    const loadStoreStatus = async () => {
      setIsStoreStatusResolved(false)
      try {
        const response = await fetch("/api/store/status", { cache: "no-store" })
        const data = response.ok ? await response.json().catch(() => null) : null
        const nextIsOpen = data?.isOpen !== false

        if (cancelled) {
          return
        }

        setIsStoreOpen(nextIsOpen)
        if (!nextIsOpen) {
          router.replace("/")
        }
      } catch {
        if (!cancelled) {
          setIsStoreOpen(true)
        }
      } finally {
        if (!cancelled) {
          setIsStoreStatusResolved(true)
        }
      }
    }

    void loadStoreStatus()

    return () => {
      cancelled = true
    }
  }, [isAuthorized, isLoading, router])

  if (isLoading || !isStoreStatusResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
        <SiteLoader size="lg" />
      </div>
    )
  }

  if (!isAuthorized || !isStoreOpen) {
    return null
  }

  return <>{children}</>
}