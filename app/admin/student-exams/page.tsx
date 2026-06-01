import { redirect } from "next/navigation"

export default async function AdminStudentExamsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    embedded?: string
  }>
}) {
  const resolvedSearchParams = await searchParams
  const params = new URLSearchParams()
  params.set("action", "student-exams")

  if (resolvedSearchParams?.embedded === "1") {
    params.set("embedded", "1")
  }

  redirect(`/admin/exams?${params.toString()}`)
}