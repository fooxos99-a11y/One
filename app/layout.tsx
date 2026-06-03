import type React from "react"
import type { Metadata, Viewport } from "next"
import { Cairo } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ConfirmDialogProvider } from "@/hooks/use-confirm-dialog"
import { DeferredGlobalEnhancements } from "@/components/deferred-global-enhancements"
import { SiteDesignApplier } from "@/components/site-design-applier"
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
        <SiteDesignApplier />
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        <DeferredGlobalEnhancements />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}