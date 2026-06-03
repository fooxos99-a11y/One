"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { User } from "lucide-react"

const LANDING_LINKS = [
  { label: "الرئيسية", href: "#home" },
  { label: "الإنجازات", href: "#achievements" },
  { label: "من نحن", href: "#about" },
  { label: "تواصل معنا", href: "#contact" },
] as const

export function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    let animationFrameId = 0

    const syncScrollState = () => {
      setIsScrolled(window.scrollY > 16)
    }

    const handleScroll = () => {
      if (animationFrameId) {
        return
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0
        syncScrollState()
      })
    }

    syncScrollState()
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  return (
    <header data-scrolled={isScrolled ? "true" : "false"} className="site-header fixed inset-x-0 top-0 z-50">
      <div className="container mx-auto flex h-20 items-center justify-between gap-4 px-4">
        <Link href="/" className="site-header-brand relative z-20 inline-flex min-w-0 items-center gap-3" aria-label="العودة إلى الرئيسية">
          <Image
            src="/%D8%B4%D8%B9%D8%A7%D8%B1-%D8%A7%D9%84%D8%AC%D9%85%D8%B9%D9%8A%D8%A9.png"
            alt="شعار الجمعية"
            width={42}
            height={42}
            className="site-header-brand-logo h-9 w-9 object-contain"
            priority
          />
          <div className="min-w-0 whitespace-nowrap text-right text-[0.92rem] font-black leading-tight">
            مجمع الملك خالد
          </div>
        </Link>

        <nav className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-7 lg:gap-10">
            {LANDING_LINKS.map((item) => (
              <a key={item.label} href={item.href} className="site-header-nav-button">
                {item.label}
              </a>
            ))}
            <Link href="/halaqat/all" className="site-header-nav-button">
              أفضل الحلقات
            </Link>
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/halaqat/all"
            className="site-header-mobile-button inline-flex items-center justify-center rounded-full px-4 text-sm font-black md:hidden"
          >
            الحلقات
          </Link>
          <Link
            href="/login"
            className="site-header-user-button"
            aria-label="تسجيل الدخول"
          >
            <User size={20} />
          </Link>
        </div>
      </div>
    </header>
  )
}