"use client"

export function HeroSection() {
  return (
    <section id="home" className="landing-hero-surface relative flex min-h-[100svh] items-center overflow-hidden px-4 sm:px-6">
      <div
        className="landing-animate-spin absolute left-1/2 top-1/2 h-[34rem] w-[34rem] rounded-full border border-white/10"
        aria-hidden
      />
      <div
        className="landing-animate-float absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/8"
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,26,66,0.02) 0%, rgba(10,26,66,0.12) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.75) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden
      />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#203b7a]/28 to-transparent" aria-hidden />

      <div className="container relative z-10 mx-auto py-32 lg:py-0">
        <div className="mx-auto max-w-5xl text-center text-white">
          <div className="mx-auto mb-6 flex items-center justify-center">
            <img
              src="/%D8%B4%D8%B9%D8%A7%D8%B1-%D8%A7%D9%84%D8%AC%D9%85%D8%B9%D9%8A%D8%A9.png"
              alt="شعار الجمعية"
              width="118"
              height="112"
              decoding="async"
              fetchPriority="high"
              className="landing-logo-top h-24 w-auto object-contain sm:h-28 md:h-32"
            />
          </div>

          <div className="mx-auto mb-8 h-1 w-24 rounded-full bg-white/70" />

          <h1 className="mb-6 text-4xl font-extrabold leading-[1.15] drop-shadow-sm sm:text-5xl md:text-6xl lg:text-7xl">
            مجمع الملك خالد
          </h1>

          <p className="mx-auto mb-10 max-w-3xl text-base leading-loose text-white/85 sm:text-xl">
            مجمع الملك خالد لتحفيظ القران الكريم يسعى لتقديم بيئة تربوية متميزة تجمع بين الأصالة والمعاصرة.
            نهدف إلى تخريج جيل قرآني متقن لكتاب الله، ملتزم بتعاليمه، قادر على خدمة دينه ومجتمعه. مع التركيز
            على الجودة والإتقان والمتابعة المستمرة لكل طالب.
          </p>
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-24"
        style={{ background: "linear-gradient(to top, rgba(232,238,247,0.88) 0%, transparent 100%)" }}
      />    </section>
  )
}