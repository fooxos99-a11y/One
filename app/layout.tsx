import type React from "react"
import type { Metadata, Viewport } from "next"
import { Cairo } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ConfirmDialogProvider } from "@/hooks/use-confirm-dialog"
import { GlobalAdminModals } from '@/components/global-admin-modals'
import { NotificationPermissionPrompt } from "@/components/notification-permission-prompt"
import { NativeNotificationBridge } from "@/components/native-notification-bridge"
import { PwaRegistration } from "@/components/pwa-registration"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://habiib.org"),
  title: "مجمع الملك خالد",
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  applicationName: "مجمع الملك خالد",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "مجمع الملك خالد",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3453a7",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <head />
      <body className="antialiased" suppressHydrationWarning>
        <PwaRegistration />
        <NativeNotificationBridge />
        <NotificationPermissionPrompt />
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        <GlobalAdminModals />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
