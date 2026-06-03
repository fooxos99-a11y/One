"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const PwaRegistration = dynamic(() => import("@/components/pwa-registration").then((module) => module.PwaRegistration), {
  ssr: false,
})
const NativeNotificationBridge = dynamic(
  () => import("@/components/native-notification-bridge").then((module) => module.NativeNotificationBridge),
  { ssr: false },
)
const NotificationPermissionPrompt = dynamic(
  () => import("@/components/notification-permission-prompt").then((module) => module.NotificationPermissionPrompt),
  { ssr: false },
)
const Toaster = dynamic(() => import("@/components/ui/toaster").then((module) => module.Toaster), {
  ssr: false,
})

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
  cancelIdleCallback?: (handle: number) => void
}

export function DeferredGlobalEnhancements() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const currentWindow = window as WindowWithIdleCallback

    if (typeof currentWindow.requestIdleCallback === "function") {
      const idleId = currentWindow.requestIdleCallback(() => setIsReady(true), { timeout: 1500 })
      return () => {
        currentWindow.cancelIdleCallback?.(idleId)
      }
    }

    const timeoutId = window.setTimeout(() => setIsReady(true), 300)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  if (!isReady) {
    return null
  }

  return (
    <>
      <PwaRegistration />
      <NativeNotificationBridge />
      <NotificationPermissionPrompt />
      <Toaster />
    </>
  )
}