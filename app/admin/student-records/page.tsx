"use client"

import { useEffect, useMemo, useState } from "react"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { SiteLoader } from "@/components/ui/site-loader"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminAuth } from "@/hooks/use-admin-auth"
import { formatQuranRange } from "@/lib/quran-data"
import { translateAttendanceStatus } from "@/lib/student-attendance"

interface Circle {
  id: string
  name: string
}

interface Student {
  id: string
  name: string
  halaqah?: string | null
  circle_name?: string | null
}

interface StudentRecord {
  id: string
  date: string
  status: string | null
  createdAt?: string | null
  notes?: string | null
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

const getStudentCircleName = (student: Student) => String(student.halaqah || student.circle_name || "").trim()

function translateLevel(level: string | null | undefined) {
  if (!level) return "—"
  if (level === "excellent") return "ممتاز"
  if (level === "very_good") return "جيد جدًا"
  if (level === "good") return "جيد"
  if (level === "not_completed") return "لم يكمل"
  return level
}

function formatRecordDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function StudentRecordsPage() {
  return <StudentRecordsContent displayMode="page" />
}

export function StudentRecordsContent({ displayMode = "page" }: { displayMode?: "page" | "inline" }) {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("سجلات الطلاب")
  const [circles, setCircles] = useState<Circle[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<StudentRecord[]>([])
  const [selectedCircle, setSelectedCircle] = useState("")
  const [selectedStudent, setSelectedStudent] = useState("")
  const [isBootLoading, setIsBootLoading] = useState(true)
  const [isRecordsLoading, setIsRecordsLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [circlesResponse, studentsResponse] = await Promise.all([
          fetch("/api/circles", { cache: "no-store" }),
          fetch("/api/students", { cache: "no-store" }),
        ])

        const circlesPayload = await circlesResponse.json()
        const studentsPayload = await studentsResponse.json()

        setCircles(Array.isArray(circlesPayload.circles) ? circlesPayload.circles : [])
        setStudents(Array.isArray(studentsPayload.students) ? studentsPayload.students : [])
      } catch (error) {
        console.error("Error fetching student-records filters:", error)
        setCircles([])
        setStudents([])
      } finally {
        setIsBootLoading(false)
      }
    }

    if (!authLoading && authVerified) {
      void fetchData()
    }
  }, [authLoading, authVerified])

  useEffect(() => {
    if (!selectedStudent) {
      setRecords([])
      return
    }

    const fetchRecords = async () => {
      try {
        setIsRecordsLoading(true)
        const response = await fetch(`/api/student-records?studentId=${encodeURIComponent(selectedStudent)}`, { cache: "no-store" })
        const payload = await response.json()
        setRecords(Array.isArray(payload.records) ? payload.records : [])
      } catch (error) {
        console.error("Error fetching student records:", error)
        setRecords([])
      } finally {
        setIsRecordsLoading(false)
      }
    }

    void fetchRecords()
  }, [selectedStudent])

  const filteredStudents = useMemo(
    () => students.filter((student) => getStudentCircleName(student) === selectedCircle),
    [selectedCircle, students],
  )

  if (authLoading || !authVerified || isBootLoading) {
    return (
      <div className={`${displayMode === "inline" ? "min-h-[320px]" : "min-h-screen"} flex items-center justify-center bg-[#fafaf9]`}>
        <SiteLoader size="md" />
      </div>
    )
  }

  return (
    <div className={`${displayMode === "inline" ? "bg-transparent" : "min-h-screen bg-[#f7f9fd]"} flex flex-col`} dir="rtl">
      {displayMode === "inline" ? null : <Header />}
      <main className={`flex-1 ${displayMode === "inline" ? "px-0 py-0" : "px-4 py-6 md:px-6 md:py-10"}`}>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="rounded-[1.9rem] border border-[#edf2fb] bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:px-7 md:py-7">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <div className="text-lg font-semibold text-[#1a2332]">الحلقة</div>
                <Select
                  value={selectedCircle}
                  onValueChange={(value) => {
                    setSelectedCircle(value)
                    setSelectedStudent("")
                    setRecords([])
                  }}
                  dir="rtl"
                >
                  <SelectTrigger className="h-14 rounded-[1.25rem] border-[#cfdcf4] bg-white px-5 text-lg focus:border-[#bfd0ea]">
                    <SelectValue placeholder="اختر الحلقة" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {circles.map((circle) => (
                      <SelectItem key={circle.id} value={circle.name}>
                        {circle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="text-lg font-semibold text-[#1a2332]">الطالب</div>
                <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={!selectedCircle} dir="rtl">
                  <SelectTrigger className="h-14 rounded-[1.25rem] border-[#cfdcf4] bg-white px-5 text-lg focus:border-[#bfd0ea]">
                    <SelectValue placeholder={selectedCircle ? "اختر الطالب" : "اختر الحلقة أولاً"} />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {filteredStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 space-y-4 border-t border-[#dfe7f5]/70 pt-6">
              {isRecordsLoading ? (
                <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] bg-[#fbfdff]">
                  <SiteLoader size="md" />
                </div>
              ) : !selectedStudent ? (
                <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] bg-[#fbfdff] px-6 text-center text-lg text-[#8b97aa]">
                  اختر الحلقة ثم الطالب لعرض السجلات السابقة.
                </div>
              ) : records.length === 0 ? (
                <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] bg-[#fbfdff] px-6 text-center text-2xl text-[#8b97aa]">
                  لا توجد سجلات سابقة لهذا الطالب
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((record) => {
                    const hafizRange = formatQuranRange(record.hafiz_from_surah, record.hafiz_from_verse, record.hafiz_to_surah, record.hafiz_to_verse)
                    const samaaRange = formatQuranRange(record.samaa_from_surah, record.samaa_from_verse, record.samaa_to_surah, record.samaa_to_verse)
                    const rabetRange = formatQuranRange(record.rabet_from_surah, record.rabet_from_verse, record.rabet_to_surah, record.rabet_to_verse)

                    return (
                      <div key={record.id} className="rounded-[1.35rem] border border-[#e0e9f8] bg-[#fbfdff] px-4 py-4 shadow-[0_8px_24px_rgba(52,83,167,0.05)]">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#e7eef9] pb-3">
                          <div className="text-base font-black text-[#1a2332]">{formatRecordDate(record.date)}</div>
                          <div className="rounded-full bg-[#edf4ff] px-3 py-1 text-sm font-bold text-[#3453a7]">{translateAttendanceStatus(record.status) || "—"}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div className="rounded-2xl border border-[#e7eef9] bg-white px-3 py-3 text-center">
                            <div className="text-xs font-bold text-[#7d8ca3]">الحفظ</div>
                            <div className="mt-1 text-sm font-black text-[#1a2332]">{translateLevel(record.hafiz_level)}</div>
                            {hafizRange ? <div className="mt-1 text-[11px] leading-5 text-[#7d8ca3]">{hafizRange}</div> : null}
                          </div>
                          <div className="rounded-2xl border border-[#e7eef9] bg-white px-3 py-3 text-center">
                            <div className="text-xs font-bold text-[#7d8ca3]">التكرار</div>
                            <div className="mt-1 text-sm font-black text-[#1a2332]">{translateLevel(record.tikrar_level)}</div>
                          </div>
                          <div className="rounded-2xl border border-[#e7eef9] bg-white px-3 py-3 text-center">
                            <div className="text-xs font-bold text-[#7d8ca3]">التسميع</div>
                            <div className="mt-1 text-sm font-black text-[#1a2332]">{translateLevel(record.samaa_level)}</div>
                            {samaaRange ? <div className="mt-1 text-[11px] leading-5 text-[#7d8ca3]">{samaaRange}</div> : null}
                          </div>
                          <div className="rounded-2xl border border-[#e7eef9] bg-white px-3 py-3 text-center">
                            <div className="text-xs font-bold text-[#7d8ca3]">الربط</div>
                            <div className="mt-1 text-sm font-black text-[#1a2332]">{translateLevel(record.rabet_level)}</div>
                            {rabetRange ? <div className="mt-1 text-[11px] leading-5 text-[#7d8ca3]">{rabetRange}</div> : null}
                          </div>
                        </div>

                        {record.notes ? (
                          <div className="mt-3 rounded-2xl bg-[#f4f7fc] px-4 py-3 text-sm text-[#5f6e84]">
                            {record.notes}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      {displayMode === "inline" ? null : <Footer />}
    </div>
  )
}
