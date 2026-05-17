"use client"

const AUTH_STORAGE_KEYS = [
  "isLoggedIn",
  "userRole",
  "account_number",
  "accountNumber",
  "userName",
  "studentName",
  "studentId",
  "userHalaqah",
  "currentUser",
]

export function clearClientAuthState() {
  try {
    for (const key of AUTH_STORAGE_KEYS) {
      localStorage.removeItem(key)
      localStorage.removeItem(`${key}:ts`)
    }

    sessionStorage.clear()
  } catch {
    // Ignore storage cleanup failures during logout.
  }
}

export async function performClientLogout(redirectPath: string) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null
  const timeoutId = controller
    ? window.setTimeout(() => {
        controller.abort()
      }, 1500)
    : null

  try {
    await fetch("/api/auth", {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
      signal: controller?.signal,
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch {
    // Continue clearing client state even if the request fails.
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }
    clearClientAuthState()
    window.location.replace(redirectPath)
  }
}