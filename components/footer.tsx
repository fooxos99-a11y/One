"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Phone, Mail, MapPin } from "lucide-react"

export function Footer() {
  const searchParams = useSearchParams()
  const isEmbedded = searchParams?.get("embedded") === "1"

  if (isEmbedded) {
    return null
  }

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[linear-gradient(135deg,#20335f_0%,#2b4691_54%,#3453a7_100%)] pt-16 pb-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_36%)]" aria-hidden />
      <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="container relative mx-auto px-4">
        <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <h3 className="mb-6 text-2xl font-black text-white">من نحن</h3>
            <p className="text-base leading-8 text-white/80">              مجمع الملك خالد لتحفيظ القرآن الكريم، يسعى لتقديم بيئة تربوية متميزة تجمع بين الأصالة والمعاصرة.
              نهدف إلى تخريج جيل قرآني متقن لكتاب الله، ملتزم بتعاليمه، قادر على خدمة دينه ومجتمعه. مع التركيز على
              الجودة والإتقان والمتابعة المستمرة لكل طالب.
            </p>
          </div>

          <div className="flex justify-start md:justify-center">
            <div>
              <h3 className="mb-6 text-right text-xl font-black text-white md:text-center">روابط سريعة</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/" className="text-white/80 transition-colors hover:text-white">                    الرئيسية
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-white/80 transition-colors hover:text-white">                    شروط الخدمة
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-white/80 transition-colors hover:text-white">                    سياسة الخصوصية
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-white/80 transition-colors hover:text-white">                    اتصل بنا
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="mb-6 text-xl font-black text-white">تواصل معنا</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-white/80">
                <Phone className="h-5 w-5 text-white" />
                <span>789 456 123+</span>
              </li>
              <li className="flex items-center gap-3 text-white/80">
                <Mail className="h-5 w-5 text-white" />
                <span>info@example.com</span>
              </li>
              <li className="flex items-center gap-3 text-white/80">
                <MapPin className="h-5 w-5 text-white" />                <span>السعودية، بريدة</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15 pt-6 text-center text-sm text-white/65">
          جميع الحقوق محفوظة لمجمع الملك خالد لتحفيظ القرآن الكريم
        </div>
      </div>
    </footer>
  )
}