import { NextResponse } from "next/server"

import { requireAdminPermission } from "@/lib/auth/guards"
import { createAdminClient } from "@/lib/supabase/admin"

type FinanceSection = "invoices" | "expenses" | "incomes" | "trips"

const FINANCE_SELECTS: Record<FinanceSection, string> = {
  invoices: "id, title, vendor, invoice_number, amount, issue_date, due_date, status",
  expenses: "id, title, beneficiary, payment_method, amount, expense_date",
  incomes: "id, title, source, amount, income_date",
  trips: "id, title, trip_date, costs",
}

const FINANCE_TABLES: Record<FinanceSection, string> = {
  invoices: "finance_invoices",
  expenses: "finance_expenses",
  incomes: "finance_incomes",
  trips: "finance_trips",
}

async function getActiveSemesterId(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from("semesters")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return String(data?.id || "")
}

function isFinanceSection(value: unknown): value is FinanceSection {
  return value === "invoices" || value === "expenses" || value === "incomes" || value === "trips"
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermission(request, "المالية")
    if ("response" in auth) {
      return auth.response
    }

    const supabase = createAdminClient()
    const activeSemesterId = await getActiveSemesterId(supabase)

    if (!activeSemesterId) {
      return NextResponse.json({
        activeSemesterId: "",
        invoices: [],
        expenses: [],
        incomes: [],
        trips: [],
      })
    }

    const [invoicesResult, expensesResult, incomesResult, tripsResult] = await Promise.all([
      supabase.from(FINANCE_TABLES.invoices).select(FINANCE_SELECTS.invoices).eq("semester_id", activeSemesterId).order("created_at", { ascending: false }),
      supabase.from(FINANCE_TABLES.expenses).select(FINANCE_SELECTS.expenses).eq("semester_id", activeSemesterId).order("created_at", { ascending: false }),
      supabase.from(FINANCE_TABLES.incomes).select(FINANCE_SELECTS.incomes).eq("semester_id", activeSemesterId).order("created_at", { ascending: false }),
      supabase.from(FINANCE_TABLES.trips).select(FINANCE_SELECTS.trips).eq("semester_id", activeSemesterId).order("created_at", { ascending: false }),
    ])

    if (invoicesResult.error) throw invoicesResult.error
    if (expensesResult.error) throw expensesResult.error
    if (incomesResult.error) throw incomesResult.error
    if (tripsResult.error) throw tripsResult.error

    return NextResponse.json({
      activeSemesterId,
      invoices: invoicesResult.data || [],
      expenses: expensesResult.data || [],
      incomes: incomesResult.data || [],
      trips: tripsResult.data || [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تحميل بيانات المالية" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermission(request, "المالية")
    if ("response" in auth) {
      return auth.response
    }

    const body = await request.json().catch(() => null)
    const section = body?.section
    const payload = body?.payload

    if (!isFinanceSection(section) || !payload || typeof payload !== "object") {
      return NextResponse.json({ error: "بيانات العملية غير صحيحة" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const activeSemesterId = await getActiveSemesterId(supabase)

    if (!activeSemesterId) {
      return NextResponse.json({ error: "لا يوجد فصل نشط" }, { status: 400 })
    }

    const insertPayload = { ...payload, semester_id: activeSemesterId }
    const { data, error } = await supabase
      .from(FINANCE_TABLES[section])
      .insert(insertPayload)
      .select(FINANCE_SELECTS[section])
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ record: data, activeSemesterId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر حفظ سجل المالية" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdminPermission(request, "المالية")
    if ("response" in auth) {
      return auth.response
    }

    const body = await request.json().catch(() => null)
    const section = body?.section
    const recordId = String(body?.recordId || "")

    if (!isFinanceSection(section) || !recordId) {
      return NextResponse.json({ error: "بيانات الحذف غير صحيحة" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from(FINANCE_TABLES[section]).delete().eq("id", recordId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر حذف سجل المالية" },
      { status: 500 },
    )
  }
}