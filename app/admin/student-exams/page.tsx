import { redirect } from "next/navigation"

export default function AdminStudentExamsPage({
  searchParams,
}: {
  searchParams?: {
    embedded?: string
  }
}) {
  const params = new URLSearchParams()
  params.set("action", "student-exams")

  if (searchParams?.embedded === "1") {
    params.set("embedded", "1")
  }

  redirect(`/admin/exams?${params.toString()}`)
}