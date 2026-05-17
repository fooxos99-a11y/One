import { BookOpen, Sparkles, Target } from "lucide-react"

export function AboutSection() {
  const highlights = [
    {
      title: "عناية تربوية",
      description: "بيئة تحتضن الطالب بالقيم، والانضباط، والرعاية اليومية.",
      icon: Sparkles,
    },
    {
      title: "متابعة مستمرة",
      description: "قياس متدرج للأداء مع ملاحظة دائمة وتوجيه واضح.",
      icon: Target,
    },
    {
      title: "إتقان في الحفظ والتلاوة",
      description: "تركيز على جودة التلاوة وثبات الحفظ قبل الانتقال للمرحلة التالية.",
      icon: BookOpen,
    },
  ]

  return (
    <section id="about" className="relative overflow-hidden py-20 sm:py-24 lg:py-28">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-[#3453a7]/12 bg-white/55 px-4 py-2 text-sm font-extrabold text-[#3453a7] shadow-[0_10px_30px_rgba(52,83,167,0.08)] backdrop-blur-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3453a7]" />
            لمحة عن المجمع
          </div>

          <p className="mx-auto mt-8 max-w-4xl text-lg leading-9 text-[#4d586c] sm:text-xl sm:leading-10">
            مجمع الملك خالد لتحفيظ القرآن الكريم يقدّم بيئة تعليمية وتربوية تجمع بين العناية، الإتقان،
            والمتابعة المستمرة؛ بهدف إعداد طالب متقن لكتاب الله، راسخ في قيمه، نافع لدينه ومجتمعه.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {highlights.map((highlight) => {
              const Icon = highlight.icon

              return (
                <div
                  key={highlight.title}
                  className="group relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,255,0.92))] p-6 text-center shadow-[0_18px_44px_rgba(19,39,89,0.08)] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(52,83,167,0.35),transparent)]" />
                  <div className="flex justify-center">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#24428f_0%,#3453a7_55%,#4f73d1_100%)] text-white shadow-[0_14px_28px_rgba(52,83,167,0.22)]">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>

                  <h3 className="mt-5 text-xl font-black text-[#20335f]">{highlight.title}</h3>
                  <p className="mt-3 text-base leading-8 text-[#5f6b80]">{highlight.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
