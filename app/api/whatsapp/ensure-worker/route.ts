import fs from "fs"
import path from "path"
import { spawn } from "child_process"
import { NextResponse } from "next/server"
import { requireRoles } from "@/lib/auth/guards"
import { readWhatsAppWorkerStatus } from "@/lib/whatsapp-worker-status"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const PROJECT_ROOT = process.cwd()
const WORKER_ENTRY_PATH = path.join(PROJECT_ROOT, "whatsapp-worker", "index.js")
const LOCAL_ENV_PATH = path.join(PROJECT_ROOT, ".env.local-worker")

function sanitizeInstanceSlug(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getSupabaseProjectRef(url: string | undefined) {
  try {
    const hostname = new URL(String(url || "")).hostname
    return hostname.split(".")[0] || null
  } catch {
    return null
  }
}

function getDefaultInstanceSlug() {
  const explicitSlug = sanitizeInstanceSlug(process.env.WHATSAPP_INSTANCE_SLUG)
  if (explicitSlug) {
    return explicitSlug
  }

  const configuredClientId = sanitizeInstanceSlug(process.env.WHATSAPP_CLIENT_ID)
  if (configuredClientId) {
    return configuredClientId
  }

  const projectRef = sanitizeInstanceSlug(process.env.SUPABASE_PROJECT_REF || getSupabaseProjectRef(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL))
  if (projectRef) {
    return projectRef
  }

  const portToken = sanitizeInstanceSlug(process.env.PORT)
  if (portToken) {
    return `port-${portToken}`
  }

  return "default"
}

function resolveWorkerPath(configuredPath: string | undefined, fallbackPath: string) {
  const candidate = String(configuredPath || "").trim()
  if (!candidate) {
    return fallbackPath
  }

  return path.isAbsolute(candidate) ? candidate : path.resolve(PROJECT_ROOT, candidate)
}

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getRunningWorkerPid(lockFilePath: string) {
  try {
    if (!fs.existsSync(lockFilePath)) {
      return null
    }

    const rawLock = fs.readFileSync(lockFilePath, "utf8")
    const payload = rawLock.trim() ? JSON.parse(rawLock) : {}
    const pid = Number(payload.pid)
    return isProcessAlive(pid) ? pid : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const auth = await requireRoles(request, ["admin", "supervisor"])
  if ("response" in auth) {
    return auth.response
  }

  try {
    if (process.env.VERCEL) {
      return NextResponse.json({ error: "التشغيل التلقائي للعامل المحلي غير متاح على Vercel" }, { status: 409 })
    }

    if (!fs.existsSync(WORKER_ENTRY_PATH)) {
      return NextResponse.json({ error: "ملف عامل واتساب غير موجود" }, { status: 404 })
    }

    if (!fs.existsSync(LOCAL_ENV_PATH)) {
      return NextResponse.json({ error: "ملف .env.local-worker غير موجود" }, { status: 409 })
    }

    const status = await readWhatsAppWorkerStatus()
    if (status.workerOnline) {
      return NextResponse.json({ success: true, alreadyRunning: true })
    }

    const instanceSlug = getDefaultInstanceSlug()
    const lockFilePath = resolveWorkerPath(
      process.env.WHATSAPP_LOCK_FILE_PATH,
      path.join(PROJECT_ROOT, "whatsapp-worker", `worker-${instanceSlug}.lock`),
    )

    const existingPid = getRunningWorkerPid(lockFilePath)
    if (existingPid) {
      return NextResponse.json({ success: true, alreadyRunning: true, pid: existingPid })
    }

    const child = spawn(process.execPath, [WORKER_ENTRY_PATH], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        WORKER_ENV_FILE: ".env.local-worker",
        WHATSAPP_WORKER_MODE: "local",
        WHATSAPP_DEVICE_LABEL: process.env.WHATSAPP_DEVICE_LABEL || "الجهاز الحالي",
      },
    })

    child.unref()

    return NextResponse.json({ success: true, started: true, pid: child.pid ?? null })
  } catch (error) {
    console.error("[WhatsApp] Ensure worker error:", error)
    return NextResponse.json({ error: "تعذر تشغيل عامل واتساب المحلي تلقائياً" }, { status: 500 })
  }
}