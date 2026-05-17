"use client"

import { useEffect, useState } from "react"
import { TeacherAttendanceModal } from "./teacher-attendance-modal"
import { getSaudiDateString } from "@/lib/saudi-time"

interface TeacherAttendanceCheckProps {
  teacherId?: string
  teacherName?: string
  accountNumber?: number
  triggerFromLogin?: boolean
}

export function TeacherAttendanceCheck({
  teacherId,
  teacherName,
  accountNumber,
  triggerFromLogin = false,
}: TeacherAttendanceCheckProps) {
  const [showModal, setShowModal] = useState(false)
  const [localTeacherId, setLocalTeacherId] = useState(teacherId)
  const [localTeacherName, setLocalTeacherName] = useState(teacherName)
  const [localAccountNumber, setLocalAccountNumber] = useState(accountNumber)

  useEffect(() => {
    setLocalTeacherId(teacherId)
    setLocalTeacherName(teacherName)
    setLocalAccountNumber(accountNumber)

    const checkDailyAttendance = async () => {
      if (!teacherId) return

      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true"
      const userRole = localStorage.getItem("userRole")
      const today = getSaudiDateString()

      if (isLoggedIn && (userRole === "teacher" || userRole === "deputy_teacher")) {
        try {
          const response = await fetch(`/api/teacher-attendance?teacher_id=${teacherId}&date=${today}`, { cache: "no-store" })
          const data = await response.json()

          setShowModal(!data.exists)
        } catch (error) {
          console.error("[v0] Error checking daily attendance:", error)
        }
      }
    }

    void checkDailyAttendance()
  }, [accountNumber, teacherId, teacherName, triggerFromLogin])

  if (!localTeacherId) {
    return null
  }

  return (
    <TeacherAttendanceModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      teacherId={localTeacherId}
      teacherName={localTeacherName || ""}
      accountNumber={localAccountNumber || 0}
    />
  )
}
