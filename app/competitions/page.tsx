"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Gamepad2, Grid3x3, Loader2, Puzzle, Trophy } from "lucide-react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
const games = [
  {
    id: "categories",
    title: "لعبة الفئات",
    description: "مواجهة سريعة بين فريقين عبر فئات متنوعة وأسئلة متدرجة.",    icon: Grid3x3,
    available: true,
    path: "/competitions/categories",
  },
  {
    id: "auction",
    title: "لعبة المزاد",
    description: "تحدي قائم على النقاط والأسئلة العشوائية مع قرارات أسرع أثناء اللعب.",    icon: Gamepad2,
    available: true,
    path: "/competitions/auction",
  },
  {
    id: "guess-images",
    title: "خمن الصورة",
    description: "اكتشف معنى الصورة قبل الفريق الآخر واحصد التقدم في الجولة.",    icon: Puzzle,
    available: true,
    path: "/competitions/guess-images",
  },
  {
    id: "letter-hive",
    title: "خلية الحروف",
    description: "سباق تعاوني تنافسي لتوصيل اللون من الجهتين والفوز بالمسار.",    icon: Grid3x3,
    available: true,
    path: "/competitions/letter-hive/teams",
  },
  {
    id: "millionaire-game",
    title: "من سيربح المليون",
    description: "أسئلة متدرجة الصعوبة في تجربة جماعية مستوحاة من نمط المسابقات الكبرى.",    icon: Trophy,
    available: true,
    path: "/competitions/millionaire-game",
  },
  {
    id: "higher-lower",
    title: "أعلى أو أقل",
    description: "تحدي تخمين سريع يعتمد على المقارنة واتخاذ القرار في الوقت المناسب.",    icon: Puzzle,
    available: false,
    path: "/competitions/higher-lower",
  },
]

export default function CompetitionsPage() {
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    games.forEach((game) => {
      if (game.available) {
        router.prefetch(game.path)
      }
    })
  }, [router])

  const handleGameNavigation = (path: string, gameId: string) => {
    if (loadingGameId) {
      return
    }

    setLoadingGameId(gameId)
    requestAnimationFrame(() => {
      router.push(path)
    })
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[linear-gradient(180deg,#f6f9ff_0%,#eef4ff_38%,#ffffff_100%)]">
      <Header />

      <main className="flex-1 px-4 pb-16 pt-8 sm:px-6 lg:pt-10">
        <div className="container mx-auto max-w-6xl">
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {games.map((game) => (
              <button
                key={game.id}
                disabled={!game.available || loadingGameId !== null}
                onClick={() => handleGameNavigation(game.path, game.id)}
                className={`group relative overflow-hidden rounded-[2rem] border p-6 text-right shadow-[0_20px_55px_rgba(19,39,89,0.10)] transition-all duration-300 ${
                  game.available && loadingGameId === null
                    ? "cursor-pointer border-[#dbe6fb] bg-white/90 hover:-translate-y-1.5 hover:border-[#3453a7]/35 hover:shadow-[0_26px_70px_rgba(19,39,89,0.14)]"
                    : "cursor-not-allowed border-[#e6ebf5] bg-white/75 opacity-70"
                }`}
              >
                <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#3453a7]/20 to-transparent" />

                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,#24428f_0%,#3453a7_55%,#4f73d1_100%)] text-white shadow-[0_16px_32px_rgba(52,83,167,0.24)]">
                    <game.icon className="h-8 w-8" />
                  </div>

                  {game.available ? (
                    <span className="rounded-full bg-[#edf3ff] px-3 py-1 text-xs font-black text-[#3453a7]">متاحة الآن</span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-400">قريبًا</span>
                  )}
                </div>

                <h2 className="text-2xl font-black text-[#1a2332] transition-colors duration-300 group-hover:text-[#3453a7]">{game.title}</h2>
                <p className="mt-3 min-h-16 text-sm leading-7 text-[#5b6475] sm:text-base">{game.description}</p>

                <div className="mt-6 flex items-center justify-between border-t border-[#edf1f8] pt-4">
                  {game.available && loadingGameId === game.id ? (
                    <div className="flex items-center gap-2 text-sm font-bold text-[#3453a7]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري التحميل...
                    </div>
                  ) : (
                    <span className={`text-sm font-bold ${game.available ? "text-[#3453a7]" : "text-neutral-400"}`}>
                      {game.available ? "ابدأ الآن" : "انتظر الإطلاق"}
                    </span>
                  )}

                  {game.available ? (
                    <ChevronLeft className="h-5 w-5 text-[#3453a7] transition-transform duration-300 group-hover:-translate-x-1" />
                  ) : null}
                </div>
              </button>
            ))}
          </section>        </div>
      </main>

      <Footer />
    </div>
  )
}