import { redirect } from "next/navigation"

export default async function AdminStudentExamsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    embedded?: string
  }>
}) {
  const resolvedSearchParams = await searchParams
  const target = "/admin/dashboard?action=student-exams"
  const params = new URLSearchParams()
  params.set("target", target)

  if (resolvedSearchParams?.embedded === "1") {
    params.set("embedded", "1")
  }

  redirect(`/admin/dashboard?${params.toString()}`)
}