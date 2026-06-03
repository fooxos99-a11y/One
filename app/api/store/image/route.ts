import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

const STORE_PRODUCTS_BUCKET = "store-products"

export async function GET(request: NextRequest) {
  try {
    const imagePath = request.nextUrl.searchParams.get("path")?.trim() || ""
    if (!imagePath) {
      return NextResponse.json({ error: "الصورة غير محددة" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.storage.from(STORE_PRODUCTS_BUCKET).download(imagePath)

    if (error || !data) {
      return new NextResponse(null, { status: 404 })
    }

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}