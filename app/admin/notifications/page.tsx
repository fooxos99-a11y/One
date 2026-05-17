"use client"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SiteLoader } from "@/components/ui/site-loader"
import AdminNotificationsClient from "./admin-notifications-client"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { useSearchParams } from "next/navigation"

export function AdminNotificationsContent({ displayMode = "page" }: { displayMode?: "page" | "inline" }) {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("الإشعارات")
  const searchParams = useSearchParams()
  const isEmbedded = displayMode === "inline" || searchParams.get("embedded") === "1"

  if (authLoading || !authVerified) {
    return isEmbedded ? (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50"><SiteLoader size="md" /></div>
    ) : <SiteLoader fullScreen />
  }

  const content = <AdminNotificationsClient />

  if (isEmbedded) {
    return (
      <div className="min-h-full bg-slate-50 px-1 py-1 dir-rtl font-cairo">
        <div className="mx-auto max-w-6xl px-4 py-8">{content}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dir-rtl font-cairo">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-6xl">
        {content}
      </main>
      <Footer />
    </div>
  )
}

export default function AdminNotificationsPage() {
  return <AdminNotificationsContent displayMode="page" />
}
