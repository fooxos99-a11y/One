"use client"

import type React from "react"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useAlertDialog } from "@/hooks/use-confirm-dialog"
import { getOfflineErrorMessage } from "@/lib/network-error"

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showAlert = useAlertDialog()

  useEffect(() => {
    const userRole = localStorage.getItem("userRole")
    const userName = localStorage.getItem("userName")

    if (userRole && userName) {
      setFormData((prev) => ({ ...prev, name: userName }))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await showAlert("لا يوجد اتصال بالإنترنت", "خطأ")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        await showAlert("تم إرسال رسالتك بنجاح!", "نجاح")
        setFormData({ name: "", subject: "", message: "" })
      } else {
        await showAlert(data.error || "حدث خطأ أثناء إرسال الرسالة", "خطأ")
      }
    } catch (error) {
      console.error("[v0] Error submitting form:", error)
      await showAlert(getOfflineErrorMessage(error) || "حدث خطأ أثناء إرسال الرسالة", "خطأ")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="contact" className="relative overflow-hidden py-20 sm:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3453a7]/15 to-transparent" />
      <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-[#8fb0ff]/10 blur-3xl" aria-hidden />
      <div className="absolute left-0 bottom-0 h-56 w-56 rounded-full bg-[#3453a7]/10 blur-3xl" aria-hidden />

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-14">
          <h2 className="text-3xl font-black leading-tight text-[#1a2332] sm:text-4xl md:text-5xl">
            تواصل معنا
          </h2>
        </div>

        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_24px_60px_rgba(19,39,89,0.12)] backdrop-blur-sm sm:p-10 lg:p-12">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div>
              <label htmlFor="contact-name" className="mb-2 block text-sm font-bold text-[#1a2332] sm:text-base">
                الاسم <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="contact-name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="أدخل اسمك"
                className="w-full rounded-2xl border border-[#d8e3fb] bg-[#fbfcff] px-4 py-3 text-[#1a2332] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#3453a7]"
              />
            </div>

            <div>
              <label htmlFor="contact-subject" className="mb-2 block text-sm font-bold text-[#1a2332] sm:text-base">
                موضوع الرسالة <span className="text-red-500">*</span>
              </label>
              <select
                id="contact-subject"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full rounded-2xl border border-[#d8e3fb] bg-[#fbfcff] px-4 py-3 text-[#1a2332] outline-none transition-colors focus:border-[#3453a7]"
              >
                <option value="">اختر موضوع الرسالة</option>
                <option value="inquiry">استفسار عام</option>
                <option value="registration">التسجيل في الحلقات</option>
                <option value="programs">الاستفسار عن البرامج</option>
                <option value="complaint">شكوى أو اقتراح</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className="mb-2 block text-sm font-bold text-[#1a2332] sm:text-base">
                الرسالة <span className="text-red-500">*</span>
              </label>
              <textarea
                id="contact-message"
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="اكتب رسالتك هنا"
                rows={5}
                className="min-h-[150px] w-full resize-none rounded-2xl border border-[#d8e3fb] bg-[#fbfcff] px-4 py-3 text-[#1a2332] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#3453a7]"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#24428f_0%,#3453a7_55%,#4f73d1_100%)] text-base font-extrabold text-white shadow-lg transition-all duration-300 hover:brightness-105 disabled:opacity-50"
            >
              {isSubmitting ? "جاري الإرسال..." : "إرسال الرسالة"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  )
}