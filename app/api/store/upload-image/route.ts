import { NextResponse } from "next/server"

import { requireAdminPermission } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveStoreImageSrc } from "@/lib/store-images"

const STORE_PRODUCTS_BUCKET = "store-products"
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

async function ensureStoreProductsBucket() {
  const supabase = createAdminClient()
  const { data: bucket, error } = await supabase.storage.getBucket(STORE_PRODUCTS_BUCKET)

  if (bucket) {
    return supabase
  }

  if (error && !String(error.message || "").toLowerCase().includes("not found")) {
    throw error
  }

  const { error: createError } = await supabase.storage.createBucket(STORE_PRODUCTS_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_IMAGE_SIZE}`,
    allowedMimeTypes: ALLOWED_IMAGE_TYPES,
  })

  if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
    throw createError
  }

  return supabase
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermission(request, "إدارة المتجر")
    if ("response" in auth) {
      return auth.response
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "لم يتم اختيار صورة" }, { status: 400 })
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "نوع الصورة غير مدعوم" }, { status: 400 })
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "حجم الصورة كبير جدًا" }, { status: 400 })
    }

    const supabase = await ensureStoreProductsBucket()
    const extension = file.name.split(".").pop() || "png"
    const fileName = `product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from(STORE_PRODUCTS_BUCKET)
      .upload(fileName, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      console.error("[store-upload][POST][upload]", uploadError)
      return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 500 })
    }

    return NextResponse.json({ url: resolveStoreImageSrc(`store-products/${fileName}`) })
  } catch (error) {
    console.error("[store-upload][POST]", error)
    return NextResponse.json({ error: "حدث خطأ أثناء رفع الصورة" }, { status: 500 })
  }
}