import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

type EvaluationRow = {
	hafiz_level?: string | null
	tikrar_level?: string | null
	samaa_level?: string | null
	rabet_level?: string | null
	hafiz_from_surah?: string | null
	hafiz_from_verse?: string | null
	hafiz_to_surah?: string | null
	hafiz_to_verse?: string | null
	samaa_from_surah?: string | null
	samaa_from_verse?: string | null
	samaa_to_surah?: string | null
	samaa_to_verse?: string | null
	rabet_from_surah?: string | null
	rabet_from_verse?: string | null
	rabet_to_surah?: string | null
	rabet_to_verse?: string | null
}

type AttendanceRow = {
	id: string
	date: string
	status: string | null
	created_at: string | null
	notes: string | null
	evaluations: EvaluationRow[] | EvaluationRow | null
}

function getEvaluationRecord(value: AttendanceRow["evaluations"]): EvaluationRow {
	if (Array.isArray(value)) {
		return value[0] ?? {}
	}

	return value ?? {}
}

export async function GET(request: Request) {
	const url = new URL(request.url)
	const studentId = url.searchParams.get("studentId")

	if (!studentId) {
		return NextResponse.json({ error: "studentId is required" }, { status: 400 })
	}

	const supabase = await createClient()

	const { data, error } = await supabase
		.from("attendance_records")
		.select(`
			id,
			date,
			status,
			created_at,
			notes,
			evaluations (
				hafiz_level,
				tikrar_level,
				samaa_level,
				rabet_level,
				hafiz_from_surah,
				hafiz_from_verse,
				hafiz_to_surah,
				hafiz_to_verse,
				samaa_from_surah,
				samaa_from_verse,
				samaa_to_surah,
				samaa_to_verse,
				rabet_from_surah,
				rabet_from_verse,
				rabet_to_surah,
				rabet_to_verse
			)
		`)
		.eq("student_id", studentId)
		.order("date", { ascending: false })

	if (error) {
		return NextResponse.json({ error: "تعذر جلب سجلات الطالب" }, { status: 500 })
	}

	const records = ((data ?? []) as AttendanceRow[]).map((record) => ({
		id: record.id,
		date: record.date,
		status: record.status,
		createdAt: record.created_at,
		notes: record.notes,
		...getEvaluationRecord(record.evaluations),
	}))

	return NextResponse.json({ records })
}