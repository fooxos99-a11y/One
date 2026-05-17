"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SiteLoader } from "@/components/ui/site-loader"
import { useAdminAuth } from "@/hooks/use-admin-auth"

export default function AdminEntryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoading, isVerified } = useAdminAuth()

  useEffect(() => {
    if (isLoading || !isVerified) {
      return
    }

    const query = searchParams?.toString()

    if (query) {
      router.replace(`/admin/dashboard?target=${encodeURIComponent(`/admin?${query}`)}`)
      return
    }

    router.replace("/admin/dashboard")
  }, [isLoading, isVerified, router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]" dir="rtl">
      <SiteLoader size="md" />
    </div>
  )
}