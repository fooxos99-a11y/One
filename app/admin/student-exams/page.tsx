import { redirect } from "next/navigation"

export default function AdminStudentExamsPage() {
  redirect("/admin/exams?action=student-exams")
}